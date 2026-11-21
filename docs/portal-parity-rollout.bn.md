# QawmiERP: পোর্টাল সামঞ্জস্য — বাস্তবায়ন ও রিলিজ যাচাই

**সিদ্ধান্ত: staging-এ যাচাইয়ের জন্য প্রস্তুত; production-এ এখনই চালুর অনুমোদন নয়।** Admin, Teacher এবং Student/Guardian-এর জন্য একই রেকর্ডের অর্থ এক করা হয়েছে, কিন্তু সবার দেখার অধিকার এক করা হয়নি। যেমন, শিক্ষক তার বিষয়ের নম্বর পান; একই জামাতের শিক্ষার্থীর পারিবারিক ফি খতিয়ান পান না।

ভিত্তি `main@d8efed2`। [Phase 1-এর ১৪টি পর্যবেক্ষণ](./cross-portal-audit.bn.md) সোর্স পরিবর্তনের আগে লেখা হয়েছিল। নিচের ফলাফল কাজের শাখার; কোনো live database, gateway, APK অথবা production deployment-এর প্রত্যয়ন নয়।

## কী বদলেছে

| ক্ষেত্র | প্রত্যাশিত আচরণ ও প্রাসঙ্গিক কোড |
|---|---|
| ১–২. পরিচয় ও বরাদ্দ | `lib/portal/identity.ts` প্রতিষ্ঠান, সক্রিয় account, server-owned role, অভিভাবক–সন্তান সংযোগ এবং শিক্ষক–জামাত বরাদ্দ যাচাই করে। নামের মিল বা তালিকার প্রথম শিক্ষার্থী দিয়ে অচেনা `student_id` বদলানো হয় না। শিক্ষক ডিরেক্টরি সীমিত fields ফেরত দেয়। Web cookie ও Mobile Bearer আলাদা transport, কিন্তু `portalSnapshot` একই। |
| ৩. প্রমোশন | `/dashboard/students/promotion`-ই মূল প্রবেশপথ। `apply_portal_promotion` শিক্ষাবর্ষের metadata এবং চলতি শিক্ষার্থীর জামাত/রোল একই transaction-এ পরিবর্তন করে। জমা দেওয়ার পর রোস্টার বদলে গেলে পুরোটাই ব্যর্থ হয়। ভবিষ্যৎ সেশনের placement সেশন সক্রিয় না হওয়া পর্যন্ত বর্তমান জামাত বদলায় না; প্রস্থান ও পুরোনো সেশনের ইতিহাস আলাদা। |
| ৪. রুটিন | `lib/portal/queries.ts`, `lib/routine-helper.ts`: শিক্ষকের নিজের রুটিনে শুধু সরাসরি তাঁর নামে দেওয়া পিরিয়ড আসে; একই বিষয়ের শিক্ষকহীন বা অন্য শিক্ষকের পিরিয়ড নয়। এক জামাতের ছুটিতে অন্য জামাতের ক্লাস চলতে পারে। একটি ক্লাসের শেষ সময় পরের ক্লাসের শুরুর সঙ্গে দ্বিগুণ গণনা হয় না। |
| ৫–৬. নম্বর, ফল ও মেধা | `teacher-entry.ts`, `cohort.ts`, `exams.ts` ও `lib/exam-grading.ts`: শিক্ষককে বিষয় ও শিক্ষার্থী দুটোই বরাদ্দ থাকতে হয়। শূন্য নম্বর আর এন্ট্রি না থাকা এক নয়। রিপোর্ট কার্ড ও পোর্টালের গ্রেড/মেধাস্থানের ভিত্তি পরীক্ষার সময়ের cohort; tie হলে `১, ১, ৩`। `set_portal_exam_publication` একই সঙ্গে SQL প্রকাশনা, পুরোনো metadata এবং পরীক্ষার status বদলায়। ফল প্রত্যাহারের পর পরবর্তী সফল sync পুরোনো ফল সরায়। |
| ৭–৮. হাজিরা, হিফজ ও কিতাব | `Present`, `Absent`, `Late`, `Leave` — শুধু পোস্ট করা রেকর্ড গণনা হয়। শূন্য রেকর্ডকে ১০০% উপস্থিতি দেখানো হয় না; **মাসের** রিপোর্টের সঙ্গে **সর্বকালের** মোট তুলনা করা যাবে না। হাজিরা পৃষ্ঠা পড়লে নতুন হাজিরা লেখা হয় না। হিফজ/কিতাবে `log_date`, শিক্ষার্থী এবং প্রযোজ্য ক্ষেত্রে কিতাব ধরে এন্ট্রি; ব্যর্থ write-কে সাফল্য বলা হয় না। |
| ৯–১১. নোটিশ, বাড়ির কাজ, ছুটি | নোটিশের audience, active অবস্থা ও জামাত ছেঁকে তারপর সর্বশেষ তিনটি নেওয়া হয়। Student Portal-এ নমুনা/আর্কাইভ কাজ নয়, নির্বাচিত সন্তানের পাঠ আসে। ক্লাস/বিভাগভিত্তিক ছুটি আলাদা। সাধারণ feedback ছুটির আবেদন নয়; নতুন আবেদনের একটিই pending ID। প্রশাসনিক সিদ্ধান্ত সেই ID-তে যুক্ত হয়। পুরোনো untagged হাজিরাকে নতুন ছুটির নামে মুছে ফেলা হয় না। |
| ১২. ফি ও রসিদ | `lib/portal/ledger.ts` বিল, ছাড় এবং আদায় আলাদা করে। স্থায়ী ID/রসিদ দিয়ে মিল হয়, একই অঙ্ক/তারিখ দিয়ে নয়। বাতিল রসিদ তার legacy কপিসহ মোট থেকে বাদ যায়। `/pay`-এর শিক্ষার্থী ও বিল যাচাই হয়। নতুন ফি callback নির্দিষ্ট প্রতিষ্ঠানের transaction/ভ্যালিডেশন ব্যবহার করে; SSLCommerz-এর যাচাই করা reference, BDT এবং অঙ্ক না মিললে পোস্ট হয় না। `settle_portal_fee_intent`-এ **অনলাইন ফি**র বিল, allocation, রসিদ, পুরোনো `fees` কপি ও transaction status একই সঙ্গে পোস্ট হয়; একই IPN পুনরায় এলে দ্বিতীয় আদায় হয় না। এটি সাধারণ ক্যাশিয়ার/ফান্ড/void-এর পূর্ণ fee-posting RPC নয়। |
| ১৩–১৪. Offline ও পুনঃপ্রেরণ | Dexie database-এর মালিক `tenant:user:portal`; নির্বাচিত সন্তানের snapshot আলাদা। সম্পূর্ণ বৈধ response পাওয়ার পর replace হয়; ব্যর্থ fetch-কে খালি সফল sync ধরা হয় না। Service Worker ব্যক্তিগত HTML/RSC cache করে না। Offline hard reload-এ সর্বশেষ সিঙ্কের সময়সহ read-only কপি; অনলাইনে ফিরলে নতুন অনুরোধ। শিক্ষক outbox-এ একই কাজ দুই ট্যাব মিলে একবারে claim করে, অন্য মালিকের হয়ে পাঠায় না। |

## কী পরীক্ষা হয়েছে

| পরীক্ষা | ফল | সীমানা |
|---|---|---|
| `npm ci`, `npm run lint`, `npm run build` | পরিষ্কার install, TypeScript ও Next.js production build সফল | Node 22.22.3, npm 10.9.8। পুরোনো lockfile অন্য dependency set-এর ছিল; বর্তমান manifest দিয়ে মিলিয়ে clean install যাচাই হয়েছে। Next-এর `middleware` → `proxy` deprecation warning আছে। |
| `npm test` | **১০৮/১০৮**, ১৬ ফাইল | নির্বাচিত সন্তান, শিক্ষকের বিষয়, পুরোনো cohort, future placement, টাই/শূন্য/অনুপস্থিত নম্বর, ছুটি, রসিদ ও offline cache-এর fixture আছে। |
| `npm run test:e2e` | **১৪৯/১৪৯**, ২৫ ফাইল | রিপোর integration harness। কিছু অডিট write-এর `fetch failed` stderr ছিল; এগুলো live audit persistence-এর পরীক্ষা নয়। |
| `tests/sql/run-portal-parity.mjs` | base → account model → parity → parity পুনরায় → rollback-only assertions: সফল | স্থানীয় PGlite, মডেলকৃত `auth.uid()`। দুই tenant, teacher/parent/admin, mixed/disabled role, BI/RPC grants; ভুল roster-এ rollback; প্রকাশ/প্রত্যাহার; বকেয়া বদলে গেলে আংশিক রসিদ না লেখা ও duplicate IPN পরীক্ষা হয়েছে। Supabase PostgREST/GoTrue নয়। |
| `tests/browser/portal-offline.mjs` | বাস্তব headless Chromium-এ সফল | স্থানীয় fixture HTTP server, আসল SW/Dexie/sync module। নির্বাচিত সন্তানের hard reload, অন্য ট্যাবে tenant/account বদল, reconnect, দুই ট্যাবের queue claim, মেয়াদোত্তীর্ণ lease এবং দেরিতে ফেরা write response পরীক্ষা হয়েছে। আসল login UI বা Android WebView নয়। |

অতিরিক্ত পরীক্ষাগুলো repo root থেকে, **disposable** tooling দিয়ে চালানো যায়:

```sh
npm ci
TOOLS=$(mktemp -d)
npm install --prefix "$TOOLS" --no-audit --no-fund @electric-sql/pglite@0.5.17 puppeteer-core@24.43.1 @sparticuz/chromium@143.0.4
QAWMI_BROWSER_TOOLS="$TOOLS" node tests/sql/run-portal-parity.mjs
QAWMI_BROWSER_TOOLS="$TOOLS" node tests/browser/portal-offline.mjs
```

ব্রাউজার পরীক্ষার জন্য Linux-এ Chromium-এর NSS/NSPR shared libraries প্রয়োজন। এই sandbox-এ ব্যবহৃত Chromium package-এর bundled libraries দিয়ে চালানো হয়েছে। `tests/sql/portal-parity.sql` **production-এ চালাবেন না**।

## Staging ও rollout-এর ক্রম

**পরবর্তী ধাপের সরঞ্জাম:** [দুই প্রতিষ্ঠানের read-only fee preflight, একই সঙ্গে return/IPN যাচাই, অভিভাবকের cookie/Bearer session, একই ব্রাউজারে দুই অভিভাবকের পরীক্ষার ফল ও Android offline যাচাই](./portal-staging-checks.bn.md)। উপরের পরীক্ষার টেবিলটি Phase 2-এর ফল; নতুন নির্দেশিকায় পরবর্তী যাচাই আলাদা করে দেওয়া আছে।

1. **আগে snapshot/backup।** staging clone-এ দুই প্রতিষ্ঠান, দুই সন্তানযুক্ত guardian, একাধিক বিষয়ের শিক্ষক, unlinked account, finance operator ও admin রাখুন। legacy JSON, account links, SQL bill/payment count, void রসিদ এবং pending gateway transaction-এর তালিকা ধরে রাখুন। Secret বা বাস্তব শিক্ষার্থীর তথ্য test fixture-এ রাখবেন না।
2. **Schema-র ক্রম।** খালি staging-এ `supabase_schema.sql` → `supabase_fix_account_model_migration.sql` → `supabase_portal_parity_migration.sql`। বিদ্যমান database-এ base পুনরায় চালাবেন না; কোন migration ইতিমধ্যেই প্রয়োগ করা, optional table/view আছে কি না, metadata ও linked IDs সঠিক কি না দেখুন। পরবর্তীতে optional ERP/BI migration দিলে restrictive policy ও grants আবার যাচাই করুন।
3. **App ও migration একসঙ্গে cutover করুন।** পুরোনো session binding backfill নয়; সকলকে নতুন app দিয়ে পুনরায় login করতে হবে। maintenance বা সীমিত traffic-এ deploy করুন; RPC ও PostgREST schema cache প্রস্তুত হওয়ার আগে নম্বর প্রকাশ, প্রমোশন বা পেমেন্ট চালু করবেন না। পুরোনো client-এর tenant-wide সরাসরি SQL reads নতুন RLS-এ কাজ করার কথা নয়। অদৃশ্য তথ্য ফেরাতে policy শিথিল করবেন না।
4. **একই রেকর্ড দিয়ে তিন পোর্টাল মিলিয়ে দেখুন।** নম্বর/পূর্ণমান → Admin tabulation → published Student result → unpublish → refresh; জামাত বদলের আগে ও পরে historical merit; একই মাসে চার status; হিফজ/কিতাবের তারিখ; দুই জামাতের নোটিশ, ছুটি, homework এবং leave approve/reject। জামাতহীন/সংযোগহীন ব্যবহারকারীকে অন্য কারও রেকর্ড দেখানো চলবে না।
5. **Finance gate।** SQL-এ backfill/reconcile না হওয়া পুরোনো বিলের জন্য নতুন online intent ব্যর্থ হওয়াই প্রত্যাশিত; আগে বিল মিলিয়ে নিন। PSP sandbox-এ আসল IPN ও return দুটোই পাঠিয়ে দেখুন: সুবিধা-ফি সহ gateway amount আর শিক্ষার্থীর fee-credit এক অঙ্ক নাও হতে পারে। একবারই receipt/allocation হবে। আগের সংস্করণের tenant-বিহীন pending callback, অমিল balance অথবা manual transfer আলাদাভাবে যাচাই করুন; gateway-তে টাকা কাটা হলে যাচাই ছাড়া গ্রাহককে আবার দিতে বলবেন না।
6. **Shared device ও release gate।** বাস্তব cookie session এবং Mobile Bearer দিয়ে revoke/disable, logout, account switch, unlinked sibling, নতুন SW install এবং Android/Capacitor airplane-mode/reconnect চালান। কোনো tenant leak, দ্বৈত রসিদ, প্রকাশ প্রত্যাহারের পর সফল sync-এ পুরোনো ফল, বা user-visible মিথ্যা success হলে rollout বন্ধ রাখুন।

**যা এখনও নিশ্চিত নয়:** পুরোনো backend-এ নতুন optional policy-র কার্যকারিতা, production-এর historical data completeness, বড় প্রতিষ্ঠানে paged snapshot-এর latency, আসল PSP/Capacitor এবং audit delivery। সম্পূর্ণ offline ডিভাইস server-এ ঘটে যাওয়া revocation বা ফল প্রত্যাহার সংযোগ ফেরার আগে জানতে পারে না। আগের সব cashier write, legacy JSON-এর সমান্তরাল edits এবং external webhook delivery-কে এই পরিবর্তন transaction বা exactly-once করেনি।

**Rollback:** traffic ও finance writes থামিয়ে চলতি receipt/PSP statement মিলিয়ে নিন। আগের app চালিয়ে restrictive RLS খুলে দেওয়া নিরাপদ rollback নয়। যাচাইকৃত একই সংস্করণের app ও database snapshot জোড়ায় ব্যবহার করুন; snapshot-এর পর তৈরি আর্থিক লেনদেন না মিলিয়ে restore করবেন না।
