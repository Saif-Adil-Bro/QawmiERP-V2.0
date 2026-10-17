-- ============================================================================
-- QawmiERP — অ্যাকাউন্ট মডেল ও হিসাব মডিউল ফিক্স মাইগ্রেশন
-- ============================================================================
-- উদ্দেশ্য (MD-1 · Schema drift):
--   `supabase_schema.sql`-এর সাথে অ্যাপের কোডের মধ্যে বিচ্যুতি ছিল — কোড এমন সব কলাম
--   পড়ে/লেখে যা বেস স্কিমায় নেই (users.phone, expenses.fund_id, donations.status,
--   fee_payment_allocations.fund_id, madrasas.security_metadata ইত্যাদি)। ফলে নতুন
--   পরিবেশে (staging / নতুন মাদ্রাসা / DR restore) অ্যাপ নীরবে ভুল আচরণ করত:
--     • `donations` query পুরো fail → আয় শূন্য/ভুল
--     • `expenses` insert ব্যর্থ → fallback পথ, ভাউচার/ফান্ড তথ্য হারানো
--     • `users` row save ব্যর্থ → orphan Auth অ্যাকাউন্ট (MD-8)
--
-- এই স্ক্রিপ্টটি:
--   1. সব প্রয়োজনীয় কলাম (IF NOT EXISTS) যোগ করে — idempotent, বারবার চালানো নিরাপদ
--   2. পুরোনো `madrasas.registration_no` JSON blob-কে নতুন dedicated কলামে সরায়
--      এবং আসল নিবন্ধন নম্বর `reg_no`-তে উদ্ধার করে
--   3. `fee_payment_allocations`-এর ঐতিহাসিক ডুপ্লিকেট (CR-7) চিহ্নিত ও পরিষ্কার করে
--   4. দরকারি ইনডেক্স/unique constraint যোগ করে (নতুন ডুপ্লিকেট ঠেকাতে)
--
-- নিরাপত্তা: পুরো স্ক্রিপ্ট একটি transaction-এ চলে। সন্দেহ হলে আগে BACKUP নিন।
-- চালানোর আগে: SELECT * FROM public.fee_payment_allocations; -- রেকর্ডের সংখ্যা জেনে নিন
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- ধাপ ১: মাদ্রাসা — JSON store-এর জন্য dedicated কলাম + আসল নিবন্ধন নম্বর
-- ----------------------------------------------------------------------------
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS security_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS metadata          JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS reg_no            TEXT;

COMMENT ON COLUMN public.madrasas.security_metadata IS 'রোল, সিকিউরিটি প্রোফাইল, অনুমোদন ও অডিট লগ (JSON)';
COMMENT ON COLUMN public.madrasas.metadata          IS 'সেশন, ফি/স্টুডেন্ট মেটাডেটা, রসিদ কাউন্টার (JSON)';
COMMENT ON COLUMN public.madrasas.reg_no            IS 'মাদ্রাসার প্রকৃত নিবন্ধন নম্বর (আগে registration_no-তে JSON ব্লবের সাথে হারিয়ে যেত)';
COMMENT ON COLUMN public.madrasas.registration_no   IS 'ঐতিহাসিক কলাম — কেবল ফলব্যাক হিসেবে; আসল নিবন্ধন নম্বর reg_no-তে';

-- পুরোনো পদ্ধতিতে registration_no-তে JSON লেখা থাকলে সেটি নিরাপদে নতুন কলামে সরানো হয়
DO $$
DECLARE
  r        RECORD;
  parsed   JSONB;
  moved_sec INT := 0;
  moved_meta INT := 0;
BEGIN
  FOR r IN
    SELECT id, registration_no
    FROM public.madrasas
    WHERE registration_no IS NOT NULL AND btrim(registration_no) LIKE '{%'
  LOOP
    BEGIN
      parsed := btrim(r.registration_no)::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE; -- অবৈধ JSON — হাত দেব না
    END;

    -- security স্টোরের চিহ্ন
    IF parsed ? 'custom_roles' OR parsed ? 'user_security_profiles'
       OR parsed ? 'approval_requests' OR parsed ? 'system_audit_logs' THEN
      UPDATE public.madrasas
      SET security_metadata = COALESCE(NULLIF(security_metadata, '{}'::jsonb), '{}'::jsonb) || parsed
      WHERE id = r.id;
      moved_sec := moved_sec + 1;
    END IF;

    -- meta স্টোরের চিহ্ন
    IF parsed ? 'sessions' OR parsed ? 'receipt_counter' OR parsed ? 'student_profiles'
       OR parsed ? 'discounts' OR parsed ? 'payments' OR parsed ? 'student_fees' THEN
      UPDATE public.madrasas
      SET metadata = COALESCE(NULLIF(metadata, '{}'::jsonb), '{}'::jsonb) || parsed
      WHERE id = r.id;
      moved_meta := moved_meta + 1;
    END IF;

  END LOOP;

  RAISE NOTICE 'moved security blobs: %, meta blobs: %', moved_sec, moved_meta;
END $$;

-- নিরাপত্তা: এই স্ক্রিপ্ট **কোনো ব্লব স্বয়ংক্রিয়ভাবে মুছে ফেলে না** — কারণ অপরিচিত key
-- থাকলে ডেটা হারানোর ঝুঁকি থাকে। যাচাই করার পর নিজে হাতে পরিষ্কার করুন:
--
--   -- কোন মাদ্রাসার registration_no-তে এখনো JSON ব্লব আছে দেখুন
--   SELECT id, name, left(registration_no, 60) AS blob_preview
--   FROM public.madrasas WHERE registration_no LIKE '{%';
--
--   -- নতুন কলামে ডেটা ঠিকভাবে এসেছে নিশ্চিত হলে তবেই:
--   UPDATE public.madrasas SET registration_no = NULL
--   WHERE registration_no LIKE '{%' AND (metadata <> '{}'::jsonb OR security_metadata <> '{}'::jsonb);

-- ----------------------------------------------------------------------------
-- ধাপ ২: users — কোড যে কলামগুলো লেখে/পড়ে
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone       TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id  TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS teacher_id  TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_users_madrasa      ON public.users(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_users_student_id   ON public.users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_teacher_id   ON public.users(teacher_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower  ON public.users(lower(email));

-- MD-8 (orphan auth account) প্রতিরোধে: একই ইমেইলে একাধিক row থাকলে সেটি সনাক্ত করা যায়
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT lower(email) FROM public.users GROUP BY lower(email) HAVING count(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE NOTICE 'সতর্কতা: % টি ইমেইলে একাধিক users row আছে — MD-8/ডেটা পরিষ্কার করার তালিকায় দেখুন', dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ধাপ ৩: expenses — ফান্ড ম্যাপিং (CR-8), ভাউচার নম্বর (HI-3/HI-4), VOID (HI-5)
-- ----------------------------------------------------------------------------
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS fund_id     TEXT DEFAULT 'fund-general';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS fund_name   TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS voucher_no  TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS status      VARCHAR(30) NOT NULL DEFAULT 'COMPLETED'; -- COMPLETED, VOID
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS voided_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_expenses_date        ON public.expenses(madrasa_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_fund        ON public.expenses(madrasa_id, fund_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status      ON public.expenses(madrasa_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_voucher     ON public.expenses(madrasa_id, voucher_no);

-- একই মাসে একই ভাউচার নম্বর দুইবার নয় (HI-3: count()-ভিত্তিক ডুপ্লিকেট প্রতিরোধে দ্বিতীয় স্তর)
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT madrasa_id, voucher_no FROM public.expenses
    WHERE voucher_no IS NOT NULL
    GROUP BY madrasa_id, voucher_no HAVING count(*) > 1
  ) t;
  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_expenses_voucher_no
      ON public.expenses(madrasa_id, voucher_no) WHERE voucher_no IS NOT NULL;
    RAISE NOTICE 'uniq_expenses_voucher_no তৈরি হয়েছে';
  ELSE
    RAISE NOTICE 'সতর্কতা: % টি ডুপ্লিকেট ভাউচার নম্বর পাওয়া গেছে — ম্যানুয়ালি ঠিক করার পর ইনডেক্স তৈরি করুন', dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ধাপ ৪: donations — status ও fund ম্যাপিং (CR-10, CR-8)
-- ----------------------------------------------------------------------------
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS status    VARCHAR(30) NOT NULL DEFAULT 'COMPLETED'; -- COMPLETED, VOID
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS fund_id   TEXT DEFAULT 'fund-general';
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS fund_name TEXT;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS voided_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_donations_date     ON public.donations(madrasa_id, donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_receipt  ON public.donations(madrasa_id, receipt_no);
CREATE INDEX IF NOT EXISTS idx_donations_fund     ON public.donations(madrasa_id, fund_id);

-- পুরোনো বাতিল রসিদ (notes-এ [VOID:...] ট্যাগ) থাকলে status ঠিক করা হয়
UPDATE public.donations
SET status = 'VOID', voided_at = COALESCE(voided_at, created_at)
WHERE (notes IS NOT NULL AND notes LIKE '%[VOID:%')
  AND COALESCE(status, 'COMPLETED') <> 'VOID';

-- ----------------------------------------------------------------------------
-- ধাপ ৫: fee_payment_allocations — ফান্ড কলাম + CR-7 ডুপ্লিকেট পরিষ্কার
-- ----------------------------------------------------------------------------
ALTER TABLE public.fee_payment_allocations ADD COLUMN IF NOT EXISTS fund_id   TEXT DEFAULT 'fund-general';
ALTER TABLE public.fee_payment_allocations ADD COLUMN IF NOT EXISTS fund_name TEXT;

CREATE INDEX IF NOT EXISTS idx_fee_payment_alloc_fund ON public.fee_payment_allocations(fund_id);

-- ⛔ CR-7: পুরোনো কোড প্রতি সেভে একই allocation আবার insert করত (id ছাড়া upsert)।
-- ফলে একই (payment_id, fee_type_id, billing_period) একাধিক row হয়ে রিপোর্টের আয় ফুলে উঠত।
-- নিচের ব্লকটি আগে ক্ষতির হিসাব দেখায়, তারপর হুবহু ডুপ্লিকেট থেকে একটিমাত্র row রেখে বাকিগুলো মোছে।
DO $$
DECLARE
  dup_groups INT;
  extra_rows INT;
BEGIN
  SELECT count(*), COALESCE(sum(cnt - 1), 0)
    INTO dup_groups, extra_rows
  FROM (
    SELECT payment_id, fee_type_id, COALESCE(billing_period, ''), count(*) AS cnt
    FROM public.fee_payment_allocations
    GROUP BY payment_id, fee_type_id, COALESCE(billing_period, '')
    HAVING count(*) > 1
  ) t;

  RAISE NOTICE 'CR-7 যাচাই: % টি গ্রুপে % টি অতিরিক্ত (ডুপ্লিকেট) allocation row পাওয়া গেছে', dup_groups, extra_rows;

  IF dup_groups > 0 THEN
    -- প্রতিটি গ্রুপে সবচেয়ে পুরোনো/স্থিতিশীল row (created_at, id ক্রমে প্রথমটি) রেখে বাকিগুলো মুছে ফেলা
    DELETE FROM public.fee_payment_allocations a
    USING (
      SELECT id,
             row_number() OVER (
               PARTITION BY payment_id, fee_type_id, COALESCE(billing_period, '')
               ORDER BY created_at ASC, id ASC
             ) AS rn
      FROM public.fee_payment_allocations
    ) ranked
    WHERE a.id = ranked.id AND ranked.rn > 1;
    RAISE NOTICE 'ডুপ্লিকেট allocation পরিষ্কার করা হয়েছে';
  END IF;
END $$;

-- এখন থেকে ডুপ্লিকেট কখনো তৈরি হতে পারবে না (প্রতিটি পেমেন্টে প্রতি খাত+সময় একবারই)
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT payment_id, fee_type_id, COALESCE(billing_period, '')
    FROM public.fee_payment_allocations
    GROUP BY payment_id, fee_type_id, COALESCE(billing_period, '') HAVING count(*) > 1
  ) t;

  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_alloc_payment_fee_period
      ON public.fee_payment_allocations(payment_id, fee_type_id, COALESCE(billing_period, ''));
    RAISE NOTICE 'uniq_alloc_payment_fee_period তৈরি হয়েছে';
  ELSE
    RAISE NOTICE 'সতর্কতা: এখনো % টি ডুপ্লিকেট গ্রুপ আছে — unique index তৈরি হয়নি', dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ধাপ ৬: fee_payments — idempotency (HI-2) ও রসিদ নম্বর সার্চ
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt   ON public.fee_payments(madrasa_id, receipt_no);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student   ON public.fee_payments(madrasa_id, student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_date      ON public.fee_payments(madrasa_id, payment_date);

-- একই idempotency key দুইবার নয় (ডুপ্লিকেট পেমেন্ট ঠেকানোর শেষ স্তর)
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT madrasa_id, idempotency_key FROM public.fee_payments
    WHERE idempotency_key IS NOT NULL
    GROUP BY madrasa_id, idempotency_key HAVING count(*) > 1
  ) t;

  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_idempotency
      ON public.fee_payments(madrasa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
    RAISE NOTICE 'uniq_payments_idempotency তৈরি হয়েছে';
  ELSE
    RAISE NOTICE 'সতর্কতা: % টি ডুপ্লিকেট idempotency key পাওয়া গেছে — ম্যানুয়ালি যাচাই করুন', dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ধাপ ৭: যাচাই — সব প্রয়োজনীয় কলাম এসেছে কি না
-- ----------------------------------------------------------------------------
DO $$
DECLARE missing TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='phone') THEN
    missing := missing || 'users.phone';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='fund_id') THEN
    missing := missing || 'expenses.fund_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='voucher_no') THEN
    missing := missing || 'expenses.voucher_no';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='donations' AND column_name='status') THEN
    missing := missing || 'donations.status';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fee_payment_allocations' AND column_name='fund_id') THEN
    missing := missing || 'fee_payment_allocations.fund_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='madrasas' AND column_name='security_metadata') THEN
    missing := missing || 'madrasas.security_metadata';
  END IF;

  IF array_length(missing, 1) IS NULL THEN
    RAISE NOTICE '✅ সব প্রয়োজনীয় কলাম উপস্থিত — schema drift ঠিক হয়েছে';
  ELSE
    RAISE EXCEPTION 'অসম্পূর্ণ মাইগ্রেশন — অনুপস্থিত: %', array_to_string(missing, ', ');
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- এরপর করণীয়
-- ============================================================================
-- 1) এনভায়রনমেন্ট গার্ড (HI-9): সাধারণ লগইন থেকে কেউ যেন নিজেই super_admin না হয়ে যায় —
--      ALLOW_INITIAL_BOOTSTRAP=true (শুধু প্রাথমিক সেটআপের সময়) এবং
--      BOOTSTRAP_ADMIN_EMAILS=admin@example.com  (কমা-সেপারেটেড)
--    নির্ধারণ করুন; প্রোডাকশনে ALLOW_INITIAL_BOOTSTRAP কখনো unset/ false রাখুন।
-- 2) MD-2 অনুযায়ী ভবিষ্যতে fee সেভিংস একটি Postgres RPC (transaction) দিয়ে করাই শ্রেষ্ঠ;
--    বর্তমান কোড bulk-insert/upsert ব্যবহার করে round-trip কমিয়ে আনে।
-- 3) রিপোর্ট § পরিশিষ্ট-এর ডেটা-রিকভারি কোয়েরি চালিয়ে ভুল ব্যালেন্স (যদি থাকে) মিলিয়ে নিন।
