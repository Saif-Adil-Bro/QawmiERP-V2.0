-- For the Phase 1 "Missing ... prerequisite columns" error. One read-only SELECT.
-- Run as the migration owner on the restored staging database, BEFORE any repair.
-- A missing base table/column, an access error or RLS-filtered counts mean INCOMPLETE,
-- not empty books. Even all-zero counts are not proof that there is no other history.
WITH expected(t, cols) AS (
  VALUES ('madrasas', ARRAY['registration_no','reg_no','metadata','security_metadata']),
         ('users', ARRAY['phone','student_id','teacher_id','updated_at']),
         ('donations', ARRAY['fund_id','fund_name','status','void_reason','voided_at']),
         ('expenses', ARRAY['fund_id','fund_name','status','void_reason','voided_at','voucher_no']),
         ('student_fees', ARRAY['fund_id','fund_name']),
         ('fee_payment_allocations', ARRAY['fund_id','fund_name']),
         ('fee_payments', ARRAY['db_fee_id'])
), allocation_keys AS (
  -- Exactly the grouping used by the OLD account-model DELETE, not proof of a duplicate.
  SELECT count(*) AS n FROM public.fee_payment_allocations
  GROUP BY payment_id, fee_type_id, coalesce(billing_period, '')
)
SELECT ARRAY(
         SELECT t || '.' || c FROM expected CROSS JOIN LATERAL unnest(cols) AS col(c)
         WHERE NOT EXISTS (SELECT FROM information_schema.columns s
                           WHERE s.table_schema='public' AND s.table_name=t AND s.column_name=c)
         ORDER BY t,c
       ) AS missing_columns,
       to_regprocedure('public.portal_locked_metadata(uuid)') IS NOT NULL AS has_portal_metadata_rpc,
       to_regclass('public.portal_fee_checkouts') IS NOT NULL AS has_portal_checkouts,
       EXISTS (SELECT FROM unnest(ARRAY['public.madrasas','public.donations','public.expenses',
                                        'public.fee_payment_allocations']) AS counted(t)
               WHERE pg_catalog.row_security_active(t::regclass)) AS rls_may_filter_counts,
       (SELECT count(*) FROM public.madrasas) AS institutions,
       (SELECT count(*) FROM public.madrasas WHERE btrim(registration_no) LIKE '{%') AS legacy_json_candidates,
       d.donations, d.donation_void_tags, e.expenses, e.expense_void_tags,
       (SELECT coalesce(sum(n),0) FROM allocation_keys) AS allocations,
       (SELECT coalesce(sum(n-1),0) FROM allocation_keys) AS allocation_rows_at_risk
FROM (SELECT count(*) AS donations, count(*) FILTER (WHERE notes ILIKE '%[VOID:%') AS donation_void_tags
      FROM public.donations) AS d
CROSS JOIN (SELECT count(*) AS expenses, count(*) FILTER (WHERE description ILIKE '%[VOID:%') AS expense_void_tags
            FROM public.expenses) AS e;
