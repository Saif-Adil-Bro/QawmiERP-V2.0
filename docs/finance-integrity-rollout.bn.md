# Phase 1: হিসাব চালুর আগে যাচাই

**অবস্থা: স্থানীয় পরীক্ষা; production চালুর অনুমতি নয়।** এই পরিবর্তনে পুরোনো রসিদ পুনরায় পোস্ট, রিসিট নম্বর পরিবর্তন বা গণহারে ফান্ড বদলানোর দরকার নেই। এটি Phase 1-এর ফলাফল। ফান্ড স্থানান্তর, ক্যাশ হস্তান্তর ও দিনশেষে ক্যাশ গোনার জন্য পরবর্তী [Phase 2 নির্দেশিকা](./finance-cashbooks.bn.md) দেখুন। নিচের কাজ DBA ও হিসাব বিভাগ অনুমোদিত **staging clone**-এ করবেন।

| যাচাই | এই শাখায় ফল |
|---|---|
| TypeScript (`npm run lint`), Next production build | সফল |
| Unit / E2E | ২১৪/২১৪ ও ১৪৯/১৪৯ সফল |
| Disposable PostgreSQL 17.11 | ৭টি SQL যাচাই-গুচ্ছ সফল; পরিশোধের দুই ধাপেই ব্যর্থতা, একইসঙ্গে দুইবার পরিশোধ, migration পুনঃপ্রয়োগ ও আলাদা cold restore অন্তর্ভুক্ত |
| HTTP ও Chromium | আগের পূর্ণ Phase 1 পরীক্ষায় ১২টি API/UI যাচাই-গুচ্ছ সফল; এই সংশোধনে ওই browser fixture পুনরায় চালানো হয়নি |
| Hosted staging, PSP statement, Android/প্রিন্টার, হিসাব বিভাগের স্বাক্ষর | যাচাই বাকি — **HOLD** |

**এই সংশোধনের হিসাব মিলাবেন যেভাবে:**

- `/dashboard/zakat/funds`-এর **ম্যানুয়াল সমন্বয় প্রয়োজন** তালিকায় অমিল মাহফিল ভাউচার দেখুন। একই event transaction দুই settlement-এ থাকলে, বা লেনদেনের রসিদ নম্বর মূল ভাউচারের সঙ্গে না মিললে, তা নিশ্চিত স্থিতি নয়। ফান্ড, ব্যয় তালিকা বা খতিয়ান বারবার খুললেও মূল রেকর্ড বদলাবে না।
- রসিদের `fund_id`, নাম এবং পুরোনো `[FUND: …]` / বাজারের `FUND_NAME` ট্যাগ একসঙ্গে মিলতে হবে। দ্বিতীয় ট্যাগ বা পুরোনো চামড়ার খাতার `target_fund` প্রথমটির সঙ্গে না মিললে General ধরে সংশোধন করবেন না। মূল দলিল মিলিয়ে দেখুন; `VOID` করেও ফান্ডের প্রমাণ মুছবেন না।
- `PAID` বেতনের `expense_id` এবং General/Salary ভাউচারের `payroll_record_id` দুই দিকেই মিলতে হবে। কেবল একই অঙ্কের পুরোনো ভাউচার পাওয়া গেলে পুনরায় বেতন দেওয়া বা স্বয়ংক্রিয় লিঙ্ক করা নয়।

## ১. আগে কপি, তারপর migration

1. দুই পৃথক প্রতিষ্ঠানের অনুমোদিত, পরিচয়-মোছা কপি নিন। একটিতে relational `student_fees`/`fee_payments`, অন্যটিতে পুরোনো JSON খাতা রাখুন। ফান্ড, রসিদ, বকেয়া, বাতিল, পুরোনো মাহফিল, বেতন, বন্ধ হিসাবকাল ও অসমাপ্ত approval-এর নমুনা রাখুন। Gateway, SMS, ইমেইল, cron ও webhook যেন production-এ না যায়।
2. পূর্ণ backup **restore করে দেখুন**। app revision, schema, grants/RLS, চলমান checkout, শেষ রসিদ ও ফান্ডভিত্তিক নিয়ন্ত্রণ অঙ্ক আলাদা রাখুন। জমা নেওয়া, approval execution, cron, import/restore ও checkout সাময়িক বন্ধ করুন। পাঠানো PSP লেনদেন হারিয়ে ফেলবেন না।
3. `supabase_schema.sql`-এর প্রয়োজনীয় টেবিল, `supabase_fix_account_model_migration.sql` এবং `supabase_portal_parity_migration.sql` বর্তমান আছে কি না যাচাই করুন। পুরোনো production schema-তে না দেখে base schema পুনরায় চালাবেন না। আগে [portal/fee preflight](./portal-staging-checks.bn.md) চালান।
4. **শুধু staging-এ**, migration runner দিয়ে [`supabase_finance_integrity_migration.sql`](../supabase_finance_integrity_migration.sql) এক transaction-এ প্রয়োগ করুন। নিজস্ব `BEGIN`/`COMMIT` আছে; `ON_ERROR_STOP` বা সমতুল্য fail-on-error দরকার। আগে ও পরে row count, মোট অঙ্ক, পুরোনো voucher ID, receipt no ও status মেলান। কপিতে দ্বিতীয়বার চালিয়েও এগুলো বদলানো চলবে না। App ও migration একসঙ্গে পরীক্ষা করুন; migration-পরবর্তী grants পুরোনো সরাসরি client write/read বন্ধ করে।

### `42703: column "fund_id" of relation "donations" does not exist`

`DROP DEFAULT` কলাম তৈরি করে না। পুরোনো Phase 1 স্ক্রিপ্টে এই ত্রুটি হলে, একই session এখনো failed transaction-এ থাকলে আগে `ROLLBACK;` দিন। Migration চালানোর role দিয়ে **শুধু schema** দেখুন:

```sql
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('donations', 'expenses', 'student_fees', 'fee_payment_allocations')
  AND column_name IN ('fund_id', 'fund_name', 'status', 'void_reason', 'voided_at', 'voucher_no')
ORDER BY table_name, column_name;
```

- `donations` ও `expenses`-এ `fund_id` হওয়ার কথা `text`; দুটিতেই `fund_name`, `status`, `void_reason`, `voided_at` এবং `expenses`-এ `voucher_no` থাকার কথা। ফি-র দুই টেবিলেও `fund_id`, `fund_name` দেখুন। অন্য prerequisite ঠিক থাকলে নতুন Phase 1 স্ক্রিপ্ট কেবল অনুপস্থিত posting `fund_id` যোগ করে, কোনো default ছাড়া। পুরোনো সারির অন্যান্য তথ্য ও আগে থেকে থাকা ID অপরিবর্তিত থাকে। আগে ID ছিল কিন্তু এখন নেই এমন প্রমাণ থাকলে backup মেলান; নতুন খালি কলাম হারানো তথ্য ফেরায় না।
- আরও কলাম না থাকলে শুধু এই দুই `fund_id` যোগ করা সমাধান নয়। খালি staging-এর ক্রম: base → account-model → portal-parity → finance-integrity। পুরোনো বইয়ে না দেখে base বা account-model পুনরায় চালাবেন না: account-model অনুপস্থিত `fund_id`-তে `'fund-general'` default দেয়, `[VOID:…]` রসিদের status বদলায় এবং একই payment/fee type/billing period-এর অতিরিক্ত allocation মুছে দিতে পারে। পরে default সরালে পুরোনো সারির General মান সরবে না। আগে restored copy-তে পার্থক্য ও অঙ্ক মেলান। তারপর ধাপ ৪ অনুযায়ী **পুরো** Phase 1 transaction চালান, ব্যর্থ লাইনের পর থেকে নয়।

### `Missing Phase 1 prerequisite columns: donations.fund_name, …, expenses.voucher_no`

`donations`-এর চারটি ও `expenses`-এর পাঁচটি কলামের এই তালিকা এলে Phase 1 প্রথম যাচাইয়েই থেমেছে, কোনো Phase 1 DDL চালায়নি। কলামগুলি [account-model migration](../supabase_fix_account_model_migration.sql)-এর ধাপ ৩ ও ৪-এর। ত্রুটিতে ফি টেবিলের নাম নেই মানে যাচাই করা ফি কলামগুলি দেখা গেছে; পুরো portal-parity migration বা তার grants ঠিক আছে, এমন প্রমাণ নয়। `RAISE` সরাবেন না।

- **নতুন, সত্যিই খালি database:** base টেবিল আগে থেকেই থাকলে base পুনরায় নয়। সম্পূর্ণ `supabase_fix_account_model_migration.sql` চালান → `supabase_portal_parity_migration.sql` যাচাই/অনুপস্থিত হলে প্রয়োগ করুন → সম্পূর্ণ `supabase_finance_integrity_migration.sql` চালান। SQL editor-এ প্রতিটি ফাইল নিজের `BEGIN` থেকে `COMMIT` পর্যন্ত আলাদা query।
- **আগের কোনো তথ্য আছে বা নিশ্চিত নন:** backup restore করে staging-এ লেখা বন্ধ রাখুন। Migration owner দিয়ে [account-model যাচাইয়ের SELECT](../scripts/sql/finance-account-model-check.sql) চালান। এক সারিতে শুধু schema-র নাম, counts ও booleans আসবে। `rls_may_filter_counts=true`, missing base object বা permission error হলে হিসাব অসম্পূর্ণ। `has_portal_*` কেবল চিহ্ন, সম্পূর্ণ migration history নয়। রসিদ শূন্য দেখালেও JSON খাতা থাকতে পারে।
- **পুরোনো script চালানোর আগে সিদ্ধান্ত:** `allocation_rows_at_risk` ধনাত্মক হলে **থামুন**: পুরোনো script ঐ সংখ্যক allocation মুছে দেবে, যদিও সেগুলি আলাদা বিলের লাইনও হতে পারে। Donation-এর `notes` ও expense-এর `description`-এর VOID tag মূল খাতার সঙ্গে মেলান। অনুপস্থিত `status`-এ `DEFAULT 'COMPLETED'` পুরোনো সারিতেও বসে; পুরোনো script কিছু donation-কে `VOID` করে, expense-এর tag একইভাবে সরায় না। Fund, voucher বা status আগে ছিল কিন্তু হারিয়েছে সন্দেহ হলে backup থেকে যাচাই করুন; খালি কলাম হারানো মান ফেরাবে না। Legacy JSON metadata-র পরিবর্তনও যাচাই করুন। অমিল থাকলে account-model বা Phase 1 চালাবেন না।
- **মিলিয়ে অনুমোদিত staging rehearsal-এ** পুরোনো script যেন অনুপস্থিত ফান্ডের জায়গায় General না বসায়, account-model ফাইলের **কপিতে** তার নিজের `BEGIN;`-এর ঠিক পরে নিচের লাইন দিন। এগুলি একা নয়টি কলামের সমাধান নয়, VOID/ডুপ্লিকেটের অনুমোদনও নয়। আগে থেকেই থাকা কোনো আইডি বা default এগুলি বদলায় না।

```sql
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS fund_id text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS fund_id text;
ALTER TABLE public.fee_payment_allocations ADD COLUMN IF NOT EXISTS fund_id text;
```

অনুমোদিত prerequisite প্রয়োগের পরে একই SELECT আবার চালান; `missing_columns` খালি হওয়া ও portal চিহ্ন দুটির পাশাপাশি schema, indexes, grants ও পুরোনো বইয়ের নিয়ন্ত্রণ অঙ্ক মিলিয়ে তারপর ধাপ ৪ অনুসরণ করুন।

## ২. Read-only preflight

Secret manager থেকে `QAWMI_STAGING_DATABASE_URL` দিন (TLS যাচাইকৃত **PostgreSQL** ঠিকানা, public API key নয়)। `TENANT_A` ও `TENANT_B` ভিন্ন staging UUID। URL, password, provider reference বা শিক্ষার্থী/দাতার তথ্য টিকিট বা লগে দেবেন না।

```sh
npm ci
npm run --silent preflight:fees -- "$TENANT_A" "$TENANT_B"      # portal migration-এর পর
npm run --silent preflight:finance -- "$TENANT_A" "$TENANT_B"   # finance migration-এর পর
```

দুই প্রতিষ্ঠান একই `REPEATABLE READ, READ ONLY` snapshot-এ দেখা হয়; output-এ A/B ও counts থাকে। আলাদা report role-কে দুই SQL ফাইলের উৎস সম্পূর্ণ পড়ার অধিকার এবং `finance_metadata`, `finance_fund_catalog`, `finance_fund_tags`, `finance_is_restricted`, `finance_settlement_refs` **পঠন helper** চালানোর অধিকার লাগবে। RLS দিয়ে কিছু রেকর্ড লুকানো থাকলে ফল অসম্পূর্ণ। Browser role-কে grant বা report role-কে posting RPC দেবেন না।

| ফল | সিদ্ধান্ত |
|---|---|
| `INCOMPLETE` / exit 2 | schema/permission, timeout, invalid JSON/অঙ্ক বা tenant যাচাই করুন। এটি শূন্য ব্যালেন্স নয়। |
| `HOLD` / exit 1 | প্রতিটি blocker ও review-এর জন্য হিসাব বিভাগের মিলপত্র লাগবে। একই voucher number, পুরোনো default General, অচেনা ফান্ড, অনাথ settlement বা PAID salary দেখে অনুমান করে জোড়া লাগাবেন না। |
| `CHECKS_CLEAR` / exit 0 | SQL-এ চিহ্নিত অসঙ্গতি নেই। এটি ব্যাংক মিল, Android পরীক্ষা বা শুরা অনুমোদন নয়। নিচের অঙ্ক ও actor matrix-ও মেলাতে হবে। |

**Grants:** `anon`/`authenticated`-এর raw বই/approval read-write, legacy aggregate columns, optional BI materialized views/definer RPC ও `finance_*` posting RPC খোলা থাকা চলবে না। স্কুলের সাধারণ পরিচয় দেখাতে সম্পূর্ণ `madrasas` row নয়। দরকারি `service_role`/trusted-server table grants, FK ও RPC দিয়ে প্রকৃত app path পরীক্ষা করুন; `service_role` browser/mobile bundle-এ নয়। পরে optional BI migration, restore বা custom grant দিলে finance preflight পুনরায় চালান। পুরোনো permissive view, RPC, column-level grants ও custom integrations আলাদাভাবে পরীক্ষা করুন।

## ৩. হিসাব বিভাগের মিলপত্র (A ও B-তে আলাদা)

- **ফান্ড:** নির্বাচিত সচল ফান্ডের ID ও label দিয়ে post; archived ফান্ড পুরোনো খাতায় থাকবে, নতুন জমায় নয়। ছাত্রের ফি/বোর্ডিং খাতের *নাম* জমার ফান্ডের প্রমাণ নয়। fund evidence নেই, allocation মোট নগদের বেশি, বা ID/label পরস্পরবিরোধী হলে **ফান্ড যাচাই প্রয়োজন** লাইনে রাখুন। শুধু ঐতিহাসিক *untagged বাজারের* Lillah নিয়ম আলাদা। restricted Zakat/Goraba-তে বেতন/সাধারণ overhead/বাল্ক বাজার/Mahfil deficit নয়; অনুমোদিত খাবার ব্যয়ে উপকারভোগীর পরিচয় ও মূল ভাউচার দেখুন।
- **রসিদ ও সংখ্যা:** একই অঙ্ক/তারিখ/নাম/ফোন মানে একই ব্যক্তি বা voucher নয়। Donation box, চাঁদা, চামড়া, walk-in ও online verification-এর source ও central ID পাশাপাশি মেলান। Receipt-সহ ও receipt-বিহীন দাতা, pledged শূন্য, transport cost, cancel/restore এবং একই নম্বরে সমান্তরাল post পরীক্ষা করুন। মাহফিলের টাকা event book-এ; শুধু সঠিক counterpart transaction ও central voucher-সহ settlement মূল ফান্ডে গণনা হবে।
- **ফি ও বিল:** একই শিক্ষাবর্ষ, class, ছাত্রের category/boarding profile ও concession নিয়ে manual এবং cron-এর **পোস্ট করা বিল** তুলুন। boarding-এর প্রকৃত meal-day/cost sync আলাদাভাবে মেলান; fixed tuition-এর সঙ্গে এক করবেন না। পুরোনো term, archived খাত বা ambiguous schedule চুপচাপ নেওয়া যাবে না। আংশিক নগদ, split, ছাড়, fine, advance, noncash waiver, retry, VOID/restore ও closed period-এ দুই খাতা/allocations/audit পরীক্ষা করুন। PSP reservation থাকলে bill মুছে ফেলা যাবে না।
- **টাকার সূত্র:** cash income হবে প্রাপ্ত টাকা (ছাড় নয়); fine/advance আগে থেকেই প্রাপ্ত টাকায় থাকলে আর যোগ হবে না। `opening + posted income − posted expense = closing`। আগের মাসের বিলে এ মাসে জমা হলে আয় **রসিদের মাসে**, বকেয়া **বিলের মেয়াদে**। মাসিক, বার্ষিক, executive, BI, fund ledger, donor history ও দুই কপির receipt-এ একই cut-off ব্যবহার করুন। Review line অন্তর্ভুক্ত করে **আলাদা** দেখান। শুরার ম্যানুয়াল opening থাকলে reconciler তা লিখবেন। Ledger closing ব্যাংক স্টেটমেন্ট বা হাতে গোনা নগদ নয়।
- **Salary/maintenance:** একই salary entry দুবার চাপলে একটি General/Salary voucher ও একই expense ID। অপর পক্ষ ব্যর্থ হলে কোনোটিই নতুন করে booked নয়। পুরোনো PAID যেটির voucher নেই, আবার বেতন দেবেন না। Maintenance expense ও asset records দুদিক মেলান।
- **PSP:** [sandbox statement ও callback checklist](./portal-staging-checks.bn.md) অনুসরণ করুন। Success page/অপারেটরের দাবি দিয়ে paid নয়। Tenant, merchant, transaction, validation ID, gross charge, fee principal ও fee receipt মিলবে। ব্যর্থ/অজানা ফলের intent ও আসল statement সংরক্ষণ করুন। হাতে verified donation ও PSP-settled fee পৃথক প্রক্রিয়া।

## ৪. Approval, session ও device

**PENDING ≠ APPROVED ≠ posted.** দ্বিতীয় ব্যক্তি বর্তমান web session ও প্রয়োজনীয় scoped step-up দিয়ে সিদ্ধান্ত দেবেন; শুধু mobile Bearer বা AI confirmation সিদ্ধান্তের অধিকার নয়। `approval_step_decisions` সিদ্ধান্তের প্রমাণ, `executed_at`/`execution_result` এবং মূল expense/payment ID **posting-এর** প্রমাণ। দুটো আলাদা ধাপে লেখা হয়।

- পুরোনো pending request-এ frozen `financeWorkflow` নেই/শর্ত বদলেছে: অনুমোদন করে চালাবেন না; actor মূল কাগজ মিলিয়ে pending request বাতিল করে নতুন করে দাখিল করবেন। অনুমোদনের পর বিলের due, fund, lock বা voucher number বদলালে execution ব্যর্থ হতে পারে।
- `APPROVED` কিন্তু posting নিশ্চিত নয়: লেখার কাজ স্থগিত করুন। Expense-এ tenant + **request ID**; fee-তে cashier idempotency key/`approval:<request ID>`, receipt, allocation, mirror ও audit মিলিয়ে দেখুন। টাকা ইতিমধ্যে posted হলে আর পোস্ট নয়। **না হওয়ার প্রমাণ পেলে** সংশোধিত voucher/নতুন আবেদন ও দ্বিতীয় স্বাক্ষর; পুরোনো history রাখুন। SQL দিয়ে status reset, number reuse, blanket backfill/restore, বা বারবার callback পাঠানো recovery নয়।
- A-র accountant, approver, read-only staff, teacher/guardian ও B-র accountant দিয়ে web, mobile list/detail/write, search, BI, settings, print এবং অন্য প্রতিষ্ঠানের ID পরীক্ষা করুন। PII masking ও failed read-এ ফাঁকা সফল statement/print না হওয়া দেখুন। ছোট স্ক্রিনে statement/VOID receipt খুলে **শুধু নির্বাচিত** নথি preview/print হয় কি না দেখুন। WebView/প্রিন্টারের ফল স্থানীয় Chromium পরীক্ষার বিকল্প নয়।

**দাতা ও পেরোল:** একই নামের SQL দাতা ও পুরোনো সদস্যের খতিয়ান আলাদা করে খুলুন। রসিদের তারিখ আর চাঁদার মেয়াদ এক নয়; নম্বরহীন পুরোনো রেকর্ডে নতুন রসিদ নম্বর বানানো হয় না। VOID দেখা যাবে, কিন্তু মোট জমায় নয়। `finance.view` দিয়ে বেতনের চুক্তি বা `SALARY_CHANGE` দেখা যাবে না; `staff.salary.view` দিয়ে দেখা আর `staff.salary.manage` দিয়ে পরিবর্তন আলাদা করে পরীক্ষা করুন। শিক্ষক তালিকা খুললে আইডি বদলায় না ও কোনো বেতন তৈরি হয় না। বিদ্যমান SQL শিক্ষকের HR নিবন্ধন একটি স্পষ্ট কাজ, শুরুর বেতন শূন্য। পেরোল ড্রাফট নিজে কোনো ব্যয় নয়।

**পুনরুদ্ধার মহড়া:** স্থানীয় DB বন্ধ করে কপি নিয়ে আলাদা PostgreSQL-এ খুলে খাতা ও grants মেলানো হয়েছে। এটি hosted backup restore নয়। App-এর selective restore-এ শুধু অনুমোদিত module ব্যবহার করুন। বদলের আগে private bucket-এ snapshot লেখা, ফেরত পড়ে checksum মেলা ও snapshot ID সংরক্ষণ আবশ্যক। পরীক্ষায় attendance wipe ও সেই snapshot থেকে replay হয়; অন্য প্রতিষ্ঠানের attendance/হিসাব অপরিবর্তিত থাকে। Import-এর মাঝের টেবিলে ভুল হলে scoped change rollback হবে; snapshot ও export/audit reference থেকে যেতে পারে। `RECOVERY_NOT_CONFIRMED` হলে snapshot ID ও বর্তমান অবস্থা যাচাই করুন, blind retry নয়। Full/financial ও অনিরাপদ parent-table import বা reset বন্ধই রাখুন।

## ৫. Release gate ও rollback

DBA লিখবেন schema/grants, tested backup/restore, A/B preflight-এর তারিখ/ফল। হিসাবরক্ষক লিখবেন একই cut-off-এর opening/in/out/closing, unpaid/discount, exception counts, PSP statement reconciliation ও নাম-তারিখসহ স্বাক্ষর। দ্বিতীয় পর্যালোচক অনুমতি/step-up/দুই tenant isolation ও print মিলিয়ে sign-off দেবেন। কোনো ফল অজানা থাকলে **HOLD**।

Cutover ব্যর্থ হলে cron/checkout/নতুন financial writes বন্ধ রাখুন; receipt history, pending intents, decisions ও provider statements রক্ষা করুন। Production-এ পুরোনো app ফিরিয়ে broad grants/default General পুনঃস্থাপন করবেন না। DBA বিচ্ছিন্ন কপিতে verified snapshot restore করে আগে/পরে posted cash ও ইতিমধ্যে পাঠানো PSP লেনদেন মিলিয়ে Finance-এর স্বাক্ষরসহ roll-forward/restore ঠিক করবেন। SQL migration শুধু মুছে ফেলা বা reapply করা **rollback নয়**।

স্থানীয় regression: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run test:finance:sql`, `npm run test:finance:browser`। শেষ দুটো নিজেদের disposable PostgreSQL চালায় (`QAWMI_PG_BIN`, non-root); browser fixture-এর জন্য `tests/sql/session`-এ `npm ci`, `QAWMI_BROWSER_TOOLS`-এ Puppeteer Core/Chromium ও OS libraries লাগবে। কোনো test-এ hosted credentials দেবেন না।
