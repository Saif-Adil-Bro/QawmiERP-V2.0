-- Staging diagnostic after the parity migration. One tenant ($1); one SELECT.
-- Do not call portal_locked_metadata: that helper intentionally takes a write lock.
-- Only counts leave the database. Invalid JSON, non-array collections or nonnumeric
-- amounts are read failures, never a reason to substitute an empty ledger.
WITH store AS (
  SELECT coalesce(metadata, '{}'::jsonb) AS dedicated, registration_no AS raw,
         CASE WHEN left(ltrim(registration_no), 1) = '{' THEN registration_no::jsonb ELSE '{}'::jsonb END AS overlay
  FROM public.madrasas WHERE id = $1::uuid
), document AS (
  SELECT dedicated || overlay AS data, jsonb_typeof(dedicated) <> 'object' OR
           (left(ltrim(raw), 1) = '{' AND left(raw, 1) <> '{') AS ambiguous_store
  FROM store
), pupils AS (
  SELECT id FROM public.students WHERE madrasa_id = $1::uuid
), bills AS (
  SELECT id, student_id, session_id, fee_type_id, billing_period, payable_amount, paid_amount, due_amount
  FROM public.student_fees WHERE madrasa_id = $1::uuid
), payments AS (
  SELECT id, student_id, session_id, db_fee_id, transaction_ref, upper(btrim(receipt_no)) AS receipt,
         total_amount_received AS amount, status
  FROM public.fee_payments WHERE madrasa_id = $1::uuid
), collections AS (
  SELECT f.id, f.student_id, coalesce((to_jsonb(f)->>'amount_paid')::numeric, f.amount) AS amount,
         upper(btrim(coalesce(nullif(to_jsonb(f)->>'receipt_no',''), nullif(to_jsonb(f)->>'receipt_number',''),
           (regexp_match(f.notes, '\[(?:রিসিট|রসিদ|অনলাইন পেমেন্ট|Receipt):\s*([^|\]]+)', 'i'))[1]))) AS receipt
  FROM public.fees f WHERE f.madrasa_id = $1::uuid
), old_bills AS (
  SELECT v, count(*) OVER (PARTITION BY v->>'id') AS copies
  FROM document, jsonb_array_elements(data->'student_fees') v
), old_receipts AS (
  SELECT v, pos FROM document, jsonb_array_elements(data->'payments') WITH ORDINALITY r(v,pos)
), payment_keys AS (
  SELECT p.id, k.* FROM payments p CROSS JOIN LATERAL
    (VALUES ('id',p.id), ('collection',p.db_fee_id::text), ('receipt',p.receipt)) k(kind,key)
  WHERE nullif(k.key,'') IS NOT NULL
), receipt_matches AS (
  -- Multiple keys hitting one receipt are fine. Conflicting links must not be resolved
  -- by picking the first one. Never join by amount, date, guardian name or telephone.
  SELECT r.pos, count(DISTINCT p.id) AS candidates, min(p.id) AS candidate
  FROM old_receipts r CROSS JOIN LATERAL
    (VALUES ('id',r.v->>'id'), ('collection',r.v->>'db_fee_id'), ('receipt',upper(btrim(r.v->>'receipt_no')))) k(kind,key)
  JOIN payment_keys p ON p.kind = k.kind AND p.key = k.key GROUP BY r.pos
), receipt_pairs AS (
  SELECT r.v, m.candidates, p.*, count(*) OVER (PARTITION BY p.id) AS copies
  FROM old_receipts r LEFT JOIN receipt_matches m USING (pos)
  LEFT JOIN payments p ON m.candidates = 1 AND p.id = m.candidate
), collection_links AS (
  SELECT f.id AS collection_id, k.id AS payment_id FROM collections f CROSS JOIN LATERAL
    (VALUES ('id',f.id::text), ('collection',f.id::text), ('receipt',f.receipt)) lookup(kind,key)
  JOIN payment_keys k ON k.kind = lookup.kind AND k.key = lookup.key
  GROUP BY f.id, k.id
), intents AS (
  SELECT v, pos, v->>'status' AS status, count(*) OVER (PARTITION BY v->>'transaction_id') AS copies
  FROM document, jsonb_array_elements(data->'online_transactions') WITH ORDINALITY t(v,pos)
), checkouts AS (
  SELECT * FROM public.portal_fee_checkouts WHERE madrasa_id=$1::uuid
), ssl_intents AS (
  SELECT t.v, t.status, c.validation_id,
    c.transaction_id IS NOT NULL AND (c.student_id::text,c.principal,c.charged,c.allocations) IS NOT DISTINCT FROM
      (t.v->>'student_id',(t.v->>'amount')::numeric,(t.v->>'total_payable')::numeric,t.v->'allocations') AS bound
  FROM intents t LEFT JOIN checkouts c ON c.transaction_id=t.v->>'transaction_id' AND c.merchant_scope=t.v->>'sslcommerz_scope'
  WHERE t.v->>'provider'='SSLCOMMERZ'
), pending AS (
  SELECT pos, v, (v->>'amount')::numeric AS principal, (v->>'total_payable')::numeric AS charged,
         coalesce((v->>'convenience_fee')::numeric,0) AS surcharge FROM intents WHERE status = 'PENDING'
), allocations AS (
  SELECT p.pos, a->>'student_fee_id' AS bill_id, (a->>'allocated_amount')::numeric AS amount,
         b.due_amount, b.student_id::text = p.v->>'student_id' AS owns_bill
  FROM pending p CROSS JOIN LATERAL jsonb_array_elements(p.v->'allocations') a
  LEFT JOIN bills b ON b.id = a->>'student_fee_id'
), allocation_totals AS (
  SELECT pos, sum(amount) AS allocated, count(*) = count(DISTINCT bill_id) AS distinct_bills,
         bool_and((owns_bill AND amount BETWEEN 0.01 AND due_amount AND round(amount,2) = amount) IS TRUE) AS valid
  FROM allocations GROUP BY pos
), successes AS (
  SELECT t.v, t.pos, upper(btrim(t.v->>'receipt_no')) AS receipt,
         count(*) OVER (PARTITION BY upper(btrim(t.v->>'receipt_no'))) AS uses
  FROM intents t WHERE t.status = 'SUCCESS'
), posted_allocations AS (
  -- Allocations have no tenant column; scope through the owning payment, never the bill alone.
  SELECT a.payment_id, a.student_fee_id, a.allocated_amount, p.student_id AS payer, b.student_id AS billed
  FROM public.fee_payment_allocations a JOIN payments p ON p.id = a.payment_id
  LEFT JOIN bills b ON b.id = a.student_fee_id
), expected_lines AS (
  SELECT t.pos, a->>'student_fee_id' AS bill_id, (a->>'allocated_amount')::numeric AS amount
  FROM successes t CROSS JOIN LATERAL jsonb_array_elements(t.v->'allocations') a
), expected_posting AS (
  SELECT pos, jsonb_agg(jsonb_build_array(bill_id,amount) ORDER BY bill_id,amount) AS lines
  FROM expected_lines GROUP BY pos
), actual_posting AS (
  SELECT payment_id, sum(allocated_amount) FILTER (WHERE payer = billed) AS credit,
         jsonb_agg(jsonb_build_array(student_fee_id,allocated_amount) ORDER BY student_fee_id,allocated_amount) AS lines
  FROM posted_allocations GROUP BY payment_id
), settled AS (
  SELECT t.pos, t.uses, count(p.id) FILTER (WHERE p.status = 'COMPLETED' AND p.student_id::text = t.v->>'student_id'
      AND p.amount = (t.v->>'amount')::numeric) AS matches,
    bool_or(p.id IS NOT NULL AND (a.credit IS DISTINCT FROM p.amount OR a.lines IS DISTINCT FROM e.lines)) AS wrong_posting
  FROM successes t LEFT JOIN payments p ON p.receipt = t.receipt
  LEFT JOIN expected_posting e ON e.pos = t.pos LEFT JOIN actual_posting a ON a.payment_id = p.id
  GROUP BY t.pos,t.uses
), required_rpcs AS (
  SELECT to_regprocedure(signature) AS fn FROM (VALUES
    ('public.portal_locked_metadata(uuid)'), ('public.write_portal_fee_intent(uuid,jsonb,boolean)'),
    ('public.settle_portal_fee_intent(uuid,jsonb,text,text)'),('public.replace_portal_gateway_key(uuid,text,jsonb,jsonb)')) r(signature)
), checks(level, code, n) AS (
  SELECT 'BLOCK', 'ambiguous_metadata', count(*) FROM document WHERE ambiguous_store
  UNION ALL SELECT 'BLOCK', 'rpc_missing_or_grants', count(*) FROM required_rpcs
    WHERE fn IS NULL OR has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE')
      OR NOT has_function_privilege('service_role',fn,'EXECUTE')
  UNION ALL SELECT 'BLOCK', 'checkout_permissions', 1 WHERE
    EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) AS client(role_name) WHERE
      has_any_column_privilege(role_name,'public.portal_fee_checkouts','SELECT,INSERT,UPDATE') OR
      has_table_privilege(role_name,'public.portal_fee_checkouts','DELETE,TRUNCATE'))
    OR NOT has_table_privilege('service_role','public.portal_fee_checkouts','SELECT')
    OR NOT has_table_privilege('service_role','public.portal_fee_checkouts','INSERT')
    OR NOT has_column_privilege('service_role','public.portal_fee_checkouts','validation_id','UPDATE')
  UNION ALL SELECT 'BLOCK', 'sql_bill_owner_or_balance', count(*) FROM bills b LEFT JOIN pupils s ON s.id = b.student_id
    WHERE s.id IS NULL OR least(b.payable_amount,b.paid_amount,b.due_amount) < 0
      OR 'NaN'::numeric IN (b.payable_amount,b.paid_amount,b.due_amount) OR b.due_amount <> b.payable_amount-b.paid_amount
  UNION ALL SELECT 'BLOCK', 'legacy_bill_not_posted', count(*) FROM old_bills l LEFT JOIN bills b ON b.id = l.v->>'id' WHERE b.id IS NULL
  UNION ALL SELECT 'BLOCK', 'legacy_bill_conflict', count(*) FROM old_bills l JOIN bills b ON b.id = l.v->>'id'
    WHERE l.copies <> 1 OR (l.v ? 'madrasa_id' AND l.v->>'madrasa_id' IS DISTINCT FROM $1::uuid::text)
      OR b.student_id::text IS DISTINCT FROM l.v->>'student_id' OR (l.v ? 'session_id' AND b.session_id IS DISTINCT FROM l.v->>'session_id')
      OR (l.v ? 'fee_type_id' AND b.fee_type_id IS DISTINCT FROM l.v->>'fee_type_id')
      OR (l.v ? 'billing_period' AND b.billing_period IS DISTINCT FROM l.v->>'billing_period')
      OR (b.payable_amount,b.paid_amount,b.due_amount) IS DISTINCT FROM
         ((l.v->>'payable_amount')::numeric,(l.v->>'paid_amount')::numeric,(l.v->>'due_amount')::numeric)
  UNION ALL SELECT 'BLOCK', 'legacy_receipt_unresolved', count(*) FROM receipt_pairs WHERE candidates IS DISTINCT FROM 1
  UNION ALL SELECT 'BLOCK', 'legacy_receipt_conflict', count(*) FROM receipt_pairs WHERE candidates = 1 AND
    (copies <> 1 OR (v ? 'madrasa_id' AND v->>'madrasa_id' IS DISTINCT FROM $1::uuid::text)
     OR student_id::text IS DISTINCT FROM v->>'student_id' OR (v ? 'session_id' AND session_id IS DISTINCT FROM v->>'session_id')
     OR amount IS DISTINCT FROM (v->>'total_amount_received')::numeric OR status IS DISTINCT FROM v->>'status'
     OR (nullif(v->>'receipt_no','') IS NOT NULL AND receipt IS DISTINCT FROM upper(btrim(v->>'receipt_no')))
     OR (nullif(v->>'db_fee_id','') IS NOT NULL AND status = 'COMPLETED' AND NOT EXISTS
         (SELECT 1 FROM collection_links l WHERE l.collection_id::text = v->>'db_fee_id' AND l.payment_id = receipt_pairs.id)))
  UNION ALL SELECT 'BLOCK', 'duplicate_receipt_numbers', count(*) FROM
    (SELECT receipt FROM payments GROUP BY receipt HAVING count(*) > 1) duplicates
  UNION ALL SELECT 'BLOCK', 'sql_receipt_owner_or_status', count(*) FROM payments p LEFT JOIN pupils s ON s.id = p.student_id
    WHERE s.id IS NULL OR p.receipt = '' OR p.status NOT IN ('COMPLETED','VOID','REVERSED') OR p.amount < 0 OR p.amount = 'NaN'::numeric
  UNION ALL SELECT 'BLOCK', 'collection_owner', count(*) FROM collections f LEFT JOIN pupils s ON s.id = f.student_id WHERE s.id IS NULL
  UNION ALL SELECT 'BLOCK', 'receipt_mirror_conflict', count(*) FROM collection_links l
    JOIN collections f ON f.id = l.collection_id JOIN payments p ON p.id = l.payment_id
    WHERE (p.student_id,p.amount) IS DISTINCT FROM (f.student_id,f.amount) OR (f.receipt IS NOT NULL AND f.receipt <> p.receipt)
  UNION ALL SELECT 'BLOCK', 'ambiguous_collection_links', count(*) FROM
    (SELECT collection_id FROM collection_links GROUP BY collection_id HAVING count(*) > 1) duplicates
  UNION ALL SELECT 'BLOCK', 'duplicate_collection_mirrors', count(*) FROM
    (SELECT payment_id FROM collection_links GROUP BY payment_id HAVING count(*) > 1) duplicates
  -- Voiding/reversing a receipt can legitimately delete its old `fees` copy.
  UNION ALL SELECT 'BLOCK', 'declared_collection_missing', count(*) FROM payments p LEFT JOIN collections f ON f.id = p.db_fee_id
    WHERE p.status = 'COMPLETED' AND p.db_fee_id IS NOT NULL AND f.id IS NULL
  UNION ALL SELECT 'BLOCK', 'intent_identity_or_status', count(*) FROM intents t LEFT JOIN pupils s ON s.id::text = t.v->>'student_id'
    WHERE t.status IS NULL OR t.status NOT IN ('PENDING','SUCCESS','FAILED','CANCELLED') OR
      (t.status IN ('PENDING','SUCCESS') AND (s.id IS NULL OR t.v->>'madrasa_id' IS DISTINCT FROM $1::uuid::text OR
        nullif(btrim(t.v->>'transaction_id'),'') IS NULL OR t.copies <> 1))
  UNION ALL SELECT 'BLOCK', 'pending_amount_or_allocation', count(*) FROM pending p LEFT JOIN allocation_totals a USING (pos)
    WHERE (p.principal BETWEEN 0.01 AND 99999999.99 AND round(p.principal,2) = p.principal AND p.surcharge >= 0
      AND p.surcharge < 'Infinity'::numeric AND round(p.surcharge,2) = p.surcharge AND p.charged = p.principal + p.surcharge
      AND a.allocated = p.principal AND a.valid AND a.distinct_bills) IS NOT TRUE
  UNION ALL SELECT 'BLOCK', 'overlapping_pending_bills', count(*) FROM
    (SELECT bill_id FROM allocations GROUP BY bill_id HAVING count(DISTINCT pos) > 1 AND sum(amount) > max(due_amount)) overbooked
  UNION ALL SELECT 'BLOCK', 'allocation_bill_owner', count(*) FROM posted_allocations
    WHERE student_fee_id IS NOT NULL AND billed IS DISTINCT FROM payer
  UNION ALL SELECT 'BLOCK', 'success_without_matching_receipt', count(*) FROM settled WHERE uses <> 1 OR matches <> 1
  UNION ALL SELECT 'BLOCK', 'success_allocation_mismatch', count(*) FROM settled WHERE wrong_posting
  UNION ALL SELECT 'BLOCK', 'ambiguous_standalone_receipts', count(*) FROM
    (SELECT f.receipt FROM collections f WHERE f.receipt IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM collection_links l WHERE l.collection_id = f.id)
      GROUP BY f.receipt HAVING count(*) > 1) duplicates
  -- The app reads the overlay first; do not resurrect superseded data, but surface
  -- nonempty shadow copies for finance to check instead of silently passing them.
  UNION ALL SELECT 'REVIEW', 'shadowed_fee_keys', count(*) FROM store,
    (VALUES ('student_fees'),('payments'),('online_transactions')) fee(key)
    WHERE overlay ? key AND dedicated ? key AND dedicated->key <> '[]'::jsonb AND dedicated->key <> overlay->key
  UNION ALL SELECT 'BLOCK', 'unbound_ssl_checkout', count(*) FROM ssl_intents
    WHERE status='PENDING' AND (NOT bound OR validation_id IS NOT NULL)
  UNION ALL SELECT 'BLOCK', 'settled_ssl_proof_mismatch', count(*) FROM ssl_intents t WHERE t.status='SUCCESS' AND t.v ? 'sslcommerz_scope'
    AND (NOT t.bound OR t.validation_id IS NULL OR t.validation_id IS DISTINCT FROM t.v->>'gateway_ref' OR NOT EXISTS
      (SELECT 1 FROM payments p WHERE p.id='online:'||$1::uuid::text||':'||(t.v->>'transaction_id') AND p.transaction_ref=t.validation_id))
  -- Other legacy writers can still replace metadata. Report reservations with no
  -- matching intent, or a consumed proof whose settlement disappeared from it.
  UNION ALL SELECT 'BLOCK', 'checkout_without_matching_intent', count(*) FROM checkouts c WHERE NOT EXISTS
    (SELECT 1 FROM intents t WHERE t.v->>'provider'='SSLCOMMERZ' AND t.v->>'transaction_id'=c.transaction_id
      AND t.v->>'sslcommerz_scope'=c.merchant_scope AND (c.validation_id IS NULL OR t.status='SUCCESS'))
  -- No local ledger can tell whether the PSP took the money. Never replay a pending intent here.
  UNION ALL SELECT 'REVIEW', 'pending_statement_check', count(*) FROM pending
  UNION ALL SELECT 'REVIEW', 'no_posted_bills', 1 WHERE NOT EXISTS (SELECT 1 FROM bills)
)
SELECT jsonb_build_object('legacy_bills',(SELECT count(*) FROM old_bills),'sql_bills',(SELECT count(*) FROM bills),
                          'legacy_receipts',(SELECT count(*) FROM old_receipts),'sql_receipts',(SELECT count(*) FROM payments),
                          'collections',(SELECT count(*) FROM collections),
                          'standalone_collections',(SELECT count(*) FROM collections f WHERE NOT EXISTS
                            (SELECT 1 FROM collection_links l WHERE l.collection_id = f.id)),
                          'pending_intents',(SELECT count(*) FROM pending)) AS inventory,
       coalesce((SELECT jsonb_object_agg(code,n) FROM checks WHERE level = 'BLOCK' AND n > 0),'{}') AS blockers,
       coalesce((SELECT jsonb_object_agg(code,n) FROM checks WHERE level = 'REVIEW' AND n > 0),'{}') AS review
FROM store;
