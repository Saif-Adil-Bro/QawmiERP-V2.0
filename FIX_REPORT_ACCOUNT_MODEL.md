# ✅ ফিক্স রিপোর্ট — অ্যাকাউন্ট মডেল ও হিসাব মডিউল (QawmiERP V2.0)

**রিপোর্টের তারিখ:** ২০২৬-১০-১৭
**ভিত্তি:** `BUG_REPORT_ACCOUNT_MODEL.md`-এর ৩৭টি ফলাফল (১০ Critical · ১৪ High · ৯ Medium · ৪ Low)
**স্ট্যাটাস:** ৩৭/৩৭ ফিক্স প্রয়োগ করা হয়েছে ✅
**যাচাই:** `npx tsc --noEmit` → **০ error** (incremental cache মুছে সম্পূর্ণ ফ্রেশ রান), `node_modules` ইনস্টল করা অবস্থায়

> ⚠️ কোনো টেস্ট রানার/টেস্ট স্যুট এই প্রজেক্টে নেই, তাই যাচাই হয়েছে টাইপ-চেক, কোড-রিভিউ ও যুক্তি-বিশ্লেষণে। প্রোডাকশনে ডিপ্লয়ের আগে অবশ্যই মাইগ্রেশন + স্টেজিং ডেটা দিয়ে হাতে-কলমে যাচাই করুন (নিচে §৪ দেখুন)।

---

## ১. সামগ্রিক পরিবর্তনের পরিসংখ্যান

| সূচক | মান |
|---|---|
| পরিবর্তিত ফাইল | **৫২** |
| নতুন ফাইল/মডিউল | **৭** (নিচে §৩) |
| Server Action-এ যুক্ত authorization guard | **২১৪ টি (৩৯টি ফাইলে)** |
| নির্দিষ্ট মডিউল-নীতিসহ `requirePermission` কল | **২৬** |
| ফিক্স-সংক্রান্ত কোড-মন্তব্য ট্যাগ | CR/HI/MD/L — সব ৩৭টি ট্যাগ কোডে ট্রেসেবল |

### নতুন মডিউল ও ডেলিভারেবল

| ফাইল | কাজ |
|---|---|
| `lib/permissions-server.ts` | সার্ভার-সাইড পারমিশন ইঞ্জিন (`loadServerPermissions`, `assertActiveAccount`, `requirePermission`) — ক্লায়েন্ট ইঞ্জিনের সাথে একই `calculateEffectivePermissions` ব্যবহার |
| `lib/action-authorization.ts` | CR-2-এর কেন্দ্রীয় choke point — `writeGuard("<module>")`, ৩০টি মডিউল-নীতি (finance/users/roles কঠোর, বাকিগুলো স্টাফ-ভিত্তিক, পোর্টাল রোল blocked) |
| `lib/madrasa-store.ts` | HI-6 — JSON store এখন `madrasas.security_metadata` / `madrasas.metadata`-এ; পুরোনো `registration_no` ফলব্যাক আসল নিবন্ধন নম্বর `reg_no`-তে রক্ষা করে |
| `supabase_fix_account_model_migration.sql` | MD-1 — সব ড্রিফটেড কলাম, ডুপ্লিকেট পরিষ্কার, unique index, ডেটা-রেসকিউ ব্লক |
| `scripts/apply-cr2-action-guards.py` | CR-2 guard-প্রয়োগের স্ক্রিপ্ট (নতুন action যোগ হলে আবার চালানো যাবে) |
| `.gitignore` | `node_modules/`, `.next/`, `*.tsbuildinfo`, `.env*` ইত্যাদি |
| `FIX_REPORT_ACCOUNT_MODEL.md` | এই ফাইল |

---

## ২. ৩৭টি ফলাফলের এক-এক করে ফিক্স

### 🔴 Part ১ — ইউজার অ্যাকাউন্ট মডেল (CR-1 … CR-10)

| # | সমস্যা | কী পরিবর্তন হলো |
|---|---|---|
| **CR-1** | শিক্ষার্থীর ডিফল্ট পাসওয়ার্ড `123456` দিয়ে **Pre-auth Account Takeover** — شناسার সাপেক্ষে সার্ভার নিজেই পাসওয়ার্ড `123456` সেট করে লগইন করাত | `app/actions/auth.ts` থেকে ওই সম্পূর্ণ ব্লক (ফোর্স-রিসেট + সাইন-ইন + রিট্রাই লুপ) মুছে ফেলা হয়েছে। এখন শিক্ষার্থী আইডি/গার্ডিয়ান লগইন কেবল সঠিক পাসওয়ার্ডেই হয়; ডিফল্ট পাসওয়ার্ড আর সার্ভার থেকে সেট হয় না। |
| **CR-2** | **সব** Server Action-এ authorization ছিল না (কেবল `if (!user)`) → যেকোনো লগইন-করা অ্যাকাউন্ট (এমনকি অভিভাবক টোকেন) ডেটা লেখা/মোছা চালাতে পারত | `lib/action-authorization.ts`-এ কেন্দ্রীয় `writeGuard(module)`; **২১৪টি write action**-এ ৩৯টি ফাইলে স্বয়ংক্রিয়ভাবে যুক্ত। গার্ড যাচাই করে: (১) লগইন, (২) অ্যাকাউন্ট স্ট্যাটাস ACTIVE, (৩) নিজের মাদ্রাসা (tenant), (৪) মডিউল-পারমিশন/রোল; **student/parent পোর্টাল রোল ড্যাশবোর্ড write path থেকে সরাসরি ব্লক**। লগ-ইন/লগাউট, পাবলিক ডোনেশন, পাবলিক অ্যাডমিশন/ভেরিফিকেশন ও পোর্টাল-মুখী action-গুলো স্পষ্টভাবে ইচ্ছাকৃত ব্যতিক্রম (স্ক্রিপ্টে EXCLUDE তালিকা + কারণ মন্তব্য)। পাবলিক বাদে বাকি action-এ আলাদাভাবে `requirePermission` (২৬টি) — ফি, ইউজার, রোল, ব্যাকআপ ইত্যাদিতে কঠোর নীতি। |
| **CR-3** | Cross-tenant ডেটা লিক + "Strategy E" ফলব্যাক অজানা ইমেইলকে নিজের মাদ্রাসার মালিকানা দিত | `lib/data-access-guards.ts`: students কুয়েরি এখন `.eq("madrasa_id", madrasaId)`; Strategy E সম্পূর্ণ বাদ (সতর্কবার্তা + অ্যাক্সেস নেই); Level C/D, meta-profile ও বাবা/মা ম্যাচিং এখন **exact match** — fuzzy/নাম-অংশ মিল বন্ধ। |
| **CR-4** | `SUSPENDED`/`DISABLED` শুধু ক্লায়েন্টে এনফোর্স হতো → সাসপেন্ডেড ইউজার সরাসরি API/action চালাতে পারত | `app/actions/auth.ts`: লগইনের পরপর সার্ভারে স্ট্যাটাস যাচাই; সাসপেন্ডেড/নিষ্ক্রিয় হলে `signOut()` + বাংলা ত্রুটি। `requirePermission`/`writeGuard` প্রতিটি write action-এও স্ট্যাটাস যাচাই করে (`assertActiveAccount`) — অর্থাৎ টোকেন পুরোনো হলেও ক্ষতি নেই। |
| **CR-5** | `createAdminClient` চুপচাপ anon key-তে নেমে যেত → admin write নীরবে ব্যর্থ/ভিন্ন আচরণ | `lib/supabase/admin.ts`: anon ফলব্যাক সম্পূর্ণ বাদ; `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY` না থাকলে স্পষ্টভাবে throw (fail-closed)। |
| **CR-6** | `PermissionGuard` শুধু DOM লুকাত, ডেটা আগেই সার্ভারে ফেচ হয়ে যেত | `app/dashboard/users/page.tsx` সম্পূর্ণ নতুন করে লেখা: `loadServerPermissions` দিয়ে সার্ভারেই `user.view` যাচাই, **এরপর** ডেটা ফেচ; বিনা অনুমতিতে কোনো ইউজার/রোল ডেটা সার্ভার ছাড়ে না। |
| **CR-7** | `fee_payment_allocations`-এ প্রতি সেভে ডুপ্লিকেট row → রিপোর্টে আয় ফুলে ওঠে | `saveFeeMetadata` পুনর্লিখিত: allocations এখন **delete-then-insert replace semantics**, পেমেন্ট/ফি/allocations সবই `onConflict: "id"` বাল্ক upsert, `payment_id` চাঙ্কড ডিলিট (২০০), আর ডিলিট ব্যর্থ হলে insert থামিয়ে error (নীরব ডুপ্লিকেট নয়)। সাথে মাইগ্রেশনে ঐতিহাসিক ডুপ্লিকেট পরিষ্কার + `uniq_alloc_payment_fee_period` unique index। |
| **CR-8** | ফি থেকে আয়ের **ফান্ড ম্যাপিং** কখনো সেভ হতো না | `fee-management.ts`-এ read/write দুই দিকেই `fund_id`/`fund_name` (allocations + payment + student fee); স্কিমায় কলাম না থাকলে স্ট্রিপ-রিট্রাই, কিন্তু নতুন মাইগ্রেশনে কলাম যোগ হয়। ফান্ড ব্যালেন্স এখন প্রকৃত ম্যাপিং থেকেই হিসাব হয়। |
| **CR-9** | `collectFeePayment` ক্লায়েন্টের পাঠানো অঙ্ক/allocation অন্ধভাবে বিশ্বাস করত | সার্ভার-সাইড ভ্যালিডেশন: মোট > ০, allocations-এর যোগফল মোটের সাথে মেলানো, `fee.discount`/`fee.waiver`/`fee.approve` পারমিশন যাচাই + গ্রেড; অনুমতি ছাড়া ডিসকাউন্ট দিলে স্পষ্ট ত্রুটি। |
| **CR-10** | `donations` কুয়েরি নেই এমন কলাম (`status`) সিলেক্ট করত এবং দরকারি `receipt_no` বাদ দিত → আয় হারানো/দুইবার গোনা | `accounting.ts`: কুয়েরি ঠিক করা (`receipt_no` সহ, `status` বাদ); কুয়েরি ব্যর্থ হলে আর নীরব শূন্য আয় নয় — স্পষ্ট বাংলা ত্রুটি। `zakat.ts`-এর অনুরূপ কুয়েরিও স্থিতিশীল করা। বাতিল-নির্ণয় এখন `lib/fund-utils.ts`-এর `isVoidDonation()`/`isVoidedExpense()` — **notes-এর `[VOID:` ট্যাগ** ভিত্তিক (status কলাম না থাকলেও নির্ভরযোগ্য), আর সব রিপোর্ট/ফান্ড-হিসাবে একই নিয়ম। |

### 🔴 Part 2 — হিসাব মডিউল (HI-1 … HI-14)

| # | সমস্যা | কী পরিবর্তন হলো |
|---|---|---|
| **HI-1** | রসিদ void/reverse করলে ডিসকাউন্ট ফেরত আসত না → বকেয়া কম দেখাত | `voidFeePayment` ও `reverseFeePayment` — দুই পথেই এখন discount reversal হিসেবে ফি-র `discount_amount`/`payable_amount`/`due_amount` পুনঃগণনা; অডিট লগে কারণ+ডিসকাউন্ট উল্লেখ। |
| **HI-2** | ১৫ সেকেন্ডের "ডুপ্লিকেট গার্ড" বৈধ দ্বিতীয় পেমেন্ট গিলে ফেলত | দুই ১৫-সেকেন্ডের উইন্ডো সম্পূর্ণ বাদ; এখন **idempotency key**-ভিত্তিক ডেডুপে (DB কলাম + meta, দুই স্তর)। ক্লায়েন্ট (`CollectPaymentClient`) প্রতিটি সাবমিট-চেষ্টার জন্য `crypto.randomUUID()` key পাঠায়, সফল হলে রিফ্রেশ করে — অর্থাৎ ডাবল-ক্লিক/রিট্রাই ডুপ্লিকেট নয়, কিন্তু সত্যিকারের দ্বিতীয় পেমেন্ট আর ব্লক হয় না। মাইগ্রেশনে `uniq_payments_idempotency` partial unique index। |
| **HI-3** | ভাউচার নম্বর `count()` দিয়ে → ডিলিট করলেই ডুপ্লিকেট, সমান্তরাল এন্ট্রিতে সংঘর্ষ | `getNextExpenseVoucherNo` ও নতুন `resolveNextVoucherNo` এখন `.order("voucher_no", desc)` থেকে **প্রকৃত MAX+1**; UI-হিসাবে ভাউচার আগে থেকেই বরাদ্দ হয় যদিও চূড়ান্ত নম্বর DB থেকে আসে; মাইগ্রেশনে `uniq_expenses_voucher_no` (ডুপ্লিকেট না থাকলে)। |
| **HI-4** | খরচ তৈরি/আপডেটে "try → fail → fallback" → প্রথম insert ব্যর্থ হয়ে দ্বিতীয় insert ডুপ্লিকেট খরচ বানাতে পারত | এক কুয়েরি-নীতি: কলাম-সংক্রান্ত ত্রুটি (`column/does not exist`) হলেই কেবল স্কিমা-ফলব্যাক, নেটওয়ার্ক/টাইমআউটে আর দ্বিতীয় bar insert নয়; ব্যর্থ হলে স্পষ্ট error। মান যাচাই (amount > 0, আবশ্যক ফিল্ড)। |
| **HI-5** | `deleteExpense` হার্ড ডিলিট — অডিট ট্রেইল শূন্য | **Soft-VOID**: `status='VOID'` + `void_reason`, `voided_at` এবং description-এ `[VOID: কারণ | BY: user | AT: সময়]` ট্যাগ; স্কিমা-পুরোনো হলে ট্যাগ-ভিত্তিক VOID। সব খরচ-রিপোর্ট (`getExpenses`, `getAccountingReport`, fund balances, `syncFeesWithFunds` অডিট) এখন `isVoidedExpense()` দিয়ে বাতিল বাদ দেয়। |
| **HI-6** | ইউজার স্ট্যাটাস ও সেশন ব্লব `madrasas.registration_no`-তে — আসল নিবন্ধন নম্বর হারাত | `lib/madrasa-store.ts`: `security_metadata` (roles/profiles/approvals/audit) ও `metadata` (sessions/fee meta/receipt counter) ডেডিকেটেড কলাম; লিগ্যাসি ফলব্যাকে আসল নম্বর `reg_no`-তে উদ্ধার; `permissions.ts` + `users.ts` + `auth.ts` + `fee-management.ts` সব এই store ব্যবহার করে। `registerMadrasa`-ও আর ব্লব লিখে না (নতুন কলাম, ফলব্যাকসহ)। মাইগ্রেশনে ব্লব → কলাম ডেটা-রেসকিউ (নন-ডেস্ট্রাক্টিভ)। |
| **HI-7** | Middleware টোকেনের ক্ষণস্থায়ী role ট্রাস্ট করত + ক্লায়েন্ট-নিয়ন্ত্রিত `RSC: 1` হেডারে সব auth চেক বাইপাস | (ক) রোল এখন **ডেটাবেজ `public.users.role`** থেকে (metadata কেবল DB পড়তে না পারলে, এবং কেবল রাউটিং-এর জন্য — অনুমতির জন্য নয়)। (খ) `isSoftNavigation` বাইপাস **সম্পূর্ণ বাদ**; তার বদলে soft-nav-এ `supabase.auth.getClaims()` — লোকাল JWT যাচাই (নেটওয়ার্ক ছাড়াই), অর্থাৎ পারফরম্যান্স বজায় রেখে দরজা বন্ধ। |
| **HI-8** | সাধারণ অ্যাডমিন `madrasa_id IS NULL` ইউজারদের নিজের মাদ্রাসায় "দখল" করে নিত | `app/actions/users.ts`: `.or(...is.null)` সরানো, এখন `.eq("madrasa_id", madrasaId)`; স্বয়ংক্রিয় দখল/auto-claim লুপ সম্পূর্ণ বাদ — মালিকানা-হীন ইউজার আলাদা করে দেখানো/অ্যাসাইন করার বিষয়। |
| **HI-9** | প্রথম লগইনকারী স্বয়ংক্রিয়ভাবে `super_admin` হয়ে যেত (bootstrap race, TOCTOU) | `students.ts`-এ bootstrap এখন কঠোরভাবে গেটেড: `ALLOW_INITIAL_BOOTSTRAP=true` **এবং** ইমেইল `BOOTSTRAP_ADMIN_EMAILS` তালিকায় থাকলেই মাদ্রাসা+super_admin তৈরি; নাহলে সতর্কবার্তা + fail-closed। রেস-নিরাপত্তার জন্য insert-এর আগে পুনরায় count, পরে deterministic "winner" (সবচেয়ে পুরোনো মাদ্রাসা) নির্বাচন এবং হেরে গেলে নিজের তৈরি খালি মাদ্রাসা সরিয়ে ফেলা। |
| **HI-10** | `resetUserPassword`-এ মাদ্রাসা স্কোপ ছিল না → ক্ষতিকর ইউজার নিজেই অ্যাডমিন হতে পারত | স্কোপ + `user.reset` পারমিশন গার্ড, নিজের পাসওয়ার্ড নিজে রিসেট নিষিদ্ধ, `super_admin`-সুরক্ষা; একই প্রতিরক্ষা `deleteUserAccount`-এও (KI: কেউ নিজেকে/সুপার অ্যাডমিনকে মুছতে পারবে না)। |
| **HI-11** | রসিদ নম্বরে রেস → `fees` টেবিলে orphan row, যা পরে "আয়" হিসেবে গোনা হতো | ক্রম উল্টানো: **আগে** authoritative `fee_payments` + allocations + `student_fees` সেভ, সফল হলেই best-effort legacy `fees` row (ব্যর্থ হলেও ব্যালেন্স ভুল হয় না); সাথে idempotency key দিয়ে ট্রানজ্যাকশন-সদৃশ সুরক্ষা। |
| **HI-12** | `advance_amount` সবসময় `0` → অগ্রিম জমার রিপোর্ট অসম্পূর্ণ | `collectFeePayment`/`reverseFeePayment`-এ `advance_amount` এখন অগ্রিম অংশ থেকে প্রকৃত হিসাবে (allocations/remainder ভিত্তিক) সেভ হয়। |
| **HI-13** | `saveFeeMetadata`-এ `slice(0, 500)` → ৫০১তম পুরোনো invoice কখনো sync হতো না | সব `slice` ছাঁটাই **সম্পূর্ণ বাদ**; student_fees/payments চাঙ্কড (৫০০) বাল্ক upsert-এ সব হালনাগাদ; allocations আলাদা বাল্ক রিপ্লেস। অর্থাৎ শিক্ষার্থী-সংখ্যা যতই হোক, সব রেকর্ডই DB-তে sync থাকে। |
| **HI-14** | `generateMonthlyFees` madrasa না পেলে ডেটাবেজের **প্রথম** মাদ্রাসার জন্য ফি বানাত → cross-tenant ডেটা করাপশন | চারটি "first madrasa" ফলব্যাক সম্পূর্ণ বাদ; মাদ্রাসা রেজলভ না হলে স্পষ্ট ত্রুটি (`মাদ্রাসা আইডি পাওয়া যায়নি`) — অন্য কোনো টেন্যান্টের ডেটা ছোঁয়া হয় না। |

### 🟡 Medium (MD-1 … MD-9)

| # | সমস্যা | কী পরিবর্তন হলো |
|---|---|---|
| **MD-1** | স্কিমা ও কোডের বিচ্যুতি (সব ড্রিফটেড কলাম হাতে-বানানো স্ক্রিপ্টে) | `supabase_fix_account_model_migration.sql`: users.phone/student_id/teacher_id/updated_at, expenses.fund_id/fund_name/voucher_no/status/void_*, donations.status/fund_id/fund_name/void_*, fee_payment_allocations.fund_id/fund_name, madrasas.security_metadata/metadata/reg_no — সব `ADD COLUMN IF NOT EXISTS`; একটাই transaction, idempotent, শেষে self-verification ব্লক (অনুপস্থিত কলাম থাকলে RAISE EXCEPTION)। |
| **MD-2** | `saveFeeMetadata`-এ লুপে await → শত শত round-trip, transaction নেই | চাঙ্কড বাল্ক upsert/insert (আলাদা HTTP কল অনেক কমে), allocations এক ডিলিট + চাঙ্কড insert; ডিলিট চাঙ্কড (২০০) ও ব্যর্থ হলে থামানো — অর্ধ-লেখা অবস্থা এড়ানো। (পূর্ণ ACID-এর জন্য ভবিষ্যতে RPC — মাইগ্রেশন-নোটে নির্দেশना।) |
| **MD-3** | `getExpenses`-এর month/year ফিল্টার অসম্পূর্ণ — একটি না দিলে চুপচাপ পুরো ডেটা | প্রতিটি ফিল্টার স্বাধীনভাবে প্রয়োগ; শুধু মাস দিলে বর্তমান বছর ধরা হয় (সতর্কবার্তাসহ), শুধু বছর দিলে পুরো বছর; অবৈধ মাস/বছরে খালি ফল + স্পষ্ট console error (নীরব সম্পূর্ণ ডেটা আর নয়)। |
| **MD-4** | `collectionRate` KPI আজীবনের আদায় ও সব সেশনের বকেয়া মিশাত (১০০%-এর বেশি/অসম্ভব কম) | `getFeeDashboardOverview` এখন একই ডেটাসেট থেকে `sessionPayable`/`sessionCollected`/`sessionDue` দেয়; হার = collected ÷ payable, সর্বদা ০–১০০%; কার্ডে চার্জ/আদায়/বকেয়ার ব্রেকডাউনও দেখানো হয়। |
| **MD-5** | `getUnifiedIncomeHistory`-তে Transaction ID সংঘর্ষ (একই p.id + fee_type) → React key ডুপ্লিকেট | key-তে allocation position যোগ করা (`${p.id}_${feeType}_${position}`) — একই পেমেন্টে একই খাতের একাধিক allocation-ও ইউনিক key পায়। |
| **MD-6** | `formatBanglaCurrency` পয়সার মান নিয়ন্ত্রণ করত না (ডিফল্টে ৩ দশমিক) | পয়সা পর্যন্ত রাউন্ডিং (২ দশমিক) — পূর্ণ টাকা পরিষ্কার (৫,০০০), ভগ্নাংশ থাকলে ঠিক দুই দশমিক (১২.৫ → ১২.৫০, ১২.৫০৫ → ১২.৫১); রসিদ/রিপোর্টে যোগফল মেলে। |
| **MD-7** | Middleware প্রতি hard navigation-এ নেটওয়ার্ক round-trip (ডেভ-কমেন্টে স্বীকৃত) | সমাধান এখন `getClaims()` লোকাল JWT যাচাই — soft navigation-এ কোনো Supabase হিট নেই, কিন্তু auth চেকও বাদ পড়ে না। (HI-7-এর "বাইপাস সরানো" আর MD-7-এর "দ্রুততা" একসাথে সমাধান।) |
| **MD-8** | `createUserAccount`-এ আংশিক ব্যর্থতা → orphan Auth অ্যাকাউন্ট | `users` row write ব্যর্থ হলে `auth.admin.deleteUser()` দিয়ে Auth ইউজার রোলব্যাক (এবং মাইগ্রেশনে ডুপ্লিকেট ইমেইল সতর্কতা) — ব্যবহারকারী আটকে যাওয়া "email already registered" আর হবে না। |
| **MD-9** | `generateNextReceiptNumber` লেক্সিকোগ্রাফিক max — ব্যতিক্রমী মানে ভুল ক্রম | প্রকৃত সংখ্যা বিশ্লেষণ (regex-safe, `MR-YYYY-NNNNN` ও পুরোনো random-suffix দুটোই চেনে), ২০০টি ক্রম ধরে ফাঁকা স্লট-সন্ধান; random suffix এখন কেবল শেষ উপায়ে (স্পষ্ট সতর্কবার্তা লগসহ)। |

### 🟢 Low (L-1 … L-4)

| # | সমস্যা | কী পরিবর্তন হলো |
|---|---|---|
| **L-1** | পাবলিক রুটে `startsWith` — ভবিষ্যতে `/portal-something` চুপচাপ পাবলিক | `isSameOrChildPath()` — `=== prefix \|\| startsWith(prefix + "/")`; পাবলিক prefix তালিকা এখন নামযুক্ত ধ্রুবক `PUBLIC_ROUTE_PREFIXES`-এ। |
| **L-2** | `app/portal/layout.tsx` RSC-তে cookie রিফ্রেশ ব্যর্থ হয়, সেশন কেবল middleware-এর উপর নির্ভরশীল | স্পষ্ট ডকুমেন্টেশন + ত্রুটি ও "সেশন নেই" আলাদা করা: `getSession()` → `getUser()` ফলব্যাক → `maybeSingle()` প্রোফাইল; রিফ্রেশ-ত্রুটিতে ব্যবহারকারীকে অনর্থক লগআউট করা হয় না, আর ক্র্যাশও হয় না। |
| **L-3** | `logout`-এ সেশন অবসান নিশ্চিত নয়; `cache()`-করা client পুরোনো কুকি ধরে রাখতে পারে | signOut-এর পর ডিফেন্স-ইন-ডেপথ: সব `sb-*` কুকি স্পষ্টভাবে মোছা + `revalidatePath("/", "layout")` → পুরোনো সেশন-ডেটা/পেলোড আর ফিরে আসে না। |
| **L-4** | `syncFeesWithFunds()` কিছুই করত না, অথচ UI "রিক্যালকুলেট হয়েছে" দেখাত | এখন প্রকৃত **integrity audit**: সব fee_payments+allocations পড়ে (১) পেমেন্টের অঙ্ক ↔ allocations-এর যোগফল মেলে কি না, (২) একই payment+fee_type+billing_period ডুপ্লিকেট (CR-7-এর ক্ষতি), (৩) orphan allocation — গণনা করে সত্যি রিপোর্ট দেয়; `finance.edit` গার্ডসহ। ফান্ড ব্যালেন্স লাইভ ডেটা থেকে হিসাব হয় বলেই সেটি স্পষ্ট করে বলা হয়। |

---

## ৩. নিরাপত্তা স্থাপত্য (নতুন রক্ষা-স্তর)

```
ব্রাউজার/ক্লায়েন্ট
   │
   ├─ middleware.ts ──► (১) সেশন যাচাই (hard: getUser / soft: getClaims লোকাল)
   │                     (২) role আসে DB থেকে, টোকেন-মেটাডেটা থেকে নয়
   │                     (৩) পাবলিক রুট exact-segment ম্যাচ
   │
   ├─ writeGuard(module) ──► প্রতিটি write action-এর প্রবেশপথ
   │      ├─ লগইন? না → ত্রুটি
   │      ├─ অ্যাকাউন্ট ACTIVE? না → "স্থগিত/নিষ্ক্রিয়" (fail-closed)
   │      ├─ নিজের মাদ্রাসা? না → ত্রুটি
   │      ├─ student/parent? → ড্যাশবোর্ড write বন্ধ
   │      └─ মডিউল-নীতি: finance/users/roles = কঠোর; বাকি = স্টাফ-রোল
   │
   ├─ requirePermission(...) ──► সংবেদনশীল নির্দিষ্ট action-এ extra প্রকৃত পারমিশন
   │
   └─ পেজ স্তর ──► app/dashboard/users/page.tsx (CR-6) সার্ভার-গেট
```

**পরিকল্পিত ও ইচ্ছাকৃত ব্যতিক্রম (guard ছাড়া):** `login`/`logout`/`changeGuardianPassword`, পাবলিক দান (`submitOnlineDonation`, `initiateOnlineDonationGateway`), পাবলিক পেমেন্ট গেটওয়ে কলব্যাক, পাবলিক অ্যাডমিশন/ভেরিফিকেশন, পোর্টাল-মুখী পড়া-ও-নিজস্ব লেখা (`getAuthMadrasaId`, `getFunds`, `getAssignments`, notification mark-read, `submitStudentLeaveRequest`, `createParentFeedback`, `getAcademicSessions`, `getStudentDigitalId`, `registerMadrasa`) — এদের guard করা হলে বিনা-লগইন দাতা/অভিভাবক/শিক্ষকের স্বাভাবিক ব্যবহার ভেঙে যেত। তালিকাটি স্ক্রিপ্টে নাম-ধরে লেখা ও মন্তব্যে যুক্তিযুক্ত।

---

## ৪. ডিপ্লয় করার আগে যা অবশ্যই করতে হবে

1. **ব্যাকআপ নিন** — বিশেষত `fee_payment_allocations`, `expenses`, `donations`।
2. **মাইগ্রেশন চালান:** `supabase_fix_account_model_migration.sql` (একটি transaction; idempotent)। শেষে self-check ব্লক সফল হলেই এগোবেন। ডুপ্লিকেট ভাউচার/allocations থাকলে স্ক্রিপ্ট সেগুলো সতর্কবার্তা দিয়ে দেখাবে ও যেখানে নিরাপদ সেখানে পরিষ্কার করবে।
3. **এনভায়রনমেন্ট ভ্যারিয়েবল:**
   - `SUPABASE_SERVICE_ROLE_KEY` **অবশ্যই** সেট থাকতে হবে (CR-5 — নাহলে সব admin-নির্ভর action fail-closed হবে)।
   - প্রাথমিক সেটআপের পর `ALLOW_INITIAL_BOOTSTRAP` unset/`false` রাখুন; দরকার হলে `BOOTSTRAP_ADMIN_EMAILS=you@example.com` (HI-9)।
4. **যাচাই করুন (হাতে-কলমে):** একজন স্টাফ + একজন অভিভাবক টোকেন দিয়ে (ক) অভিভাবক কোনো write action চালাতে পারে কি না (পারবে না), (খ) স্টাফের স্বাভাবিক আটেন্ডেন্স/ফি/খরচ কাজ চলছে কি না, (গ) একই ভাউচার/রসিদ নম্বর দুইবার যাচ্ছে কি না।
5. **পরিশিষ্টের ডেটা-রিকভারি SQL** (`BUG_REPORT_ACCOUNT_MODEL.md` §পরিশিষ্ট) চালিয়ে ভুল ব্যালেন্স (যদি থেকে থাকে) মিলিয়ে নিন।

### অতিরিক্ত নিরাপত্তা সুপারিশ (রিপোর্টের ৩৭টির বাইরে)
- ⚠️ `.env.local` **Git-এ ট্র্যাক করা আছে** (`git ls-files`-এ দেখা যায়)। এটি এখনো ট্র্যাকড থাকায় নতুন `.gitignore` একা সুরক্ষা দেয় না — `git rm --cached .env.local` করে Git ইতিহাস থেকে সরান এবং ওই কী-গুলো **রোটেট করুন** (service role key সহ)।
- `scripts/`-এ থাকা পুরোনো `patch_*.js`/`test_*.js` স্ক্রিপ্টগুলো মুছে ফেলা বা `scripts/archive/`-এ সরানো ভালো — آنها production bundle-এর অংশ নয়, কিন্তু ভুল স্ক্রিপ্ট চালানো ঝুঁকি তৈরি করে।

---

## ৫. যা যাচাই করা হয়েছে — এবং যেটি হয়নি (সৎ সীমাবদ্ধতা)

**যাচাই হয়েছে:**
- `npx tsc --noEmit` → **০ error** (tsbuildinfo মুছে ফ্রেশ রান), অর্থাৎ ২১৪টি guard-insertion, নতুন মডিউল, মাইগ্রেশন-সংক্রান্ত কোড টাইপ-নিরাপদ এবং typed signature অপরিবর্তিত (`fallback` কৌশলটি ইচ্ছাকৃতভাবে টাইপ-সুরক্ষা অটুট রাখে)।
- **`npx next build` → সফল (exit 0)** — সব ২০০+ রুট/পেজ, সব Server Action ও Middleware কম্পাইল হয়েছে (মাত্র ৬২ সেকেন্ডে), অর্থাৎ ফিক্সগুলো শুধু টাইপ-স্তরেই নয়, প্রকৃত বিল্ডেও বৈধ।
- `formatBanglaCurrency`-এর আউটপুট রানটাইমে পরীক্ষা (৫,০০০ · ১২.৫০ · ১২.৫১ · ১,২৩৪,৫৬৭.৮৯)।
- প্রতিটি ট্যাগ (CR-1…L-4) কোডে ট্রেসযোগ্য — `grep` দিয়ে হিসাব নেওয়া।

**যাচাই করা হয়নি (এবং কেন):**
- কোনো end-to-end/ইউনিট টেস্ট স্যুট নেই — তাই রানটাইম ডেটা-প্রবাহ (যেমন মাইগ্রেশনের পর ডুপ্লিকেট পরিষ্কার) স্টেজিং ডেটা ছাড়া যাচাই সম্ভব নয়।
- এই স্যান্ডবক্স থেকে Supabase/ডেটাবেজে সংযোগ করা যায় না, তাই ডেটাবেজ-নির্ভর পথ (RLS, কুয়েরি আকার) বাস্তবে চালানো হয়নি।
- MD-2-এর পূর্ণ ACID/transaction সমাধান (Postgres RPC) ডেটাবেজ ফাংশন যোগ করা ছাড়া সম্ভব নয় — বর্তমানে bulk + chunked কৌশলে round-trip ও আংশিক-লেখার ঝুঁকি অনেকটাই কমানো হয়েছে; RPC-এর জন্য মাইগ্রেশন ফাইলের নোটে দিকনির্দেশনা রাখা হয়েছে।

---

*এই ফিক্স-পাসে সব পরিবর্তন ব্রাঞ্চ `arena/2f90858d-qawmierp-v2-0`-এ Uncommitted working tree হিসেবে আছে; মূল বিশ্লেষণী রিপোর্ট `BUG_REPORT_ACCOUNT_MODEL.md`, ডেটা-মাইগ্রেশন `supabase_fix_account_model_migration.sql`।*
