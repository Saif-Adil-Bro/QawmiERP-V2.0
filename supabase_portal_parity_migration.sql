-- Apply after the base and account-model migrations, in a coordinated app/DB cutover.
-- Keep writes paused until scoped readers and service-only RPCs are both ready.
-- See docs/portal-parity-rollout.bn.md before enabling portal traffic.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id text,
                         ADD COLUMN IF NOT EXISTS teacher_id text;
-- The upstream teacher provisioner writes this stable binding. Do not infer historical links.
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS leave_request_id text;
ALTER TABLE public.teacher_attendance ADD COLUMN IF NOT EXISTS leave_request_id text;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS written_marks numeric,
                                ADD COLUMN IF NOT EXISTS oral_marks numeric,
                                ADD COLUMN IF NOT EXISTS tutorial_marks numeric,
                                ADD COLUMN IF NOT EXISTS attendance_marks numeric;
CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id uuid NOT NULL REFERENCES public.madrasas ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes ON DELETE CASCADE,
  subject_name text NOT NULL,
  total_marks numeric NOT NULL DEFAULT 100 CHECK (total_marks > 0),
  pass_marks numeric NOT NULL DEFAULT 33 CHECK (pass_marks BETWEEN 0 AND total_marks),
  exam_type text NOT NULL DEFAULT 'Written',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id,class_id,subject_name)
);
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_subjects_tenant ON public.exam_subjects;
CREATE POLICY exam_subjects_tenant ON public.exam_subjects TO authenticated
  USING (madrasa_id=public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id=public.get_auth_madrasa_id()
    AND EXISTS (SELECT 1 FROM public.exams e WHERE e.id=exam_id AND e.madrasa_id=exam_subjects.madrasa_id)
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id=class_id AND c.madrasa_id=exam_subjects.madrasa_id));

-- Only a successful app login binds an issuer session. Keep legacy records for audit;
-- neither a rotating token hash nor an old cookie/JSON entry proves a binding.
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS provider_session_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_provider_id ON public.user_sessions(provider_session_id)
  WHERE provider_session_id IS NOT NULL;
REVOKE ALL ON public.user_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO service_role;
DROP POLICY IF EXISTS session_registry_server_only ON public.user_sessions;
CREATE POLICY session_registry_server_only ON public.user_sessions AS RESTRICTIVE FOR ALL
  TO PUBLIC USING (false) WITH CHECK (false);

-- No caller-controlled identifiers, no session list, no editable Auth metadata.
CREATE OR REPLACE FUNCTION public.current_app_session() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id',s.id,'user_id',s.user_id,'madrasa_id',s.madrasa_id)
    FROM public.user_sessions s JOIN public.users u ON u.id=s.user_id AND u.madrasa_id=s.madrasa_id
    WHERE s.user_id=auth.uid()
      AND s.provider_session_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid
      AND s.is_active AND s.revoked_at IS NULL AND s.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.current_app_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_session() TO authenticated;

-- Aggregate JSON columns contain records belonging to many families. Reading them via
-- PostgREST and filtering in the browser cannot enforce family or subject boundaries.
-- This definer takes NO caller-controlled ID and returns only a boolean for auth.uid().
CREATE OR REPLACE FUNCTION public.portal_may_use_raw_erp_tables() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_role text; store jsonb; legacy text; profile jsonb;
  portal_roles text[] := ARRAY['parent','guardian','student','guardian_student','teacher','ustad','hifz_teacher','hifz_supervisor'];
BEGIN
  -- users.role is text in the base schema, but an enum in lib/db/setup.sql.
  SELECT lower(u.role::text),to_jsonb(m)->'security_metadata',to_jsonb(m)->>'registration_no'
    INTO account_role,store,legacy FROM public.users u JOIN public.madrasas m ON m.id=u.madrasa_id WHERE u.id=auth.uid();
  IF account_role IS NULL OR account_role=ANY(portal_roles) OR public.current_app_session() IS NULL THEN RETURN false; END IF;
  IF (store IS NULL OR store='null'::jsonb) AND left(ltrim(legacy),1)='{' THEN store:=legacy::jsonb; END IF;
  IF store IS NOT NULL AND jsonb_typeof(store)<>'object' THEN RETURN false; END IF;
  profile:=store->'user_security_profiles'->(auth.uid()::text);
  IF profile IS NOT NULL AND jsonb_typeof(profile)<>'object' THEN RETURN false; END IF;
  RETURN NOT (coalesce(profile->>'status','ACTIVE') <> 'ACTIVE'
    OR lower(coalesce(profile->>'primaryRole',''))=ANY(portal_roles)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(profile->'roles','[]')) AS r(role) WHERE lower(r.role)=ANY(portal_roles)));
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.portal_may_use_raw_erp_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_may_use_raw_erp_tables() TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['madrasas','students','teachers','classes','subjects','class_subjects','teacher_subjects',
    'academic_sessions','student_enrollments','attendance','teacher_attendance','routines','notices','hifz_logs','kitab_logs',
    'exams','exam_subjects','exam_settings','exam_results','exam_routines','fees','student_fees','fee_payments',
    'fee_discount_waivers','fee_payment_allocations','fee_audit_logs','madrasa_settings',
    'fee_types','fee_structures','fee_structure_items','expenses','donors','donations','meal_entries','bazar_expenses',
    'zakat_funds','books','book_issues','sms_logs','system_audit_logs','staff_leave_requests','accounting_periods',
    'approval_workflows','approval_workflow_steps','approval_requests','approval_step_decisions','user_sessions',
    'user_mfa_settings','step_up_verifications','automation_rules','job_execution_logs','notification_templates',
    'notification_queue','notification_device_tokens','digest_schedules','webhook_endpoints','webhook_deliveries',
    'student_risk_scores','financial_anomalies'] LOOP
    IF to_regclass(format('public.%I',t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS portal_server_only ON public.%I',t);
    EXECUTE format('CREATE POLICY portal_server_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.portal_may_use_raw_erp_tables())) WITH CHECK ((SELECT public.portal_may_use_raw_erp_tables()))',t);
  END LOOP;
END $$;
-- The login and module guards still read the caller's own row. Account and identity links
-- must only be provisioned by trusted server code; never self-writable through PostgREST.
DROP POLICY IF EXISTS portal_own_identity ON public.users;
CREATE POLICY portal_own_identity ON public.users AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id=auth.uid() OR (SELECT public.portal_may_use_raw_erp_tables()));
DROP POLICY IF EXISTS portal_no_identity_insert ON public.users;
CREATE POLICY portal_no_identity_insert ON public.users AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS portal_no_identity_update ON public.users;
CREATE POLICY portal_no_identity_update ON public.users AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS portal_no_identity_delete ON public.users;
CREATE POLICY portal_no_identity_delete ON public.users AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
-- This locks only one institution. All callers are server-only and release the row lock
-- on commit/rollback. Never cast a plain legacy registration number to JSON.
CREATE OR REPLACE FUNCTION public.portal_locked_metadata(p_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE raw text; meta jsonb;
BEGIN
  SELECT m.registration_no,COALESCE(NULLIF(to_jsonb(m)->'metadata','null'::jsonb),'{}'::jsonb)
  INTO STRICT raw,meta FROM public.madrasas m WHERE id=p_tenant FOR UPDATE;
  IF left(ltrim(raw),1)='{' THEN RETURN meta || raw::jsonb; END IF;
  IF coalesce(raw,'')<>'' THEN RETURN meta || jsonb_build_object('reg_no',raw); END IF;
  RETURN meta;
END $$;
REVOKE ALL ON FUNCTION public.portal_locked_metadata(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_locked_metadata(uuid) TO service_role;

-- A merchant may be shared by institutions. Reserve the reference BEFORE checkout;
-- a later verified val_id can be consumed once in that merchant/mode, not once per
-- tenant. Keep the claim independent of editable/voided receipts. No client access.
CREATE TABLE IF NOT EXISTS public.portal_fee_checkouts (
  merchant_scope text NOT NULL CHECK (merchant_scope ~ '^(SANDBOX|LIVE):[0-9a-f]{64}$'),
  transaction_id text NOT NULL,
  madrasa_id uuid NOT NULL REFERENCES public.madrasas ON DELETE CASCADE,
  student_id uuid NOT NULL,
  principal numeric NOT NULL CHECK (principal BETWEEN 0.01 AND 99999999.99 AND principal=round(principal,2)),
  charged numeric NOT NULL CHECK (charged BETWEEN principal AND 199999999.99 AND charged=round(charged,2)),
  allocations jsonb NOT NULL CHECK (jsonb_typeof(allocations)='array'),
  validation_id text,
  UNIQUE (madrasa_id, transaction_id),
  PRIMARY KEY (merchant_scope, transaction_id),
  UNIQUE (merchant_scope, validation_id)
);
ALTER TABLE public.portal_fee_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_fee_checkouts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE(validation_id) ON public.portal_fee_checkouts TO service_role;

-- Start and cancel operate on one pending intent, not a client-supplied replacement of
-- every transaction for the tenant. Do not lose other pending payments to a 500-row cap.
CREATE OR REPLACE FUNCTION public.write_portal_fee_intent(p_tenant uuid,p_txn jsonb,p_cancel boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); txns jsonb:=coalesce(meta->'online_transactions','[]');
  old jsonb; pos bigint; allocation jsonb; ref text:=p_txn->>'transaction_id';
BEGIN
  IF coalesce(ref,'')='' OR (p_txn->>'madrasa_id')::uuid IS DISTINCT FROM p_tenant THEN RAISE EXCEPTION 'Invalid intent'; END IF;
  IF p_cancel THEN
    SELECT value,ordinality-1 INTO STRICT old,pos FROM jsonb_array_elements(txns) WITH ORDINALITY WHERE value->>'transaction_id'=ref;
    IF old->>'status' IS DISTINCT FROM 'PENDING' THEN RAISE EXCEPTION 'Transaction is no longer pending'; END IF;
    txns:=jsonb_set(txns,ARRAY[pos::text],old || jsonb_build_object('status','FAILED','notes',p_txn->>'notes'));
  ELSE
    IF p_txn->>'status' IS DISTINCT FROM 'PENDING' OR EXISTS(SELECT 1 FROM jsonb_array_elements(txns) t WHERE t->>'transaction_id'=ref) THEN RAISE EXCEPTION 'Invalid or duplicate intent'; END IF;
    IF p_txn->>'provider'='SSLCOMMERZ' AND coalesce(p_txn->>'sslcommerz_scope','') !~ '^(SANDBOX|LIVE):[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Missing checkout merchant binding'; END IF;
    IF jsonb_array_length(p_txn->'allocations') IS NULL OR jsonb_array_length(p_txn->'allocations')=0 THEN RAISE EXCEPTION 'Select a posted bill'; END IF;
    FOR allocation IN SELECT value FROM jsonb_array_elements(p_txn->'allocations') LOOP
      IF NOT EXISTS(SELECT 1 FROM public.student_fees WHERE madrasa_id=p_tenant AND student_id=(p_txn->>'student_id')::uuid AND id=allocation->>'student_fee_id' AND (allocation->>'allocated_amount')::numeric BETWEEN 0.01 AND due_amount) THEN RAISE EXCEPTION 'Bill unavailable; refresh or reconcile legacy bills before payment'; END IF;
    END LOOP;
    IF p_txn->>'provider'='SSLCOMMERZ' THEN
      IF (p_txn->>'total_payable')::numeric IS DISTINCT FROM (p_txn->>'amount')::numeric+coalesce((p_txn->>'convenience_fee')::numeric,0)
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_txn->'allocations') a GROUP BY a->>'student_fee_id' HAVING count(*)<>1)
        OR (SELECT sum((a->>'allocated_amount')::numeric) FROM jsonb_array_elements(p_txn->'allocations') a) IS DISTINCT FROM (p_txn->>'amount')::numeric
      THEN RAISE EXCEPTION 'Invalid checkout totals'; END IF;
      -- Keep the financial terms, not the pupil's name, phone or merchant credentials.
      INSERT INTO public.portal_fee_checkouts(merchant_scope,transaction_id,madrasa_id,student_id,principal,charged,allocations)
        VALUES(p_txn->>'sslcommerz_scope',ref,p_tenant,(p_txn->>'student_id')::uuid,(p_txn->>'amount')::numeric,
          (p_txn->>'total_payable')::numeric,p_txn->'allocations');
    END IF;
    txns:=jsonb_build_array(p_txn) || txns;
  END IF;
  UPDATE public.madrasas SET registration_no=jsonb_set(meta,'{online_transactions}',txns)::text WHERE id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.write_portal_fee_intent(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_portal_fee_intent(uuid,jsonb,boolean) TO service_role;

ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS db_fee_id uuid;
-- Preserve the cashier's existing per-bill fund mapping on each online allocation.
-- Nullable for legacy bills: do not invent a fund or backfill historical entries.
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS fund_id text, ADD COLUMN IF NOT EXISTS fund_name text;
ALTER TABLE public.fee_payment_allocations ADD COLUMN IF NOT EXISTS fund_id text, ADD COLUMN IF NOT EXISTS fund_name text;
-- Only the verified online-fee path; this is NOT a general manual cashier/void/fund-posting RPC.
CREATE OR REPLACE FUNCTION public.settle_portal_fee_intent(p_tenant uuid,p_expected jsonb,p_ref text,p_bank text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); txns jsonb:=meta->'online_transactions'; txn jsonb; pos bigint;
  checkout public.portal_fee_checkouts%ROWTYPE; alloc jsonb; bill public.student_fees%ROWTYPE; pupil uuid; paid numeric; posted numeric:=0; slice numeric;
  d date:=(now() AT TIME ZONE 'Asia/Dhaka')::date; receipt text; serial bigint; legacy_id uuid;
  ref text:=p_expected->>'transaction_id'; payment text:='online:'||p_tenant::text||':'||ref; session_key text;
BEGIN
  SELECT value,ordinality-1 INTO STRICT txn,pos FROM jsonb_array_elements(txns) WITH ORDINALITY WHERE value->>'transaction_id'=ref;
  IF (txn->>'madrasa_id')::uuid IS DISTINCT FROM p_tenant OR coalesce(btrim(p_ref),'')='' THEN RAISE EXCEPTION 'Invalid settlement identity'; END IF;
  SELECT * INTO checkout FROM public.portal_fee_checkouts WHERE madrasa_id=p_tenant AND transaction_id=ref;
  IF FOUND THEN
    -- A proof for the same gross cannot fund a different child, bill or fee/charge split.
    IF txn->>'provider' IS DISTINCT FROM 'SSLCOMMERZ' OR
      (checkout.merchant_scope,checkout.student_id,checkout.principal,checkout.charged,checkout.allocations) IS DISTINCT FROM
      (txn->>'sslcommerz_scope',(txn->>'student_id')::uuid,(txn->>'amount')::numeric,(txn->>'total_payable')::numeric,txn->'allocations')
    THEN RAISE EXCEPTION 'Checkout terms changed; reconciliation required'; END IF;
  ELSIF txn ? 'sslcommerz_scope' OR (txn->>'provider'='SSLCOMMERZ' AND txn->>'status'<>'SUCCESS') THEN
    RAISE EXCEPTION 'Missing checkout reservation; reconciliation required';
  END IF;
  IF txn->>'status'='SUCCESS' THEN
    -- p_expected may be the pending version read by an overlapping return/IPN.
    -- A JSON success flag is not itself a receipt. Do not ACK a second validation
    -- ID, a vanished/voided posting or a change of student, amount or allocations.
    IF (txn - ARRAY['status','receipt_no','completed_at','gateway_ref','bank_tran_id']) IS DISTINCT FROM
       (p_expected - ARRAY['status','receipt_no','completed_at','gateway_ref','bank_tran_id'])
      OR (txn->>'provider'='SSLCOMMERZ' AND txn->>'gateway_ref' IS DISTINCT FROM p_ref)
      OR (checkout.transaction_id IS NOT NULL AND (checkout.validation_id IS DISTINCT FROM p_ref OR txn->>'bank_tran_id' IS DISTINCT FROM p_bank))
      OR NOT EXISTS (SELECT 1 FROM public.fee_payments fp WHERE fp.madrasa_id=p_tenant AND fp.id=payment
        AND fp.student_id=(txn->>'student_id')::uuid AND fp.receipt_no=txn->>'receipt_no'
        AND fp.status='COMPLETED' AND fp.total_amount_received=(txn->>'amount')::numeric
        AND fp.transaction_ref=txn->>'gateway_ref')
    THEN RAISE EXCEPTION 'Posted receipt or proof differs; reconciliation required'; END IF;
    RETURN jsonb_build_object('receipt_no',txn->>'receipt_no','already_paid',true);
  END IF;
  IF txn IS DISTINCT FROM p_expected OR txn->>'status' IS DISTINCT FROM 'PENDING' THEN RAISE EXCEPTION 'Transaction changed; verify again'; END IF;
  IF txn->>'provider'='SSLCOMMERZ' THEN
    UPDATE public.portal_fee_checkouts c SET validation_id=p_ref
      WHERE c.merchant_scope=txn->>'sslcommerz_scope' AND c.transaction_id=ref AND c.madrasa_id=p_tenant AND c.validation_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unbound or already claimed checkout; reconciliation required'; END IF;
  END IF;
  pupil:=(txn->>'student_id')::uuid;paid:=(txn->>'amount')::numeric;
  IF (paid BETWEEN 0.01 AND 99999999.99 AND paid=round(paid,2)) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.students WHERE id=pupil AND madrasa_id=p_tenant) THEN RAISE EXCEPTION 'Invalid pupil or amount'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(txn->'allocations') a GROUP BY a->>'student_fee_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate bill'; END IF;
  -- The tenant lock serializes callback retries. The receipt uniqueness constraint also
  -- prevents a collision with a concurrent legacy cashier from partially writing anything.
  SELECT greatest(100,coalesce((meta->>'receipt_counter')::bigint,0),coalesce(max((substring(receipt_no FROM ('^MR-'||extract(year FROM d)::text||'-([0-9]+)')))::bigint),0))+1
    INTO serial FROM public.fee_payments WHERE madrasa_id=p_tenant;
  receipt:='MR-'||extract(year FROM d)::text||'-'||lpad(serial::text,greatest(5,length(serial::text)), '0');
  INSERT INTO public.fees(madrasa_id,student_id,fee_type,amount,payment_date,fee_month,fee_year,notes) VALUES
    (p_tenant,pupil,'Monthly',paid,d,to_char(d,'FMMonth'),extract(year FROM d)::text,'[অনলাইন পেমেন্ট: '||receipt||' | Trx: '||ref||']') RETURNING id INTO legacy_id;
  INSERT INTO public.fee_payments(id,receipt_no,madrasa_id,student_id,session_id,student_name,student_roll,class_name,total_amount_received,payment_date,payment_method,transaction_ref,collector_name,db_fee_id,notes)
    VALUES(payment,receipt,p_tenant,pupil,'online',txn->>'student_name',txn->>'student_roll',txn->>'class_name',paid,d,
      CASE txn->>'payment_channel' WHEN 'Islami Bank' THEN 'Bank' WHEN 'Card / Other' THEN 'Other' ELSE txn->>'payment_channel' END,
      p_ref,'অনলাইন গেটওয়ে',legacy_id,'[অনলাইন ট্রানজেকশন ID: '||ref||']');
  FOR alloc IN SELECT value FROM jsonb_array_elements(txn->'allocations') ORDER BY value->>'student_fee_id' LOOP
    SELECT * INTO STRICT bill FROM public.student_fees WHERE id=alloc->>'student_fee_id' AND madrasa_id=p_tenant AND student_id=pupil FOR UPDATE;
    slice:=(alloc->>'allocated_amount')::numeric;
    IF slice IS NULL OR slice<=0 OR slice<>round(slice,2) OR slice>bill.due_amount THEN RAISE EXCEPTION 'Bill balance changed; reconciliation required'; END IF;
    posted:=posted+slice;session_key:=CASE WHEN session_key IS NULL OR session_key=bill.session_id THEN bill.session_id ELSE 'online' END;
    UPDATE public.student_fees SET paid_amount=paid_amount+slice,due_amount=due_amount-slice,status=CASE WHEN due_amount=slice THEN 'PAID' ELSE 'PARTIAL' END,updated_at=now() WHERE id=bill.id;
    INSERT INTO public.fee_payment_allocations(payment_id,student_fee_id,fee_type_id,fee_type_name,billing_period,allocated_amount,fund_id,fund_name)
      VALUES(payment,bill.id,bill.fee_type_id,bill.fee_type_name,bill.billing_period,slice,bill.fund_id,bill.fund_name);
  END LOOP;
  IF posted IS DISTINCT FROM paid OR posted<=0 THEN RAISE EXCEPTION 'Allocations do not equal fee amount'; END IF;
  UPDATE public.fee_payments SET session_id=session_key WHERE id=payment;
  txn:=txn||jsonb_build_object('receipt_no',receipt,'status','SUCCESS','gateway_ref',p_ref,'bank_tran_id',p_bank,'completed_at',now());
  UPDATE public.madrasas SET registration_no=(meta||jsonb_build_object('online_transactions',jsonb_set(txns,ARRAY[pos::text],txn),'receipt_counter',serial))::text WHERE id=p_tenant;
  RETURN jsonb_build_object('already_paid',false,'receipt_no',receipt);
END $$;
REVOKE ALL ON FUNCTION public.settle_portal_fee_intent(uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_portal_fee_intent(uuid,jsonb,text,text) TO service_role;

-- Changing gateway settings or opening a donation checkout must not replace a
-- concurrent fee receipt. Compare and replace just the key the operator read.
CREATE OR REPLACE FUNCTION public.replace_portal_gateway_key(p_tenant uuid,p_key text,p_before jsonb,p_after jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant);
BEGIN
  IF p_key IS NULL OR p_key NOT IN ('payment_gateway_config','online_donations')
    OR jsonb_typeof(p_after) IS DISTINCT FROM (CASE p_key WHEN 'online_donations' THEN 'array' ELSE 'object' END)
    OR NULLIF(meta->p_key,'null'::jsonb) IS DISTINCT FROM NULLIF(p_before,'null'::jsonb)
  THEN RAISE EXCEPTION 'Gateway records changed; refresh and retry'; END IF;
  UPDATE public.madrasas SET registration_no=jsonb_set(meta,ARRAY[p_key],p_after)::text WHERE id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.replace_portal_gateway_key(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_portal_gateway_key(uuid,text,jsonb,jsonb) TO service_role;

-- The donation return shares the same metadata row as fees. A slow validator
-- must not save its old copy of the whole document over a newly posted fee.
-- This confirms the existing donation flag only, not a general donor-ledger RPC.
CREATE OR REPLACE FUNCTION public.confirm_portal_donation_return(p_tenant uuid,p_expected jsonb,p_ref text)
RETURNS text LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); d jsonb; pos bigint; receipt text;
BEGIN
  SELECT value,ordinality-1 INTO STRICT d,pos FROM jsonb_array_elements(meta->'online_donations') WITH ORDINALITY
    WHERE value->>'trx_id'=p_expected->>'trx_id';
  receipt:=d->>'receipt_no';
  IF d->>'madrasa_id' IS DISTINCT FROM p_tenant::text OR d->>'gateway_provider' IS DISTINCT FROM 'SSLCOMMERZ'
    OR coalesce(receipt,'')='' OR coalesce(p_ref,'')=''
    OR (d - ARRAY['status','verified_at','verified_by','gateway_ref']) IS DISTINCT FROM
       (p_expected - ARRAY['status','verified_at','verified_by','gateway_ref']) THEN RAISE EXCEPTION 'Donation changed'; END IF;
  IF d->>'status'='VERIFIED' AND (d->>'gateway_ref' IS NULL OR d->>'gateway_ref'=p_ref) THEN RETURN receipt; END IF;
  IF d->>'status' IS DISTINCT FROM 'PENDING' OR d IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Donation not pending'; END IF;
  UPDATE public.madrasas SET registration_no=jsonb_set(meta,ARRAY['online_donations',pos::text],
    d||jsonb_build_object('status','VERIFIED','gateway_ref',p_ref,'verified_at',now(),'verified_by','SSLCommerz'))::text WHERE id=p_tenant;
  RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.confirm_portal_donation_return(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_portal_donation_return(uuid,jsonb,text) TO service_role;

-- No multi-call half-promotions: compare and lock the tenant metadata and expected roster.
-- No access for PostgREST clients; the guarded Server Action validates source/destination sessions.
CREATE OR REPLACE FUNCTION public.apply_portal_promotion(p_tenant uuid,p_before jsonb,p_after jsonb,p_changes jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE original jsonb:=public.portal_locked_metadata(p_tenant); change jsonb; dest uuid; name_of_class text;
BEGIN
  IF original IS DISTINCT FROM p_before THEN RAISE EXCEPTION 'Enrollment changed; refresh and retry'; END IF;
  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    dest:=(change->>'class_id')::uuid; name_of_class:=NULL;
    IF dest IS NOT NULL THEN SELECT name INTO STRICT name_of_class FROM public.classes WHERE id=dest AND madrasa_id=p_tenant; END IF;
    UPDATE public.students SET class_id=dest,class_name=name_of_class,roll_number=change->>'roll_number'
      WHERE id=(change->>'id')::uuid AND madrasa_id=p_tenant AND class_id IS NOT DISTINCT FROM (change->>'previous_class')::uuid AND roll_number IS NOT DISTINCT FROM change->>'previous_roll';
    IF NOT FOUND THEN RAISE EXCEPTION 'Roster changed; refresh and retry'; END IF;
    IF dest IS DISTINCT FROM (change->>'previous_class')::uuid OR dest IS NULL THEN
      -- Some older installations store the section on the roster as well as in JSON.
      IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.students'::regclass AND attname='section' AND NOT attisdropped) THEN
        EXECUTE 'UPDATE public.students SET section=NULL WHERE id=$1 AND madrasa_id=$2' USING (change->>'id')::uuid,p_tenant;
      END IF;
      IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.students'::regclass AND attname='section_id' AND NOT attisdropped) THEN
        EXECUTE 'UPDATE public.students SET section_id=NULL WHERE id=$1 AND madrasa_id=$2' USING (change->>'id')::uuid,p_tenant;
      END IF;
    END IF;
  END LOOP;
  UPDATE public.madrasas SET registration_no=p_after::text WHERE id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.apply_portal_promotion(uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_portal_promotion(uuid,jsonb,jsonb,jsonb) TO service_role;
-- A failed unpublish must not leave a visible status mirror (or vice versa).
CREATE OR REPLACE FUNCTION public.set_portal_exam_publication(p_tenant uuid,p_exam uuid,p_info jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); flags jsonb; old_info jsonb; old_status text;
BEGIN
  IF jsonb_typeof(p_info->'is_published') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid publication flag'; END IF;
  flags:=COALESCE(meta->'published_exams','{}'::jsonb);
  IF jsonb_typeof(flags)<>'object' THEN RAISE EXCEPTION 'Invalid publication store'; END IF;
  SELECT status INTO STRICT old_status FROM public.exams WHERE id=p_exam AND madrasa_id=p_tenant FOR UPDATE;
  SELECT setting_value INTO old_info FROM public.exam_settings WHERE madrasa_id=p_tenant AND scope_key=p_exam::text AND setting_key='publish_info';
  INSERT INTO public.exam_settings(madrasa_id,exam_id,scope_key,setting_key,setting_value,updated_by)
    VALUES(p_tenant,p_exam,p_exam::text,'publish_info',p_info,p_actor)
    ON CONFLICT(madrasa_id,scope_key,setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=now();
  UPDATE public.exams SET status=CASE WHEN (p_info->>'is_published')::boolean THEN 'Published' ELSE 'Completed' END WHERE id=p_exam AND madrasa_id=p_tenant;
  UPDATE public.madrasas SET registration_no=(meta || jsonb_build_object('published_exams',flags || jsonb_build_object(p_exam::text,p_info)))::text WHERE id=p_tenant;
  RETURN coalesce(old_info,flags->(p_exam::text),jsonb_build_object('is_published',old_status='Published'));
END $$;
REVOKE ALL ON FUNCTION public.set_portal_exam_publication(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_portal_exam_publication(uuid,uuid,jsonb,uuid) TO service_role;
-- These reporting objects bypass table RLS; their server adapters already use service_role.
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['public.get_executive_bi_snapshot(uuid,int,text)','public.refresh_bi_materialized_views()'] LOOP
    IF to_regprocedure(name) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON FUNCTION '||name||' FROM PUBLIC,anon,authenticated';
      EXECUTE 'GRANT EXECUTE ON FUNCTION '||name||' TO service_role';
    END IF;
  END LOOP;
  FOREACH name IN ARRAY ARRAY['mv_bi_boarding_monthly','mv_bi_fund_health','mv_bi_class_fee_dues','mv_bi_session_exam_results'] LOOP
    IF to_regclass('public.'||name) IS NOT NULL THEN EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC,anon,authenticated',name); END IF;
  END LOOP;
END $$;
COMMIT;
