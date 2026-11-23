-- Phase 1 only. Apply after the account-model and portal-parity migrations.
-- No UPDATE/DELETE/backfill of historical postings. Unknown/conflicting history is reviewed, not guessed.
BEGIN;
-- A stale whole-document settings save does not increment this revision. Only the
-- source CAS writers advance it, in the same statement that changes the books.
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS finance_source_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE public.donations ALTER COLUMN fund_id DROP DEFAULT;
ALTER TABLE public.expenses ALTER COLUMN fund_id DROP DEFAULT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS restricted_beneficiary text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payroll_record_id text;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_one_salary_payment ON public.expenses(madrasa_id,payroll_record_id) WHERE payroll_record_id IS NOT NULL;
ALTER TABLE public.bazar_expenses ADD COLUMN IF NOT EXISTS voucher_no text,
  ADD COLUMN IF NOT EXISTS buyer_name text, ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS fund_id text;
ALTER TABLE public.bazar_expenses ALTER COLUMN fund_id DROP DEFAULT;
ALTER TABLE public.bazar_expenses ADD COLUMN IF NOT EXISTS fund_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED', ADD COLUMN IF NOT EXISTS voided_at timestamptz, ADD COLUMN IF NOT EXISTS void_reason text;

-- Same effective metadata as the existing staff/portal store. Never write it while reading a fund.
CREATE OR REPLACE FUNCTION public.finance_metadata(m public.madrasas) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce(nullif(to_jsonb(m)->'metadata','null'::jsonb),'{}'::jsonb) ||
    CASE WHEN left(ltrim(m.registration_no),1)='{' THEN m.registration_no::jsonb ELSE '{}'::jsonb END
$$;

-- One effective calendar for posting, reporting and the unlock screen. A new, empty
-- SQL table does not unlock periods in an old school. Only an explicit, dated SQL
-- unlock for the SAME window overrides a legacy close. Never rewrite the old books.
CREATE OR REPLACE FUNCTION public.finance_accounting_calendar(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE meta jsonb; settings jsonb; item record; period_key text; prev jsonb; r jsonb; periods jsonb:='{}';
BEGIN
  SELECT public.finance_metadata(m) INTO STRICT meta FROM public.madrasas m WHERE id=p_tenant;
  SELECT setting_value INTO settings FROM public.madrasa_settings WHERE madrasa_id=p_tenant AND namespace='locks' AND setting_key='accounting_periods';
  FOR item IN SELECT row_data, source FROM (
    SELECT value AS row_data, 0 AS source FROM jsonb_array_elements(meta->'accounting_periods')
    UNION ALL SELECT value, 1 FROM jsonb_array_elements(settings)
    UNION ALL SELECT to_jsonb(p), 2 FROM public.accounting_periods p WHERE p.madrasa_id=p_tenant
  ) all_periods ORDER BY source, (row_data->>'locked_at')::timestamptz NULLS FIRST LOOP
    r:=item.row_data; period_key:=r->>'period_key'; prev:=periods->period_key;
    IF nullif(btrim(period_key),'') IS NULL OR coalesce(r->>'madrasa_id',p_tenant::text)<>p_tenant::text OR
       jsonb_typeof(r->'is_locked') IS DISTINCT FROM 'boolean' OR
       (r->>'start_date' ~ '^\d{4}-\d{2}-\d{2}$' AND r->>'end_date' ~ '^\d{4}-\d{2}-\d{2}$' AND (r->>'end_date')::date >= (r->>'start_date')::date) IS NOT TRUE OR
       (prev IS NOT NULL AND (prev->>'start_date',prev->>'end_date') IS DISTINCT FROM (r->>'start_date',r->>'end_date')) THEN
      RAISE EXCEPTION 'হিসাবকালের তারিখ বা লক অবস্থা মেলেনি। আগে যাচাই করুন।'; END IF;
    IF prev->'is_locked'='true' AND r->'is_locked'='false' AND NOT (
      item.source=2 AND EXISTS(SELECT FROM public.users u WHERE u.madrasa_id=p_tenant AND u.id::text=r->>'unlocked_by') AND r->>'unlocked_at' IS NOT NULL AND
      (r->>'unlocked_at')::timestamptz >= coalesce((prev->>'locked_at')::timestamptz,'-infinity'::timestamptz)) THEN CONTINUE; END IF;
    -- Keep the latest legacy close as evidence even if its copy sorts later by source.
    IF item.source<2 AND prev->'is_locked'='true' AND r->'is_locked'='true' AND
      coalesce((prev->>'locked_at')::timestamptz,'-infinity'::timestamptz)>coalesce((r->>'locked_at')::timestamptz,'-infinity'::timestamptz) THEN CONTINUE; END IF;
    periods:=jsonb_set(periods,ARRAY[period_key],to_jsonb(jsonb_populate_record(NULL::public.accounting_periods,r-'id'))||
      jsonb_build_object('madrasa_id',p_tenant,'id',coalesce(r->>'id',period_key),'label',coalesce(r->>'label',period_key)));
  END LOOP;
  RETURN coalesce((SELECT jsonb_agg(value ORDER BY value->>'start_date' DESC,key) FROM jsonb_each(periods)),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.finance_closed_periods(p_tenant uuid) RETURNS TABLE(start_date date,end_date date)
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT p.start_date,p.end_date FROM jsonb_to_recordset(public.finance_accounting_calendar(p_tenant)) p(start_date date,end_date date,is_locked boolean) WHERE p.is_locked
$$;
REVOKE ALL ON FUNCTION public.finance_accounting_calendar(uuid),public.finance_closed_periods(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_accounting_calendar(uuid),public.finance_closed_periods(uuid) TO service_role;

-- Serialize a period close with posting. The key's original date window cannot be
-- shortened to move a recorded payment outside a closed period.
CREATE OR REPLACE FUNCTION public.finance_guard_period() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE original jsonb;
BEGIN
  PERFORM 1 FROM public.madrasas WHERE id=NEW.madrasa_id FOR UPDATE;
  SELECT p INTO original FROM jsonb_array_elements(public.finance_accounting_calendar(NEW.madrasa_id)) p WHERE p->>'period_key'=NEW.period_key;
  IF NEW.unlocked_by IS NOT NULL AND NOT EXISTS(SELECT FROM public.users WHERE id=NEW.unlocked_by AND madrasa_id=NEW.madrasa_id) THEN RAISE EXCEPTION 'হিসাবকালের প্রতিষ্ঠান মেলেনি।'; END IF;
  IF TG_OP='UPDATE' AND OLD.is_locked AND NOT NEW.is_locked AND (NEW.unlocked_by IS NULL OR NEW.unlocked_at IS NULL) THEN RAISE EXCEPTION 'হিসাবকাল আনলকের অনুমোদন আবশ্যক।'; END IF;
  IF NEW.end_date<NEW.start_date OR (TG_OP='UPDATE' AND (NEW.period_key,NEW.madrasa_id) IS DISTINCT FROM (OLD.period_key,OLD.madrasa_id)) OR
     (original IS NOT NULL AND (NEW.start_date,NEW.end_date) IS DISTINCT FROM ((original->>'start_date')::date,(original->>'end_date')::date)) THEN RAISE EXCEPTION 'হিসাবকালের মূল তারিখ পরিবর্তন করা যাবে না।'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_guard_period ON public.accounting_periods;
CREATE TRIGGER finance_guard_period BEFORE INSERT OR UPDATE ON public.accounting_periods FOR EACH ROW EXECUTE FUNCTION public.finance_guard_period();
REVOKE ALL ON FUNCTION public.finance_guard_period() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.finance_guard_source_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb:=public.finance_metadata(OLD); b jsonb:=public.finance_metadata(NEW); k text;
BEGIN
  IF a->'accounting_periods' IS DISTINCT FROM b->'accounting_periods' THEN RAISE EXCEPTION 'পুরোনো হিসাবকাল সংরক্ষিত। লক পরিবর্তন মূল ক্যালেন্ডারে করুন।'; END IF;
  IF NEW.finance_source_revision<>OLD.finance_source_revision THEN
    IF NEW.finance_source_revision<>OLD.finance_source_revision+1 OR current_setting('role',true) IN ('authenticated','anon') THEN RAISE EXCEPTION 'সংগ্রহ খাতার সংস্করণ বদলানো যাবে না।'; END IF;
    RETURN NEW;
  END IF;
  FOREACH k IN ARRAY ARRAY['payments','student_fees','fee_types','fee_structures','discounts','mahfils','custom_funds','life_member_donors','donor_subscription_payments','donation_box_logs','donation_boxes','qurbani_leather_records','leather_batches','online_donations'] LOOP
    IF a->k IS DISTINCT FROM b->k THEN RAISE EXCEPTION 'সংগ্রহ খাতা বদলেছে। মূল হিসাব থেকে পরিবর্তন করুন।'; END IF;
  END LOOP;
  -- Linked maintenance records cannot disappear in a stale asset or settings save.
  IF a#>'{inventory,maintenance}' IS DISTINCT FROM b#>'{inventory,maintenance}' AND EXISTS(
    SELECT FROM jsonb_array_elements(a#>'{inventory,maintenance}') r WHERE r->>'expense_id' IS NOT NULL AND NOT EXISTS(
      SELECT FROM jsonb_array_elements(b#>'{inventory,maintenance}') n WHERE n=r)) THEN RAISE EXCEPTION 'মেরামতের ব্যয় ভাউচার সংরক্ষণ করুন।'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_guard_source_revision ON public.madrasas;
CREATE TRIGGER finance_guard_source_revision BEFORE UPDATE OF metadata,registration_no,finance_source_revision ON public.madrasas FOR EACH ROW EXECUTE FUNCTION public.finance_guard_source_revision();
REVOKE ALL ON FUNCTION public.finance_guard_source_revision() FROM PUBLIC,anon,authenticated;

-- Defaults are virtual IDs shared by institutions, not rows with a global PK. Custom IDs must
-- exist in THIS institution. A physical inactive row takes precedence over old metadata.
CREATE OR REPLACE FUNCTION public.finance_fund_catalog(p_tenant uuid) RETURNS SETOF jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  WITH candidates(priority,f) AS (
    SELECT 1,to_jsonb(z) FROM public.zakat_funds z WHERE z.madrasa_id=p_tenant
    UNION ALL
    SELECT 2,f FROM public.madrasas m CROSS JOIN LATERAL
      jsonb_array_elements(CASE WHEN jsonb_typeof(public.finance_metadata(m)->'custom_funds')='array' THEN public.finance_metadata(m)->'custom_funds' ELSE '[]'::jsonb END) f
    WHERE m.id=p_tenant AND coalesce(f->>'madrasa_id',p_tenant::text)=p_tenant::text
    UNION ALL
    SELECT 3,to_jsonb(d)||'{"is_default":true,"is_active":true}'::jsonb FROM (VALUES
      ('fund-general','GEN','General','সাধারণ ফান্ড (General Fund)'),
      ('fund-lillah','LIL','Lillah','লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)'),
      ('fund-zakat','ZKT','Zakat','যাকাত ফান্ড (Zakat Fund)'),
      ('fund-fitra','FTR','Fitra','ফিতরা ও সদকা ফান্ড (Fitra & Sadaqah)'),
      ('fund-dev','DEV','Development','মসজিদ ও উন্নয়ন ফান্ড (Development Fund)'),
      ('fund-orphan','ORP','Education','এতিম কল্যাণ ফান্ড (Orphan Welfare Fund)')
    ) d(id,code,category,name)
  ) SELECT DISTINCT ON (f->>'id') f FROM candidates WHERE coalesce(f->>'id','') NOT IN ('','__review__') AND coalesce(f->>'name','')<>'' ORDER BY f->>'id',priority
$$;

CREATE OR REPLACE FUNCTION public.finance_is_restricted(f jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT concat_ws(' ',f->>'id',f->>'name',f->>'category',f->>'code') ~* '(\mzkt\M|zakat|zakah|g[hou]+r[ao]ba|যাকাত|জাকাত|যাকাহ|গোরাবা|গুরাবা|গরাবা|গোরবা|গুরবা)'
$$;

-- Do not allow renaming a restricted custom account into an unrestricted one (including
-- through mobile CRUD), or reusing the ID of a posted/custom restricted account.
CREATE OR REPLACE FUNCTION public.finance_guard_registry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT FROM public.madrasas WHERE id=OLD.madrasa_id) THEN RAISE EXCEPTION 'ফান্ড মুছবেন না, আর্কাইভ করুন।'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.madrasa_id<>OLD.madrasa_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'ফান্ডের পরিচয় অপরিবর্তনীয়।'; END IF;
  IF NEW.id='__review__' OR (EXISTS(SELECT FROM public.finance_fund_catalog(NEW.madrasa_id) f WHERE f->>'id'=NEW.id AND public.finance_is_restricted(f))
    AND NOT public.finance_is_restricted(to_jsonb(NEW))) THEN RAISE EXCEPTION 'সুরক্ষিত ফান্ডের বিধিনিষেধ বদলানো যাবে না।'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_guard_registry ON public.zakat_funds;
CREATE TRIGGER finance_guard_registry BEFORE INSERT OR UPDATE OR DELETE ON public.zakat_funds FOR EACH ROW EXECUTE FUNCTION public.finance_guard_registry();
REVOKE ALL ON FUNCTION public.finance_guard_registry() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.finance_posting_fund(p_tenant uuid,p_id text,p_use text,p_category text,p_beneficiary text) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE fund jsonb;
BEGIN
  IF p_tenant IS NULL THEN RAISE EXCEPTION 'প্রতিষ্ঠান আবশ্যক।'; END IF;
  SELECT f INTO fund FROM public.finance_fund_catalog(p_tenant) f WHERE f->>'id'=p_id AND coalesce(f->>'is_active','true')='true';
  IF fund IS NULL THEN RAISE EXCEPTION 'সক্রিয় ফান্ডের সঠিক আইডি নির্বাচন করুন।'; END IF;
  IF p_use IS NULL OR p_use NOT IN ('deposit','expense','bazar','mahfil_deficit') THEN RAISE EXCEPTION 'অজানা লেনদেন'; END IF;
  IF public.finance_is_restricted(fund) AND p_use<>'deposit' AND NOT
    (p_use='expense' AND coalesce(p_category,'')='Food' AND length(btrim(coalesce(p_beneficiary,''))) BETWEEN 1 AND 300) THEN
    RAISE EXCEPTION 'যাকাত/গোরাবা থেকে শুধু যোগ্য উপকারভোগীর নামসহ খাবার খরচ অনুমোদিত। সাধারণ ব্যয় বা ঘাটতি স্থানান্তর নয়।';
  END IF;
  RETURN fund;
END $$;

-- Enforce at the row boundary as well as the form: mobile, approvals, service-role and
-- direct table writes all meet the same policy. No re-funding a posted receipt via PATCH.
CREATE OR REPLACE FUNCTION public.finance_guard_posting() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; purpose text; body jsonb:=to_jsonb(NEW); prior jsonb; tagged text;
BEGIN
  PERFORM 1 FROM public.madrasas WHERE id=NEW.madrasa_id FOR SHARE;
  IF EXISTS(SELECT FROM public.finance_closed_periods(NEW.madrasa_id) WHERE
    (coalesce(body->>'expense_date',body->>'donation_date')::date BETWEEN start_date AND end_date OR
     (TG_OP='UPDATE' AND coalesce(to_jsonb(OLD)->>'expense_date',to_jsonb(OLD)->>'donation_date')::date BETWEEN start_date AND end_date))) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
  IF TG_OP='INSERT' AND (coalesce(body->>'status','COMPLETED')<>'COMPLETED' OR coalesce(body->>'description',body->>'notes',body->>'items_details','') ~* '\[VOID:') THEN RAISE EXCEPTION 'নতুন ভাউচারের অবস্থা সঠিক নয়।'; END IF;
  IF TG_OP='UPDATE' THEN
    prior:=to_jsonb(OLD);
    IF NEW.madrasa_id IS DISTINCT FROM OLD.madrasa_id OR NEW.fund_id IS DISTINCT FROM OLD.fund_id THEN
      RAISE EXCEPTION 'পোস্ট করা লেনদেনের প্রতিষ্ঠান বা ফান্ড বদলানো যাবে না। সমন্বয় প্রয়োজন।';
    END IF;
    -- Allow an unchanged legacy posting to be voided (including its existing void tag convention).
    -- Never silently repair its historical fund/name in a status-only write.
    IF body->>'status'='VOID' AND (body - ARRAY['status','notes','description','void_reason','voided_at'])
      IS NOT DISTINCT FROM (prior - ARRAY['status','notes','description','void_reason','voided_at']) THEN RETURN NEW; END IF;
  END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='expenses' AND
    (body->'amount',body->'category',body->'expense_date',body->'restricted_beneficiary',body->'voucher_no') IS DISTINCT FROM
    (prior->'amount',prior->'category',prior->'expense_date',prior->'restricted_beneficiary',prior->'voucher_no') AND
    (EXISTS(SELECT FROM public.approval_requests r WHERE r.id=NEW.id AND r.madrasa_id=NEW.madrasa_id AND r.payload->>'action'='create_expense') OR EXISTS(
      SELECT FROM public.approval_workflows w WHERE w.madrasa_id=NEW.madrasa_id AND w.is_active AND upper(w.request_type)='LARGE_EXPENSE' AND
        (NEW.amount>=w.min_amount AND (w.max_amount IS NULL OR NEW.amount<=w.max_amount) OR OLD.amount>=w.min_amount AND (w.max_amount IS NULL OR OLD.amount<=w.max_amount)))) THEN
    RAISE EXCEPTION 'অনুমোদনসাপেক্ষ ব্যয়ের শর্ত বদলাবেন না। কারণসহ বাতিল করে নতুন আবেদন দিন।'; END IF;
  IF TG_OP='UPDATE' AND prior->>'status'='VOID' AND body->>'status'='VOID' THEN RAISE EXCEPTION 'বাতিল ভাউচার সংশোধন করা যাবে না।'; END IF;
  IF NOT(NEW.amount BETWEEN 0.01 AND 9999999999.99) THEN RAISE EXCEPTION 'লেনদেনের অঙ্ক সঠিক নয়।'; END IF;
  tagged:=substring(coalesce(body->>'description',body->>'items_details',body->>'notes','') FROM '(?i)\mFUND:\s*([^]|]+)');
  IF tagged IS NOT NULL AND btrim(tagged) IS DISTINCT FROM NEW.fund_id THEN RAISE EXCEPTION 'ভাউচার ট্যাগ ও ফান্ড আইডি মিলছে না।'; END IF;
  purpose:=CASE TG_TABLE_NAME WHEN 'donations' THEN 'deposit' WHEN 'bazar_expenses' THEN 'bazar' ELSE 'expense' END;
  f:=public.finance_posting_fund(NEW.madrasa_id,NEW.fund_id,purpose,body->>'category',body->>'restricted_beneficiary');
  IF TG_OP='UPDATE' THEN
    -- Do not launder an old General-default/Zakat-tag conflict by removing the label
    -- during an unrelated edit. Voiding, above, deliberately preserves the old row.
    tagged:=substring(coalesce(prior->>'description',prior->>'items_details',prior->>'notes','') FROM '(?i)\mFUND:\s*([^]|]+)');
    IF (tagged IS NOT NULL AND btrim(tagged) IS DISTINCT FROM OLD.fund_id) OR
       (OLD.fund_id='fund-general' AND tagged IS NULL AND coalesce(prior->>'fund_name',prior->>'donation_type','')='') OR
       (NOT public.finance_is_restricted(f) AND public.finance_is_restricted(jsonb_build_object('name',concat_ws(' ',prior->>'fund_name',prior->>'donation_type')))) THEN
      RAISE EXCEPTION 'পুরোনো ফান্ডের তথ্য পরস্পরবিরোধী। সমন্বয় করুন।'; END IF;
  END IF;
  IF NEW.fund_name IS NOT NULL AND NEW.fund_name<>f->>'name' THEN RAISE EXCEPTION 'ফান্ডের নাম ও আইডি মিলছে না।'; END IF;
  NEW.fund_name:=f->>'name';
  IF TG_TABLE_NAME IN ('expenses','bazar_expenses') AND nullif(btrim(body->>'voucher_no'),'') IS NOT NULL AND (TG_OP='INSERT' OR body->>'voucher_no' IS DISTINCT FROM prior->>'voucher_no') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.madrasa_id::text||':'||lower(btrim(NEW.voucher_no)),0));
    IF EXISTS(SELECT FROM public.expenses WHERE madrasa_id=NEW.madrasa_id AND lower(btrim(coalesce(nullif(voucher_no,''),substring(description FROM '(?i)\[VOUCHER:\s*([^]|]+)'))))=lower(btrim(NEW.voucher_no)) AND (TG_TABLE_NAME<>'expenses' OR id<>NEW.id)) OR
       EXISTS(SELECT FROM public.bazar_expenses WHERE madrasa_id=NEW.madrasa_id AND lower(btrim(coalesce(nullif(voucher_no,''),substring(items_details FROM '(?i)\[VOUCHER:\s*([^]|]+)'))))=lower(btrim(NEW.voucher_no)) AND (TG_TABLE_NAME<>'bazar_expenses' OR id<>NEW.id)) THEN RAISE EXCEPTION 'ভাউচার নম্বর ইতিমধ্যে আছে।'; END IF;
  END IF;
  IF TG_TABLE_NAME='donations' THEN
    IF nullif(btrim(NEW.receipt_no),'') IS NOT NULL AND (TG_OP='INSERT' OR NEW.receipt_no IS DISTINCT FROM OLD.receipt_no) THEN
      -- Preserve pre-existing duplicate numbers, but never introduce a new collision.
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.madrasa_id::text||':'||lower(btrim(NEW.receipt_no)),0));
      IF EXISTS(SELECT FROM public.donations WHERE madrasa_id=NEW.madrasa_id AND lower(btrim(receipt_no))=lower(btrim(NEW.receipt_no)) AND id<>NEW.id) THEN
        RAISE EXCEPTION 'এই রসিদ নম্বর ব্যবহৃত হয়েছে। রিফ্রেশ করে পুনরায় চেষ্টা করুন।'; END IF;
    END IF;
    IF NEW.member_id IS NOT NULL AND (NEW.donor_id IS NOT NULL OR NOT EXISTS(SELECT FROM public.madrasas m,jsonb_array_elements(public.finance_metadata(m)->'life_member_donors') d WHERE m.id=NEW.madrasa_id AND d->>'id'=NEW.member_id)) THEN RAISE EXCEPTION 'অপরিচিত সদস্য'; END IF;
    IF NEW.donor_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.donors WHERE id=NEW.donor_id AND madrasa_id=NEW.madrasa_id) THEN RAISE EXCEPTION 'অপরিচিত দাতা'; END IF;
    IF NEW.donation_type IS NOT NULL AND NEW.donation_type <> ALL(array_remove(ARRAY[f->>'name',f->>'id',f->>'code'],NULL)) THEN RAISE EXCEPTION 'অনুদানের খাত ও ফান্ডের আইডি মিলছে না।'; END IF;
    NEW.donation_type:=f->>'name';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_guard_posting ON public.donations;
CREATE TRIGGER finance_guard_posting BEFORE INSERT OR UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posting();
DROP TRIGGER IF EXISTS finance_guard_posting ON public.expenses;
CREATE TRIGGER finance_guard_posting BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posting();
DROP TRIGGER IF EXISTS finance_guard_posting ON public.bazar_expenses;
CREATE TRIGGER finance_guard_posting BEFORE INSERT OR UPDATE ON public.bazar_expenses FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posting();

-- Compare only the source lists read by this operation. Never replace unrelated tenant data.
CREATE OR REPLACE FUNCTION public.finance_replace_sources(p_tenant uuid,p_before jsonb,p_after jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); k text;
BEGIN
  IF jsonb_typeof(p_before) IS DISTINCT FROM 'object' OR jsonb_typeof(p_after) IS DISTINCT FROM 'object' OR p_before='{}' OR p_after='{}'
    OR (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(p_before) x) IS DISTINCT FROM
       (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(p_after) x) THEN RAISE EXCEPTION 'Invalid collection fields'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_after) LOOP
    IF k NOT IN ('mahfils','donor_subscription_payments','qurbani_leather_records','leather_batches','donation_boxes','donation_box_logs','online_donations')
      OR jsonb_typeof(p_after->k) IS DISTINCT FROM 'array' OR coalesce(meta->k,'null'::jsonb) IS DISTINCT FROM p_before->k THEN
      RAISE EXCEPTION 'হিসাব বদলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।'; END IF;
    IF k IN ('donor_subscription_payments','qurbani_leather_records','leather_batches','donation_box_logs','online_donations','mahfils') AND EXISTS(
      WITH old_rows AS (SELECT value AS r FROM jsonb_array_elements(nullif(p_before->k,'null'))),
           new_rows AS (SELECT value AS r FROM jsonb_array_elements(p_after->k)),
           prior AS (SELECT d FROM old_rows CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN k='mahfils' THEN r->'transactions' ELSE jsonb_build_array(r) END) d),
           next AS (SELECT d FROM new_rows CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN k='mahfils' THEN r->'transactions' ELSE jsonb_build_array(r) END) d),
           changed AS ((TABLE prior EXCEPT ALL TABLE next) UNION ALL (TABLE next EXCEPT ALL TABLE prior))
      SELECT FROM changed, public.finance_closed_periods(p_tenant) p WHERE coalesce(d->>'donation_date',d->>'payment_date',d->>'sale_date',d->>'collection_date',d->>'date',d->>'created_at')::date BETWEEN p.start_date AND p.end_date
    ) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
  END LOOP;
  UPDATE public.madrasas SET registration_no=(meta||p_after)::text,finance_source_revision=finance_source_revision+1 WHERE id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.finance_replace_sources(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_replace_sources(uuid,jsonb,jsonb) TO service_role;

-- The SQL directory and its legacy member record have one stable identity. No
-- reconciliation by (often shared) family name/phone, no deleting paid history.
ALTER TABLE public.donors ADD COLUMN IF NOT EXISTS notes text;
CREATE OR REPLACE FUNCTION public.finance_save_member(p_tenant uuid,p_id text,p_before jsonb,p_member jsonb,p_mode text)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); members jsonb:=coalesce(meta->'life_member_donors','[]');
  pos bigint; d uuid; existing boolean; dtype text; old_member jsonb;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('create','edit','delete') OR nullif(p_id,'') IS NULL OR members IS DISTINCT FROM p_before THEN RAISE EXCEPTION 'সদস্য তালিকা বদলেছে। রিফ্রেশ করুন।'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(members) m WHERE m->>'id'=p_id)>1 THEN RAISE EXCEPTION 'একাধিক সদস্য আইডি। যাচাই করুন।'; END IF;
  SELECT value,ordinality-1 INTO old_member,pos FROM jsonb_array_elements(members) WITH ORDINALITY WHERE value->>'id'=p_id;
  IF p_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN d:=p_id::uuid; END IF;
  PERFORM 1 FROM public.donors WHERE id=d AND madrasa_id=p_tenant FOR UPDATE; existing:=FOUND;
  IF (p_mode='create' AND (existing OR pos IS NOT NULL)) OR (p_mode<>'create' AND NOT existing AND pos IS NULL) THEN RAISE EXCEPTION 'সদস্যের পরিচয় মিলছে না।'; END IF;
  IF p_mode='delete' THEN
    IF EXISTS(SELECT FROM public.donations WHERE madrasa_id=p_tenant AND (donor_id=d OR member_id=p_id)) OR
      EXISTS(SELECT FROM jsonb_array_elements(meta->'donor_subscription_payments') p WHERE p->>'donor_id'=p_id) THEN RAISE EXCEPTION 'রসিদ আছে। সদস্য মুছবেন না; নিষ্ক্রিয় করুন।'; END IF;
    IF pos IS NOT NULL THEN members:=members-(pos::int); END IF;
  ELSE
    IF coalesce((p_member->>'pledge_amount')::numeric,0) NOT BETWEEN 0 AND 9999999999.99 THEN RAISE EXCEPTION 'অঙ্গীকারের অঙ্ক সঠিক নয়।'; END IF;
    IF p_member->>'id' IS DISTINCT FROM p_id OR p_member->>'madrasa_id' IS DISTINCT FROM p_tenant::text OR nullif(btrim(p_member->>'name'),'') IS NULL THEN RAISE EXCEPTION 'সদস্যের নাম ও পরিচয় আবশ্যক।'; END IF;
    dtype:=CASE WHEN p_member->>'member_type' IN ('LIFE_MEMBER','ANNUAL_DONOR','YEARLY') THEN 'Annual' WHEN p_member->>'member_type' IN ('MONTHLY_DONOR','MONTHLY') THEN 'Monthly' ELSE 'OneTime' END;
    IF d IS NOT NULL THEN
      INSERT INTO public.donors(id,madrasa_id,name,phone,address,donor_type,notes) VALUES(d,p_tenant,p_member->>'name',p_member->>'phone',p_member->>'address',dtype,
        jsonb_build_object('member_no',p_member->>'member_no','member_type',p_member->>'member_type','pledge_amount',p_member->'pledge_amount','preferred_fund',p_member->>'preferred_fund','notes',p_member->>'notes')::text)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,address=excluded.address,donor_type=excluded.donor_type,notes=excluded.notes WHERE public.donors.madrasa_id=p_tenant;
      IF NOT FOUND THEN RAISE EXCEPTION 'সদস্যের পরিচয় মিলছে না।'; END IF;
    END IF;
    members:=CASE WHEN pos IS NULL THEN jsonb_build_array(p_member)||members ELSE jsonb_set(members,ARRAY[pos::text],p_member) END;
  END IF;
  UPDATE public.madrasas SET registration_no=jsonb_set(meta,'{life_member_donors}',members)::text,finance_source_revision=finance_source_revision+1 WHERE id=p_tenant;
  IF p_mode='delete' THEN DELETE FROM public.donors WHERE id=d AND madrasa_id=p_tenant; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finance_save_member(uuid,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_save_member(uuid,text,jsonb,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.finance_keep_donor_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT FROM public.madrasas m,jsonb_array_elements(public.finance_metadata(m)->'life_member_donors') d WHERE m.id=OLD.madrasa_id AND d->>'id'=OLD.id::text) OR EXISTS(SELECT FROM public.donations WHERE madrasa_id=OLD.madrasa_id AND (donor_id=OLD.id OR member_id=OLD.id::text)) OR EXISTS(SELECT FROM public.madrasas m,jsonb_array_elements(public.finance_metadata(m)->'donor_subscription_payments') p WHERE m.id=OLD.madrasa_id AND p->>'donor_id'=OLD.id::text) THEN RAISE EXCEPTION 'দাতার রসিদ সংরক্ষণ করুন।'; END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS finance_keep_donor_history ON public.donors;
CREATE TRIGGER finance_keep_donor_history BEFORE DELETE ON public.donors FOR EACH ROW EXECUTE FUNCTION public.finance_keep_donor_history();
REVOKE ALL ON FUNCTION public.finance_keep_donor_history() FROM PUBLIC,anon,authenticated;

-- A walk-in donor may opt into the directory while paying. Do not leave a
-- directory entry behind if the receipt collides or its fund/period is rejected.
CREATE OR REPLACE FUNCTION public.finance_receive_donation(t uuid,p_donor jsonb,p_receipt jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d public.donors; r public.donations; donor uuid:=(p_receipt->>'donor_id')::uuid;
BEGIN
  IF p_donor IS NOT NULL THEN
    IF donor IS NOT NULL OR p_receipt->>'member_id' IS NOT NULL OR nullif(btrim(p_donor->>'name'),'') IS NULL OR
      p_donor->>'donor_type' NOT IN ('Annual','Monthly','OneTime') OR (p_donor->>'pledge_amount')::numeric<0 THEN RAISE EXCEPTION 'দাতার পরিচয় বা অঙ্গীকারের অঙ্ক মেলেনি।'; END IF;
    INSERT INTO public.donors(madrasa_id,name,phone,address,donor_type,notes) VALUES(t,p_donor->>'name',p_donor->>'phone',p_donor->>'address',p_donor->>'donor_type',jsonb_build_object('pledge_amount',p_donor->'pledge_amount','notes',p_donor->>'notes')::text) RETURNING * INTO d;
    donor:=d.id;
  END IF;
  IF nullif(btrim(p_receipt->>'receipt_no'),'') IS NULL THEN RAISE EXCEPTION 'রসিদ নম্বর আবশ্যক।'; END IF;
  INSERT INTO public.donations(madrasa_id,donor_id,member_id,amount,fund_id,fund_name,donation_type,donation_date,receipt_no,notes)
    VALUES(t,donor,p_receipt->>'member_id',(p_receipt->>'amount')::numeric,p_receipt->>'fund_id',p_receipt->>'fund_name',p_receipt->>'fund_name',(p_receipt->>'donation_date')::date,p_receipt->>'receipt_no',p_receipt->>'notes') RETURNING * INTO r;
  RETURN jsonb_build_object('receipt',to_jsonb(r),'donor',CASE WHEN d.id IS NOT NULL THEN to_jsonb(d) END);
END $$;
REVOKE ALL ON FUNCTION public.finance_receive_donation(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_receive_donation(uuid,jsonb,jsonb) TO service_role;

-- Commit a source collection and its voucher together. Compare only the touched source
-- arrays under the tenant lock, so a stale browser cannot overwrite unrelated metadata.
CREATE OR REPLACE FUNCTION public.finance_post_collection(p_tenant uuid,p_before jsonb,p_after jsonb,p_kind text,p_row jsonb,p_edit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE existing uuid; delta numeric:=0; receipt text:=p_row->>'receipt_no';
BEGIN
  PERFORM public.finance_replace_sources(p_tenant,p_before,p_after);
  IF p_kind='donation' THEN
    IF coalesce(receipt,'')='' THEN RAISE EXCEPTION 'রসিদ নম্বর আবশ্যক।'; END IF;
    IF (p_row->>'donor_id') IS NOT NULL AND NOT EXISTS (SELECT FROM public.donors WHERE madrasa_id=p_tenant AND id=(p_row->>'donor_id')::uuid) THEN RAISE EXCEPTION 'অপরিচিত দাতা'; END IF;
    SELECT id INTO existing FROM public.donations WHERE madrasa_id=p_tenant AND receipt_no=receipt FOR UPDATE;
    IF p_after ?| ARRAY['mahfils','online_donations'] THEN delta:=(p_row->>'amount')::numeric; END IF;
    IF existing IS NOT NULL THEN
      IF NOT p_edit OR NOT (p_after ? 'qurbani_leather_records') OR NOT EXISTS(SELECT FROM public.donations WHERE id=existing AND id::text=p_row->>'id' AND notes LIKE '[কুরবানির চামড়া বিক্রয়]%'
        AND fund_id=p_row->>'fund_id' AND donation_type=p_row->>'fund_name' AND status<>'VOID')
        OR (SELECT count(*) FROM public.donations WHERE madrasa_id=p_tenant AND receipt_no=receipt)<>1 THEN RAISE EXCEPTION 'বিদ্যমান রসিদটি যাচাই করুন।'; END IF;
      UPDATE public.donations SET amount=(p_row->>'amount')::numeric,donation_date=(p_row->>'date')::date,notes=p_row->>'notes' WHERE id=existing;
    ELSE
      INSERT INTO public.donations(id,madrasa_id,donor_id,member_id,amount,donation_date,receipt_no,notes,fund_id,fund_name,donation_type)
      VALUES(coalesce((p_row->>'id')::uuid,gen_random_uuid()),p_tenant,(p_row->>'donor_id')::uuid,p_row->>'member_id',(p_row->>'amount')::numeric,(p_row->>'date')::date,receipt,p_row->>'notes',p_row->>'fund_id',p_row->>'fund_name',p_row->>'fund_name');
    END IF;
  ELSIF p_kind='mahfil_deficit' THEN
    delta:=-(p_row->>'amount')::numeric;
    PERFORM public.finance_posting_fund(p_tenant,p_row->>'fund_id','mahfil_deficit',NULL,NULL);
    INSERT INTO public.expenses(id,madrasa_id,amount,expense_date,category,description,voucher_no,fund_id)
      VALUES((p_row->>'id')::uuid,p_tenant,(p_row->>'amount')::numeric,(p_row->>'date')::date,'মাহফিল ঘাটতি সমন্বয়',p_row->>'notes',receipt,p_row->>'fund_id');
  ELSIF p_kind IN ('void_surplus','void_deficit') AND p_after ? 'mahfils' THEN
    -- This is an explicit operator cancellation, never a read/cleanup. Match the
    -- original row, institution, amount, fund AND voucher before touching either book.
    IF p_kind='void_surplus' THEN
      UPDATE public.donations SET status='VOID',void_reason='মাহফিল সমন্বয় বাতিল',voided_at=now()
        WHERE id=(p_row->>'id')::uuid AND madrasa_id=p_tenant AND status<>'VOID' AND fund_id=p_row->>'fund_id'
          AND receipt_no=receipt AND amount=(p_row->>'amount')::numeric RETURNING -amount INTO delta;
    ELSE
      UPDATE public.expenses SET status='VOID',void_reason='মাহফিল সমন্বয় বাতিল',voided_at=now()
        WHERE id=(p_row->>'id')::uuid AND madrasa_id=p_tenant AND status<>'VOID' AND fund_id=p_row->>'fund_id'
          AND voucher_no=receipt AND amount=(p_row->>'amount')::numeric RETURNING amount INTO delta;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'সমন্বয়ের মূল ভাউচার মেলেনি। ম্যানুয়াল যাচাই প্রয়োজন।'; END IF;
  ELSE RAISE EXCEPTION 'Invalid collection type'; END IF;
  -- Retain the existing settlement/verification balance cache. No name matching,
  -- clamping to zero, or rewriting historical balances.
  IF delta<>0 THEN UPDATE public.zakat_funds SET current_balance=current_balance+delta
    WHERE madrasa_id=p_tenant AND id=p_row->>'fund_id'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finance_post_collection(uuid,jsonb,jsonb,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_post_collection(uuid,jsonb,jsonb,text,jsonb,boolean) TO service_role;

-- Preserve settlement evidence, including singular records from older installations.
-- Compare only changed links: reapplying this migration never inspects, guesses or
-- rewrites existing unmatched vouchers. Unrelated event header edits remain allowed.
CREATE OR REPLACE FUNCTION public.finance_settlement_refs(events jsonb)
RETURNS TABLE(event_id text, ref jsonb, txn jsonb) LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT DISTINCT m->>'id',s,t FROM jsonb_array_elements(events) m
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(nullif(m->'settlements','null'),'[]') ||
    CASE WHEN jsonb_typeof(m->'settlement')='object' THEN jsonb_build_array(m->'settlement') ELSE '[]'::jsonb END) s
  LEFT JOIN LATERAL jsonb_array_elements(coalesce(nullif(m->'transactions','null'),'[]')) t ON t->>'id'=s->>'mahfil_txn_id'
$$;
CREATE OR REPLACE FUNCTION public.finance_check_settlement_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_events jsonb:=public.finance_metadata(OLD)->'mahfils'; new_events jsonb:=public.finance_metadata(NEW)->'mahfils'; change record;
BEGIN
  IF old_events IS NOT DISTINCT FROM new_events THEN RETURN NULL; END IF;
  FOR change IN SELECT * FROM public.finance_settlement_refs(old_events) EXCEPT SELECT * FROM public.finance_settlement_refs(new_events) LOOP
    IF NOT EXISTS(SELECT FROM public.donations WHERE madrasa_id=NEW.id AND id::text=change.ref->>'accounting_record_id' AND status='VOID')
      AND NOT EXISTS(SELECT FROM public.expenses WHERE madrasa_id=NEW.id AND id::text=change.ref->>'accounting_record_id' AND status='VOID') THEN
      RAISE EXCEPTION 'পোস্ট করা মাহফিল সমন্বয় আলাদাভাবে বদলানো যাবে না।'; END IF;
  END LOOP;
  FOR change IN SELECT * FROM public.finance_settlement_refs(new_events) EXCEPT SELECT * FROM public.finance_settlement_refs(old_events) LOOP
    IF change.txn IS NULL OR NOT EXISTS(
      SELECT FROM (SELECT 'SURPLUS_DEPOSIT' kind,id,receipt_no AS voucher,amount,fund_id,status FROM public.donations WHERE madrasa_id=NEW.id AND id::text=change.ref->>'accounting_record_id'
      UNION ALL SELECT 'DEFICIT_COVER',id,voucher_no,amount,fund_id,status FROM public.expenses WHERE madrasa_id=NEW.id AND id::text=change.ref->>'accounting_record_id') v
      WHERE v.status<>'VOID' AND v.kind=change.ref->>'settlement_type' AND v.amount=(change.ref->>'amount')::numeric
        AND v.fund_id=change.ref->>'fund_id' AND v.voucher=change.ref->>'accounting_voucher_no'
        AND v.amount=(change.txn->>'amount')::numeric AND change.txn->>'type'=CASE v.kind WHEN 'SURPLUS_DEPOSIT' THEN 'EXPENSE' ELSE 'INCOME' END) THEN
      RAISE EXCEPTION 'মাহফিলের সমন্বয় ও মূল ভাউচার মেলেনি।'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS finance_check_settlement_changes ON public.madrasas;
CREATE CONSTRAINT TRIGGER finance_check_settlement_changes AFTER UPDATE ON public.madrasas DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (OLD.registration_no IS DISTINCT FROM NEW.registration_no OR OLD.metadata IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION public.finance_check_settlement_changes();
CREATE OR REPLACE FUNCTION public.finance_protect_settled_voucher() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT FROM public.madrasas m,public.finance_settlement_refs(public.finance_metadata(m)->'mahfils') s
    WHERE m.id=OLD.madrasa_id AND s.ref->>'accounting_record_id'=OLD.id::text) OR
    (TG_OP='UPDATE' AND OLD.void_reason='মাহফিল সমন্বয় বাতিল') THEN RAISE EXCEPTION 'মাহফিল সমন্বয়ের ভাউচার আলাদাভাবে পরিবর্তন করা যাবে না।'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_protect_settled_voucher ON public.donations;
CREATE TRIGGER finance_protect_settled_voucher BEFORE UPDATE OR DELETE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.finance_protect_settled_voucher();
DROP TRIGGER IF EXISTS finance_protect_settled_voucher ON public.expenses;
CREATE TRIGGER finance_protect_settled_voucher BEFORE UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.finance_protect_settled_voucher();
REVOKE ALL ON FUNCTION public.finance_settlement_refs(jsonb),public.finance_check_settlement_changes(),public.finance_protect_settled_voucher() FROM PUBLIC,anon,authenticated;

-- Soft cancel / restore one identified posting and its verified source mirror in one
-- transaction. Historical rows need no automatic re-funding. Compare the stored row,
-- never update a voucher found only by a display number or a substring of its notes.
CREATE OR REPLACE FUNCTION public.finance_change_voucher(p_tenant uuid,p_actor uuid,p_table text,p_expected jsonb,
  p_before jsonb,p_after jsonb,p_void boolean,p_reason text,p_record text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); body jsonb; k text; clean text; who text;
  next_status text:=CASE WHEN p_void THEN 'VOID' ELSE 'COMPLETED' END;
BEGIN
  SELECT email INTO STRICT who FROM public.users WHERE id=p_actor AND madrasa_id=p_tenant;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500 OR p_void IS NULL THEN RAISE EXCEPTION 'কারণ উল্লেখ করুন।'; END IF;
  IF p_table='donations' THEN
    SELECT to_jsonb(d) INTO STRICT body FROM public.donations d WHERE d.madrasa_id=p_tenant AND d.id=(p_expected->>'id')::uuid FOR UPDATE;
  ELSIF p_table='expenses' THEN
    SELECT to_jsonb(e) INTO STRICT body FROM public.expenses e WHERE e.madrasa_id=p_tenant AND e.id=(p_expected->>'id')::uuid FOR UPDATE;
  ELSIF p_table='bazar_expenses' THEN
    SELECT to_jsonb(b) INTO STRICT body FROM public.bazar_expenses b WHERE b.madrasa_id=p_tenant AND b.id=(p_expected->>'id')::uuid FOR UPDATE;
  ELSIF p_table<>'source' OR p_after='{}'::jsonb THEN RAISE EXCEPTION 'ভাউচার মেলেনি।'; END IF;
  IF body IS NOT NULL THEN
    FOREACH k IN ARRAY ARRAY['fund_id','fund_name','donation_type','donor_id','member_id','amount','status','expense_date','donation_date','category','restricted_beneficiary','notes','description','items_details','receipt_no','voucher_no'] LOOP
      IF body->k IS DISTINCT FROM p_expected->k THEN RAISE EXCEPTION 'ভাউচার বদলেছে। রিফ্রেশ করুন।'; END IF;
    END LOOP;
    IF (coalesce(body->>'status','')='VOID' OR coalesce(body->>'notes',body->>'description',body->>'items_details','') ~* '\[VOID:')=p_void THEN RAISE EXCEPTION 'ভাউচারের অবস্থা বদলেছে।'; END IF;
    IF EXISTS(SELECT FROM public.finance_closed_periods(p_tenant) WHERE coalesce(body->>'expense_date',body->>'donation_date')::date BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
    clean:=regexp_replace(coalesce(body->>'notes',body->>'description',''),'\[VOID:[^]]*\]\s*','','gi');
    IF p_table='donations' THEN
      UPDATE public.donations SET status=next_status,notes=clean,void_reason=CASE WHEN p_void THEN p_reason END,
        voided_at=CASE WHEN p_void THEN now() END WHERE id=(body->>'id')::uuid AND madrasa_id=p_tenant;
    ELSIF p_table='bazar_expenses' THEN
      UPDATE public.bazar_expenses SET status=next_status,void_reason=CASE WHEN p_void THEN p_reason END,voided_at=CASE WHEN p_void THEN now() END WHERE id=(body->>'id')::uuid AND madrasa_id=p_tenant;
    ELSE
      UPDATE public.expenses SET status=next_status,description=clean,void_reason=CASE WHEN p_void THEN p_reason END,
        voided_at=CASE WHEN p_void THEN now() END WHERE id=(body->>'id')::uuid AND madrasa_id=p_tenant;
    END IF;
  END IF;
  IF p_after<>'{}' THEN PERFORM public.finance_replace_sources(p_tenant,p_before,p_after); END IF;
  meta:=public.portal_locked_metadata(p_tenant);
  meta:=jsonb_set(meta,'{audit_logs}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'madrasa_id',p_tenant,
    'action',CASE WHEN p_void THEN 'VOID_FUND_TRANSACTION' ELSE 'UNVOID_FUND_TRANSACTION' END,'user_name',who,
    'record_id',p_record,'details',p_reason,'created_at',now()))||coalesce(meta->'audit_logs','[]'));
  UPDATE public.madrasas SET registration_no=meta::text WHERE id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.finance_change_voucher(uuid,uuid,text,jsonb,jsonb,jsonb,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_change_voucher(uuid,uuid,text,jsonb,jsonb,jsonb,boolean,text,text) TO service_role;

-- One cashier operation: never upsert the tenant's entire payment history to
-- post a new receipt. The portal callback already uses a separate atomic RPC.
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS fund_id text, ADD COLUMN IF NOT EXISTS fund_name text;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS request_hash text;
-- An old mirror's bracketed reference is evidence, not a receipt guessed from amount/date.
CREATE OR REPLACE FUNCTION public.finance_fee_ref(note text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT btrim(substring(note FROM '(?i)\[(?:রিসিট|রসিদ|অনলাইন পেমেন্ট|Receipt):\s*([^]|]+)'))
$$;
-- getFeeMetadata's relational-first cutoff. Fee-type-only JSON must not
-- disappear when its first payment is collected. For a completely empty school
-- the first schedule may use virtual templates; the first standalone receipt can
-- start the SQL book. Once there are bills/structures/receipts the mode is pinned.
CREATE OR REPLACE FUNCTION public.finance_relational_book(t uuid,m jsonb,empty_sql boolean) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT FROM public.student_fees WHERE madrasa_id=t) OR EXISTS(SELECT FROM public.fee_payments WHERE madrasa_id=t)
    OR EXISTS(SELECT FROM public.fee_structures WHERE madrasa_id=t) OR
    (NOT EXISTS(SELECT FROM jsonb_array_elements(coalesce(m->'payments','[]') || coalesce(m->'student_fees','[]') || coalesce(m->'fee_structures','[]') || coalesce(m->'fee_types','[]'))) AND
      (empty_sql OR EXISTS(SELECT FROM public.fee_types WHERE madrasa_id=t)))
$$;
CREATE OR REPLACE FUNCTION public.finance_json_fee_rows(t uuid,k text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE m jsonb;
BEGIN
  IF k IS NULL OR k NOT IN ('payments','student_fees','fee_types','fee_structures') THEN RAISE EXCEPTION 'Invalid fee book'; END IF;
  SELECT public.finance_metadata(x) INTO STRICT m FROM public.madrasas x WHERE x.id=t;
  IF public.finance_relational_book(t,m,true) OR (k='fee_types' AND jsonb_array_length(coalesce(m->'fee_types','[]'))=0) THEN RETURN NULL; END IF;
  RETURN coalesce(m->k,'[]');
END $$;
REVOKE ALL ON FUNCTION public.finance_json_fee_rows(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_json_fee_rows(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.finance_active_fee_type(t uuid,m jsonb,rel boolean,k text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT CASE WHEN NOT rel AND jsonb_array_length(coalesce(m->'fee_types','[]'))>0 THEN
    EXISTS(SELECT FROM jsonb_array_elements(m->'fee_types') f WHERE f->>'id'=k AND coalesce((f->>'is_active')::boolean,true))
    WHEN rel OR EXISTS(SELECT FROM public.fee_types WHERE madrasa_id=t) THEN EXISTS(SELECT FROM public.fee_types WHERE madrasa_id=t AND id=k AND is_active)
    ELSE k=ANY(ARRAY['ft_admission','ft_monthly','ft_exam','ft_hostel','ft_books','ft_library','ft_idcard','ft_transport','ft_uniform','ft_certificate','ft_other']) END
$$;
REVOKE ALL ON FUNCTION public.finance_relational_book(uuid,jsonb,boolean),public.finance_active_fee_type(uuid,jsonb,boolean,text) FROM PUBLIC,authenticated,anon;
GRANT EXECUTE ON FUNCTION public.finance_relational_book(uuid,jsonb,boolean),public.finance_active_fee_type(uuid,jsonb,boolean,text) TO service_role;
CREATE OR REPLACE FUNCTION public.finance_collect_fee(p_tenant uuid,p_actor uuid,p jsonb,p_expected jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); pupil uuid:=(p->>'student_id')::uuid; who public.users%rowtype;
  rel boolean; a jsonb; bill jsonb; expected jsonb; existing jsonb; fund jsonb; bp bigint; paid numeric; disc numeric; due numeric; payable numeric; st text;
  receipt text:=nullif(btrim(p->>'receipt_no'),''); series text; serial numeric; fingerprint text; pid text:=p->>'id'; legacy_id uuid; total numeric:=(p->>'total_amount_received')::numeric;
  normalized jsonb:='[]'; cash numeric; discount numeric; allocated numeric:=0; discounts numeric:=0; d date:=(p->>'payment_date')::date; type_id text;
BEGIN
  SELECT * INTO STRICT who FROM public.users WHERE madrasa_id=p_tenant AND id=p_actor;
  IF NOT EXISTS(SELECT FROM public.students WHERE madrasa_id=p_tenant AND id=pupil) OR p->>'madrasa_id' IS DISTINCT FROM p_tenant::text OR
    (total BETWEEN 0 AND 99999999.99 AND total=round(total,2)) IS NOT TRUE OR (total=0 AND coalesce((p->>'discount_total')::numeric,0)<=0) OR length(receipt)>100 OR receipt ~ '[|\[\][:cntrl:]]' OR nullif(pid,'') IS NULL OR d IS NULL OR
    jsonb_typeof(p->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'allocations')=0 THEN RAISE EXCEPTION 'ফি রসিদ, শিক্ষার্থী ও অঙ্ক যাচাই করুন।'; END IF;
  -- Match the read store's cutover rule. Don't hide an existing metadata book by inserting its first SQL receipt.
  rel:=public.finance_relational_book(p_tenant,meta,true);
  IF nullif(p->>'idempotency_key','') IS NOT NULL THEN
    -- Ignore only server-generated display/identity fields. A key cannot acknowledge
    -- a different bill, split, fund, student, actor or amount as a successful payment.
    fingerprint:=encode(sha256(convert_to((jsonb_build_array(p_actor,p - ARRAY['id','created_at','student_name','student_roll','class_name','collector_name','status'])::text),'UTF8')),'hex');
    IF rel THEN
      SELECT to_jsonb(fp)||jsonb_build_object('allocations',(SELECT coalesce(jsonb_agg(to_jsonb(fa) ORDER BY fa.id),'[]') FROM public.fee_payment_allocations fa WHERE fa.payment_id=fp.id))
        INTO existing FROM public.fee_payments fp WHERE madrasa_id=p_tenant AND idempotency_key=p->>'idempotency_key';
    ELSE SELECT value INTO existing FROM jsonb_array_elements(meta->'payments') WHERE value->>'idempotency_key'=p->>'idempotency_key'; END IF;
    IF existing IS NOT NULL THEN
      IF existing->>'request_hash'=fingerprint AND existing->>'status'='COMPLETED' THEN RETURN (existing-'request_hash')||'{"already_posted":true}'; END IF;
      RAISE EXCEPTION 'একই অনুরোধের রসিদ বদলেছে। মূল রসিদ যাচাই করুন।';
    END IF;
  END IF;
  -- Allocate under the same tenant lock as gateway callbacks. Scan both books,
  -- including legacy mirrors, without rewriting or renumbering any older receipt.
  IF receipt IS NULL THEN
    series:='MR-'||to_char(d,'YYYY')||'-';
    SELECT greatest(100,coalesce((meta->>'receipt_counter')::numeric,0),coalesce(max((substring(n FROM ('^'||series||'([0-9]+)')))::numeric),0))+1 INTO serial
      FROM (SELECT receipt_no AS n FROM public.fee_payments WHERE madrasa_id=p_tenant
        UNION ALL SELECT r->>'receipt_no' FROM jsonb_array_elements(meta->'payments') r
        UNION ALL SELECT public.finance_fee_ref(notes) FROM public.fees WHERE madrasa_id=p_tenant) numbers;
    receipt:=series||lpad(serial::text,greatest(5,length(serial::text)),'0');
  END IF;
  IF EXISTS(SELECT FROM public.fees WHERE madrasa_id=p_tenant AND lower(public.finance_fee_ref(notes))=lower(receipt)) OR
     EXISTS(SELECT FROM public.fee_payments WHERE madrasa_id=p_tenant AND lower(receipt_no)=lower(receipt)) THEN RAISE EXCEPTION 'ফি রসিদ ইতিমধ্যে আছে।'; END IF;
  IF EXISTS(SELECT FROM public.finance_closed_periods(p_tenant) WHERE d BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(meta->'payments') r WHERE r->>'id'=pid OR lower(r->>'receipt_no')=lower(receipt)) THEN RAISE EXCEPTION 'ফি রসিদ ইতিমধ্যে আছে।'; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(p->'allocations') r WHERE nullif(r->>'student_fee_id','') IS NOT NULL GROUP BY r->>'student_fee_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'একই বিল একাধিকবার দেওয়া হয়েছে।'; END IF;
  fund:=public.finance_posting_fund(p_tenant,p->>'fund_id','deposit','','');
  IF p->>'fund_name' IS DISTINCT FROM fund->>'name' THEN RAISE EXCEPTION 'ফান্ডের নাম ও আইডি মিলছে না।'; END IF;
  IF coalesce(p->>'notes','') ~* '\[VOID:' THEN RAISE EXCEPTION 'নতুন রসিদে বাতিলের ট্যাগ দেওয়া যাবে না।'; END IF;
  IF total>0 THEN
    INSERT INTO public.fees(madrasa_id,student_id,amount,fee_type,payment_date,fee_month,fee_year,notes) VALUES(p_tenant,pupil,total,coalesce(nullif(p->>'fee_type',''),'Monthly'),d,to_char(d,'FMMonth'),extract(year FROM d)::text,'[রিসিট: '||receipt||']') RETURNING id INTO legacy_id;
  END IF;
  p:=p||jsonb_build_object('receipt_no',receipt,'request_hash',fingerprint,'db_fee_id',legacy_id,'status','COMPLETED','collector_name',who.email);
  IF rel THEN
    INSERT INTO public.fee_payments(id,receipt_no,madrasa_id,student_id,session_id,student_name,student_roll,class_name,fund_id,fund_name,total_amount_received,payment_date,payment_method,transaction_ref,discount_total,fine_total,advance_amount,collector_name,db_fee_id,notes,idempotency_key,request_hash)
      VALUES(pid,receipt,p_tenant,pupil,coalesce(p->>'session_id','default'),p->>'student_name',p->>'student_roll',p->>'class_name',fund->>'id',fund->>'name',total,d,coalesce(p->>'payment_method','Cash'),p->>'transaction_ref',coalesce((p->>'discount_total')::numeric,0),coalesce((p->>'fine_total')::numeric,0),coalesce((p->>'advance_amount')::numeric,0),who.email,legacy_id,p->>'notes',p->>'idempotency_key',fingerprint);
  END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(p->'allocations') ORDER BY value->>'student_fee_id' LOOP
    fund:=public.finance_posting_fund(p_tenant,a->>'fund_id','deposit','','');
    cash:=(a->>'allocated_amount')::numeric; discount:=coalesce((a->>'discount_applied')::numeric,0);
    IF a->>'fund_name' IS DISTINCT FROM fund->>'name' OR (cash>=0 AND cash=round(cash,2) AND discount>=0 AND discount=round(discount,2) AND cash+discount>0) IS NOT TRUE THEN RAISE EXCEPTION 'ফি বণ্টন ও ফান্ডের তথ্য মেলেনি।'; END IF;
    type_id:=nullif(a->>'fee_type_id','');
    IF nullif(a->>'student_fee_id','') IS NOT NULL THEN
      IF rel THEN SELECT to_jsonb(sf) INTO STRICT bill FROM public.student_fees sf WHERE id=a->>'student_fee_id' AND madrasa_id=p_tenant AND student_id=pupil FOR UPDATE;
      ELSE SELECT value,ordinality-1 INTO STRICT bill,bp FROM jsonb_array_elements(meta->'student_fees') WITH ORDINALITY WHERE value->>'id'=a->>'student_fee_id' AND value->>'student_id'=pupil::text; END IF;
      IF (type_id IS NOT NULL AND type_id IS DISTINCT FROM bill->>'fee_type_id') OR (nullif(a->>'billing_period','') IS NOT NULL AND a->>'billing_period' IS DISTINCT FROM bill->>'billing_period') THEN RAISE EXCEPTION 'বিলের খাত বা সময়কাল বদলেছে।'; END IF;
      a:=a||jsonb_build_object('fee_type_id',bill->>'fee_type_id','fee_type_name',coalesce(bill->>'fee_type_name',a->>'fee_type_name','Fee'),'billing_period',bill->>'billing_period');
      expected:=p_expected->(bill->>'id');
      IF expected IS NULL OR (bill->>'due_amount')::numeric IS DISTINCT FROM (expected->>'due_amount')::numeric OR (bill->>'paid_amount')::numeric IS DISTINCT FROM (expected->>'paid_amount')::numeric OR cash+discount>(bill->>'due_amount')::numeric THEN RAISE EXCEPTION 'বিলের অঙ্ক বদলেছে। রিফ্রেশ করুন।'; END IF;
      type_id:=bill->>'fee_type_id';paid:=(bill->>'paid_amount')::numeric+cash;disc:=coalesce((bill->>'discount_amount')::numeric,0)+discount;
      payable:=(bill->>'base_amount')::numeric+coalesce((bill->>'fine_amount')::numeric,0)-disc;due:=payable-paid;
      IF due IS NULL OR due<0 OR due<>(bill->>'due_amount')::numeric-cash-discount THEN RAISE EXCEPTION 'বিল পুনর্মিলন প্রয়োজন।'; END IF;
      st:=CASE WHEN payable=0 AND disc>0 THEN 'WAIVED' WHEN due=0 THEN 'PAID' WHEN paid=0 THEN 'UNPAID' ELSE 'PARTIAL' END;
      IF rel THEN UPDATE public.student_fees SET paid_amount=paid,discount_amount=disc,discount_reason=coalesce(nullif(p->>'discount_reason',''),discount_reason),payable_amount=payable,due_amount=due,status=st,updated_at=now() WHERE id=bill->>'id' AND madrasa_id=p_tenant;
      ELSE meta:=jsonb_set(meta,ARRAY['student_fees',bp::text],bill||jsonb_build_object('paid_amount',paid,'discount_amount',disc,'payable_amount',payable,'due_amount',due,'status',st,'updated_at',now())); END IF;
    ELSIF discount<>0 THEN RAISE EXCEPTION 'ছাড়ের জন্য মূল বিল আবশ্যক।'; END IF;
    IF rel THEN
      IF type_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.fee_types WHERE madrasa_id=p_tenant AND id=type_id) THEN RAISE EXCEPTION 'অপরিচিত ফি খাত।'; END IF;
      INSERT INTO public.fee_payment_allocations(payment_id,student_fee_id,fee_type_id,fee_type_name,billing_period,allocated_amount,discount_applied,fund_id,fund_name)
        VALUES(pid,nullif(a->>'student_fee_id',''),type_id,coalesce(a->>'fee_type_name','Fee'),a->>'billing_period',cash,discount,fund->>'id',fund->>'name');
    END IF;
    normalized:=normalized||jsonb_build_array(a);allocated:=allocated+cash;discounts:=discounts+discount;
  END LOOP;
  IF coalesce((p->>'fine_total')::numeric,0) NOT BETWEEN 0 AND total OR coalesce((p->>'advance_amount')::numeric,0) NOT BETWEEN 0 AND total-coalesce((p->>'fine_total')::numeric,0) OR allocated<>total OR discounts<>coalesce((p->>'discount_total')::numeric,0) THEN RAISE EXCEPTION 'ফি বণ্টন ও মোট অঙ্ক মিলছে না।'; END IF;
  p:=jsonb_set(p,'{allocations}',normalized);
  INSERT INTO public.fee_audit_logs(madrasa_id,action,user_name,user_role,record_id,details) VALUES(p_tenant,'COLLECT_FEE_PAYMENT',who.email,who.role,pid,receipt);
  IF NOT rel THEN
    UPDATE public.madrasas SET registration_no=jsonb_set(meta,'{payments}',jsonb_build_array(p)||coalesce(meta->'payments','[]'))::text,
      finance_source_revision=finance_source_revision+1 WHERE id=p_tenant;
  END IF;
  RETURN p-'request_hash';
END $$;
REVOKE ALL ON FUNCTION public.finance_collect_fee(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_collect_fee(uuid,uuid,jsonb,jsonb) TO service_role;

-- These tables have no madrasa_id. Page by their own primary key but authorize
-- through the owning parent. Browser roles cannot read an unscoped child table.
CREATE OR REPLACE FUNCTION public.finance_backup_children(t uuid,k text,after_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF k='fee_structure_items' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') INTO result FROM (SELECT c.* FROM public.fee_structure_items c JOIN public.fee_structures p ON p.id=c.structure_id WHERE p.madrasa_id=t AND (after_id IS NULL OR c.id>after_id) ORDER BY c.id LIMIT 500) s;
  ELSIF k='fee_payment_allocations' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') INTO result FROM (SELECT c.* FROM public.fee_payment_allocations c JOIN public.fee_payments p ON p.id=c.payment_id WHERE p.madrasa_id=t AND (after_id IS NULL OR c.id>after_id) ORDER BY c.id LIMIT 500) s;
  ELSE RAISE EXCEPTION 'Unknown child table'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.finance_backup_children(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_backup_children(uuid,text,text) TO service_role;

-- The historical picker must not lose months after a PostgREST row limit.
CREATE OR REPLACE FUNCTION public.finance_boarding_months(t uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(ym ORDER BY ym DESC),'[]') FROM (
    SELECT to_char(entry_date,'YYYY-MM') ym FROM public.meal_entries WHERE madrasa_id=t
    UNION SELECT to_char(expense_date,'YYYY-MM') FROM public.bazar_expenses WHERE madrasa_id=t) m
$$;
REVOKE ALL ON FUNCTION public.finance_boarding_months(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_boarding_months(uuid) TO service_role;
-- PostgreSQL requires an UPDATE grant for the trusted writer's SELECT FOR SHARE.
GRANT UPDATE(is_locked) ON public.academic_sessions TO service_role;

-- Choose the term before pricing, and check the same term again inside the bill/config
-- transaction. Never infer the active term from the first row or a historical receipt.
CREATE OR REPLACE FUNCTION public.finance_billing_session(p_tenant uuid, p_wanted text, p_allow_default boolean) RETURNS text
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE meta jsonb; legacy jsonb; registry jsonb; book jsonb; current_ids text[]; wanted text:=nullif(p_wanted,'default');
BEGIN
  SELECT public.finance_metadata(m) INTO STRICT meta FROM public.madrasas m WHERE id=p_tenant;
  legacy:=coalesce(meta->'sessions','[]');
  SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') INTO registry FROM public.academic_sessions s WHERE madrasa_id=p_tenant;
  book:=CASE WHEN registry='[]' THEN legacy ELSE registry END;
  IF jsonb_typeof(legacy) IS DISTINCT FROM 'array' OR EXISTS(SELECT FROM jsonb_array_elements(legacy) s WHERE
      coalesce(s->>'madrasa_id',p_tenant::text)<>p_tenant::text OR nullif(btrim(s->>'id'),'') IS NULL) OR
     EXISTS(SELECT FROM jsonb_array_elements(legacy) s GROUP BY s->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'শিক্ষাবর্ষের খাতা যাচাই করুন।'; END IF;
  SELECT array_agg(DISTINCT id) INTO current_ids FROM (
    SELECT s->>'id' id FROM jsonb_array_elements(registry||legacy) s WHERE (s->>'is_current')::boolean OR (s->>'is_active')::boolean
    UNION ALL SELECT nullif(meta->>'active_session_id','')
  ) c WHERE id IS NOT NULL;
  IF book='[]' AND wanted IS NULL AND current_ids IS NULL AND p_allow_default THEN
    IF NOT EXISTS(SELECT FROM public.student_fees WHERE madrasa_id=p_tenant AND session_id IS DISTINCT FROM 'default') AND
       NOT EXISTS(SELECT FROM public.fee_structures WHERE madrasa_id=p_tenant AND session_id IS DISTINCT FROM 'default') AND
       NOT EXISTS(SELECT FROM public.fee_payments WHERE madrasa_id=p_tenant AND session_id IS DISTINCT FROM 'default') AND
       NOT EXISTS(SELECT FROM jsonb_array_elements(coalesce(meta->'student_fees','[]')||coalesce(meta->'payments','[]')||coalesce(meta->'fee_structures','[]')) b WHERE coalesce(b->>'session_id','default')<>'default') THEN RETURN 'default'; END IF;
  END IF;
  wanted:=coalesce(wanted,current_ids[1]);
  IF cardinality(current_ids)>1 OR (current_ids IS NOT NULL AND wanted<>current_ids[1]) OR
     NOT EXISTS(SELECT FROM jsonb_array_elements(book) s WHERE s->>'id'=wanted) OR
     EXISTS(SELECT FROM jsonb_array_elements(registry||legacy) s WHERE s->>'id'=wanted AND
       (coalesce((s->>'is_locked')::boolean,false) OR upper(coalesce(s->>'status','ACTIVE'))<>'ACTIVE')) THEN
    RAISE EXCEPTION 'একটি সচল, আনলক করা শিক্ষাবর্ষ নির্বাচন করুন। দুই খাতার শিক্ষাবর্ষ মিলিয়ে দেখুন।'; END IF;
  RETURN wanted;
END $$;
REVOKE ALL ON FUNCTION public.finance_billing_session(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_billing_session(uuid,text,boolean) TO service_role;

-- Schedule edits are configuration, not a request to rewrite payment allocations.
ALTER TABLE public.fee_types ADD COLUMN IF NOT EXISTS fund_id text, ADD COLUMN IF NOT EXISTS fund_name text;
CREATE OR REPLACE FUNCTION public.finance_fee_config(p_tenant uuid,p_key text,p_changes jsonb,p_base jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); c jsonb; old jsonb; n jsonb; actual jsonb; item jsonb; cfg jsonb; pos bigint; rid text; rel boolean; term text;
BEGIN
  IF p_key IS NULL OR p_key NOT IN ('fee_types','fee_structures') OR jsonb_typeof(p_base) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid schedule'; END IF;
  rel:=public.finance_relational_book(p_tenant,meta,false);
  IF p_key='fee_structures' THEN
    -- The transaction already holds the tenant row (legacy registry and FK parent).
    PERFORM 1 FROM public.academic_sessions WHERE madrasa_id=p_tenant ORDER BY id FOR SHARE;
    FOR term IN SELECT DISTINCT x->>'session_id' FROM jsonb_array_elements(p_changes) c0,
      LATERAL (VALUES(c0->'before'),(c0->'after')) versions(x) WHERE nullif(x,'null') IS NOT NULL LOOP
      IF public.finance_billing_session(p_tenant,term,true) IS DISTINCT FROM term OR term IS NULL THEN
        RAISE EXCEPTION 'বিলের শিক্ষাবর্ষ বদলেছে।'; END IF;
    END LOOP;
  END IF;
  cfg:=coalesce(meta->p_key,p_base);
  FOR c IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    rid:=c->>'id';old:=nullif(c->'before','null');n:=nullif(c->'after','null');
    IF nullif(rid,'') IS NULL OR (n IS NOT NULL AND (n->>'id' IS DISTINCT FROM rid OR coalesce(n->>'madrasa_id',p_tenant::text)<>p_tenant::text)) THEN RAISE EXCEPTION 'খাতের পরিচয় মেলেনি।'; END IF;
    IF n IS NOT NULL AND p_key='fee_types' AND n->>'fund_name' IS DISTINCT FROM (public.finance_posting_fund(p_tenant,n->>'fund_id','deposit','','')->>'name') THEN RAISE EXCEPTION 'ফান্ড মেলেনি।'; END IF;
    IF n IS NOT NULL AND (nullif(btrim(n->>'name'),'') IS NULL OR (p_key='fee_types' AND
      (coalesce((n->>'default_amount')::numeric,0)<0 OR round((n->>'default_amount')::numeric,2)<>(n->>'default_amount')::numeric))) THEN RAISE EXCEPTION 'ফি খাতের নাম ও অঙ্ক যাচাই করুন।'; END IF;
    IF n IS NOT NULL AND p_key='fee_structures' THEN
      IF (n->>'class_id'='ALL' OR EXISTS(SELECT FROM public.classes WHERE madrasa_id=p_tenant AND id::text=n->>'class_id')) IS NOT TRUE THEN RAISE EXCEPTION 'কাঠামোর শ্রেণি ও প্রতিষ্ঠান মেলেনি।'; END IF;
      IF jsonb_typeof(n->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(n->'items')=0 OR
        EXISTS(SELECT FROM jsonb_array_elements(n->'items') i WHERE (public.finance_active_fee_type(p_tenant,meta,rel,i->>'fee_type_id') AND i->>'frequency' IN ('MONTHLY','YEARLY','ONETIME','TERM') AND
          (i->>'amount')::numeric >= 0 AND (i->>'amount')::numeric=round((i->>'amount')::numeric,2)) IS NOT TRUE) OR
        EXISTS(SELECT FROM jsonb_array_elements(n->'items') i GROUP BY i->>'fee_type_id' HAVING count(*)>1) OR
        (SELECT coalesce(sum((i->>'amount')::numeric) FILTER(WHERE i->>'frequency'='MONTHLY'),0) FROM jsonb_array_elements(n->'items') i) IS DISTINCT FROM (n->>'total_monthly_amount')::numeric OR
        (SELECT coalesce(sum((i->>'amount')::numeric) FILTER(WHERE i->>'frequency'<>'MONTHLY'),0) FROM jsonb_array_elements(n->'items') i) IS DISTINCT FROM (n->>'total_onetime_amount')::numeric THEN RAISE EXCEPTION 'ফি খাত ও কাঠামোর অঙ্ক যাচাই করুন।'; END IF;
    END IF;
    IF NOT rel THEN
      SELECT value,ordinality-1 INTO actual,pos FROM jsonb_array_elements(cfg) WITH ORDINALITY WHERE value->>'id'=rid;
      IF actual IS DISTINCT FROM old THEN RAISE EXCEPTION 'ফি কাঠামো বদলেছে। রিফ্রেশ করুন।'; END IF;
      IF n IS NULL AND p_key='fee_types' AND actual IS NOT NULL THEN n:=actual||jsonb_build_object('is_active',false,'updated_at',now()); END IF;
      cfg:=CASE WHEN n IS NULL THEN cfg-pos::int WHEN pos IS NULL THEN cfg||jsonb_build_array(n) ELSE jsonb_set(cfg,ARRAY[pos::text],n) END;
    ELSIF p_key='fee_types' THEN
      SELECT to_jsonb(ft) INTO actual FROM public.fee_types ft WHERE id=rid AND madrasa_id=p_tenant FOR UPDATE;
      -- A system template has no stored row. Never claim another tenant's global PK.
      IF (actual IS NULL AND old IS NOT NULL AND old->>'is_system' IS DISTINCT FROM 'true') OR
        (actual IS NOT NULL AND (old IS NULL OR (old->>'updated_at')::timestamptz IS DISTINCT FROM (actual->>'updated_at')::timestamptz)) THEN RAISE EXCEPTION 'ফি খাত বদলেছে।'; END IF;
      IF n IS NULL THEN
        -- Archived fee types retain their relationships to historical allocations.
        UPDATE public.fee_types SET is_active=false,updated_at=now() WHERE madrasa_id=p_tenant AND id=rid;
      ELSE
        INSERT INTO public.fee_types(id,madrasa_id,name,code,category,frequency,default_amount,is_active,is_system,fund_id,fund_name)
          VALUES(rid,p_tenant,n->>'name',n->>'code',n->>'category',n->>'frequency',(n->>'default_amount')::numeric,coalesce((n->>'is_active')::boolean,true),coalesce((n->>'is_system')::boolean,false),n->>'fund_id',n->>'fund_name')
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code,category=excluded.category,frequency=excluded.frequency,default_amount=excluded.default_amount,is_active=excluded.is_active,fund_id=excluded.fund_id,fund_name=excluded.fund_name,updated_at=now() WHERE public.fee_types.madrasa_id=p_tenant;
        IF NOT FOUND THEN RAISE EXCEPTION 'অন্য প্রতিষ্ঠানের খাত। নতুন খাত তৈরি করুন।'; END IF;
      END IF;
    ELSE
      SELECT to_jsonb(fs) INTO actual FROM public.fee_structures fs WHERE madrasa_id=p_tenant AND id=rid FOR UPDATE;
      IF (old IS NULL)<>(actual IS NULL) OR (actual->>'updated_at')::timestamptz IS DISTINCT FROM (old->>'updated_at')::timestamptz THEN RAISE EXCEPTION 'ফি কাঠামো বদলেছে।'; END IF;
      IF n IS NULL THEN DELETE FROM public.fee_structures WHERE madrasa_id=p_tenant AND id=rid;
      ELSE
        INSERT INTO public.fee_structures(id,madrasa_id,session_id,class_id,class_name,student_category,name,total_monthly_amount,total_onetime_amount)
          VALUES(rid,p_tenant,n->>'session_id',n->>'class_id',n->>'class_name',n->>'student_category',n->>'name',(n->>'total_monthly_amount')::numeric,(n->>'total_onetime_amount')::numeric)
        ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,class_id=excluded.class_id,class_name=excluded.class_name,student_category=excluded.student_category,name=excluded.name,total_monthly_amount=excluded.total_monthly_amount,total_onetime_amount=excluded.total_onetime_amount,updated_at=now() WHERE public.fee_structures.madrasa_id=p_tenant;
        IF NOT FOUND THEN RAISE EXCEPTION 'অন্য প্রতিষ্ঠানের কাঠামো।'; END IF;
        DELETE FROM public.fee_structure_items WHERE structure_id=rid;
        FOR item IN SELECT value FROM jsonb_array_elements(n->'items') LOOP
          IF NOT EXISTS(SELECT FROM public.fee_types WHERE madrasa_id=p_tenant AND id=item->>'fee_type_id' AND is_active) THEN RAISE EXCEPTION 'ফি খাত যাচাই করুন।'; END IF;
          INSERT INTO public.fee_structure_items(structure_id,fee_type_id,fee_type_name,amount,frequency) VALUES(rid,item->>'fee_type_id',item->>'fee_type_name',(item->>'amount')::numeric,item->>'frequency');
        END LOOP;
      END IF;
    END IF;
  END LOOP;
  IF NOT rel THEN UPDATE public.madrasas SET registration_no=jsonb_set(meta,ARRAY[p_key],cfg)::text,finance_source_revision=finance_source_revision+1 WHERE id=p_tenant; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finance_fee_config(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_fee_config(uuid,text,jsonb,jsonb) TO service_role;

-- Recovery is NOT a way to replay a voucher. Only the trusted server may plan
-- selective, non-financial maintenance. Keep the private snapshot reference even
-- if applying it later fails; never save an old whole-school metadata document.
CREATE OR REPLACE FUNCTION public.finance_backup_note(t uuid, actor uuid, note jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m jsonb:=public.portal_locked_metadata(t); history jsonb;
BEGIN
  IF (note->>'type' IN ('BACKUP_EXPORT','AUTO_SNAPSHOT','RESTORE_MERGE','RESTORE_REPLACE','SCOPED_WIPE')) IS NOT TRUE OR
     NOT EXISTS(SELECT FROM public.users WHERE id=actor AND madrasa_id=t) THEN RAISE EXCEPTION 'Invalid backup audit'; END IF;
  SELECT jsonb_agg(v ORDER BY i) INTO history FROM jsonb_array_elements(jsonb_build_array(note)||coalesce(m->'backup_history','[]')) WITH ORDINALITY a(v,i) WHERE i<=50;
  IF note->>'type'='BACKUP_EXPORT' THEN m:=m||jsonb_build_object('last_backup_date',note->>'timestamp'); END IF;
  UPDATE public.madrasas SET registration_no=jsonb_set(m,'{backup_history}',history)::text WHERE id=t;
END $$;

CREATE OR REPLACE FUNCTION public.finance_apply_recovery(t uuid, actor uuid, plan jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  m jsonb:=public.portal_locked_metadata(t); op text:=plan->>'operation'; ref jsonb; k text; old_rows jsonb; incoming jsonb; r jsonb; saved jsonb;
  meta_keys text[]; tab oid; f record; ok boolean; cols text; setters text; i int; stats jsonb:=plan->'audit';
  -- Independent SQL fence: never accept a finance book, parent of a book,
  -- identity, session, approval, audit or arbitrary table/metadata key.
  safe_tables constant text[]:=ARRAY['routines','exam_routines','hifz_logs','kitab_logs','attendance','teacher_attendance','leaves','exams','exam_subjects','exam_results','question_bank','exam_papers','books','book_issues','notices','sms_templates','sms_logs','alumni'];
  safe_keys constant text[]:=ARRAY['routines','exam_routines','hifz_logs','kitab_logs','hifz_records','biometric_devices','biometric_mappings','biometric_logs','teacher_attendance','student_leaves','teacher_leaves','student_leave_applications','teacher_leave_applications','leaves','published_exams','exam_end_dates','exam_subjects','question_bank','exam_papers','exam_papers_data','id_cards','id_card_templates','id_card_counter','id_card_builder_config','id_card_audit_logs','certificates','certificate_templates','certificate_audit_logs','certificate_counter','certificate_types','certificate_prefix','verification_logs','books','book_issues','library_books','parent_feedbacks','parent_appointments','absence_alerts','notices','sms_templates','sms_logs','sms_gateway','system_notifications','read_notification_ids','alumni'];
BEGIN
  SELECT value INTO STRICT ref FROM jsonb_array_elements(m->'backup_history') WHERE value->>'id'=plan->>'snapshot_id' AND value->>'type'='AUTO_SNAPSHOT';
  IF NOT EXISTS(SELECT FROM public.users WHERE madrasa_id=t AND id=actor) OR (op IN ('merge','replace','wipe') AND ref->>'storage_path' LIKE 'snapshots/'||t::text||'/%' AND ref->>'checksum'<>'' AND ref->'modules'=stats->'modules') IS NOT TRUE THEN RAISE EXCEPTION 'Verified recovery snapshot required'; END IF;
  IF op='replace' AND plan->'tables'<>'{}' THEN RAISE EXCEPTION 'Selective table replacement is not supported'; END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(plan->'meta_keys')) INTO meta_keys;
  IF NOT meta_keys<@safe_keys OR EXISTS(SELECT FROM jsonb_object_keys(plan->'patch') a(key) WHERE NOT key=ANY(meta_keys)) THEN RAISE EXCEPTION 'Recovery metadata outside scope'; END IF;
  FOREACH k IN ARRAY meta_keys LOOP
    IF m->k IS DISTINCT FROM (plan->'prior_meta')->k THEN RAISE EXCEPTION 'Snapshot metadata changed; take a new snapshot'; END IF;
  END LOOP;

  -- Maintenance runs while writers are paused. Refuse a busy table rather
  -- than racing a payment, or deleting rows inserted after the safety export.
  FOR k IN SELECT jsonb_object_keys(plan->'tables') ORDER BY 1 LOOP
    IF NOT k=ANY(safe_tables) OR (op='wipe' AND k NOT IN ('exams','exam_subjects','exam_results','attendance','teacher_attendance','hifz_logs','kitab_logs')) THEN RAISE EXCEPTION 'Recovery table outside scope'; END IF;
    old_rows:=plan#>ARRAY['tables',k,'before']; incoming:=plan#>ARRAY['tables',k,'rows'];
    IF jsonb_typeof(old_rows) IS DISTINCT FROM 'array' OR jsonb_typeof(incoming) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid snapshot'; END IF;
    IF to_regclass(format('public.%I',k)) IS NULL THEN
      IF old_rows<>'[]' OR incoming<>'[]' THEN RAISE EXCEPTION 'Recovery table missing'; END IF;
      CONTINUE;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',k);
    EXECUTE format('SELECT (SELECT count(*) FROM public.%1$I WHERE madrasa_id=$1)=jsonb_array_length($2) AND NOT EXISTS (SELECT to_jsonb(p) FROM public.%1$I p WHERE madrasa_id=$1 EXCEPT ALL SELECT to_jsonb(a) FROM jsonb_populate_recordset(NULL::public.%1$I,$2) a)',k) INTO ok USING t,old_rows;
    IF NOT ok THEN RAISE EXCEPTION 'Snapshot rows changed; take a new snapshot'; END IF;
  END LOOP;

  -- One transaction for ALL selected tables, selected metadata and success audit.
  -- Parent first for merge, child first for wipe. No client-controlled SQL names.
  FOR i IN 1..cardinality(safe_tables) LOOP
    k:=safe_tables[CASE WHEN op='wipe' THEN cardinality(safe_tables)+1-i ELSE i END];
    IF NOT (plan->'tables')?k THEN CONTINUE; END IF;
    tab:=to_regclass(format('public.%I',k)); IF tab IS NULL THEN CONTINUE; END IF;
    IF op='wipe' THEN
      -- Never cascade out of the snapshot, even on a customised/newer schema.
      FOR f IN SELECT c.conrelid::regclass AS child,ns.nspname,rel.relname,c.conkey,c.confkey,ca.attname AS fk,pa.attname AS pk
        FROM pg_constraint c JOIN pg_class rel ON rel.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=rel.relnamespace
        JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1] JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
        WHERE c.contype='f' AND c.confrelid=tab AND c.confdeltype IN ('c','d','n') LOOP
        IF f.nspname<>'public' OR NOT (plan->'tables')?f.relname OR cardinality(f.conkey)<>1 THEN RAISE EXCEPTION 'Dependent data outside wipe scope'; END IF;
        EXECUTE format('SELECT EXISTS(SELECT FROM %s c JOIN public.%I p ON p.%I=c.%I WHERE p.madrasa_id=$1)',f.child,k,f.pk,f.fk) INTO ok USING t;
        IF ok THEN RAISE EXCEPTION 'Dependent rows remain; refusing cascade'; END IF;
      END LOOP;
      EXECUTE format('DELETE FROM public.%I WHERE madrasa_id=$1',k) USING t;
      CONTINUE;
    END IF;
    incoming:=plan#>ARRAY['tables',k,'rows'];
    IF EXISTS(SELECT FROM jsonb_array_elements(incoming) a GROUP BY a->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate restore id'; END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(incoming) LOOP
      IF nullif(r->>'id','') IS NULL OR coalesce(r->>'madrasa_id',t::text)<>t::text THEN RAISE EXCEPTION 'Invalid recovery record'; END IF;
      r:=r||jsonb_build_object('madrasa_id',t);
      IF EXISTS(SELECT FROM jsonb_object_keys(r) x(key) WHERE NOT EXISTS(SELECT FROM pg_attribute a WHERE a.attrelid=tab AND a.attname=key AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='' AND a.attidentity='')) THEN RAISE EXCEPTION 'Unsupported recovery column'; END IF;
      SELECT string_agg(format('%I',key),',' ORDER BY key),string_agg(format('%1$I=excluded.%1$I',key),',' ORDER BY key) FILTER (WHERE key NOT IN ('id','madrasa_id')) INTO cols,setters FROM jsonb_object_keys(r) a(key);
      -- A global ID collision is an error, never a transfer between tenants.
      -- Partial updates don't have to supply the NOT NULL columns of an INSERT.
      EXECUTE format('SELECT EXISTS(SELECT FROM public.%I WHERE madrasa_id=$1 AND id::text=$2)',k) INTO ok USING t,r->>'id';
      IF ok THEN
        EXECUTE format('UPDATE public.%1$I owned SET %2$s FROM jsonb_populate_record(NULL::public.%1$I,$1) excluded WHERE owned.id=excluded.id AND owned.madrasa_id=$2 RETURNING to_jsonb(owned)',k,coalesce(setters,'id=owned.id')) INTO STRICT saved USING r,t;
      ELSE
        EXECUTE format('INSERT INTO public.%1$I AS owned (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I,$1) RETURNING to_jsonb(owned)',k,cols) INTO STRICT saved USING r;
      END IF;
      -- A valid global foreign key need not belong to this school. Validate
      -- the resulting row, not just fields present in a partial update.
      FOR f IN SELECT c.confrelid::regclass AS parent,c.confrelid AS parent_id,c.conkey,ca.attname AS fk,pa.attname AS pk
        FROM pg_constraint c JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1] JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
        WHERE c.contype='f' AND c.conrelid=tab LOOP
        IF f.fk='madrasa_id' AND f.parent_id='public.madrasas'::regclass THEN CONTINUE; END IF;
        IF cardinality(f.conkey)<>1 THEN RAISE EXCEPTION 'Unsupported composite recovery reference'; END IF;
        IF saved->>f.fk IS NULL THEN CONTINUE; END IF;
        EXECUTE format('SELECT true FROM %s WHERE madrasa_id=$1 AND %I::text=$2 FOR SHARE',f.parent,f.pk) INTO ok USING t,saved->>f.fk;
        IF ok IS NOT TRUE THEN RAISE EXCEPTION 'Parent outside recovery scope'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF op='wipe' THEN
    UPDATE public.madrasas SET metadata=metadata-meta_keys,registration_no=(m-meta_keys)::text WHERE id=t;
  ELSE
    UPDATE public.madrasas SET registration_no=(m || (plan->'patch'))::text WHERE id=t;
  END IF;
  PERFORM public.finance_backup_note(t,actor,stats);
END $$;
REVOKE ALL ON FUNCTION public.finance_backup_note(uuid,uuid,jsonb),public.finance_apply_recovery(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_backup_note(uuid,uuid,jsonb),public.finance_apply_recovery(uuid,uuid,jsonb) TO service_role;

-- Compare exact old display labels to canonical Gregorian months; preserve history
-- and leave Hijri periods distinct. Mirrors lib/finance/bill-period.ts.
CREATE OR REPLACE FUNCTION public.finance_bill_period(v text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
  SELECT coalesce(m[2]||'-'||lpad(array_position(string_to_array('january february march april may june july august september october november december',' '),lower(m[1]))::text,2,'0'),btrim(v))
  FROM (SELECT regexp_match(btrim(v),'^(?:[^()]+\()?([a-z]+)\)?\s+([0-9]{4})$','i') m) x
$$;
REVOKE ALL ON FUNCTION public.finance_bill_period(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_bill_period(text) TO service_role;

-- Invoice generation, boarding sync and deletion may change unpaid invoices, never cash.
-- Compare only the rows actually changed; an old billing preview cannot overwrite a receipt.
CREATE OR REPLACE FUNCTION public.finance_edit_bills(p_tenant uuid,p_changes jsonb,p_audit jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); bills jsonb:=coalesce(meta->'student_fees','[]');
  rel boolean; c jsonb; prior jsonb; nxt jsonb; actual jsonb; rid text; pos bigint; k text; v public.student_fees; term text;
BEGIN
  rel:=public.finance_relational_book(p_tenant,meta,false);
    -- The transaction already holds the tenant row (legacy registry and FK parent).
    PERFORM 1 FROM public.academic_sessions WHERE madrasa_id=p_tenant ORDER BY id FOR SHARE;
    FOR term IN SELECT DISTINCT x->>'session_id' FROM jsonb_array_elements(p_changes) c0,
      LATERAL (VALUES(c0->'before'),(c0->'after')) versions(x) WHERE nullif(x,'null') IS NOT NULL LOOP
      IF public.finance_billing_session(p_tenant,term,true) IS DISTINCT FROM term OR term IS NULL THEN
        RAISE EXCEPTION 'বিলের শিক্ষাবর্ষ বদলেছে।'; END IF;
    END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(p_changes) ORDER BY value->>'id' LOOP
    rid:=c->>'id';prior:=nullif(c->'before','null');nxt:=nullif(c->'after','null');
    IF rel THEN SELECT to_jsonb(sf) INTO actual FROM public.student_fees sf WHERE sf.id=rid AND sf.madrasa_id=p_tenant FOR UPDATE;
    ELSE SELECT value,ordinality-1 INTO actual,pos FROM jsonb_array_elements(bills) WITH ORDINALITY WHERE value->>'id'=rid; END IF;
    IF (actual IS NULL)<>(prior IS NULL) OR (actual IS NOT NULL AND (actual->>'updated_at')::timestamptz IS DISTINCT FROM (prior->>'updated_at')::timestamptz) THEN RAISE EXCEPTION 'বিল বদলেছে। রিফ্রেশ করুন।'; END IF;
    IF actual IS NOT NULL THEN
      FOREACH k IN ARRAY ARRAY['student_id','fee_type_id','billing_period','status','fund_id','fund_name','session_id'] LOOP
        IF actual->>k IS DISTINCT FROM prior->>k THEN RAISE EXCEPTION 'বিল বদলেছে। রিফ্রেশ করুন।'; END IF;
      END LOOP;
      FOREACH k IN ARRAY ARRAY['base_amount','discount_amount','paid_amount','fine_amount','payable_amount','due_amount'] LOOP
        IF coalesce((actual->>k)::numeric,0) IS DISTINCT FROM coalesce((prior->>k)::numeric,0) THEN RAISE EXCEPTION 'বিল বদলেছে। রিফ্রেশ করুন।'; END IF;
      END LOOP;
      IF EXISTS(SELECT FROM jsonb_array_elements(meta->'online_transactions') t,jsonb_array_elements(t->'allocations') a WHERE t->>'status'='PENDING' AND a->>'student_fee_id'=rid) THEN RAISE EXCEPTION 'এই বিলে একটি checkout চলছে।'; END IF;
      IF coalesce((actual->>'paid_amount')::numeric,0)<>0 OR EXISTS(SELECT FROM public.fee_payment_allocations a JOIN public.fee_payments p ON p.id=a.payment_id WHERE p.madrasa_id=p_tenant AND a.student_fee_id=rid) OR
         EXISTS(SELECT FROM jsonb_array_elements(meta->'payments') p,jsonb_array_elements(p->'allocations') a WHERE a->>'student_fee_id'=rid) THEN RAISE EXCEPTION 'রসিদযুক্ত বিল অপরিবর্তনীয়।'; END IF;
    END IF;
    IF EXISTS(SELECT FROM public.finance_closed_periods(p_tenant) period WHERE EXISTS(
        SELECT FROM (VALUES(actual),(nxt)) dates(b) WHERE (b->>'due_date')::date BETWEEN period.start_date AND period.end_date OR
        (CASE WHEN public.finance_bill_period(b->>'billing_period') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN daterange((public.finance_bill_period(b->>'billing_period')||'-01')::date,((public.finance_bill_period(b->>'billing_period')||'-01')::date+interval '1 month')::date,'[)') && daterange(period.start_date,period.end_date,'[]') ELSE false END))) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
    IF nxt IS NULL AND actual IS NOT NULL THEN
      IF rel THEN DELETE FROM public.student_fees WHERE madrasa_id=p_tenant AND id=rid; ELSE bills:=bills-(pos::int); END IF;
    ELSE
      v:=jsonb_populate_record(NULL::public.student_fees,nxt);
      IF v.id IS DISTINCT FROM rid OR v.madrasa_id IS DISTINCT FROM p_tenant OR NOT EXISTS(SELECT FROM public.students WHERE id=v.student_id AND madrasa_id=p_tenant) OR
        (actual IS NOT NULL AND (v.student_id::text,v.fee_type_id,v.billing_period,v.session_id) IS DISTINCT FROM (actual->>'student_id',actual->>'fee_type_id',actual->>'billing_period',actual->>'session_id')) OR
        (v.paid_amount=0 AND v.due_amount=v.payable_amount AND v.due_amount=v.base_amount+coalesce(v.fine_amount,0)-coalesce(v.discount_amount,0) AND least(v.due_amount,v.base_amount,coalesce(v.discount_amount,0),coalesce(v.fine_amount,0))>=0) IS NOT TRUE THEN RAISE EXCEPTION 'বিল ও অঙ্ক যাচাই করুন।'; END IF;
      IF nullif(v.billing_period,'') IS NULL OR nullif(v.session_id,'') IS NULL OR (v.status=CASE WHEN v.payable_amount=0 THEN 'WAIVED' ELSE 'UNPAID' END) IS NOT TRUE OR
        public.finance_active_fee_type(p_tenant,meta,rel,v.fee_type_id) IS NOT TRUE OR EXISTS(SELECT FROM jsonb_each_text(nxt) x WHERE x.key IN ('base_amount','discount_amount','paid_amount','fine_amount','payable_amount','due_amount') AND x.value::numeric<>round(x.value::numeric,2)) THEN RAISE EXCEPTION 'বিলের খাত, সময়কাল ও অঙ্ক যাচাই করুন।'; END IF;
      IF v.fund_name IS DISTINCT FROM (public.finance_posting_fund(p_tenant,v.fund_id,'deposit','','')->>'name') THEN RAISE EXCEPTION 'বিলের ফান্ড যাচাই করুন।'; END IF;
      IF actual IS NULL AND rel AND EXISTS(SELECT FROM public.student_fees b WHERE b.madrasa_id=p_tenant AND b.student_id=v.student_id AND b.session_id=v.session_id AND b.fee_type_id=v.fee_type_id AND public.finance_bill_period(b.billing_period)=public.finance_bill_period(v.billing_period)) THEN RAISE EXCEPTION 'একই বিল ইতিমধ্যে আছে।'; END IF;
      IF rel THEN
        IF NOT EXISTS(SELECT FROM public.fee_types WHERE id=v.fee_type_id AND madrasa_id=p_tenant) THEN RAISE EXCEPTION 'আগে এই প্রতিষ্ঠানের ফি খাত তৈরি করুন।'; END IF;
        IF actual IS NULL THEN
          INSERT INTO public.student_fees(id,madrasa_id,session_id,student_id,student_name,student_roll,class_id,class_name,fee_type_id,fee_type_name,billing_period,month_name,year,due_date,base_amount,discount_amount,discount_reason,fine_amount,fine_reason,payable_amount,paid_amount,due_amount,status,fund_id,fund_name)
            VALUES(v.id,p_tenant,v.session_id,v.student_id,v.student_name,v.student_roll,v.class_id,v.class_name,v.fee_type_id,v.fee_type_name,v.billing_period,v.month_name,v.year,v.due_date,v.base_amount,coalesce(v.discount_amount,0),v.discount_reason,coalesce(v.fine_amount,0),v.fine_reason,v.payable_amount,0,v.due_amount,v.status,v.fund_id,v.fund_name);
        ELSE UPDATE public.student_fees SET base_amount=v.base_amount,discount_amount=v.discount_amount,discount_reason=v.discount_reason,fine_amount=v.fine_amount,fine_reason=v.fine_reason,due_amount=v.due_amount,payable_amount=v.payable_amount,due_date=v.due_date,status=v.status,fund_id=v.fund_id,fund_name=v.fund_name,updated_at=now() WHERE madrasa_id=p_tenant AND id=rid; END IF;
      ELSE
        IF EXISTS(SELECT FROM jsonb_array_elements(bills) b WHERE b->>'id'<>rid AND (b->>'session_id',b->>'student_id',b->>'fee_type_id',public.finance_bill_period(b->>'billing_period'))=(v.session_id,v.student_id::text,v.fee_type_id,public.finance_bill_period(v.billing_period))) THEN RAISE EXCEPTION 'একই বিল ইতিমধ্যে আছে।'; END IF;
        bills:=CASE WHEN pos IS NULL THEN bills||jsonb_build_array(nxt) ELSE jsonb_set(bills,ARRAY[pos::text],nxt) END;
      END IF;
    END IF;
  END LOOP;
  IF p_audit->>'id' IS NOT NULL THEN
    INSERT INTO public.fee_audit_logs(id,madrasa_id,action,user_name,user_role,details) VALUES(p_audit->>'id',p_tenant,p_audit->>'action',p_audit->>'user_name',p_audit->>'user_role',p_audit->>'details');
    meta:=jsonb_set(meta,'{audit_logs}',jsonb_build_array(p_audit)||coalesce(meta->'audit_logs','[]'));
  END IF;
  IF NOT rel THEN UPDATE public.madrasas SET registration_no=jsonb_set(meta,'{student_fees}',bills)::text,finance_source_revision=finance_source_revision+1 WHERE id=p_tenant; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finance_edit_bills(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_edit_bills(uuid,jsonb,jsonb) TO service_role;

-- Reverse an identified fee receipt, not a substring of a legacy receipt number.
-- Dues, discounts, receipt status, optional legacy mirror and the audit commit together.
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED';
CREATE OR REPLACE FUNCTION public.finance_fee_status(p_tenant uuid,p_actor uuid,p_id text,p_status text,p_reason text)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); p jsonb; bill jsonb; a jsonb; allocations jsonb;
  rel boolean; pos bigint; bp bigint; actor public.users%rowtype; rec public.fees%rowtype;
  restoring boolean:=p_status='COMPLETED'; sign integer:=CASE WHEN restoring THEN 1 ELSE -1 END;
  paid numeric; disc numeric; payable numeric; due numeric; bill_status text; patch jsonb; note text; audit jsonb;
BEGIN
  SELECT * INTO STRICT actor FROM public.users WHERE madrasa_id=p_tenant AND id=p_actor;
  IF p_status IS NULL OR p_status NOT IN ('COMPLETED','VOID','REVERSED') OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'রসিদ ও কারণ যাচাই করুন।'; END IF;
  SELECT to_jsonb(fp) INTO p FROM public.fee_payments fp WHERE fp.id=p_id AND fp.madrasa_id=p_tenant FOR UPDATE;
  rel:=FOUND;
  IF rel THEN
    SELECT coalesce(jsonb_agg(to_jsonb(fa)),'[]') INTO allocations FROM public.fee_payment_allocations fa WHERE payment_id=p_id;
  ELSE
    IF EXISTS(SELECT FROM public.fee_payments WHERE madrasa_id=p_tenant) OR EXISTS(SELECT FROM public.student_fees WHERE madrasa_id=p_tenant) OR EXISTS(SELECT FROM public.fee_structures WHERE madrasa_id=p_tenant) THEN
      RAISE EXCEPTION 'মূল ফি রসিদ পাওয়া যায়নি।'; END IF;
    SELECT value,ordinality-1 INTO STRICT p,pos FROM jsonb_array_elements(meta->'payments') WITH ORDINALITY WHERE value->>'id'=p_id;
    allocations:=coalesce(p->'allocations','[]');
  END IF;
  IF coalesce(p->>'madrasa_id',p_tenant::text)<>p_tenant::text OR nullif(p->>'student_id','') IS NULL OR
    (restoring AND coalesce(p->>'status','') NOT IN ('VOID','REVERSED')) OR (NOT restoring AND p->>'status' IS DISTINCT FROM 'COMPLETED') THEN
    RAISE EXCEPTION 'ফি রসিদের অবস্থা মেলেনি। রিফ্রেশ করুন।'; END IF;
  IF EXISTS(SELECT FROM public.finance_closed_periods(p_tenant) WHERE (p->>'payment_date')::date BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(allocations) r WHERE nullif(r->>'student_fee_id','') IS NOT NULL GROUP BY r->>'student_fee_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'বিল বণ্টন পুনর্মিলন প্রয়োজন।'; END IF;
  IF restoring AND (SELECT coalesce(sum((a1->>'allocated_amount')::numeric),0) FROM jsonb_array_elements(allocations) a1)>(p->>'total_amount_received')::numeric THEN RAISE EXCEPTION 'বণ্টনের অঙ্ক যাচাই করুন।'; END IF;
  IF restoring AND (SELECT coalesce(sum((a1->>'allocated_amount')::numeric),0) FROM jsonb_array_elements(allocations) a1)<(p->>'total_amount_received')::numeric AND
    nullif(p->>'fund_name','') IS DISTINCT FROM (public.finance_posting_fund(p_tenant,p->>'fund_id','deposit','','')->>'name') THEN RAISE EXCEPTION 'অবশিষ্ট টাকার ফান্ড যাচাই করুন।'; END IF;
  IF restoring THEN
    -- An old receipt with no provable active allocation needs review, not a new General posting.
    FOR a IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_array_length(allocations)=0 THEN jsonb_build_array(p) ELSE allocations END) LOOP
      DECLARE f jsonb:=public.finance_posting_fund(p_tenant,coalesce(a->>'fund_id',p->>'fund_id'),'deposit','',''); BEGIN
        IF nullif(a->>'fund_name','') IS DISTINCT FROM f->>'name' THEN RAISE EXCEPTION 'পুরোনো ফি রসিদের ফান্ড যাচাই করুন।'; END IF;
      END;
    END LOOP;
  END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(allocations) WHERE nullif(value->>'student_fee_id','') IS NOT NULL ORDER BY value->>'student_fee_id' LOOP
    IF rel THEN SELECT to_jsonb(sf) INTO STRICT bill FROM public.student_fees sf WHERE sf.madrasa_id=p_tenant AND sf.id=a->>'student_fee_id' AND sf.student_id::text=p->>'student_id' FOR UPDATE;
    ELSE SELECT value,ordinality-1 INTO STRICT bill,bp FROM jsonb_array_elements(meta->'student_fees') WITH ORDINALITY WHERE value->>'id'=a->>'student_fee_id' AND value->>'student_id'=p->>'student_id'; END IF;
    paid:=(bill->>'paid_amount')::numeric+sign*coalesce((a->>'allocated_amount')::numeric,0);
    disc:=coalesce((bill->>'discount_amount')::numeric,0)+sign*coalesce((a->>'discount_applied')::numeric,0);
    payable:=(bill->>'base_amount')::numeric+coalesce((bill->>'fine_amount')::numeric,0)-disc; due:=payable-paid;
    IF paid IS NULL OR payable IS NULL OR least(paid,disc,payable,due)<0 OR due IS DISTINCT FROM (bill->>'due_amount')::numeric-sign*(coalesce((a->>'allocated_amount')::numeric,0)+coalesce((a->>'discount_applied')::numeric,0)) THEN RAISE EXCEPTION 'রসিদ ও বিলের অঙ্ক মিলছে না। ম্যানুয়াল যাচাই করুন।'; END IF;
    bill_status:=CASE WHEN payable=0 AND disc>0 THEN 'WAIVED' WHEN due=0 THEN 'PAID' WHEN paid=0 THEN 'UNPAID' ELSE 'PARTIAL' END;
    IF rel THEN UPDATE public.student_fees SET paid_amount=paid,discount_amount=disc,payable_amount=payable,due_amount=due,status=bill_status,updated_at=now() WHERE madrasa_id=p_tenant AND id=bill->>'id';
    ELSE meta:=jsonb_set(meta,ARRAY['student_fees',bp::text],bill||jsonb_build_object('paid_amount',paid,'discount_amount',disc,'payable_amount',payable,'due_amount',due,'status',bill_status,'updated_at',now())); END IF;
  END LOOP;
  -- Do not touch legacy rows by receipt number (let the read model suppress known mirrors).
  IF nullif(p->>'db_fee_id','') IS NOT NULL THEN
    SELECT * INTO STRICT rec FROM public.fees WHERE madrasa_id=p_tenant AND id::text=p->>'db_fee_id' AND student_id::text=p->>'student_id' AND amount=(p->>'total_amount_received')::numeric FOR UPDATE;
    IF (CASE WHEN restoring THEN rec.status NOT IN ('VOID','REVERSED') ELSE rec.status<>'COMPLETED' END) OR
      (public.finance_fee_ref(rec.notes) IS NOT NULL AND public.finance_fee_ref(rec.notes) IS DISTINCT FROM p->>'receipt_no') OR
      (rel AND EXISTS(SELECT FROM public.fee_payments fp WHERE fp.madrasa_id=p_tenant AND fp.id<>p_id AND fp.db_fee_id=rec.id)) OR
      (NOT rel AND EXISTS(SELECT FROM jsonb_array_elements(meta->'payments') r WHERE r->>'id'<>p_id AND r->>'db_fee_id'=rec.id::text))
      THEN RAISE EXCEPTION 'মূল রসিদ ও অনুলিপির পরিচয় মেলেনি।'; END IF;
    UPDATE public.fees SET status=p_status WHERE id=rec.id;
  ELSIF EXISTS(SELECT FROM public.fees WHERE madrasa_id=p_tenant AND lower(public.finance_fee_ref(notes))=lower(p->>'receipt_no')) THEN
    RAISE EXCEPTION 'অনুলিপির আইডি অনিশ্চিত। রসিদ পুনর্মিলন প্রয়োজন।';
  END IF;
  note:=regexp_replace(coalesce(p->>'notes',''),'\[VOID:[^]]*\]\s*','','gi');
  IF rel THEN UPDATE public.fee_payments SET status=p_status,notes=note,reversal_reason=CASE WHEN NOT restoring THEN p_reason END,
    reversed_at=CASE WHEN NOT restoring THEN now() END,reversed_by=CASE WHEN NOT restoring THEN actor.email END WHERE madrasa_id=p_tenant AND id=p_id;
  ELSE patch:=jsonb_build_object('status',p_status,'notes',note,'cancellation_reason',CASE WHEN NOT restoring THEN p_reason END,'reversal_reason',CASE WHEN NOT restoring THEN p_reason END,
    'voided_at',CASE WHEN NOT restoring THEN now() END,'voided_by',CASE WHEN NOT restoring THEN actor.email END);
    meta:=jsonb_set(meta,ARRAY['payments',pos::text],p||patch); END IF;
  audit:=jsonb_build_object('id',gen_random_uuid(),'madrasa_id',p_tenant,'action',CASE p_status WHEN 'COMPLETED' THEN 'UNVOID_FEE_PAYMENT' WHEN 'VOID' THEN 'VOID_FEE_PAYMENT' ELSE 'REVERSE_FEE_PAYMENT' END,
    'user_role',actor.role,'user_name',actor.email,'record_id',p_id,'details',p_reason,'created_at',now());
  INSERT INTO public.fee_audit_logs(id,madrasa_id,action,user_name,user_role,record_id,details) VALUES(audit->>'id',p_tenant,audit->>'action',actor.email,actor.role,p_id,p_reason);
  IF NOT rel THEN UPDATE public.madrasas SET finance_source_revision=finance_source_revision+1,registration_no=jsonb_set(meta,'{audit_logs}',jsonb_build_array(audit)||coalesce(meta->'audit_logs','[]'))::text WHERE id=p_tenant; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finance_fee_status(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_fee_status(uuid,uuid,text,text,text) TO service_role;

-- Record maintenance and its optional expense together; keep the existing inventory
-- document format. A failed expense cannot leave an apparent paid maintenance record.
CREATE OR REPLACE FUNCTION public.finance_record_maintenance(p_tenant uuid,p_record jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); asset jsonb; cost numeric:=(p_record->>'cost')::numeric; eid uuid;
BEGIN
  SELECT value INTO STRICT asset FROM jsonb_array_elements(meta#>'{inventory,items}') WHERE value->>'id'=p_record->>'asset_id';
  IF cost IS NULL OR NOT(cost BETWEEN 0 AND 99999999.99 AND cost=round(cost,2)) THEN RAISE EXCEPTION 'মেরামত ব্যয় সঠিক নয়।'; END IF;
  IF (p_record->>'auto_add_to_expense')::boolean AND cost>0 THEN
    INSERT INTO public.expenses(madrasa_id,amount,expense_date,category,fund_id,fund_name,voucher_no,description)
      VALUES(p_tenant,cost,(p_record->>'maintenance_date')::date,'Maintenance',p_record->>'fund_id',p_record->>'fund_name',
        nullif(p_record->>'voucher_no',''),format('%s (%s) মেরামত: %s',asset->>'name',asset->>'asset_code',p_record->>'work_done')) RETURNING id INTO eid;
    p_record:=p_record||jsonb_build_object('expense_id',eid);
  END IF;
  UPDATE public.madrasas SET registration_no=jsonb_set(meta,'{inventory,maintenance}',jsonb_build_array(p_record)||coalesce(meta#>'{inventory,maintenance}','[]'))::text WHERE id=p_tenant;
  RETURN p_record;
END $$;
REVOKE ALL ON FUNCTION public.finance_record_maintenance(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_record_maintenance(uuid,jsonb) TO service_role;

-- A salary settlement is ONE transaction. The caller supplies neither an amount, staff
-- identity, date nor fund. The institution row lock serializes retries and payroll updates.
CREATE OR REPLACE FUNCTION public.finance_pay_salary(p_tenant uuid,p_actor uuid,p_record text,p_method text,p_ref text,p_remarks text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); r jsonb; pos bigint; who text; eid uuid;
  salary numeric; today date:=(now() AT TIME ZONE 'Asia/Dhaka')::date; sp bigint; member jsonb;
BEGIN
  SELECT email INTO STRICT who FROM public.users WHERE madrasa_id=p_tenant AND id=p_actor;
  SELECT value,ordinality-1 INTO STRICT r,pos FROM jsonb_array_elements(meta->'staff_salary_records') WITH ORDINALITY WHERE value->>'id'=p_record;
  IF r->>'madrasa_id' IS DISTINCT FROM p_tenant::text THEN RAISE EXCEPTION 'পেরোল প্রতিষ্ঠানের সাথে মিলছে না।'; END IF;
  salary:=(r->>'net_salary')::numeric;
  IF r->>'status'='PAID' THEN
    SELECT id INTO eid FROM public.expenses WHERE madrasa_id=p_tenant AND id::text=r->>'expense_id'
      AND category='Salary' AND amount=salary AND coalesce(status,'')<>'VOID' AND coalesce(description,'') NOT LIKE '%[VOID:%'
      AND (payroll_record_id=p_record OR payroll_record_id IS NULL);
    IF eid IS NULL THEN RAISE EXCEPTION 'পুরোনো পরিশোধিত বেতনের ভাউচার মেলেনি। পুনরায় পরিশোধ নয়, সমন্বয় করুন।'; END IF;
    RETURN jsonb_build_object('expense_id',eid,'already_paid',true);
  END IF;
  IF r->>'status' IS DISTINCT FROM 'PENDING' OR r->>'expense_id' IS NOT NULL OR salary IS NULL OR NOT(salary BETWEEN 0.01 AND 99999999.99 AND salary=round(salary,2))
    OR p_method IS NULL OR p_method NOT IN ('CASH','BANK','BKASH','NAGAD','OTHER') THEN RAISE EXCEPTION 'বেতনের রেকর্ড, অঙ্ক বা মাধ্যম সঠিক নয়।'; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(meta->'staff_salary_records') other WHERE other->>'id'<>p_record AND other->>'staff_id'=r->>'staff_id'
    AND ltrim(other->>'month','0')=ltrim(r->>'month','0') AND other->>'year'=r->>'year' AND other->>'status'='PAID') THEN
    RAISE EXCEPTION 'একই কর্মীর এই মাসের বেতন পরিশোধিত। সমন্বয় করুন।'; END IF;
  -- The old two-call action could leave an expense behind for a still-PENDING salary.
  -- Never manufacture a second payment or auto-link something by name/amount.
  IF EXISTS(SELECT FROM public.expenses WHERE madrasa_id=p_tenant AND payroll_record_id IS NULL AND category='Salary'
    AND coalesce(status,'')<>'VOID' AND description NOT LIKE '%[VOID:%'
    AND btrim(split_part(description,'[FUND:',1))=format('স্টাফ বেতন: %s (%s) - %s/%s',r->>'staff_name',r->>'staff_id_code',r->>'month',r->>'year')) THEN
    RAISE EXCEPTION 'এই বেতনের পুরোনো ভাউচার রয়েছে। পুনরায় পরিশোধ নয়, সমন্বয় করুন।'; END IF;
  IF EXISTS(SELECT FROM public.finance_closed_periods(p_tenant) WHERE today BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
  INSERT INTO public.expenses(madrasa_id,fund_id,category,amount,expense_date,description,payroll_record_id)
    VALUES(p_tenant,'fund-general','Salary',salary,today,format('স্টাফ বেতন: %s (%s) - %s/%s',r->>'staff_name',r->>'staff_id_code',r->>'month',r->>'year'),p_record) RETURNING id INTO eid;
  r:=r||jsonb_build_object('status','PAID','expense_id',eid,'payment_date',today,'payment_method',p_method,'transaction_ref',coalesce(p_ref,''),'remarks',coalesce(p_remarks,''),'processed_by',who);
  meta:=jsonb_set(meta,ARRAY['staff_salary_records',pos::text],r);
  SELECT value,ordinality-1 INTO member,sp FROM jsonb_array_elements(meta->'staff_members') WITH ORDINALITY WHERE value->>'id'=r->>'staff_id';
  IF FOUND THEN
    member:=member||jsonb_build_object('audit_logs',coalesce(member->'audit_logs','[]')||jsonb_build_array(jsonb_build_object(
      'id','payroll_'||eid::text,'action','বেতন পরিশোধ','details',format('%s/%s: ৳%s',r->>'month',r->>'year',salary),'user_email',who,'created_at',now())));
    meta:=jsonb_set(meta,ARRAY['staff_members',sp::text],member);
  END IF;
  UPDATE public.madrasas SET registration_no=meta::text WHERE id=p_tenant;
  RETURN jsonb_build_object('expense_id',eid,'already_paid',false);
END $$;

-- A SQL teacher does not imply an HR profile or a salary. Explicit enrolment
-- allocates an ID code once and starts at zero, preserving all legacy IDs.
CREATE OR REPLACE FUNCTION public.finance_register_teacher(t uuid,actor uuid,profile jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m jsonb:=public.portal_locked_metadata(t); members jsonb:=coalesce(m->'staff_members','[]'); sid text:=profile->>'id'; seq int; code text;
BEGIN
  IF NOT EXISTS(SELECT FROM public.users WHERE id=actor AND madrasa_id=t) OR NOT EXISTS(SELECT FROM public.teachers WHERE madrasa_id=t AND id::text=sid) OR
    profile->>'madrasa_id' IS DISTINCT FROM t::text OR EXISTS(SELECT FROM jsonb_array_elements(members) s WHERE sid IN(s->>'id',s->>'legacy_id')) THEN RAISE EXCEPTION 'Teacher profile changed; refresh'; END IF;
  seq:=greatest(coalesce((m->>'staff_id_serial_counter')::int,0),jsonb_array_length(members));
  LOOP
    seq:=seq+1; code:=coalesce(nullif(m->>'staff_id_prefix',''),'STF')||'-'||to_char(now() AT TIME ZONE 'Asia/Dhaka','YY')||lpad(seq::text,greatest(length(seq::text),4),'0');
    EXIT WHEN NOT EXISTS(SELECT FROM jsonb_array_elements(members) s WHERE s->>'staff_id_code'=code);
  END LOOP;
  profile:=(profile-'directory_only'-'salary_hidden')||jsonb_build_object('staff_id_code',code,'salary',jsonb_build_object('basic_salary',0,'net_salary',0,'allowances','{}'::jsonb,'deductions','{}'::jsonb));
  profile:=jsonb_set(jsonb_set(profile,'{employment,staff_id_code}',to_jsonb(code)),'{id_card,card_number}',to_jsonb('QM-'||code));
  UPDATE public.madrasas SET registration_no=(m||jsonb_build_object('staff_members',members||jsonb_build_array(profile),'staff_id_serial_counter',seq))::text WHERE id=t;
END $$;
-- The generated draft is not cash. Never save a previously read copy of the
-- staff register, pending salaries for other months, or a stale PAID record.
CREATE OR REPLACE FUNCTION public.finance_draft_payroll(t uuid, actor uuid, staff_before jsonb, payroll_before jsonb, additions jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m jsonb:=public.portal_locked_metadata(t); r jsonb;
BEGIN
  IF (coalesce(m->'staff_members','[]')=staff_before AND coalesce(m->'staff_salary_records','[]')=payroll_before AND jsonb_typeof(additions)='array') IS NOT TRUE OR
    NOT EXISTS(SELECT FROM public.users WHERE madrasa_id=t AND id=actor) THEN RAISE EXCEPTION 'পেরোল বা বেতন চুক্তি বদলেছে। রিফ্রেশ করুন।'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(additions) LOOP
    IF (r->>'madrasa_id'=t::text AND r->>'status'='PENDING' AND r->>'month' ~ '^(0[1-9]|1[0-2])$' AND r->>'year' ~ '^[0-9]{4}$' AND (r->>'net_salary')::numeric>0 AND r->>'id'='sal_'||(r->>'staff_id')||'_'||(r->>'year')||'_'||(r->>'month')) IS NOT TRUE OR
      NOT EXISTS(SELECT FROM jsonb_array_elements(staff_before) s WHERE s->>'id'=r->>'staff_id' AND coalesce(s->>'madrasa_id',t::text)=t::text AND (s#>>'{salary,net_salary}')::numeric=(r->>'net_salary')::numeric) OR
      EXISTS(SELECT FROM jsonb_array_elements(payroll_before) p WHERE p->>'id'=r->>'id' OR (p->>'staff_id'=r->>'staff_id' AND p->>'year'=r->>'year' AND ltrim(p->>'month','0')=ltrim(r->>'month','0'))) THEN RAISE EXCEPTION 'Invalid payroll draft'; END IF;
  END LOOP;
  IF EXISTS(SELECT FROM jsonb_array_elements(additions) a(item) GROUP BY item->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate payroll draft'; END IF;
  SELECT coalesce(jsonb_agg(item || jsonb_build_object('finance_drafted',true) ORDER BY n),'[]') INTO additions FROM jsonb_array_elements(additions) WITH ORDINALITY a(item,n);
  UPDATE public.madrasas SET registration_no=jsonb_set(m,'{staff_salary_records}',additions||payroll_before)::text WHERE id=t;
END $$;
REVOKE ALL ON FUNCTION public.finance_register_teacher(uuid,uuid,jsonb),public.finance_draft_payroll(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_register_teacher(uuid,uuid,jsonb),public.finance_draft_payroll(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;

-- Apply one exact contract to one existing employee, and synchronize the teacher
-- mirror in the same transaction. Never replace a staff list from a stale read.
CREATE OR REPLACE FUNCTION public.finance_edit_staff(t uuid,actor uuid,prior jsonb,nxt jsonb,teacher jsonb,log jsonb,request_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m jsonb:=public.portal_locked_metadata(t); ix int; row_before jsonb; req public.approval_requests; sid text:=prior->>'id';
BEGIN
  SELECT a,ordinality-1 INTO STRICT row_before,ix FROM jsonb_array_elements(m->'staff_members') WITH ORDINALITY e(a,ordinality) WHERE a->>'id'=sid;
  IF row_before IS DISTINCT FROM prior OR coalesce(prior->>'madrasa_id',t::text)<>t::text OR nxt->>'madrasa_id' IS DISTINCT FROM t::text OR nxt->>'id' IS DISTINCT FROM sid OR
    NOT EXISTS(SELECT FROM public.users WHERE id=actor AND madrasa_id=t) THEN RAISE EXCEPTION 'কর্মীর তথ্য বদলেছে। রিফ্রেশ করুন।'; END IF;
  IF request_id IS NOT NULL THEN
    SELECT * INTO STRICT req FROM public.approval_requests WHERE id=request_id AND madrasa_id=t FOR UPDATE;
    IF req.status<>'APPROVED' OR req.executed_at IS NOT NULL OR req.final_decision_by IS DISTINCT FROM actor OR req.request_type<>'SALARY_CHANGE' OR req.target_id IS DISTINCT FROM sid OR
      (req.payload->>'action' IN ('update_staff_salary','promote_staff') AND req.payload->'salaryTerms'=nxt->'salary' AND req.amount=greatest((nxt#>>'{salary,basic_salary}')::numeric,(nxt#>>'{salary,net_salary}')::numeric) AND
       req.payload->'priorSalary'=prior->'salary' AND req.payload->>'staffId'=sid) IS NOT TRUE OR req.payload->>'priorUpdate' IS DISTINCT FROM prior->>'updated_at' THEN RAISE EXCEPTION 'অনুমোদিত কর্মী, বেতন বা পূর্বের চুক্তি মেলেনি।'; END IF;
  END IF;
  IF teacher IS NOT NULL THEN
    UPDATE public.teachers SET designation=teacher->>'designation',first_name=coalesce(teacher->>'first_name',first_name),last_name=coalesce(teacher->>'last_name',last_name),
      phone=CASE WHEN teacher?'phone' THEN teacher->>'phone' ELSE phone END,email=CASE WHEN teacher?'email' THEN teacher->>'email' ELSE email END WHERE id::text=sid AND madrasa_id=t;
    IF NOT FOUND THEN RAISE EXCEPTION 'কর্মী ও শিক্ষকের প্রতিষ্ঠান মেলেনি।'; END IF;
  END IF;
  m:=jsonb_set(m,ARRAY['staff_members',ix::text],nxt);
  IF log IS NOT NULL THEN m:=jsonb_set(m,'{staff_audit_logs}',coalesce(m->'staff_audit_logs','[]')||jsonb_build_array(log)); END IF;
  UPDATE public.madrasas SET registration_no=m::text,finance_source_revision=finance_source_revision+1 WHERE id=t;
END $$;
REVOKE ALL ON FUNCTION public.finance_edit_staff(uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_edit_staff(uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid) TO service_role;

-- Old clients save whole metadata documents. Reject a stale save that would remove
-- or revert a linked PAID record instead of quietly breaking the two ledgers later.
CREATE OR REPLACE FUNCTION public.finance_guard_paid_metadata() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE records jsonb:=public.finance_metadata(NEW)->'staff_salary_records'; previous jsonb:=public.finance_metadata(OLD)->'staff_salary_records';
BEGIN
  IF EXISTS(SELECT FROM jsonb_array_elements(public.finance_metadata(OLD)->'staff_members') m WHERE EXISTS(SELECT FROM jsonb_array_elements(previous) p WHERE p->>'staff_id'=m->>'id' AND p->>'status'='PAID') AND NOT EXISTS(SELECT FROM jsonb_array_elements(public.finance_metadata(NEW)->'staff_members') n WHERE n->>'id'=m->>'id')) THEN RAISE EXCEPTION 'পরিশোধিত পেরোলের কর্মী মুছবেন না।'; END IF;
  IF OLD.finance_source_revision=NEW.finance_source_revision AND EXISTS(
    SELECT FROM jsonb_array_elements(public.finance_metadata(OLD)->'staff_members') o JOIN jsonb_array_elements(public.finance_metadata(NEW)->'staff_members') n ON o->>'id'=n->>'id' WHERE o->'salary' IS DISTINCT FROM n->'salary') THEN RAISE EXCEPTION 'বেতনের চুক্তি বদলেছে। কর্মীর ফর্ম ব্যবহার করুন।'; END IF;
  IF records IS NOT DISTINCT FROM previous THEN RETURN NEW; END IF;
  -- A whole-document save must not erase/reprice a generated draft. The only
  -- allowed change is PENDING -> PAID on its original terms; the check below
  -- independently requires that payment's exact matching expense.
  IF EXISTS(SELECT FROM jsonb_array_elements(previous) p WHERE p->>'finance_drafted'='true' AND p->>'status'='PENDING'
    AND NOT EXISTS(SELECT FROM jsonb_array_elements(records) r WHERE r=p OR (r->>'status'='PAID' AND
      (r - ARRAY['status','expense_id','payment_date','payment_method','transaction_ref','remarks','processed_by']) = (p - 'status'))))
    THEN RAISE EXCEPTION 'সংরক্ষিত পেরোল বদলানো যাবে না। খাতাটি মিলিয়ে দেখুন।'; END IF;
  -- Preserve existing legacy PAID rows as-is; a newly paid row must be backed by this tenant's posting.
  IF EXISTS(SELECT FROM jsonb_array_elements(records) r WHERE r->>'status'='PAID'
    AND NOT EXISTS(SELECT FROM jsonb_array_elements(previous) p WHERE p=r)
    AND NOT EXISTS(SELECT FROM public.expenses e WHERE e.madrasa_id=NEW.id AND e.payroll_record_id=r->>'id' AND e.id::text=r->>'expense_id'
      AND e.amount=(r->>'net_salary')::numeric AND e.category='Salary' AND e.status<>'VOID')) THEN
    RAISE EXCEPTION 'পরিশোধিত পেরোলের মূল ভাউচার নেই।'; END IF;
  IF EXISTS(SELECT FROM public.expenses e WHERE e.madrasa_id=NEW.id AND e.payroll_record_id IS NOT NULL AND NOT EXISTS
    (SELECT FROM jsonb_array_elements(records) r WHERE r->>'id'=e.payroll_record_id AND r->>'status'='PAID' AND r->>'expense_id'=e.id::text AND (r->>'net_salary')::numeric=e.amount)) OR
    EXISTS(SELECT FROM jsonb_array_elements(previous) p WHERE p->>'status'='PAID'
      AND NOT EXISTS(SELECT FROM jsonb_array_elements(records) r WHERE r=p)) THEN
    RAISE EXCEPTION 'পরিশোধিত পেরোল বদলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_guard_paid_metadata ON public.madrasas;
CREATE TRIGGER finance_guard_paid_metadata BEFORE UPDATE OF registration_no,metadata ON public.madrasas FOR EACH ROW EXECUTE FUNCTION public.finance_guard_paid_metadata();
CREATE OR REPLACE FUNCTION public.finance_guard_salary_expense() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF (OLD.payroll_record_id IS NOT NULL OR EXISTS(SELECT FROM public.madrasas m,jsonb_array_elements(public.finance_metadata(m)->'staff_salary_records') p WHERE m.id=OLD.madrasa_id AND p->>'status'='PAID' AND p->>'expense_id'=OLD.id::text)) AND (TG_OP='UPDATE' OR EXISTS(SELECT FROM public.madrasas WHERE id=OLD.madrasa_id)) THEN RAISE EXCEPTION 'পেরোলের ভাউচার আলাদাভাবে পরিবর্তন/বাতিল করা যাবে না।'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.payroll_record_id IS NOT NULL THEN RAISE EXCEPTION 'পেরোলের লিঙ্ক পরিবর্তন করা যাবে না।'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_guard_salary_expense ON public.expenses;
CREATE TRIGGER finance_guard_salary_expense BEFORE UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.finance_guard_salary_expense();

-- A direct expense insert may not invent a payroll link. Defer the check until both
-- sides of the RPC have been written; a bogus standalone insert rolls back at commit.
CREATE OR REPLACE FUNCTION public.finance_check_salary_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.category<>'Salary' OR NEW.fund_id<>'fund-general' OR NEW.status='VOID' OR NOT EXISTS(
    SELECT FROM public.madrasas m, jsonb_array_elements(public.finance_metadata(m)->'staff_salary_records') r
    WHERE m.id=NEW.madrasa_id AND r->>'id'=NEW.payroll_record_id AND r->>'expense_id'=NEW.id::text AND r->>'status'='PAID'
    AND r->>'madrasa_id'=m.id::text AND (r->>'net_salary')::numeric=NEW.amount) THEN RAISE EXCEPTION 'পেরোলের মূল রেকর্ড মেলেনি।'; END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS finance_check_salary_link ON public.expenses;
CREATE CONSTRAINT TRIGGER finance_check_salary_link AFTER INSERT ON public.expenses DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW.payroll_record_id IS NOT NULL) EXECUTE FUNCTION public.finance_check_salary_link();
REVOKE ALL ON FUNCTION public.finance_check_salary_link() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.finance_metadata(public.madrasas),public.finance_fund_catalog(uuid),public.finance_is_restricted(jsonb),public.finance_posting_fund(uuid,text,text,text,text),public.finance_pay_salary(uuid,uuid,text,text,text,text),public.finance_guard_posting(),public.finance_guard_paid_metadata(),public.finance_guard_salary_expense() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_metadata(public.madrasas),public.finance_fund_catalog(uuid),public.finance_is_restricted(jsonb),public.finance_posting_fund(uuid,text,text,text,text),public.finance_pay_salary(uuid,uuid,text,text,text,text) TO service_role;
-- Preserve the portal gateway CAS contract; online donation saves use the same
-- source revision as the operator workflows. Other gateway settings are not books.
CREATE OR REPLACE FUNCTION public.replace_portal_gateway_key(p_tenant uuid,p_key text,p_before jsonb,p_after jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant);
BEGIN
  IF p_key='online_donations' THEN
    PERFORM public.finance_replace_sources(p_tenant,jsonb_build_object(p_key,p_before),jsonb_build_object(p_key,p_after));
  ELSIF p_key='payment_gateway_config' AND jsonb_typeof(p_after)='object' AND NULLIF(meta->p_key,'null'::jsonb) IS NOT DISTINCT FROM NULLIF(p_before,'null'::jsonb) THEN
    UPDATE public.madrasas SET registration_no=jsonb_set(meta,ARRAY[p_key],p_after)::text WHERE id=p_tenant;
  ELSE RAISE EXCEPTION 'Gateway records changed; refresh and retry'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.replace_portal_gateway_key(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_portal_gateway_key(uuid,text,jsonb,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.confirm_portal_donation_return(p_tenant uuid,p_expected jsonb,p_ref text)
RETURNS text LANGUAGE plpgsql SET search_path='' AS $$
DECLARE meta jsonb:=public.portal_locked_metadata(p_tenant); d jsonb; pos bigint; receipt text; voucher uuid;
BEGIN
  SELECT value,ordinality-1 INTO STRICT d,pos FROM jsonb_array_elements(meta->'online_donations') WITH ORDINALITY
    WHERE value->>'trx_id'=p_expected->>'trx_id';
  receipt:=d->>'receipt_no';
  IF d->>'madrasa_id' IS DISTINCT FROM p_tenant::text OR d->>'gateway_provider' IS DISTINCT FROM 'SSLCOMMERZ'
    OR coalesce(receipt,'')='' OR coalesce(p_ref,'')=''
    OR (d - ARRAY['status','verified_at','verified_by','gateway_ref','accounting_record_id']) IS DISTINCT FROM
       (p_expected - ARRAY['status','verified_at','verified_by','gateway_ref','accounting_record_id']) THEN RAISE EXCEPTION 'Donation changed'; END IF;
  IF d->>'status'='VERIFIED' AND (d->>'gateway_ref' IS NULL OR d->>'gateway_ref'=p_ref) THEN
    IF NOT EXISTS(SELECT FROM public.donations v WHERE v.madrasa_id=p_tenant AND v.id::text=d->>'accounting_record_id' AND v.receipt_no=receipt AND v.amount=(d->>'amount')::numeric AND v.fund_id=d->>'fund_id' AND v.status='COMPLETED') THEN RAISE EXCEPTION 'Posted donation differs; reconcile original receipt'; END IF;
    RETURN receipt;
  END IF;
  IF d->>'status' IS DISTINCT FROM 'PENDING' OR d IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Donation not pending'; END IF;
  -- A pre-migration pending checkout without an exact ID needs manual reconciliation;
  -- previously VERIFIED returns above stay idempotent and do not create a new receipt.
  IF EXISTS(SELECT FROM public.donations WHERE madrasa_id=p_tenant AND receipt_no=receipt) THEN RAISE EXCEPTION 'Donation receipt already exists; reconcile'; END IF;
  INSERT INTO public.donations(madrasa_id,amount,donation_date,receipt_no,fund_id,fund_name,donation_type,notes)
    VALUES(p_tenant,(d->>'amount')::numeric,(d->>'donation_date')::date,receipt,d->>'fund_id',d->>'fund_category',d->>'fund_category',format('[অনলাইন অনুদান | SSLCommerz] %s',d->>'trx_id')) RETURNING id INTO voucher;
  UPDATE public.madrasas SET finance_source_revision=finance_source_revision+1,registration_no=jsonb_set(meta,ARRAY['online_donations',pos::text],
    d||jsonb_build_object('accounting_record_id',voucher,'status','VERIFIED','gateway_ref',p_ref,'verified_at',now(),'verified_by','SSLCommerz'))::text WHERE id=p_tenant;
  RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.confirm_portal_donation_return(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_portal_donation_return(uuid,jsonb,text) TO service_role;

-- Verify institution, fund and period before opening a new PSP checkout, as well as at posting.
CREATE OR REPLACE FUNCTION public.finance_check_checkout() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb; f jsonb;
BEGIN
  IF EXISTS(SELECT FROM public.finance_closed_periods(NEW.madrasa_id) WHERE (now() AT TIME ZONE 'Asia/Dhaka')::date BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'হিসাবকাল লক করা আছে।'; END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(NEW.allocations) LOOP
    f:=public.finance_posting_fund(NEW.madrasa_id,a->>'fund_id','deposit','','');
    IF a->>'fund_name' IS DISTINCT FROM f->>'name' OR NOT EXISTS(SELECT FROM public.student_fees WHERE madrasa_id=NEW.madrasa_id AND student_id=NEW.student_id AND id=a->>'student_fee_id' AND fund_id=f->>'id' AND fund_name=f->>'name') THEN RAISE EXCEPTION 'Checkout bill fund changed; refresh'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_check_checkout ON public.portal_fee_checkouts;
CREATE TRIGGER finance_check_checkout BEFORE INSERT ON public.portal_fee_checkouts FOR EACH ROW EXECUTE FUNCTION public.finance_check_checkout();
REVOKE ALL ON FUNCTION public.finance_check_checkout() FROM PUBLIC,anon,authenticated;

-- A new portal allocation must keep the fund reserved at checkout; do not
-- silently book an already charged old/unmapped intent to General. Roll out with
-- no outstanding unverified checkouts (see runbook). Reads do not fire this trigger.
CREATE OR REPLACE FUNCTION public.finance_new_allocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fp public.fee_payments; f jsonb; meta jsonb;
BEGIN
  SELECT * INTO STRICT fp FROM public.fee_payments WHERE id=NEW.payment_id;
  f:=public.finance_posting_fund(fp.madrasa_id,NEW.fund_id,'deposit','','');
  IF NEW.fund_name IS DISTINCT FROM f->>'name' OR (NEW.student_fee_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.student_fees b WHERE b.id=NEW.student_fee_id AND b.student_id=fp.student_id AND b.madrasa_id=fp.madrasa_id)) THEN RAISE EXCEPTION 'বরাদ্দের বিল বা ফান্ড মেলেনি।'; END IF;
  IF fp.id LIKE 'online:%' THEN
    SELECT public.finance_metadata(m) INTO meta FROM public.madrasas m WHERE m.id=fp.madrasa_id;
    IF NOT EXISTS(SELECT FROM jsonb_array_elements(meta->'online_transactions') t,jsonb_array_elements(t->'allocations') a
      WHERE fp.id=('online:'||fp.madrasa_id::text||':'||(t->>'transaction_id')) AND a->>'student_fee_id'=NEW.student_fee_id AND a->>'fund_id'=NEW.fund_id AND a->>'fund_name'=NEW.fund_name) OR
      EXISTS(SELECT FROM public.finance_closed_periods(fp.madrasa_id) WHERE fp.payment_date BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'Checkout fund/period changed; reconciliation required'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finance_new_allocation ON public.fee_payment_allocations;
CREATE TRIGGER finance_new_allocation BEFORE INSERT ON public.fee_payment_allocations FOR EACH ROW EXECUTE FUNCTION public.finance_new_allocation();
REVOKE ALL ON FUNCTION public.finance_new_allocation() FROM PUBLIC,authenticated,anon;
-- Same-tenant RLS alone is not authority to rewrite a posted receipt or mark a bill paid.
REVOKE ALL ON public.fees,public.fee_payments,public.fee_payment_allocations,public.student_fees,public.fee_types,public.fee_structures,public.fee_structure_items,public.fee_discount_waivers,public.fee_audit_logs FROM PUBLIC,authenticated,anon;

-- An approval is a decision, not proof that a voucher exists. Only one caller can
-- advance this exact step/financial payload. The executor records its separate
-- outcome and the real voucher ID. Never replay by changing status back to PENDING.
-- Change the policy and all of its steps together. A failed child insert must
-- not disable step-up or remove the prior school's rules. Preserve referenced
-- steps/decisions; archive a used policy instead of rewriting its history.
CREATE OR REPLACE FUNCTION public.finance_write_workflow(t uuid,actor uuid,rid uuid,op text,w jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE old public.approval_workflows; s jsonb; used boolean;
BEGIN
  PERFORM 1 FROM public.madrasas WHERE id=t FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT FROM public.users WHERE id=actor AND madrasa_id=t) THEN RAISE EXCEPTION 'Invalid workflow owner'; END IF;
  SELECT * INTO old FROM public.approval_workflows WHERE id=rid AND madrasa_id=t FOR UPDATE;
  IF (op IN ('edit','archive') AND old.id IS NULL) OR (op='create' AND old.id IS NOT NULL) THEN RAISE EXCEPTION 'Workflow changed; refresh first'; END IF;
  SELECT EXISTS(SELECT FROM public.approval_requests WHERE workflow_id=rid) INTO used;
  IF op='archive' THEN
    IF used THEN UPDATE public.approval_workflows SET is_active=false,updated_at=now() WHERE id=rid AND madrasa_id=t;
    ELSE DELETE FROM public.approval_workflows WHERE id=rid AND madrasa_id=t; END IF;
    RETURN;
  END IF;
  IF used OR (op IN ('create','edit') AND w->>'id'=rid::text AND w->>'madrasa_id'=t::text AND nullif(btrim(w->>'name'),'') IS NOT NULL AND
    jsonb_array_length(w->'steps')>0 AND (w->>'min_amount')::numeric>=0 AND ((w->>'max_amount') IS NULL OR (w->>'max_amount')::numeric>=(w->>'min_amount')::numeric)) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid or already used workflow; archive it and create a new policy'; END IF;
  -- The qualified conflict condition never moves a foreign workflow. A new
  -- ID collision never silently updates a policy, even if it belongs to t.
  INSERT INTO public.approval_workflows AS owned(id,madrasa_id,name,name_bn,request_type,description,min_amount,max_amount,is_active,priority,require_two_person,created_by)
    VALUES(rid,t,w->>'name',w->>'name_bn',w->>'request_type',w->>'description',(w->>'min_amount')::numeric,(w->>'max_amount')::numeric,(w->>'is_active')::boolean,(w->>'priority')::int,(w->>'require_two_person')::boolean,actor)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_bn=excluded.name_bn,request_type=excluded.request_type,description=excluded.description,min_amount=excluded.min_amount,max_amount=excluded.max_amount,is_active=excluded.is_active,priority=excluded.priority,require_two_person=excluded.require_two_person,updated_at=now() WHERE owned.madrasa_id=t AND op='edit';
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow owner changed'; END IF;
  DELETE FROM public.approval_workflow_steps WHERE madrasa_id=t AND workflow_id=rid;
  FOR s IN SELECT value FROM jsonb_array_elements(w->'steps') LOOP
    IF s->>'approver_user_id' IS NOT NULL AND NOT EXISTS(SELECT FROM public.users WHERE id=(s->>'approver_user_id')::uuid AND madrasa_id=t) THEN RAISE EXCEPTION 'Invalid workflow reviewer'; END IF;
    INSERT INTO public.approval_workflow_steps(id,madrasa_id,workflow_id,step_order,step_name,approver_role,required_permission,approver_user_id,sla_hours,allow_delegation,require_step_up)
      VALUES((s->>'id')::uuid,t,rid,(s->>'step_order')::int,s->>'step_name',s->>'approver_role',s->>'required_permission',(s->>'approver_user_id')::uuid,(s->>'sla_hours')::int,(s->>'allow_delegation')::boolean,(s->>'require_step_up')::boolean);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.finance_write_workflow(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_write_workflow(uuid,uuid,uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.finance_decide_request(t uuid,rid uuid,expected jsonb,d jsonb,patch jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.approval_requests; actor uuid:=(d->>'decided_by')::uuid;
BEGIN
  SELECT * INTO STRICT r FROM public.approval_requests WHERE madrasa_id=t AND id=rid FOR UPDATE;
  IF r.status NOT IN ('PENDING','IN_REVIEW') OR r.status IS DISTINCT FROM expected->>'status' OR
     r.current_step_order IS DISTINCT FROM (d->>'step_order')::int OR r.payload IS DISTINCT FROM expected->'payload' OR
     r.amount IS DISTINCT FROM (expected->>'amount')::numeric OR r.target_id IS DISTINCT FROM expected->>'target_id' OR
     r.workflow_id IS DISTINCT FROM (expected->>'workflow_id')::uuid OR r.request_type IS DISTINCT FROM expected->>'request_type' OR
     r.requested_by IS DISTINCT FROM (expected->>'requested_by')::uuid OR coalesce(r.payload->>'action','') NOT IN ('collect_fee_payment','create_expense','update_staff_salary','promote_staff') OR
     NOT EXISTS (SELECT FROM public.users WHERE id=actor AND madrasa_id=t) OR
     NOT EXISTS (SELECT FROM public.approval_workflow_steps WHERE madrasa_id=t AND workflow_id=r.workflow_id AND step_order=r.current_step_order AND id=(d->>'step_id')::uuid) OR
     EXISTS (SELECT FROM public.approval_step_decisions WHERE request_id=rid AND step_order=r.current_step_order) THEN
    RAISE EXCEPTION 'অনুমোদনের ধাপ বা শর্ত বদলেছে। রিফ্রেশ করুন।'; END IF;
  -- Keep workflow and step terms stable from the final permission check through
  -- this decision. Lock the parent first so adding a new FK child must also wait.
  IF d->>'decision'='APPROVED' THEN
    PERFORM 1 FROM public.approval_workflows WHERE id=r.workflow_id AND madrasa_id=t FOR UPDATE;
    PERFORM 1 FROM public.approval_workflow_steps WHERE workflow_id=r.workflow_id ORDER BY step_order FOR SHARE;
    IF NOT EXISTS(SELECT FROM public.approval_workflows w WHERE w.id=r.workflow_id AND w.madrasa_id=t AND w.is_active AND w.request_type=r.request_type AND
      (r.requested_by IS NOT NULL AND r.requested_by<>actor) AND r.payload->'financeWorkflow'=jsonb_build_array(w.id,w.require_two_person,w.is_active,w.min_amount,w.max_amount,
        (SELECT jsonb_agg(jsonb_build_array(s.id,s.step_order,nullif(s.approver_role,''),s.approver_user_id,nullif(s.required_permission,''),s.require_step_up,
          coalesce((to_jsonb(s)->>'is_critical')::boolean,false)) ORDER BY s.step_order) FROM public.approval_workflow_steps s WHERE s.workflow_id=w.id AND s.madrasa_id=t)))
    THEN RAISE EXCEPTION 'আর্থিক আবেদনের অনুমোদন শর্ত মেলেনি।'; END IF;
  END IF;
  INSERT INTO public.approval_step_decisions(id,madrasa_id,request_id,step_id,step_order,step_name,decided_by,decided_by_name,decided_by_role,decision,notes,sla_breached,decided_at)
    VALUES((d->>'id')::uuid,t,rid,(d->>'step_id')::uuid,r.current_step_order,d->>'step_name',actor,d->>'decided_by_name',d->>'decided_by_role',d->>'decision',d->>'notes',(d->>'sla_breached')::boolean,(d->>'decided_at')::timestamptz);
  UPDATE public.approval_requests SET status=patch->>'status',current_step_order=(patch->>'current_step_order')::int,sla_due_at=(patch->>'sla_due_at')::timestamptz,
    final_decision_by=(patch->>'final_decision_by')::uuid,final_decision_by_name=patch->>'final_decision_by_name',final_decision_at=(patch->>'final_decision_at')::timestamptz,final_notes=patch->>'final_notes',updated_at=now() WHERE id=rid AND madrasa_id=t;
END $$;
REVOKE ALL ON FUNCTION public.finance_decide_request(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_decide_request(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
-- Book/approval reads and writes go through an authorized server (restrictive tenant RLS
-- alone does not distinguish an ordinary school employee from a cashier).
REVOKE ALL ON public.expenses,public.bazar_expenses,public.donations,public.zakat_funds,public.donors,
  public.approval_requests,public.approval_workflows,public.approval_workflow_steps,public.approval_step_decisions FROM PUBLIC,authenticated,anon;

-- Even without raw ledger grants, a SELECT * on a legacy institution could
-- disclose all the same books. Preserve already-readable public header columns
-- for authenticated staff *under the existing RLS*, never the aggregate blobs.
DO $$ DECLARE header text; BEGIN
  SELECT string_agg(quote_ident(a.attname),',') INTO header FROM pg_attribute a
    WHERE a.attrelid='public.madrasas'::regclass AND NOT a.attisdropped AND a.attname=ANY(ARRAY['id','name','address','contact_email','contact_phone','logo_url','phone','email','principal_name','signature_url','website','slogan','eiin_code','currency','weekend_days','established_year','reg_no','prefix','short_code'])
      AND has_column_privilege('authenticated',a.attrelid,a.attname,'SELECT');
  REVOKE ALL ON public.madrasas FROM PUBLIC,anon,authenticated;
  IF header IS NOT NULL THEN EXECUTE 'GRANT SELECT ('||header||') ON public.madrasas TO authenticated'; END IF;
END $$;
REVOKE ALL ON public.madrasa_settings,public.accounting_periods,public.system_audit_logs FROM PUBLIC,anon,authenticated;

-- The optional BI migration supplies definer functions/materialized views (no
-- per-tenant RLS on an MV). Only the authorized BI server may query them.
DO $$ DECLARE n text; BEGIN
  FOREACH n IN ARRAY ARRAY['get_executive_bi_snapshot(uuid,integer,text)','refresh_bi_materialized_views()'] LOOP
    IF to_regprocedure('public.'||n) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON FUNCTION public.'||n||' FROM PUBLIC,anon,authenticated';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||n||' TO service_role';
    END IF;
  END LOOP;
  FOREACH n IN ARRAY ARRAY['mv_bi_boarding_monthly','mv_bi_fund_health','mv_bi_class_fee_dues','mv_bi_session_exam_results'] LOOP
    IF to_regclass('public.'||n) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
      EXECUTE format('GRANT SELECT ON public.%I TO service_role',n);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
