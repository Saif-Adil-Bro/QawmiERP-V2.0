-- Phase 2, after both finance migrations. Counts only on the same pinned READ ONLY snapshot.
WITH tenant AS (SELECT id,public.finance_metadata(m) AS meta FROM public.madrasas m WHERE id=$1),
books AS (SELECT name,to_regclass('public.'||name) oid FROM unnest(ARRAY['treasury_days','treasury_movements','treasury_heads','treasury_memos','treasury_fee_tenders','treasury_journals','treasury_epochs']) name),
required AS (SELECT to_regprocedure('public.'||signature) oid FROM unnest(ARRAY[
  'treasury_cashbook(uuid,uuid,date)','treasury_cash_action(uuid,uuid,date,text,uuid,numeric,uuid,text,numeric)',
  'treasury_post_journal(uuid,uuid,uuid,date,text,text,text,numeric,text,bigint,numeric)','treasury_head(uuid,uuid,uuid,text,text,boolean)',
  'treasury_attach_memo(uuid,uuid,uuid,text)','treasury_read_memo(uuid,uuid)','treasury_memo_index(uuid,uuid)',
  'finance_replace_sources(uuid,jsonb,jsonb,uuid)','finance_pay_salary(uuid,uuid,text,text,text,text,boolean)',
  'finance_collect_fee(uuid,uuid,jsonb,jsonb,uuid)','finance_record_maintenance(uuid,jsonb,uuid,text)',
  'finance_receive_donation(uuid,jsonb,jsonb,uuid,text)','finance_post_collection(uuid,jsonb,jsonb,text,jsonb,boolean,uuid,text)']) signature),
guards AS (
  SELECT * FROM (VALUES ('donations','aa_treasury_voucher'),('expenses','aa_treasury_voucher'),('bazar_expenses','aa_treasury_voucher'),('fee_payments','aa_treasury_fee'),('madrasas','aa_treasury_fee_meta'),('madrasas','aa_treasury_transport')) g(tab,name)
  UNION ALL SELECT tab,'treasury_tick' FROM unnest(ARRAY['madrasas','donations','expenses','bazar_expenses','fees','fee_payments','fee_payment_allocations','fee_types','student_fees','fee_structures','zakat_funds','treasury_journals']) tab
), receipts AS (
  SELECT id,payment_date AS d,upper(payment_method) method,true AS relational FROM public.fee_payments WHERE madrasa_id=$1
  UNION ALL SELECT p->>'id',(p->>'payment_date')::date,upper(p->>'payment_method'),false FROM tenant,LATERAL jsonb_array_elements(meta->'payments') p
), closed AS MATERIALIZED (
  SELECT d.*,public.treasury_cashbook(d.madrasa_id,d.operator_id,d.cash_date) AS book FROM public.treasury_days d WHERE madrasa_id=$1 AND closed_at IS NOT NULL
), checks(level,code,n) AS (
  SELECT 'BLOCK','treasury_table_absent_or_rls_off',count(*) FROM books b LEFT JOIN pg_class c ON c.oid=b.oid WHERE c.relrowsecurity IS DISTINCT FROM true
  UNION ALL SELECT 'BLOCK','treasury_client_grants',count(*) FROM books,(VALUES ('anon'),('authenticated')) c(client)
    WHERE has_any_column_privilege(client,oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(client,oid,'DELETE,TRUNCATE,TRIGGER')
  UNION ALL SELECT 'BLOCK','treasury_service_grants',count(*) FROM books WHERE
    has_any_column_privilege('service_role',oid,'INSERT,UPDATE') OR has_table_privilege('service_role',oid,'DELETE,TRUNCATE') OR
    CASE name WHEN 'treasury_memos' THEN has_any_column_privilege('service_role',oid,'SELECT') ELSE NOT has_table_privilege('service_role',oid,'SELECT') END
  UNION ALL SELECT 'BLOCK','treasury_rpc_missing_or_grants',count(*) FROM required WHERE oid IS NULL OR has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE') OR NOT has_function_privilege('service_role',oid,'EXECUTE')
  UNION ALL SELECT 'BLOCK','treasury_guard_missing_or_disabled',count(*) FROM guards g WHERE NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid=to_regclass('public.'||g.tab) AND tgname=g.name AND tgenabled IN ('A','O'))
  UNION ALL SELECT 'BLOCK','treasury_helper_grants',count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^treasury_' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
  UNION ALL SELECT 'BLOCK','treasury_tender_without_owned_receipt',count(*) FROM public.treasury_fee_tenders f WHERE f.madrasa_id=$1 AND (
    NOT EXISTS(SELECT FROM public.users u WHERE u.madrasa_id=f.madrasa_id AND u.id=f.operator_id) OR
    (SELECT count(*) FROM receipts r WHERE r.id=f.payment_id AND r.relational=f.relational AND r.d=f.cash_date AND (upper(f.method)<>'CASH' OR r.method='CASH'))<>1)
  UNION ALL SELECT 'BLOCK','treasury_memo_without_owned_voucher',count(*) FROM public.treasury_memos m WHERE m.madrasa_id=$1 AND NOT EXISTS(SELECT FROM public.expenses e WHERE e.madrasa_id=m.madrasa_id AND e.id=m.expense_id)
  UNION ALL SELECT 'BLOCK','treasury_invalid_movement',count(*) FROM public.treasury_movements m WHERE m.madrasa_id=$1 AND (
    NOT EXISTS(SELECT FROM public.treasury_days d WHERE (d.madrasa_id,d.cash_date,d.operator_id)=(m.madrasa_id,m.cash_date,m.sender)) OR
    (m.recipient IS NOT NULL AND NOT EXISTS(SELECT FROM public.treasury_days d WHERE (d.madrasa_id,d.cash_date,d.operator_id)=(m.madrasa_id,m.cash_date,m.recipient))) OR
    (m.accepted_at IS NOT NULL AND m.cancelled_at IS NOT NULL) OR
    (m.recipient IS NOT NULL AND m.accepted_at IS NULL AND m.cancelled_at IS NULL AND EXISTS(SELECT FROM closed d WHERE d.cash_date=m.cash_date AND d.operator_id IN (m.sender,m.recipient))))
  UNION ALL SELECT 'BLOCK','treasury_frozen_close_mismatch',count(*) FROM closed WHERE counted IS NULL OR expected IS DISTINCT FROM
    (opening+(book->>'collected')::numeric-(book->>'expenses')::numeric+(book->>'handedIn')::numeric-(book->>'handedOut')::numeric-(book->>'deposited')::numeric)
  UNION ALL SELECT 'REVIEW','treasury_explained_variances',count(*) FROM closed WHERE counted<>expected
  UNION ALL SELECT 'REVIEW','treasury_pending_handovers',count(*) FROM public.treasury_movements WHERE madrasa_id=$1 AND recipient IS NOT NULL AND accepted_at IS NULL AND cancelled_at IS NULL
)
SELECT jsonb_build_object('cashbook_days',(SELECT count(*) FROM public.treasury_days WHERE madrasa_id=$1),'journal_vouchers',(SELECT count(*) FROM public.treasury_journals WHERE madrasa_id=$1),'private_memos',(SELECT count(*) FROM public.treasury_memos WHERE madrasa_id=$1),'fee_tenders',(SELECT count(*) FROM public.treasury_fee_tenders WHERE madrasa_id=$1)) inventory,
  coalesce((SELECT jsonb_object_agg(code,n) FROM checks WHERE level='BLOCK' AND n>0),'{}') blockers,
  coalesce((SELECT jsonb_object_agg(code,n) FROM checks WHERE level='REVIEW' AND n>0),'{}') review FROM tenant
