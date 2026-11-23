-- Additional post-migration staging checks. $1 is one authorized tenant, not a filter supplied by a browser.
-- Run in the same pinned READ ONLY snapshot as portal-fee-preflight.sql. Return counts only.
WITH tenant AS (SELECT m.id, public.finance_metadata(m) AS meta FROM public.madrasas m WHERE m.id=$1),
funds AS (SELECT f FROM public.finance_fund_catalog($1) f),
vouchers AS (
  SELECT 'donation' AS kind,id::text AS id,receipt_no AS num,fund_id,fund_name,amount,notes AS note,status,donation_type AS category,NULL AS beneficiary FROM public.donations WHERE madrasa_id=$1
  UNION ALL SELECT 'expense',id::text,voucher_no,fund_id,fund_name,amount,description,status,category,restricted_beneficiary FROM public.expenses WHERE madrasa_id=$1
  UNION ALL SELECT 'bazar',id::text,voucher_no,fund_id,fund_name,amount,items_details,status,'Bazar',NULL FROM public.bazar_expenses WHERE madrasa_id=$1
), active AS (SELECT * FROM vouchers WHERE coalesce(status,'COMPLETED')<>'VOID' AND coalesce(note,'') !~* '\[VOID:'),
settlements AS (SELECT s.ref,s.txn FROM tenant t, public.finance_settlement_refs(t.meta->'mahfils') s),
rpcs AS (SELECT to_regprocedure(signature) fn FROM (VALUES
  ('public.finance_register_teacher(uuid,uuid,jsonb)'),('public.finance_draft_payroll(uuid,uuid,jsonb,jsonb,jsonb)'),('public.finance_write_workflow(uuid,uuid,uuid,text,jsonb)'),('public.finance_backup_note(uuid,uuid,jsonb)'),('public.finance_apply_recovery(uuid,uuid,jsonb)'),('public.finance_backup_children(uuid,text,text)'),('public.finance_edit_staff(uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid)'),('public.finance_boarding_months(uuid)'),('public.finance_billing_session(uuid,text,boolean)'),('public.finance_accounting_calendar(uuid)'),('public.finance_closed_periods(uuid)'),('public.finance_fund_catalog(uuid)'),('public.finance_posting_fund(uuid,text,text,text,text)'),('public.finance_save_member(uuid,text,jsonb,jsonb,text)'),
  ('public.finance_receive_donation(uuid,jsonb,jsonb)'),('public.finance_post_collection(uuid,jsonb,jsonb,text,jsonb,boolean)'),('public.finance_change_voucher(uuid,uuid,text,jsonb,jsonb,jsonb,boolean,text,text)'),
  ('public.finance_collect_fee(uuid,uuid,jsonb,jsonb)'),('public.finance_fee_status(uuid,uuid,text,text,text)'),('public.finance_edit_bills(uuid,jsonb,jsonb)'),('public.finance_fee_config(uuid,text,jsonb,jsonb)'),
  ('public.finance_json_fee_rows(uuid,text)'),('public.finance_record_maintenance(uuid,jsonb)'),('public.finance_pay_salary(uuid,uuid,text,text,text,text)'),('public.finance_decide_request(uuid,uuid,jsonb,jsonb,jsonb)'),('public.finance_replace_sources(uuid,jsonb,jsonb)')) r(signature)),
checks(level,code,n) AS (
  SELECT 'BLOCK','finance_rpc_missing_or_grants',count(*) FROM rpcs WHERE fn IS NULL OR has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE') OR NOT has_function_privilege('service_role',fn,'EXECUTE')
  UNION ALL SELECT 'BLOCK','finance_raw_book_grants',count(*) FROM unnest(ARRAY['fees','fee_payments','fee_payment_allocations','student_fees','fee_types','fee_structures','fee_structure_items','fee_discount_waivers','fee_audit_logs','madrasa_settings','accounting_periods','system_audit_logs','expenses','bazar_expenses','donations','donors','zakat_funds','approval_requests','approval_workflows','approval_workflow_steps','approval_step_decisions']) q(book), (VALUES ('anon'),('authenticated')) c(client)
    WHERE has_any_column_privilege(client,'public.'||book,'SELECT,INSERT,UPDATE') OR has_table_privilege(client,'public.'||book,'DELETE,TRUNCATE')
  UNION ALL SELECT 'BLOCK','raw_aggregate_grants',count(*) FROM pg_attribute a,(VALUES ('anon'),('authenticated')) c(client) WHERE a.attrelid='public.madrasas'::regclass AND a.attname IN ('registration_no','metadata','security_metadata','finance_source_revision') AND NOT a.attisdropped AND has_column_privilege(client,a.attrelid,a.attname,'SELECT,UPDATE,INSERT')
  UNION ALL SELECT 'BLOCK','bi_raw_relation_grants',count(*) FROM unnest(ARRAY['mv_bi_boarding_monthly','mv_bi_fund_health','mv_bi_class_fee_dues','mv_bi_session_exam_results']) n, (VALUES ('anon'),('authenticated')) c(client) WHERE has_any_column_privilege(client,to_regclass('public.'||n),'SELECT')
  UNION ALL SELECT 'BLOCK','bi_raw_function_grants',count(*) FROM unnest(ARRAY['get_executive_bi_snapshot(uuid,integer,text)','refresh_bi_materialized_views()']) n,(VALUES ('anon'),('authenticated')) c(client) WHERE has_function_privilege(client,to_regprocedure('public.'||n),'EXECUTE')
  UNION ALL SELECT 'REVIEW','old_finance_approval',count(*) FROM public.approval_requests WHERE madrasa_id=$1 AND status IN ('PENDING','IN_REVIEW') AND payload->>'action' IN ('create_expense','collect_fee_payment','update_staff_salary','promote_staff') AND NOT (payload?'financeWorkflow')
  UNION ALL SELECT 'REVIEW','approved_without_confirmed_posting',count(*) FROM public.approval_requests WHERE madrasa_id=$1 AND status='APPROVED' AND payload->>'action' IN ('create_expense','collect_fee_payment','update_staff_salary','promote_staff') AND (executed_at IS NULL OR execution_result->>'executed' IS DISTINCT FROM 'true')
  UNION ALL
  SELECT 'REVIEW','fund_id_unconfirmed',count(*) FROM active a WHERE NOT EXISTS (SELECT FROM funds WHERE f->>'id'=a.fund_id)
    OR (fund_id='fund-general' AND coalesce(fund_name,'')='' AND coalesce(note,'') !~* 'FUND:')
  UNION ALL SELECT 'REVIEW','stored_fund_label_disagrees',count(*) FROM active a JOIN funds ON f->>'id'=a.fund_id
    WHERE nullif(fund_name,'') IS NOT NULL AND fund_name IS DISTINCT FROM f->>'name'
  UNION ALL SELECT 'REVIEW','restricted_outflow_evidence',count(*) FROM active a JOIN funds ON f->>'id'=a.fund_id WHERE a.kind<>'donation' AND public.finance_is_restricted(f)
    AND (kind='bazar' OR lower(category) IS DISTINCT FROM 'food' OR nullif(btrim(beneficiary),'') IS NULL)
  UNION ALL SELECT 'REVIEW','duplicate_voucher_groups',count(*) FROM (SELECT (kind='donation'),lower(btrim(num)) FROM vouchers WHERE nullif(btrim(num),'') IS NOT NULL GROUP BY 1,2 HAVING count(*)>1) dups
  UNION ALL SELECT 'REVIEW','mahfil_voucher_without_event',count(*) FROM active a WHERE (coalesce(num,'') ~* 'MHF-' OR coalesce(note,'') ~ 'মাহফিল (সমন্বয়|ঘাটতি|উদ্বৃত্ত)')
    AND NOT EXISTS (SELECT FROM settlements s WHERE s.ref->>'accounting_record_id'=a.id AND s.ref->>'accounting_voucher_no'=a.num)
  UNION ALL SELECT 'BLOCK','mahfil_settlement_mismatch',count(*) FROM settlements s WHERE s.txn IS NULL OR NOT EXISTS
    (SELECT FROM active a WHERE a.id=s.ref->>'accounting_record_id' AND a.num=s.ref->>'accounting_voucher_no' AND a.amount=(s.ref->>'amount')::numeric AND a.fund_id=s.ref->>'fund_id'
      AND a.amount=(s.txn->>'amount')::numeric AND s.txn->>'type'=CASE a.kind WHEN 'donation' THEN 'EXPENSE' ELSE 'INCOME' END AND a.kind=CASE s.ref->>'settlement_type' WHEN 'SURPLUS_DEPOSIT' THEN 'donation' WHEN 'DEFICIT_COVER' THEN 'expense' END)
  UNION ALL SELECT 'REVIEW','paid_salary_without_exact_expense',count(*) FROM tenant t,jsonb_array_elements(t.meta->'staff_salary_records') r WHERE r->>'status'='PAID'
    AND NOT EXISTS (SELECT FROM public.expenses e WHERE e.madrasa_id=t.id AND e.id::text=r->>'expense_id' AND e.payroll_record_id=r->>'id' AND e.amount=(r->>'net_salary')::numeric AND e.status<>'VOID' AND e.fund_id='fund-general')
  UNION ALL SELECT 'BLOCK','bill_child_without_own_receipt',count(*) FROM public.student_fees b JOIN public.fee_payment_allocations a ON a.student_fee_id=b.id
    LEFT JOIN public.fee_payments p ON p.id=a.payment_id WHERE b.madrasa_id=$1 AND (p.id IS NULL OR p.madrasa_id IS DISTINCT FROM b.madrasa_id OR p.student_id IS DISTINCT FROM b.student_id)
  UNION ALL SELECT 'REVIEW','online_donation_statement_pending',count(*) FROM tenant t,jsonb_array_elements(t.meta->'online_donations') d WHERE d->>'status'='PENDING'
)
SELECT jsonb_build_object('accounting_periods',jsonb_array_length(public.finance_accounting_calendar($1)),'central_vouchers',(SELECT count(*) FROM vouchers),'mahfil_settlements',(SELECT count(*) FROM settlements),'catalog_funds',(SELECT count(*) FROM funds)) AS inventory,
       coalesce((SELECT jsonb_object_agg(code,n) FROM checks WHERE level='BLOCK' AND n>0),'{}') AS blockers,
       coalesce((SELECT jsonb_object_agg(code,n) FROM checks WHERE level='REVIEW' AND n>0),'{}') AS review
FROM tenant
