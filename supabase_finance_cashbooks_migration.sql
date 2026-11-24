-- Phase 2. Apply AFTER supabase_finance_integrity_migration.sql. No historical backfill.
BEGIN;
CREATE TABLE IF NOT EXISTS public.treasury_journals (
  id uuid PRIMARY KEY, madrasa_id uuid NOT NULL REFERENCES public.madrasas, actor_id uuid NOT NULL REFERENCES public.users,
  posting_date date NOT NULL, kind text NOT NULL CHECK(kind IN ('TRANSFER','OPENING','ADJUST_IN','ADJUST_OUT')),
  from_fund text, to_fund text, amount numeric(14,2) NOT NULL CHECK(amount>0), reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (CASE kind WHEN 'TRANSFER' THEN from_fund IS NOT NULL AND to_fund IS NOT NULL AND from_fund<>to_fund
    WHEN 'ADJUST_OUT' THEN from_fund IS NOT NULL AND to_fund IS NULL ELSE from_fund IS NULL AND to_fund IS NOT NULL END));
CREATE UNIQUE INDEX IF NOT EXISTS treasury_open_once ON public.treasury_journals(madrasa_id,to_fund) WHERE kind='OPENING';
CREATE INDEX IF NOT EXISTS treasury_journal_date ON public.treasury_journals(madrasa_id,posting_date);
CREATE TABLE IF NOT EXISTS public.treasury_epochs (madrasa_id uuid PRIMARY KEY, revision bigint NOT NULL);
CREATE TABLE IF NOT EXISTS public.treasury_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), madrasa_id uuid NOT NULL REFERENCES public.madrasas,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100), policy text NOT NULL CHECK(policy IN ('Food','Utility','Maintenance','Salary','Other')),
  active boolean NOT NULL DEFAULT true, changed_by uuid NOT NULL REFERENCES public.users);
CREATE UNIQUE INDEX IF NOT EXISTS treasury_head_name ON public.treasury_heads(madrasa_id,lower(btrim(name)));
CREATE TABLE IF NOT EXISTS public.treasury_days (
  madrasa_id uuid NOT NULL REFERENCES public.madrasas, operator_id uuid NOT NULL REFERENCES public.users, cash_date date NOT NULL,
  opening numeric(14,2) NOT NULL CHECK(opening>=0), counted numeric(14,2) CHECK(counted>=0), expected numeric(14,2),
  note text, opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, PRIMARY KEY(madrasa_id,operator_id,cash_date));
CREATE TABLE IF NOT EXISTS public.treasury_movements (
  id uuid PRIMARY KEY, madrasa_id uuid NOT NULL REFERENCES public.madrasas, sender uuid NOT NULL REFERENCES public.users,
  recipient uuid REFERENCES public.users, cash_date date NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>0), reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz, CHECK(recipient<>sender)); -- NULL recipient = bank deposit
ALTER TABLE public.treasury_movements ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE INDEX IF NOT EXISTS treasury_moves_date ON public.treasury_movements(madrasa_id,cash_date);
CREATE TABLE IF NOT EXISTS public.treasury_fee_tenders (
  madrasa_id uuid NOT NULL REFERENCES public.madrasas, payment_id text NOT NULL, operator_id uuid NOT NULL REFERENCES public.users,
  cash_date date NOT NULL, method text NOT NULL, relational boolean NOT NULL, PRIMARY KEY(madrasa_id,payment_id));
CREATE INDEX IF NOT EXISTS treasury_fee_till ON public.treasury_fee_tenders(madrasa_id,operator_id,cash_date);
CREATE TABLE IF NOT EXISTS public.treasury_memos (
  expense_id uuid PRIMARY KEY REFERENCES public.expenses, madrasa_id uuid NOT NULL REFERENCES public.madrasas,
  actor_id uuid NOT NULL REFERENCES public.users, image bytea NOT NULL CHECK(octet_length(image) BETWEEN 4 AND 2097152 AND substring(image for 3)=decode('ffd8ff','hex')),
  created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS operator_id uuid, ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.bazar_expenses ADD COLUMN IF NOT EXISTS operator_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS operator_id uuid, ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS head_id uuid REFERENCES public.treasury_heads, ADD COLUMN IF NOT EXISTS head_name text,
  ADD COLUMN IF NOT EXISTS line_items jsonb, ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students, ADD COLUMN IF NOT EXISTS staff_id text;
CREATE INDEX IF NOT EXISTS treasury_expense_till ON public.expenses(madrasa_id,operator_id,expense_date) WHERE operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS treasury_donation_till ON public.donations(madrasa_id,operator_id,donation_date) WHERE operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS treasury_bazar_till ON public.bazar_expenses(madrasa_id,operator_id,expense_date) WHERE operator_id IS NOT NULL;

-- Only trusted session-bound actions call these routines. Serialize close/post and both sides of handovers.
CREATE OR REPLACE FUNCTION public.treasury_actor(t uuid,a uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.madrasas WHERE id=t FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT FROM public.users WHERE id=a AND madrasa_id=t) THEN RAISE EXCEPTION 'Operator or institution mismatch'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.treasury_day_writable(t uuid,a uuid,d date) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF d IS NULL OR EXISTS(SELECT FROM public.finance_closed_periods(t) WHERE d BETWEEN start_date AND end_date) OR
    EXISTS(SELECT FROM public.treasury_days WHERE madrasa_id=t AND operator_id=a AND cash_date=d AND closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Cash day or accounting period is closed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.treasury_amount(n numeric,allow_zero boolean DEFAULT false) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF (n BETWEEN 0 AND 9999999999.99 AND n=round(n,2) AND (allow_zero OR n>0)) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid taka amount'; END IF;
  RETURN n;
END $$;
-- The projection used to establish source funds includes legacy/JSON receipts, not just SQL cash. Reject a stale
-- server-calculated balance if ANY input has changed before the journal is booked. Never trust a browser balance.
CREATE OR REPLACE FUNCTION public.treasury_tick() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; t uuid;
BEGIN
  IF TG_TABLE_NAME='madrasas' THEN t:=(r->>'id')::uuid;
  ELSIF TG_TABLE_NAME='fee_payment_allocations' THEN SELECT madrasa_id INTO t FROM public.fee_payments WHERE id=r->>'payment_id';
  ELSE t:=(r->>'madrasa_id')::uuid; END IF;
  IF t IS NOT NULL THEN INSERT INTO public.treasury_epochs VALUES(t,1) ON CONFLICT(madrasa_id) DO UPDATE SET revision=treasury_epochs.revision+1; END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['donations','expenses','bazar_expenses','fees','fee_payments','fee_payment_allocations','fee_types','student_fees','fee_structures','zakat_funds','treasury_journals'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS treasury_tick ON public.%I',tab);
    EXECUTE format('CREATE TRIGGER treasury_tick AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.treasury_tick()',tab);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS treasury_tick ON public.madrasas;
CREATE TRIGGER treasury_tick AFTER UPDATE OF registration_no,metadata ON public.madrasas FOR EACH ROW EXECUTE FUNCTION public.treasury_tick();
CREATE OR REPLACE FUNCTION public.treasury_post_journal(t uuid,a uuid,k uuid,d date,kind_ text,src text,dst text,n numeric,memo text,rev bigint,available numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.treasury_journals; f jsonb; current_rev bigint;
BEGIN
  PERFORM public.treasury_actor(t,a); PERFORM public.treasury_amount(n);
  IF k IS NULL OR NOT(length(btrim(coalesce(memo,''))) BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'Voucher ID and reason required'; END IF;
  SELECT * INTO old FROM public.treasury_journals WHERE id=k;
  IF FOUND THEN
    IF (old.madrasa_id,old.actor_id,old.posting_date,old.kind,old.from_fund,old.to_fund,old.amount,old.reason) IS DISTINCT FROM
       (t,a,d,kind_,src,dst,n,btrim(memo)) THEN RAISE EXCEPTION 'Voucher ID already used'; END IF; RETURN k;
  END IF;
  IF d>(now() AT TIME ZONE 'Asia/Dhaka')::date THEN RAISE EXCEPTION 'Future posting date'; END IF;
  PERFORM public.treasury_day_writable(t,NULL,d);
  IF src IS NOT NULL THEN
    f:=public.finance_posting_fund(t,src,'deposit',NULL,NULL);
    IF public.finance_is_restricted(f) THEN RAISE EXCEPTION 'Restricted fund cannot be transferred or adjusted out'; END IF;
    INSERT INTO public.treasury_epochs VALUES(t,0) ON CONFLICT DO NOTHING;
    SELECT revision INTO current_rev FROM public.treasury_epochs WHERE madrasa_id=t FOR UPDATE;
    IF rev IS DISTINCT FROM current_rev OR (available>=n) IS NOT TRUE THEN RAISE EXCEPTION 'Insufficient or changed source balance; refresh'; END IF;
  END IF;
  IF dst IS NOT NULL THEN PERFORM public.finance_posting_fund(t,dst,'deposit',NULL,NULL); END IF;
  INSERT INTO public.treasury_journals(id,madrasa_id,actor_id,posting_date,kind,from_fund,to_fund,amount,reason) VALUES(k,t,a,d,kind_,src,dst,n,btrim(memo));
  RETURN k;
END $$;
CREATE OR REPLACE FUNCTION public.treasury_head(t uuid,a uuid,k uuid,label text,policy_ text,enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM public.treasury_actor(t,a);
  IF k IS NULL THEN INSERT INTO public.treasury_heads(madrasa_id,changed_by,name,policy,active) VALUES(t,a,btrim(label),policy_,enabled);
  ELSE UPDATE public.treasury_heads SET changed_by=a,name=btrim(label),active=enabled WHERE id=k AND madrasa_id=t AND policy=policy_;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown head or changed policy'; END IF;
  END IF;
END $$;

-- New vouchers only. Do not assign a cashier or tender by name, old default, receipt number or narrative.
CREATE OR REPLACE FUNCTION public.treasury_guard_voucher() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; old_r jsonb; d date; old_d date; h public.treasury_heads; l jsonb; total numeric:=0;
BEGIN
  IF TG_OP<>'INSERT' THEN
    old_r:=to_jsonb(OLD); old_d:=coalesce(old_r->>'expense_date',old_r->>'donation_date')::date;
    IF OLD.operator_id IS NOT NULL THEN
      PERFORM public.treasury_actor(OLD.madrasa_id,OLD.operator_id);
      IF upper(OLD.payment_method)='CASH' THEN PERFORM public.treasury_day_writable(OLD.madrasa_id,OLD.operator_id,old_d); END IF;
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Keep the original voucher; use a reasoned void'; END IF;
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    IF (NEW.operator_id,NEW.payment_method) IS DISTINCT FROM (OLD.operator_id,OLD.payment_method) THEN RAISE EXCEPTION 'Voucher tender and cashier are immutable'; END IF;
  ELSE
    NEW.operator_id:=coalesce(NEW.operator_id,nullif(current_setting('qawmi.till_actor',true),'')::uuid);
    NEW.payment_method:=coalesce(NEW.payment_method,nullif(current_setting('qawmi.till_method',true),''));
  END IF;
  r:=to_jsonb(NEW); d:=coalesce(r->>'expense_date',r->>'donation_date')::date;
  IF NEW.operator_id IS NOT NULL THEN
    PERFORM public.treasury_actor(NEW.madrasa_id,NEW.operator_id);
    IF upper(NEW.payment_method)='CASH' THEN PERFORM public.treasury_day_writable(NEW.madrasa_id,NEW.operator_id,d); END IF;
  END IF;
  IF TG_TABLE_NAME='expenses' THEN
    IF TG_OP='UPDATE' AND (r->'line_items',r->'head_id',r->'head_name',r->'student_id',r->'staff_id') IS DISTINCT FROM
      (old_r->'line_items',old_r->'head_id',old_r->'head_name',old_r->'student_id',old_r->'staff_id') THEN RAISE EXCEPTION 'Voucher details are immutable; void and reissue'; END IF;
    IF TG_OP='UPDATE' AND (NEW.head_id IS NOT NULL OR NEW.line_items IS NOT NULL OR NEW.student_id IS NOT NULL OR NEW.staff_id IS NOT NULL OR EXISTS(SELECT FROM public.treasury_memos WHERE expense_id=OLD.id)) AND
      ((NEW.category,NEW.amount,NEW.voucher_no,NEW.expense_date,NEW.restricted_beneficiary) IS DISTINCT FROM (OLD.category,OLD.amount,OLD.voucher_no,OLD.expense_date,OLD.restricted_beneficiary) OR
      btrim(regexp_replace(coalesce(NEW.description,''),'\[VOID:[^]]*\]\s*','','gi')) IS DISTINCT FROM btrim(regexp_replace(coalesce(OLD.description,''),'\[VOID:[^]]*\]\s*','','gi'))) THEN RAISE EXCEPTION 'আইটেম বা মেমোযুক্ত মূল ভাউচার বদলাবেন না। বাতিল করে নতুন ভাউচার দিন।'; END IF;
    IF TG_OP='INSERT' THEN
      IF NEW.head_id IS NOT NULL THEN SELECT * INTO STRICT h FROM public.treasury_heads WHERE id=NEW.head_id AND madrasa_id=NEW.madrasa_id AND active AND policy=NEW.category;
        IF NEW.head_name IS NOT NULL AND NEW.head_name IS DISTINCT FROM h.name THEN RAISE EXCEPTION 'Expense head changed; refresh and review'; END IF;
        NEW.head_name:=h.name;
      ELSE NEW.head_name:=NULL; END IF;
      IF NEW.student_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.students WHERE id=NEW.student_id AND madrasa_id=NEW.madrasa_id) THEN RAISE EXCEPTION 'Unknown student'; END IF;
      IF NEW.staff_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.madrasas m,jsonb_array_elements(public.finance_metadata(m)->'staff_members') s WHERE m.id=NEW.madrasa_id AND s->>'id'=NEW.staff_id AND coalesce(s->>'madrasa_id',m.id::text)=m.id::text) THEN RAISE EXCEPTION 'Unknown staff'; END IF;
      IF NEW.line_items IS NOT NULL THEN
        IF jsonb_typeof(NEW.line_items)<>'array' OR jsonb_array_length(NEW.line_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid voucher lines'; END IF;
        FOR l IN SELECT value FROM jsonb_array_elements(NEW.line_items) LOOP
          IF jsonb_typeof(l->'label') IS DISTINCT FROM 'string' OR length(btrim(l->>'label')) NOT BETWEEN 1 AND 180 OR l-ARRAY['label','amount']<>'{}' OR jsonb_typeof(l->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid voucher line'; END IF;
          total:=total+public.treasury_amount((l->>'amount')::numeric);
        END LOOP;
        IF total<>NEW.amount THEN RAISE EXCEPTION 'Voucher lines do not total the expense'; END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['donations','expenses','bazar_expenses'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS aa_treasury_voucher ON public.%I',tab);
  EXECUTE format('CREATE TRIGGER aa_treasury_voucher BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.treasury_guard_voucher()',tab);
END LOOP; END $$;
-- Overloads, not replacements: the Phase 1 RPC still performs every original check and write.
-- The additional arguments come ONLY from server-side sessions; no failed-write fallback.
CREATE OR REPLACE FUNCTION public.treasury_context(t uuid,a uuid,method text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  PERFORM public.treasury_actor(t,a); PERFORM set_config('qawmi.till_actor',a::text,true); PERFORM set_config('qawmi.till_method',coalesce(nullif(btrim(method),''),'Unknown'),true);
END $$;
-- Leather sales and carriage are distinct tenders. Preserve both metadata mirrors, count the cost once.
CREATE OR REPLACE FUNCTION public.treasury_transport(m jsonb) RETURNS TABLE(id text,operator_id uuid,method text,d date,n numeric,voided boolean)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT l->>'id',(l->>'transport_operator_id')::uuid,l->>'transport_method',coalesce(l->>'sale_date',l->>'collection_date')::date,
    coalesce(l->>'transport_labour_cost',l->>'transport_labor_cost')::numeric,
    coalesce(l->>'status','')='VOID' OR coalesce(l->>'expense_status','')='VOID' OR coalesce(l->>'exp_notes','') LIKE '%[VOID:%'
  FROM jsonb_array_elements(m) l WHERE l->>'transport_operator_id' IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION public.treasury_guard_transport() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb:=public.finance_metadata(NEW); old_m jsonb:=public.finance_metadata(OLD); r record;
BEGIN
  IF (m->'qurbani_leather_records',m->'leather_batches') IS NOT DISTINCT FROM (old_m->'qurbani_leather_records',old_m->'leather_batches') THEN RETURN NEW; END IF;
  IF EXISTS(SELECT id FROM public.treasury_transport(m->'qurbani_leather_records') GROUP BY id HAVING count(*)>1) OR
    EXISTS((SELECT * FROM public.treasury_transport(m->'qurbani_leather_records') EXCEPT ALL SELECT * FROM public.treasury_transport(m->'leather_batches')) UNION ALL
           (SELECT * FROM public.treasury_transport(m->'leather_batches') EXCEPT ALL SELECT * FROM public.treasury_transport(m->'qurbani_leather_records'))) THEN RAISE EXCEPTION 'Transport voucher copies differ'; END IF;
  FOR r IN SELECT o.id AS old_id,o.operator_id AS old_operator,o.d AS old_date,o.method AS old_method,n.* FROM public.treasury_transport(old_m->'qurbani_leather_records') o
    FULL JOIN public.treasury_transport(m->'qurbani_leather_records') n USING(id) WHERE o.* IS DISTINCT FROM n.* LOOP
    IF r.old_id IS NOT NULL AND (r.old_operator,r.old_method) IS DISTINCT FROM (r.operator_id,r.method) THEN RAISE EXCEPTION 'Keep original transport tender; void instead'; END IF;
    IF r.old_id IS NULL AND (r.operator_id::text IS DISTINCT FROM current_setting('qawmi.till_actor',true) OR EXISTS(
      SELECT FROM jsonb_array_elements(coalesce(old_m->'qurbani_leather_records','[]')||coalesce(old_m->'leather_batches','[]')) l
      WHERE l->>'id'=r.id AND coalesce(l->>'transport_labour_cost',l->>'transport_labor_cost','0')::numeric>0)) THEN RAISE EXCEPTION 'Unverified or historical transport operator'; END IF;
    IF r.d IS NULL OR nullif(btrim(r.method),'') IS NULL OR NOT EXISTS(SELECT FROM public.users WHERE id=r.operator_id AND madrasa_id=NEW.id) THEN RAISE EXCEPTION 'Invalid transport tender'; END IF;
    PERFORM public.treasury_amount(r.n);
    IF upper(r.method)='CASH' THEN
      IF r.old_date IS NOT NULL THEN PERFORM public.treasury_day_writable(NEW.id,r.operator_id,r.old_date); END IF;
      PERFORM public.treasury_day_writable(NEW.id,r.operator_id,r.d);
    END IF;
  END LOOP; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aa_treasury_transport ON public.madrasas;
CREATE TRIGGER aa_treasury_transport BEFORE UPDATE OF registration_no,metadata ON public.madrasas FOR EACH ROW EXECUTE FUNCTION public.treasury_guard_transport();
CREATE OR REPLACE FUNCTION public.finance_replace_sources(p_tenant uuid,p_before jsonb,p_after jsonb,p_operator uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.treasury_context(p_tenant,p_operator,'Unknown'); PERFORM public.finance_replace_sources(p_tenant,p_before,p_after); END $$;

CREATE OR REPLACE FUNCTION public.finance_receive_donation(t uuid,p_donor jsonb,p_receipt jsonb,p_operator uuid,p_method text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.treasury_context(t,p_operator,p_method); RETURN public.finance_receive_donation(t,p_donor,p_receipt); END $$;
CREATE OR REPLACE FUNCTION public.finance_post_collection(p_tenant uuid,p_before jsonb,p_after jsonb,p_kind text,p_row jsonb,p_edit boolean,p_operator uuid,p_method text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.treasury_context(p_tenant,p_operator,CASE WHEN p_after?'online_donations' THEN 'Online' ELSE p_method END);
  PERFORM public.finance_post_collection(p_tenant,p_before,p_after,p_kind,p_row,p_edit); END $$;
CREATE OR REPLACE FUNCTION public.finance_pay_salary(p_tenant uuid,p_actor uuid,p_record text,p_method text,p_ref text,p_remarks text,p_register boolean) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.treasury_context(p_tenant,p_actor,p_method); RETURN public.finance_pay_salary(p_tenant,p_actor,p_record,p_method,p_ref,p_remarks); END $$;
CREATE OR REPLACE FUNCTION public.finance_record_maintenance(p_tenant uuid,p_record jsonb,p_operator uuid,p_method text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.treasury_context(p_tenant,p_operator,p_method); RETURN public.finance_record_maintenance(p_tenant,p_record); END $$;
CREATE OR REPLACE FUNCTION public.finance_collect_fee(p_tenant uuid,p_actor uuid,p jsonb,p_expected jsonb,p_operator uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; d date:=(p->>'payment_date')::date; method text:=coalesce(nullif(btrim(p->>'payment_method'),''),'Unknown');
BEGIN
  PERFORM public.treasury_actor(p_tenant,p_operator); r:=public.finance_collect_fee(p_tenant,p_actor,p,p_expected);
  IF coalesce((r->>'already_posted')::boolean,false) OR (r->>'total_amount_received')::numeric=0 THEN RETURN r; END IF;
  IF upper(method)='CASH' THEN PERFORM public.treasury_day_writable(p_tenant,p_operator,d); END IF;
  INSERT INTO public.treasury_fee_tenders VALUES(p_tenant,r->>'id',p_operator,d,method,EXISTS(SELECT FROM public.fee_payments WHERE madrasa_id=p_tenant AND id=r->>'id'));
  RETURN r;
END $$;
-- A fee has one tender irrespective of allocations and legacy mirrors. Closing a drawer locks
-- status changes on that original payment, including fee_status writes in the legacy JSON book.
CREATE OR REPLACE FUNCTION public.treasury_guard_fee() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.treasury_fee_tenders; changed record; m jsonb; prev jsonb;
BEGIN
  IF TG_TABLE_NAME='fee_payments' THEN
    SELECT * INTO b FROM public.treasury_fee_tenders WHERE madrasa_id=OLD.madrasa_id AND payment_id=OLD.id;
    IF FOUND AND upper(b.method)='CASH' THEN
      PERFORM public.treasury_actor(b.madrasa_id,b.operator_id); PERFORM public.treasury_day_writable(b.madrasa_id,b.operator_id,b.cash_date);
      IF TG_OP='DELETE' OR (NEW.id,NEW.madrasa_id,NEW.payment_method,NEW.payment_date,NEW.total_amount_received) IS DISTINCT FROM
        (OLD.id,OLD.madrasa_id,OLD.payment_method,OLD.payment_date,OLD.total_amount_received) THEN RAISE EXCEPTION 'Keep original cash receipt'; END IF;
    END IF;
  ELSE
    m:=public.finance_metadata(NEW)->'payments'; prev:=public.finance_metadata(OLD)->'payments';
    IF m IS DISTINCT FROM prev THEN
      -- One pass per book, not two full JSON scans per historical cash receipt.
      FOR changed IN
        WITH old_rows AS (SELECT value->>'id' id,jsonb_agg(value) copies FROM jsonb_array_elements(prev) GROUP BY 1),
             new_rows AS (SELECT value->>'id' id,jsonb_agg(value) copies FROM jsonb_array_elements(m) GROUP BY 1)
        SELECT t.*,o.copies old_copies,n.copies new_copies FROM public.treasury_fee_tenders t
          LEFT JOIN old_rows o ON o.id=t.payment_id LEFT JOIN new_rows n ON n.id=t.payment_id
        WHERE t.madrasa_id=NEW.id AND NOT t.relational AND upper(t.method)='CASH' AND o.copies IS DISTINCT FROM n.copies
      LOOP
        PERFORM public.treasury_day_writable(changed.madrasa_id,changed.operator_id,changed.cash_date);
        IF jsonb_array_length(changed.old_copies) IS DISTINCT FROM 1 OR jsonb_array_length(changed.new_copies) IS DISTINCT FROM 1 OR
          (changed.old_copies#>'{0,payment_date}',changed.old_copies#>'{0,payment_method}',changed.old_copies#>'{0,total_amount_received}') IS DISTINCT FROM
          (changed.new_copies#>'{0,payment_date}',changed.new_copies#>'{0,payment_method}',changed.new_copies#>'{0,total_amount_received}') THEN RAISE EXCEPTION 'Keep original cash receipt'; END IF;
      END LOOP;
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aa_treasury_fee ON public.fee_payments;
CREATE TRIGGER aa_treasury_fee BEFORE UPDATE OR DELETE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.treasury_guard_fee();
DROP TRIGGER IF EXISTS aa_treasury_fee_meta ON public.madrasas;
CREATE TRIGGER aa_treasury_fee_meta BEFORE UPDATE OF metadata,registration_no ON public.madrasas FOR EACH ROW EXECUTE FUNCTION public.treasury_guard_fee();

CREATE OR REPLACE FUNCTION public.treasury_cash_rows(t uuid,a uuid,d date) RETURNS TABLE(source text,id text,reference text,amount numeric,incoming boolean)
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT 'Donation',v.id::text,v.receipt_no,v.amount,true FROM public.donations v WHERE v.madrasa_id=$1 AND operator_id=$2 AND donation_date=$3 AND upper(payment_method)='CASH' AND status<>'VOID' AND coalesce(notes,'') !~* '\[VOID:'
  UNION ALL SELECT 'Expense',v.id::text,v.voucher_no,v.amount,false FROM public.expenses v WHERE v.madrasa_id=$1 AND operator_id=$2 AND expense_date=$3 AND upper(payment_method)='CASH' AND status<>'VOID' AND coalesce(description,'') !~* '\[VOID:'
  UNION ALL SELECT 'Bazar',v.id::text,v.voucher_no,v.amount,false FROM public.bazar_expenses v WHERE v.madrasa_id=$1 AND operator_id=$2 AND expense_date=$3 AND upper(payment_method)='CASH' AND status<>'VOID' AND coalesce(items_details,'') !~* '\[VOID:'
  UNION ALL SELECT 'Transport',l.id,'EXP-LTH-'||l.id,l.n,false FROM public.madrasas m,LATERAL public.treasury_transport(public.finance_metadata(m)->'qurbani_leather_records') l WHERE m.id=$1 AND l.operator_id=$2 AND l.d=$3 AND upper(l.method)='CASH' AND NOT l.voided
  UNION ALL SELECT 'Fee',v.id,v.receipt_no,v.total_amount_received,true FROM public.treasury_fee_tenders b JOIN public.fee_payments v ON v.madrasa_id=b.madrasa_id AND v.id=b.payment_id
    WHERE b.madrasa_id=$1 AND b.operator_id=$2 AND b.cash_date=$3 AND upper(b.method)='CASH' AND b.relational AND v.status='COMPLETED' AND coalesce(v.notes,'') !~* '\[VOID:'
  UNION ALL SELECT 'Fee',v->>'id',v->>'receipt_no',(v->>'total_amount_received')::numeric,true FROM public.treasury_fee_tenders b JOIN public.madrasas m ON m.id=b.madrasa_id,
    LATERAL jsonb_array_elements(public.finance_metadata(m)->'payments') v WHERE b.madrasa_id=$1 AND b.operator_id=$2 AND b.cash_date=$3 AND upper(b.method)='CASH' AND NOT b.relational AND v->>'id'=b.payment_id AND v->>'status'='COMPLETED' AND coalesce(v->>'notes','') !~* '\[VOID:'
$$;
CREATE OR REPLACE FUNCTION public.treasury_cashbook(t uuid,a uuid,d date) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE day_ public.treasury_days; receipts numeric; paid numeric; sent numeric; received numeric; banked numeric; rows_ jsonb; moves jsonb; expected_ numeric;
BEGIN
  IF NOT EXISTS(SELECT FROM public.users WHERE madrasa_id=t AND id=a) THEN RAISE EXCEPTION 'Unknown operator'; END IF;
  SELECT * INTO day_ FROM public.treasury_days WHERE madrasa_id=t AND operator_id=a AND cash_date=d;
  SELECT coalesce(sum(amount) FILTER(WHERE incoming),0),coalesce(sum(amount) FILTER(WHERE NOT incoming),0),coalesce(jsonb_agg(to_jsonb(r) ORDER BY source,id),'[]') INTO receipts,paid,rows_ FROM public.treasury_cash_rows(t,a,d) r;
  SELECT coalesce(sum(amount) FILTER(WHERE sender=a AND recipient IS NOT NULL AND accepted_at IS NOT NULL),0),coalesce(sum(amount) FILTER(WHERE recipient=a AND accepted_at IS NOT NULL),0),
    coalesce(sum(amount) FILTER(WHERE recipient IS NULL),0),coalesce(jsonb_agg(to_jsonb(m) ORDER BY created_at,id),'[]') INTO sent,received,banked,moves FROM public.treasury_movements m WHERE madrasa_id=t AND cash_date=d AND (sender=a OR recipient=a);
  expected_:=day_.opening+receipts-paid-sent+received-banked;
  RETURN jsonb_build_object('day',d,'operator',a,'operatorName',(SELECT full_name FROM public.users WHERE id=a AND madrasa_id=t),'opening',day_.opening,'collected',receipts,'expenses',paid,'handedOut',sent,'handedIn',received,'deposited',banked,
    'expected',coalesce(day_.expected,expected_),'counted',day_.counted,'variance',day_.counted-day_.expected,'note',day_.note,'closed',day_.closed_at IS NOT NULL,'rows',rows_,'moves',moves,
    'recipients',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) ORDER BY u.full_name),'[]') FROM public.treasury_days o JOIN public.users u ON u.id=o.operator_id AND u.madrasa_id=o.madrasa_id WHERE o.madrasa_id=t AND o.cash_date=d AND o.closed_at IS NULL AND u.id<>a));
END $$;
CREATE OR REPLACE FUNCTION public.treasury_cash_action(t uuid,a uuid,d date,op text,k uuid,n numeric,receiver uuid,ref text,seen numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE day_ public.treasury_days; m public.treasury_movements; available numeric;
BEGIN
  PERFORM public.treasury_actor(t,a); PERFORM public.treasury_day_writable(t,a,d);
  IF d>(now() AT TIME ZONE 'Asia/Dhaka')::date THEN RAISE EXCEPTION 'Future cash date'; END IF;
  SELECT * INTO day_ FROM public.treasury_days WHERE madrasa_id=t AND operator_id=a AND cash_date=d;
  IF op='OPEN' THEN PERFORM public.treasury_amount(n,true);
    IF FOUND AND day_.opening IS NOT NULL THEN RAISE EXCEPTION 'Drawer already open'; END IF;
    INSERT INTO public.treasury_days(madrasa_id,operator_id,cash_date,opening) VALUES(t,a,d,n); RETURN;
  END IF;
  IF day_.opening IS NULL THEN RAISE EXCEPTION 'Count opening cash first'; END IF;
  available:=(public.treasury_cashbook(t,a,d)->>'expected')::numeric;
  IF op='CLOSE' THEN
    PERFORM public.treasury_amount(n,true);
    IF available IS DISTINCT FROM seen THEN RAISE EXCEPTION 'Drawer changed; refresh and recount'; END IF;
    IF length(coalesce(ref,''))>500 OR (n<>available AND nullif(btrim(ref),'') IS NULL) THEN RAISE EXCEPTION 'Explain the closing variance'; END IF;
    IF EXISTS(SELECT FROM public.treasury_movements WHERE madrasa_id=t AND cash_date=d AND (sender=a OR recipient=a) AND recipient IS NOT NULL AND accepted_at IS NULL AND cancelled_at IS NULL) THEN RAISE EXCEPTION 'Resolve pending handovers first'; END IF;
    UPDATE public.treasury_days SET counted=n,expected=available,note=ref,closed_at=now() WHERE madrasa_id=t AND operator_id=a AND cash_date=d;
  ELSIF op IN ('ACCEPT','CANCEL') THEN
    SELECT * INTO STRICT m FROM public.treasury_movements WHERE madrasa_id=t AND cash_date=d AND id=k AND recipient IS NOT NULL AND accepted_at IS NULL AND cancelled_at IS NULL;
    IF op='ACCEPT' AND m.recipient=a THEN
      PERFORM public.treasury_day_writable(t,m.sender,d);
      IF (public.treasury_cashbook(t,m.sender,d)->>'expected')::numeric<m.amount THEN RAISE EXCEPTION 'Sender has insufficient cash'; END IF;
      UPDATE public.treasury_movements SET accepted_at=now() WHERE id=k;
    ELSIF op='CANCEL' AND m.sender=a THEN UPDATE public.treasury_movements SET cancelled_at=now() WHERE id=k; -- keep the unaccepted proposal for audit
    ELSE RAISE EXCEPTION 'Not your handover'; END IF;
  ELSIF op IN ('HANDOVER','BANK') THEN
    PERFORM public.treasury_amount(n);
    IF length(btrim(coalesce(ref,''))) NOT BETWEEN 1 AND 200 OR k IS NULL THEN RAISE EXCEPTION 'Reference and voucher ID required'; END IF;
    IF op='HANDOVER' AND (receiver IS NULL OR receiver=a OR NOT EXISTS(SELECT FROM public.treasury_days WHERE madrasa_id=t AND operator_id=receiver AND cash_date=d AND closed_at IS NULL)) THEN RAISE EXCEPTION 'Select another open drawer'; END IF;
    IF op='BANK' AND receiver IS NOT NULL THEN RAISE EXCEPTION 'Invalid deposit'; END IF;
    SELECT * INTO m FROM public.treasury_movements WHERE id=k;
    IF FOUND THEN IF (m.madrasa_id,m.sender,m.cash_date,m.amount,m.recipient,m.reference) IS DISTINCT FROM (t,a,d,n,receiver,btrim(ref)) THEN RAISE EXCEPTION 'Movement ID already used'; END IF; RETURN; END IF;
    IF n>available-coalesce((SELECT sum(amount) FROM public.treasury_movements WHERE madrasa_id=t AND cash_date=d AND sender=a AND recipient IS NOT NULL AND accepted_at IS NULL AND cancelled_at IS NULL),0) THEN RAISE EXCEPTION 'Insufficient physical cash'; END IF;
    INSERT INTO public.treasury_movements(id,madrasa_id,sender,recipient,cash_date,amount,reference) VALUES(k,t,a,receiver,d,n,btrim(ref));
  ELSE RAISE EXCEPTION 'Unknown cash operation'; END IF;
END $$;

-- A memo is a private immutable attachment, not a public URL. Upload AFTER a confirmed expense.
CREATE OR REPLACE FUNCTION public.treasury_attach_memo(t uuid,a uuid,e uuid,bytes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.expenses; BEGIN
  PERFORM public.treasury_actor(t,a); SELECT * INTO STRICT v FROM public.expenses WHERE madrasa_id=t AND id=e AND status<>'VOID' AND coalesce(description,'') !~* '\[VOID:' FOR UPDATE;
  PERFORM public.treasury_day_writable(t,NULL,v.expense_date);
  INSERT INTO public.treasury_memos(expense_id,madrasa_id,actor_id,image) VALUES(e,t,a,decode(bytes,'base64'));
END $$;
CREATE OR REPLACE FUNCTION public.treasury_read_memo(t uuid,e uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT encode(image,'base64') FROM public.treasury_memos WHERE madrasa_id=t AND expense_id=e
$$;
-- JSON exports inventory each attachment, but never distribute the private bytes. The
-- signed cold DB backup, not a downloadable application JSON, restores the photographs.
CREATE OR REPLACE FUNCTION public.treasury_memo_index(t uuid,after_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY expense_id),'[]') FROM (SELECT expense_id,created_at,octet_length(image) bytes,encode(sha256(image),'hex') sha256
    FROM public.treasury_memos WHERE madrasa_id=t AND (after_id IS NULL OR expense_id>after_id) ORDER BY expense_id LIMIT 500) q
$$;
DO $$ DECLARE tab text; fn regprocedure; BEGIN
  FOREACH tab IN ARRAY ARRAY['treasury_journals','treasury_epochs','treasury_heads','treasury_days','treasury_movements','treasury_fee_tenders','treasury_memos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',tab);
  END LOOP;
  GRANT SELECT ON public.treasury_journals,public.treasury_epochs,public.treasury_heads,public.treasury_days,public.treasury_movements,public.treasury_fee_tenders TO service_role;
  FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname ~ '^treasury_' OR
    (proname IN ('finance_collect_fee','finance_pay_salary') AND 'p_register'=ANY(proargnames)) OR
    (proname IN ('finance_receive_donation','finance_post_collection','finance_record_maintenance','finance_collect_fee','finance_replace_sources') AND 'p_operator'=ANY(proargnames))) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn);
  END LOOP;
END $$;
COMMIT;
