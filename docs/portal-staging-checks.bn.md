# Staging যাচাই: ফি, পোর্টাল সেশন ও শেয়ার করা Android ডিভাইস

**বর্তমান সিদ্ধান্ত: স্থানীয় যাচাই সফল; production-এ ফি চালু করার অনুমোদন নয়।** এখানে staging-এর রেকর্ড, আসল PSP callback বা Android WebView ব্যবহার করা হয়নি। নিচের পরীক্ষা [মূল rollout checklist](./portal-parity-rollout.bn.md)-এর finance, সেশন ও shared-device ধাপের জন্য।

**Staging বা টেস্ট ফোন এখনও না থাকলে:** [পোর্টাল পরীক্ষার খাতা (.xlsx)](./portal-pilot.bn.xlsx) ডাউনলোড করে একটি কপি রাখুন। `শুরু` পাতায় পোর্টাল ও হিসাব যাচাইয়ের দায়িত্ব ঠিক করুন। `পরিবার ও রসিদ` পাতায় দুই কাল্পনিক অভিভাবকের কোন সন্তান ও কত টাকার রসিদ দেখা উচিত তা দেওয়া আছে। `ফলাফল` পাতার সব পরীক্ষা শুরুতে **চালানো হয়নি**। অনুমোদিত পরিবেশে পরীক্ষা না করা পর্যন্ত নমুনা অঙ্ককে প্রকৃত ফল হিসেবে লিখবেন না। খাতাটি অফলাইনে ব্যবহার করা যায়; এতে কোনো অ্যাকাউন্ট তৈরি বা ডেটা import হয় না।

## ১. ফি চালুর আগে: দুই প্রতিষ্ঠানে read-only পরীক্ষা

আগে অনুমোদিত staging clone, backup এবং **আলাদা দুই প্রতিষ্ঠানের** UUID নিশ্চিত করুন। দুই প্রতিষ্ঠানেই পরীক্ষার জন্য কিছু বাস্তবসম্মত posted bill থাকা চাই। [Parity migration](../supabase_portal_parity_migration.sql) প্রয়োগের পরে, writes বন্ধ রেখে, staging-এর অনুমোদিত মেশিনে চালান:

```sh
npm ci
# QAWMI_STAGING_DATABASE_URL আগে থেকেই secret manager দিয়ে environment-এ দিন।
# TENANT_A এবং TENANT_B দুই staging প্রতিষ্ঠানের UUID।
npm run --silent preflight:fees -- "$TENANT_A" "$TENANT_B"
```

এটি **PostgreSQL connection URL** নেয়, Supabase HTTP URL বা API key নয়। `.env.local`, `DATABASE_URL` বা CLI argument থেকে password নেয় না। TLS certificate যাচাই হয়; private CA হলে বিশ্বস্ত certificate `NODE_EXTRA_CA_CERTS` দিয়ে দিন, যাচাই বন্ধ করবেন না। Clone-এর এমন report account ব্যবহার করুন যা প্রয়োজনীয় টেবিলগুলো সম্পূর্ণ পড়তে পারে; write বা settlement RPC চালানোর অধিকার লাগে না। RLS-এর আড়ালে কিছু সারি থাকলে পরীক্ষাটি ব্যর্থ হয়—policy খুলে দেওয়ার নির্দেশ নয়।

Parity migration-এর এই সংস্করণে report role-এর আগের `SELECT` তালিকার সঙ্গে **`public.portal_fee_checkouts`-এ `SELECT`** লাগবে। এই টেবিলে merchant password নেই, কিন্তু checkout, শিক্ষার্থী ও provider reference আছে। শুধু অনুমোদিত report role ব্যবহার করুন; `anon`/`authenticated`-কে grant দেবেন না। `checkout_permissions` বা `rpc_missing_or_grants` থাকলে cutover স্থগিত রাখুন।

[Runner](../scripts/portal-fee-preflight.mjs) দুই tenant-কে একই `REPEATABLE READ, READ ONLY` transaction-এ, UUID parameter দিয়ে আলাদাভাবে পড়ে। [SQL](../scripts/sql/portal-fee-preflight.sql) কোনো বিল লেখে না, metadata-তে `FOR UPDATE` lock নেয় না এবং PSP-তে যোগাযোগ করে না। ফলাফলে `A`/`B` argument-এর ক্রম অনুযায়ী; `inventory`, `blockers` ও `review`-এ শুধু সংখ্যা থাকে, ছাত্রের নাম, রসিদ নম্বর বা bank reference নয়।

| ফল / exit | অর্থ | কী করবেন |
|---|---|---|
| `CHECKS_CLEAR` / `0` | দুই প্রতিষ্ঠানের পড়া রেকর্ডে পরীক্ষিত অমিল বা pending review নেই। | Backup-এর control total মিলিয়ে তারপর PSP sandbox পরীক্ষা করুন। এটি settlement বা release sign-off নয়। |
| `HOLD` / `1` | অন্তত একটিতে অমিল **অথবা** হাতে যাচাই বাকি। এক রেকর্ড একাধিক check-এ ধরা পড়তে পারে। | সংশ্লিষ্ট প্রতিষ্ঠান ও check অনুযায়ী Finance-কে দিন। সিদ্ধান্ত নথিভুক্ত না করে writes চালু করবেন না। |
| `INCOMPLETE` / `2` | ভুল/একই UUID, প্রতিষ্ঠান নেই, schema/permission সমস্যা, malformed metadata, TLS বা timeout। | এটিকে শূন্য অমিল ভাববেন না। ভুলটি ঠিক করে দুটো প্রতিষ্ঠানেই আবার চালান। আংশিক সফল report ছাপা হয় না। |

**কী মিলছে, এবং অমিল পেলে কোথায় দেখবেন:**

- **বিল:** `legacy_bill_not_posted`, `legacy_bill_conflict`, `sql_bill_owner_or_balance` হলে সেই প্রতিষ্ঠানের পুরোনো `student_fees` ও SQL bill-এ ID, শিক্ষার্থী, প্রযোজ্য session/fee type/period, প্রদেয়–আদায়–বকেয়া মিলিয়ে দেখুন। `shadowed_fee_keys` মানে `registration_no`-র JSON একটি ভিন্ন, অখালি `metadata` key ঢেকে রেখেছে; দুই সেট যোগ করে হিসাব করবেন না। আগেই মুছে যাওয়া legacy record এই পরীক্ষায় আবিষ্কার করা যায় না—backup দরকার।
- **রসিদ:** JSON `payments`, SQL `fee_payments` এবং পুরোনো `fees` কপি স্থায়ী payment ID, `db_fee_id` বা রসিদ নম্বরে মেলে। একই তারিখ ও অঙ্ক মিললেই এক আদায় নয়। `standalone_collections` হলো কোনো structured receipt-এ যুক্ত নয় এমন `fees` সারি; একে নিজে থেকেই duplicate বলা যায় না। `*_receipt_*`/`*_mirror*` conflict হলে মালিক, অঙ্ক, status ও মূল রসিদ মিলিয়ে নিন। বাতিল রসিদের মুছে দেওয়া mirror পুনরায় পোস্ট করবেন না।
- **অনলাইন:** `pending_statement_check` থাকলে **শুধু খতিয়ান ঠিক হলেও `HOLD`**। PSP বা bank statement ছাড়া আদায়ের সিদ্ধান্ত দেবেন না। পুরোনো tenant-বিহীন reference, অন্য শিক্ষার্থীর/প্রতিষ্ঠানের বিল, একই বকেয়ায় একাধিক pending দাবি, convenience fee-সহ মোটের অমিল ও সফল transaction-এর অনুপস্থিত/ভুল receipt বা bill allocation আলাদা হয়। `rpc_missing_or_grants` হলে schema version ও grants যাচাই করুন; app user-কে settlement permission দেবেন না।
- এই command কোনো backfill, refund, retry, waiver/fund audit বা সাধারণ ক্যাশিয়ারের day-close করে না। অমিল মেটাতে স্বয়ংক্রিয় migration পুনরায় চালানো বা অভিভাবককে আবার টাকা দিতে বলা ঠিক নয়।

### SSLCommerz ফি: staging-এ কীভাবে প্রমাণ নেবেন

1. **পরিবেশ ঠিক করুন।** এই staging deployment-এর নিজস্ব `NEXT_PUBLIC_APP_URL` **build-এর আগেই** সেট করুন: কেবল `https://` origin, path/query/fragment নয়। Placeholder বা production fallback নেই। অনুমোদিত gateway manager staging প্রতিষ্ঠানের **নিজস্ব sandbox Store ID ও password** রাখবেন; `environment=SANDBOX` ও `sslcommerz.is_live=false` হতে হবে। শুধু সংযোগ পরীক্ষা সফল হওয়া আদায়ের প্রমাণ নয়। Password, validator query URL, cookie বা callback body লগ/টিকিট/চ্যাটে রাখবেন না।
2. **চেকআউটের আগে মেলান।** লিখতে দেওয়ার আগে bill, আগের আদায়, বকেয়া ও pending intent-এর control total রাখুন। নতুন fee intent-এ merchant/mode, শিক্ষার্থী, মূল ফি, গেটওয়ে মোট ও bill allocation সংরক্ষিত হয়। একই merchant/mode-এ একটি `tran_id` মাত্র একবার খোলা যায়। পুরোনো pending-এ এই সংযোগ/রেকর্ড না থাকলে `unbound_ssl_checkout`; অনুমান করে Store ID বসাবেন না। Sandbox/live বা Store ID বদলালে পুরোনো checkout-এর statement আগে মেলান। একই Store ID-র password বদলানো আলাদা বিষয়।
3. **একবার পরিশোধ করে দুটি delivery দেখুন।** synthetic guardian দিয়ে নিজের সন্তানের posted bill-এ আংশিক fee দিন। Browser return এবং provider-এর IPN-এ tenant-সহ URL পৌঁছাচ্ছে কি না দেখুন। Provider statement-এ **মূল ফি + convenience charge**, দুটো reference ও BDT মেলান; ছাত্রের বিলে credit হবে **শুধু মূল ফি**। একই `val_id`-এর সমর্থিত redelivery-তে আগের রসিদ থাকবে। হিসাব করুন: একটি `fee_payments`, ওই রসিদের প্রত্যাশিত allocation-গুলো, একটি যুক্ত `fees` কপি; অন্য প্রতিষ্ঠান ও অন্য সন্তানের খতিয়ান অপরিবর্তিত। যাচাইকৃত `bank_tran_id`-ই প্রযোজ্য, browser form-এর দাবি নয়।
4. **ফল বুঝে ব্যবস্থা নিন।** সফল IPN `200`; তথ্য/প্রমাণ না মিললে `400`, checkout/খতিয়ান/বিলের দ্বন্দ্বে `409`, সাময়িক যাচাই-ব্যর্থতায় `503` হতে পারে। Browser return-এর `303` কেবল পোর্টালে ফেরায়; নির্বাচিত সন্তানের জমা হওয়া রসিদই প্রমাণ। Fail/cancel return টাকা ফেরত বা আগের রসিদ বাতিল করে না। `settled_ssl_proof_mismatch` বা `checkout_without_matching_intent` দেখলে statement, backup, আসল রসিদ ও allocation দেখে Finance সিদ্ধান্ত নেবে। বাতিল/উল্টানো রসিদ redelivery দিয়ে পুনরায় পোস্ট করবেন না। **টাকা কেটে থাকলে অভিভাবককে আবার দিতে বলবেন না।**

দুই প্রতিষ্ঠানের A/B ফল, পরীক্ষার সময়, expected/actual count ও Finance sign-off রাখুন; শনাক্তকারী ও statement কেবল অনুমোদিত সুরক্ষিত ব্যবস্থায়। অন্য provider-এর manual verification, অনুদানের `online_donations` status, cashier-এর সব write, fund posting বা webhook পৌঁছানো এই fee পরীক্ষার আওতায় নয়। Legacy writer পুরো metadata বদলাতে পারে; pilot চলাকালীন পুরোনো app/job-এর writes বন্ধ রাখুন।

## ২. একই অভিভাবকের ওয়েব ও মোবাইল সেশন

**Cutover-এর প্রভাব: পুরোনো ব্যবহারকারীদের আবার লগইন করতে হবে।** নতুন app ও [parity migration](../supabase_portal_parity_migration.sql) একই maintenance window-তে দিন। `users`-এ সঠিক প্রতিষ্ঠান ও সক্রিয় profile থাকতে হবে। App-এ password login সফল হলে `user_sessions`-এ provider-এর স্থায়ী `session_id` সংরক্ষিত হয়; access token বদলালেও এই ID বদলায় না। `current_app_session()` যাচাইকৃত JWT এবং বর্তমান user–প্রতিষ্ঠান সংযোগ থেকে মেয়াদসহ সক্রিয় row খোঁজে। এটি কোনো cookie-র আলাদা ID, login-token hash বা `user_metadata` থেকে অনুমতি দেয় না।

- পুরোনো SQL/JSON session ইতিহাস অক্ষত থাকে; hash দেখে নতুন binding বসাবেন না। সংযোগ না থাকলে, মেয়াদ পেরিয়ে গেলে বা সেশন বাতিল হলে সেই login দিয়ে আর পোর্টাল খোলা যাবে না। এটি staff-এর সরাসরি ERP table-এর restrictive policy-তেও প্রযোজ্য।
- PostgREST schema cache-এ নতুন column/RPC দৃশ্যমান ও `authenticated`-এর নিজের `current_app_session()` চালানোর অনুমতি নিশ্চিত করুন। `user_sessions`-এ app client-কে সরাসরি write/read grant দিয়ে সমস্যা ঢাকবেন না। নতুন registration commit না হলে সাধারণ web/mobile login token ফেরত দেবে না।
- পরীক্ষা করুন **অনুমোদিত staging-এ**, আলাদা browser profile ও মোবাইল test client দিয়ে। `MOBILE_API_KEY` কনফিগার করুন; এটি ব্যবহারকারীর Bearer token-এর বিকল্প নয়। Cookie, JWT, refresh token, API key, password বা আসল রসিদ রিপোর্টে কপি করবেন না।

| পরীক্ষা | পাসের শর্ত |
|---|---|
| **সন্তান বদল** | A-র একই অভিভাবকের দুই সন্তানের ভিন্ন অঙ্কের posted রসিদ নিন। প্রত্যেকটির `/portal/fees?student_id=…`, cookie-সহ `/api/portal/snapshot?portal=student&student_id=…` ও Bearer-সহ `/api/mobile/portal/student?student_id=…` মিলিয়ে দেখুন। নির্বাচিত সন্তানের রসিদ ও `total_paid` মিলবে, অন্যটির রসিদ থাকবে না। |
| **সংযোগ ও ভূমিকা** | সংযোগহীন বা B-র সন্তান নির্বাচন করলে পোর্টাল `200` দিয়েও `active_student: null` ও খালি খতিয়ান ফেরাতে পারে; নিজের সন্তানদের selector থাকা স্বাভাবিক। অভিভাবক teacher snapshot পাবেন না। উভয় snapshot-এর সাফল্য ও প্রত্যাখ্যান `private, no-store`। |
| **Refresh ও বাতিল** | ওয়েব SDK এবং `/api/mobile/auth/refresh` দিয়ে নিজ নিজ token ঘোরান; রসিদ অপরিবর্তিত ও app session সংখ্যা একই থাকবে। ওয়েব থেকে কেবল মোবাইল সেশনটি বাতিল করুন: মোবাইলে snapshot `401`, refresh নতুন token দেবে না, স্বতন্ত্র ওয়েব login সচল থাকবে। এরপর ওয়েব সেশন বাতিল করলে সেই cookie ও একই login-এর Bearer sync আর তথ্য পাবে না; `/login`-এ আবার প্রবেশ করা যাবে। |
| **Logout, স্থগিত বা সাময়িক ত্রুটি** | নতুন login-এ পরীক্ষা করুন: refresh-এর পরে mobile logout শুধু ওই ডিভাইসের সেশন বন্ধ করবে। Account স্থগিতে দুই transport-এই খতিয়ান বন্ধ। Session registry সাময়িকভাবে পড়া না গেলে snapshot-এ `5xx`, কোনো ব্যক্তিগত data নয়; এটিকে স্থায়ী revocation বা সফল sync বলে গণ্য করবেন না। |

এই পরীক্ষায় app access বন্ধ হওয়া যাচাই হয়; upstream provider সব JWT সঙ্গে সঙ্গে সর্বত্র বাতিল করেছে, এমন দাবি নয়। Staging evidence-এ প্রত্যাশিত/প্রাপ্ত status, অঙ্ক মেলার ফল, সময় ও পরীক্ষিত app সংস্করণ রাখুন। Token বা সার্ভারের সম্পূর্ণ response রাখার দরকার নেই।

## ৩. শেয়ার করা ব্রাউজার ও Android: কার রসিদ দেখা উচিত?

| পরিস্থিতি | প্রত্যাশিত আচরণ |
|---|---|
| হোস্টেড পোর্টালে SW সক্রিয়; একই ব্যবহারকারীর নির্বাচিত সন্তানের সফল sync আছে | `/portal/fees?student_id=…`-তে offline hard reload সেই origin-এর owner-scoped, সময়-চিহ্নিত read-only snapshot দেখাতে পারে। আগের মালিকের HTTP-cached HTML নয়। |
| SW বা বৈধ snapshot নেই; WebView-এর main-frame ব্যর্থ হয়ে bundled `native-offline.html` খোলে | এটি Capacitor-এর **স্থানীয় origin**। কোনো ছাত্র, রসিদ, token বা login অনুমান করে না; hosted database কপি করে না। সংযোগ ফিরলে **পোর্টালে ফিরুন** কনফিগার করা server-এর `/login` খোলে; আগের deep link বা error page reload করে না। |
| Session বদল, logout বা reconnect | Cookie ও Bearer snapshot-এর app response `private, no-store`; offline DB-তে সংরক্ষণ আলাদা। নতুন মালিকের যাচাইকৃত response না পাওয়া পর্যন্ত পুরোনো মালিকের কপি দেখানো চলবে না। পুরোপুরি offline ডিভাইস server-এ নতুন revocation সম্পর্কে তখনই জানতে পারে না। |

**একই ব্রাউজারে মালিক বদলের স্থানীয় ফল।** [Chromium UI পরীক্ষা](../tests/browser/shared-guardian-ui.mjs) একই ট্যাব ও প্রোফাইলে দুটি ভিন্ন প্রতিষ্ঠানের অভিভাবককে পাসওয়ার্ড ফর্ম দিয়ে লগইন করায়। অ্যাপ নিজেই cookie ও offline কপি তৈরি করে; পরীক্ষা সেগুলো বসায় না।

| ব্যবহারকারীর কাজ | কী দেখা গেছে |
|---|---|
| A ফি পাতায় দ্বিতীয় সন্তান নির্বাচন করেন; সিঙ্কের পরে সংযোগ কেটে reload | নির্বাচিত সন্তানের **৳৭২.৫০**-এর রসিদ। প্রথম সন্তানের **৳৪৫.২৫**-এর রসিদ নেই। |
| A লগআউট করেন; একই ট্যাবে B লগইন করে নিজের দ্বিতীয় সন্তান নির্বাচন করেন | A-র app session নিষ্ক্রিয়, তাঁর সংরক্ষিত portal snapshot নেই। B-র offline reload-এ **৳৯১.৭৫**-এর রসিদ; A-র নাম বা রসিদ নেই। |
| ব্রাউজার offline থাকা অবস্থায় B-র ওই সন্তানের খতিয়ানে আরেকটি পরীক্ষামূলক **৳৬.২৫** জমা হয় | Offline কপিতে নতুন রসিদ আসেনি। সংযোগ ফিরলে পাতা নিজে থেকে অনলাইনে খুলে দুটি রসিদ ও মোট **৳৯৮** দেখিয়েছে। এটি জমা করা fixture, PSP payment নয়। |
| B আবার offline অবস্থায় Back করে A-র আগে দেখা দ্বিতীয় সন্তানের ফি পাতায় ফেরেন | Back ও আবার reload—দুই ক্ষেত্রেই রসিদের অংশ খালি। সংযোগ ফিরলে B-র পোর্টালে ওই নির্বাচনের জন্য কোনো সংযুক্ত শিক্ষার্থী নেই। এরপর পুরোনো `/portal/fees` পাতায় (সন্তান নির্দিষ্ট নয়) Back করলে B-র প্রথম সন্তানের রসিদ দেখা গেছে, A-রটি নয়। |

এখানে Chromium-এর history-র আসল এন্ট্রিতে ফেরা হয়েছে এবং ট্যাব ও service worker দুটিরই সংযোগ বন্ধ ছিল। ফলটি পরীক্ষিত পাতায় কী দেখা গেছে তা বলে; সব browser-এর back/forward cache, ফোনের recent-apps preview বা WebView-এর আচরণের নিশ্চয়তা নয়।

**বাস্তব ডিভাইসে বাকি পরীক্ষা:** staging HTTPS origin দিয়ে asset prepare ও `cap sync android` একই environment-এ করে APK বিল্ড করুন। একটি পরিষ্কার test profile-এ প্রথম launch-ই airplane mode-এ করুন; ব্যক্তিগত তথ্য আসবে না। তারপর অনলাইনে tenant A-র দুই সন্তানের মধ্যে দ্বিতীয়টির রসিদ sync করে airplane mode, hard reload, background/foreground ও reconnect দেখুন। একই ডিভাইসে logout করে tenant B-তে ঢুকে Back ও পুনরায় launch করুন; A-র নাম/রসিদ বা queued write আসা চলবে না। পুরোনো APK থেকে upgrade-ও পরীক্ষা করুন। WebView/OS সংস্করণ, দেখা origin, প্রত্যাশিত ও প্রকৃত ফল লিখুন; token বা শিক্ষার্থীর তথ্য রিপোর্টে নয়।

## ৪. স্থানীয় পরীক্ষার প্রমাণ

| চালানো হয়েছে | ফলাফল |
|---|---|
| `npm ci`, `npm run lint`, `npm run build` | সফল; Next 16.4.6-এর ৫১/৫১ static page তৈরি। |
| `npm test`, `npm run test:e2e` | ১৩৩/১৩৩ unit (২২ ফাইল), ১৪৯/১৪৯ repository integration (২৫ ফাইল)। এর মধ্যে পরিষ্কার build directory-তে আসল `cap sync android`, bundled error path/reader, cookie/Mobile cache headers আছে। E2E-র audit write warning live persistence-এর প্রমাণ নয়। |
| [PGlite suite](../tests/sql/run-portal-parity.mjs) | migration ও rollback assertions-এর পাশাপাশি দুই tenant-এ একই receipt/reference, ভাঙা ও shadowed legacy data, ভুল bill allocation, overlapping pending, unbound/হারানো checkout, অমিল validation reference, `VOID`/`REVERSED`, grant, RLS-filtered read ও redacted error যাচাই হয়েছে। |
| [PostgreSQL CLI test](../tests/sql/fee-preflight-cli.mjs) | disposable PostgreSQL **16.16**, TLS ও SELECT-only report role দিয়ে আসল CLI-এর exit `0`, `1`, `2` যাচাই। Staging DB ব্যবহার হয়নি। |
| [ফি callback HTTP test](../tests/sql/fee-callbacks-http.mjs) | Build করা Next-এর আসল return ও IPN POST দুটোই একই প্রতিষ্ঠানের lock-এ **দুটি আলাদা PostgreSQL session**-এ অপেক্ষারত দেখা হয়েছে। ৳৭৭.২৫ গেটওয়ে মোট → ৳৭৫.২৫ ফি, ৳৬০ ও ৳১৫.২৫ allocation, একটি রসিদ ও একটি `fees` কপি। একই delivery, অমিল bank/reference/amount, বদলানো bill/checkout, একই merchant-এর অন্য প্রতিষ্ঠান, `VOID`/`REVERSED` ও দেরিতে ফেরা donation callback যাচাই করা হয়েছে। **Validator ও সীমিত PostgREST transport কৃত্রিম; আসল PSP/Supabase নয়।** |
| [সেশন ও রসিদের HTTP test](../tests/sql/session/portal-sessions-http.mjs) | Build করা Next, disposable PostgreSQL 16.16 ও **Supabase Lite 0.11.0**-এ password sign-in, SSR cookie ও refresh-এর পরে পাওয়া Bearer token দিয়ে দুই সন্তানের **৳৪৫.২৫** ও **৳৭২.৫০** মিলেছে। ওয়েব ফি পাতায় শুধু নির্বাচিত রসিদ; unlinked/অন্য প্রতিষ্ঠানের নির্বাচন খালি। সেশন বাতিল, অন্য login অক্ষত থাকা, স্থগিত account, refresh-এর পরে logout, registry পড়া/লেখার অনুমতি না থাকলে data/token না দেওয়া যাচাই হয়েছে। Lite একটি আলাদা Auth/Data API implementation; এই HTTP test-এ browser UI চালানো হয় না। |
| [শিক্ষক প্রোফাইল ও রুটিন HTTP test](../tests/sql/session/teacher-links-http.mjs) | বর্তমান `main`-এর শিক্ষক-সংযোগের সঙ্গে মিলিয়ে built Next, PostgreSQL ও Supabase Lite-এ পরীক্ষা: `teachers.auth_user_id`-এ যুক্ত শিক্ষক ওয়েব cookie ও আলাদা mobile Bearer-এ একই বরাদ্দ বিষয় এবং শুধু নিজের নামে দেওয়া পিরিয়ড দেখেন। সংযোগ সরালে একই নামের অন্য শিক্ষক বা শিক্ষকহীন পিরিয়ড দেখা যায়নি। |
| [শেয়ার করা Chromium-এ আসল login/logout UI](../tests/browser/shared-guardian-ui.mjs) | স্থানীয় production build, PostgreSQL ও Supabase Lite-এ উপরের A → B পরীক্ষা (ধাপ ৩)। আলাদা প্রোফাইল, কৃত্রিম login cookie বা হাতে বানানো browser snapshot নয়। |
| [Chromium: কৃত্রিম HTTP পাতা](../tests/browser/portal-offline.mjs) | চার group সফল: selected child ও আগে থেকেই HTTP-cache-এ থাকা private HTML; আলাদা origin-এর bundled error page থেকে `/login`; দুই ট্যাবের queue lease; মালিক বদলের পরে দেরিতে ফেরা write। **এটি Android/WebView run নয়।** |

PGlite/Chromium পুনরায় চালানোর নির্দেশ [rollout report-এ](./portal-parity-rollout.bn.md)। CLI integration test-এর জন্য non-root মেশিনে `openssl` ও PostgreSQL-এর **স্থানীয়** `initdb`/`pg_ctl` দিয়ে repo root থেকে চালান:

```sh
QAWMI_PG_BIN="$(pg_config --bindir)" node tests/sql/fee-preflight-cli.mjs

# আলাদা disposable checkout-এ, কোনো deployment env file/credential ছাড়া:
npm run build
QAWMI_PG_BIN="$(pg_config --bindir)" node tests/sql/fee-callbacks-http.mjs

# Session পরীক্ষার pinned tooling আলাদা; app-এর dependency নয়।
npm ci --prefix tests/sql/session --ignore-scripts
QAWMI_PG_BIN="$(pg_config --bindir)" node tests/sql/session/portal-sessions-http.mjs
QAWMI_PG_BIN="$(pg_config --bindir)" node tests/sql/session/teacher-links-http.mjs

# একই ট্যাবে দুই login: TOOLS হলো rollout report-এ দেখানো Chromium tooling directory।
QAWMI_PG_BIN="$(pg_config --bindir)" QAWMI_BROWSER_TOOLS="$TOOLS" \
  node tests/browser/shared-guardian-ui.mjs
```

UI test নিজেই `.cache/`-এর অস্থায়ী project-এ স্থানীয় Auth API দিয়ে build করে এবং শেষে সেটি সরায়; root-এর `.next` বদলায় না। PostgreSQL test-গুলো নিজ নিজ অস্থায়ী cluster তৈরি করে, loopback-এ চালায়, তারপর বন্ধ করে; এটি staging চালানোর command নয়। **Release-এর বাকি শর্ত: অনুমোদিত দুই-tenant staging run, hosted Supabase-এ staging cookie/Bearer session, PSP sandbox statement/IPN এবং বাস্তব Android device।**
