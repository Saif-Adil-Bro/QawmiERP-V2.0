# FOLLOWUP4 (2026-11-25) — রুট-কজ বিশ্লেষণ ও ফিক্স প্ল্যান

ব্রাঞ্চ: `fix/followup4-round4-remaining` → যাচাইয়ের পর `main`-এ `--no-ff` মার্জ ও পুশ।

> [!IMPORTANT]
> "বন্ধ হয়ে গেছে — হাত দেবেন না" তালিকার কোনো জিনিস বদলানো হবে না: S1 (২৪ বিষয় + NAH-KAF), R2, S3 কাউন্টার ও "হাজিরা বাকি" ব্যাজ, PB-01, PB-03, PB-05, PB-10, PB-12, PB-14, PB-04/11, PB-08 ডিফল্ট ("প্রযোজ্য নয়")। PB-02-এর নতুন পিকারে শুধু গতি বাড়ানো ও progress/guard যোগ হবে।

---

## Priority 1 — ব্যবহারকারীর ক্ষতি করে এমন বাগ

### N6 [HIGH] — অনুপস্থিতি অ্যালার্টে ভুল শ্রেণিবিভাগ, শ্রেণির নাম ভুল, তিন পেজে তিন রকম সংখ্যা
**রুট কজ**
- `getAbsenceAlertData` ([parent-communication.ts](file:///home/antigravity/Saif-Adil-Bro/QawmiERP-V2.0/app/actions/parent-communication.ts#L428-L621)): রেকর্ড না থাকা ছাত্রকে `"Present"` ধরে নেয় (`attMap.get(id) || "Present"`), আর `"Late"`-কে `"Absent"` গোনে। ফলে যাচাই (Late)-এর জন্য অনুপস্থিতির WhatsApp ড্রাফট তৈরি হয়।
- `classes(id, name)` join করা হয় না, তাই শ্রেণির নাম `"সাধারণ জামাত"`-এ চলে যায় (একই সমস্যা `getFeeAlertStudentsData` ও `attendance-cron-service.ts`-এ)।
- [dashboard/page.tsx](file:///home/antigravity/Saif-Adil-Bro/QawmiERP-V2.0/app/dashboard/page.tsx#L92-L174) বর্তমান রোস্টারে সীমাবদ্ধ না রেখে কাঁচা attendance row গোনে, আর "হাজিরা বাকি" বাদ দেয়।
- `saveAttendance` absence-alerts ও reports পাথ revalidate করে না।

**ফিক্স**
- [NEW] `lib/attendance-truth.ts`: হাজিরার একক সত্য-উৎস হেল্পার। বর্তমান সক্রিয় ছাত্রদের রোস্টারে সীমাবদ্ধ থাকবে। নিয়ম: সেভ করা DB রেকর্ডই একমাত্র উৎস, `Late` কখনো `Absent` নয়, রেকর্ড না থাকলে = `Unmarked` (হাজিরা বাকি)।
- [MODIFY] `parent-communication.ts`, `AbsenceAlertsClient.tsx`, `dashboard/page.tsx`, `PremiumDashboardClient.tsx`, `ReportingCharts.tsx`, `api/mobile/dashboard/route.ts`, `attendance-cron-service.ts`: এই হেল্পার ব্যবহার করবে এবং `classes(id,name)` join করবে।
- [MODIFY] `app/actions/attendance.ts`: সেভের পর absence-alerts ও reports পাথ revalidate হবে।

### N2 [MEDIUM] — মাসিক রিপোর্টে "শতভাগ উপস্থিত"-এর মধ্যে যাচাই (০ উপস্থিত, ১ Late) গোনা হচ্ছে
- **রুট কজ:** [reports/page.tsx](file:///home/antigravity/Saif-Adil-Bro/QawmiERP-V2.0/app/dashboard/attendance/reports/page.tsx#L98-L259) শুধু `absent === 0` পরীক্ষা করে।
- **ফিক্স:** KPI কার্ড ও `no_absent` ফিল্টার দুই জায়গাতেই শর্ত হবে `total > 0 && present === total`।

### N9 [HIGH] — অডিট লগ ২৭টি রেকর্ডে আটকে আছে
**রুট কজ**
1. `writeGuard()`-এর `autoAudit` ২৮৬টি কল-সাইটের একটিতেও পাস করা হয় না।
2. লগইন/লগআউট, বিষয়, বরাদ্দ, হাজিরা, যাকাত/দান, ফি, সেটিংস ও গেটওয়ে — কোনো জায়গা থেকেই `logAuditEvent` কল হয় না। ফি শুধু `fee_audit_logs`-এ লেখে।
3. [audit-log.ts](file:///home/antigravity/Saif-Adil-Bro/QawmiERP-V2.0/lib/audit-log.ts#L250-L300): `actor_id`-এর FK error (`23503`/`22P02`) চুপচাপ গিলে ফেলা হয়।

**ফিক্স**
- [MODIFY] `lib/audit-log.ts`:
  - FK বা UUID error হলে `actor_id: null` দিয়ে আবার চেষ্টা করবে; actor-এর তথ্য `metadata`-তে রাখা হবে।
  - অন্য যেকোনো error-এ `system_audit_logs_fallback`-এ লিখবে।
  - `/dashboard/settings/audit-logs` revalidate করবে।
- [MODIFY] নিচের জায়গাগুলোতে স্পষ্ট `logAuditEvent` যোগ হবে:
  - `api/auth/login/route.ts`, `actions/auth.ts`: LOGIN, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGED
  - `subjects.ts`, `class_subjects.ts`, `teacher_subjects.ts`, `classes.ts`: বিষয় ও বরাদ্দ
  - `attendance.ts`, `api/attendance/bulk`: হাজিরা সেভ
  - `zakat.ts`, `fundraising.ts`: যাকাত ও দান
  - `fee-management.ts`: ফি তৈরি ও কনফিগ
  - `tenant.ts`, `payment-gateway.ts`: সেটিংস ও গেটওয়ে

### N11 [MEDIUM] — আর্লি ওয়ার্নিং "০ বিশ্লেষিত" দেখায়, অথচ ব্যানার বলে "কেউ ঝুঁকিতে নেই"
**রুট কজ**
- `getEarlyWarningAlerts` ভুল টেবিল পড়ে: `fee_invoices` ও `fees.paid_amount` (এগুলো নেই)। আসল টেবিল `student_fees` বাদ পড়েছে, তাই সালমান (৳৮,৬০০) ও তাহমিদ (৳৪,৩০০) ধরা পড়ে না।
- `page.tsx`-এ `scoresRes.scores || ...`: খালি অ্যারে `[]` truthy হওয়ায় বিকল্প ডেটা ঢাকা পড়ে যায়।
- `student_risk_scores` খালি থাকলে লাইভ স্কোর হিসাব হয় না।
- ছাত্র ০ জন বিশ্লেষিত হলেও উইজেট সবুজ আশ্বাস দেখায়।

**ফিক্স**
- [MODIFY] `actions/early-warning.ts`, `lib/early-warning-service.ts`: `student_fees` থেকে বকেয়া পড়বে (`WAIVED` বাদ) এবং `classes` join করবে। স্কোর টেবিল খালি হলে সব স্কোপড ছাত্রের লাইভ ঝুঁকি হিসাব হবে।
- [MODIFY] `early-warning/page.tsx`: শর্ত হবে `scores?.length ? ... : summary.risk_scores`।
- [MODIFY] `EarlyWarningWidget.tsx`: বিশ্লেষিত ০ হলে দেখাবে "ঝুঁকি বিশ্লেষণ এখনো চালানো হয়নি"। খালি শ্রেণি ব্যাজও আর দেখাবে না।

### N12 [MEDIUM] — ইনভয়েস নেই এমন ছাত্রকে পোর্টাল "পরিশোধিত" দেখায়
- **রুট কজ:** শুধু `totalDue > 0` পরীক্ষা করা হয়। ইনভয়েসের সংখ্যা পাস করা হয় না।
- **ফিক্স:** [MODIFY] `portal/page.tsx`, `PortalDashboardClient.tsx`, `ParentPortalFeesClient.tsx` — তিনটি আলাদা অবস্থা:
  - বকেয়া > ০ → "বর্তমান বকেয়া"
  - ইনভয়েস ০ এবং পরিশোধ ০ → "ফি নির্ধারণ হয়নি / ইনভয়েস তৈরি হয়নি" (নিরপেক্ষ রঙ)
  - বাকি ক্ষেত্রে → "কোনো বকেয়া নেই (পরিশোধিত)"

---

## Priority 2 — ভুল ডেটা ও ভাঙা পেজ

| আইটেম | রুট কজ | ফিক্স (ফাইল) |
|---|---|---|
| **PB-09** `/teacher-portal/profile` খুললেই ক্র্যাশ | `borrow_records` টেবিল নেই (`PGRST205`), আর `stf_...` আইডি UUID নয় (`22P02`) | `teacher-portal/profile/page.tsx`: শুধু UUID কী রাখা হবে, ঐচ্ছিক টেবিলের কোয়েরি try/catch-এ থাকবে। `auth.ts`: পাসওয়ার্ড বদলের পর revalidate ও অডিট |
| **PB-06** স্টাফ প্রোফাইলে জিম্মাদারি ও বিষয় ০ দেখায় | `getTeacherAcademicSchedule`-এ teacher-role পরীক্ষা `staffId`-এর আগে চলে, তাই লগইন করা অ্যাডমিনের নিজের খালি সময়সূচি ফেরত আসে। ফোন/নাম মেলানো স্বাভাবিকীকরণ হয় না (বাংলা অঙ্ক, +88, হাফেজ/মাওলানা ইত্যাদি)। ডুপ্লিকেট teacher row থাকলে `empty` ফেরত আসে। | `teacher_subjects.ts`: `staffId`-কে আগে প্রাধান্য, `staffRead` guard। `lib/teacher-identity.ts`: স্বাভাবিকীকরণ ও ডুপ্লিকেট সহনশীলতা। `lib/portal/identity.ts`: সব মেলানো UUID-এ `.in(...)`, `madrasa_id.is.null` |
| **N1** ছাত্র তালিকার ফি ফিল্টার কাজ করে না, `?fee=FREE` URL-এ আটকে থাকে | `useMemo`-এর dependency-তে `selectedSystem` ও `selectedFeeCategory` নেই। `router.replace` ধীর RSC রি-রেন্ডারের সাথে race করে। | `StudentsListClient.tsx`: dependency যোগ। `router.replace`-এর বদলে `window.history.replaceState` |
| **N5** কম মজুদের অ্যালার্টে মজুদ ০ ও ভুল আইটেম | `quantity` পড়া হয় (আসল ঘর `in_stock_qty`), আর `<=` তুলনা করা হয় | `notifications.ts`: `in_stock_qty` পড়বে, archived বাদ যাবে, `<` তুলনা, পুরোনো "মজুদ: ০" নোটিফিকেশন ফিল্টার |
| **PB-08 (বাকি)** হিফজ রিপোর্টে ১১ জনই দেখায় | regex-এ নূরানী/মক্তব/নাজেরা আছে। রোস্টার fallback ও `hifz_profiles[0]` fallback আছে। | `hifz.ts`, `lib/hifz/read.ts`: regex শুধু হিফজ, ভুল fallback বাদ। `hifz/report/page.tsx`: ডিফল্টে হিফজ জামাত নির্বাচিত। ডিফল্ট "প্রযোজ্য নয়" অপরিবর্তিত থাকবে। |
| **B01** প্রিন্টে লোগো ভাঙা | আপলোডের error উপেক্ষা করে মৃত URL সেভ হয়। `<img>`-এর কোনো fallback নেই। | `tenant.ts`: upload error পরীক্ষা। [NEW] `components/print/SafeLogo.tsx` (`onError` বা `naturalWidth===0` হলে মনোগ্রাম)। `PrintLetterpad.tsx` ও অন্যান্য প্রিন্ট/রসিদ কম্পোনেন্টে প্রয়োগ। |

---

## Priority 3 — অসঙ্গতি, আংশিক বাকি ও পলিশ

- **N7 গেটওয়ে স্ট্যাটাস:**
  - `getOnlineDonationSettings` `getFullPaymentGatewayConfig` থেকে enabled/provider নেবে।
  - ডিফল্ট মান `gateway_enabled=false`।
  - `OnlineDonationsClient.tsx` ব্যানার আসল অবস্থা দেখাবে।
  - গেটওয়ে সেভের পর online-donations revalidate হবে।
- **N8 ব্যাকআপ:**
  - `BackupClient.tsx`-এর হার্ডকোড "২৬" বদলে `MODULE_DEFINITIONS.length` (২৭)।
  - `getBackupOverviewStats` আসল টেবিল ও meta store (dedupe করে) গুনবে: donations, zakat, donors, life_member_donors, users, staff, audit।
  - শেষ ব্যাকআপের অবস্থা দেখাবে।
  - `system_audit_logs` ও অনুপস্থিত টেবিলগুলো `KNOWN_DB_TABLES` ও `BACKUP_MODULE_SPECS`-এ যোগ হবে।
- **N10 এক্সিকিউটিভ BI:**
  - `executive-bi-service.ts`-এ class ও student ম্যাপ দিয়ে "সাধারণ"-এর বদলে আসল শ্রেণির নাম।
  - `boarding.ts`-এর বিল সিঙ্কে আসল `class_id`।
- **N4 বোর্ডিং মিল:** `getStudentsForMeals`-এ `classes(id,name)` join, ফলে "N/A"-এর বদলে শ্রেণির নাম।
- **PB-02/S2:**
  - `assignSubjectToTeacher`: শেয়ার্ড ক্যাটালগ বা `class_subjects`-এ থাকা বিষয় গ্রহণ করবে, আর `resolveTeacherUuid` ব্যবহার করবে। এতে লিগেসি `/dashboard/teachers/[id]/subjects` পেজের error চলে যাবে।
  - `/api/classes/[id]/subjects`-এ দ্রুত `PATCH` হ্যান্ডলার যোগ হবে। `ClassSubjectsManager.tsx` থেকে `keepalive` fetch করা হবে, আর সারি ও উপরের ব্যানারে progress দেখাবে (২০–৩০ সেকেন্ডের বদলে প্রায় তাৎক্ষণিক)।
  - প্রতিটি সেভ নিজের save-guard টোকেন নেবে ও ছাড়বে, আর পেন্ডিং সেভ গোনা হবে।
  - F5/Ctrl+R-এ `preventDefault` সরানো হবে, যাতে ব্রাউজারের নিজস্ব `beforeunload` ডায়ালগ আসে।
  - লিগেসি পেজেও guard যোগ হবে।
- **PB-07 (বাকি):**
  - `lib/portal-sync.ts`-এর `postTeacherEntry`-এ অনলাইন সেভ সফল হলে snapshot-এর `syncedAt` আপডেট হবে এবং একটি sync event dispatch হবে, তাই হেডারের "সিঙ্কড: ..." সাথে সাথে বদলাবে।
  - Attendance, Hifz, ExamMarks ও Kitab ফর্মে স্পষ্ট sticky সাফল্য-টোস্ট দেখাবে।
- **পলিশ (a) বেল ব্যাজ ৩ বনাম প্যানেল ২:**
  - `GlobalNotificationBell.tsx`-এর cache পাথের স্কোপ (teacher/dashboard) অনুযায়ী আলাদা হবে।
  - ব্যাজের সংখ্যা প্যানেলের একই `notifications + readIds` থেকে হিসাব হবে।
  - পড়া হলে সব মাউন্ট করা বেলে broadcast হবে।
- **পলিশ (b) সিলেবাস পূর্বাভাস:**
  - `lib/syllabus.ts`-এ গতি ০ হলে কাল্পনিক ০.৫/দিন আর ধরা হবে না।
  - তখন "গতি ০ (পাঠ শুরু হয়নি)" দেখাবে, অথবা পরিকল্পিত শেষ তারিখ।
  - শুধু পৃষ্ঠাভিত্তিক সিলেবাসে `/10` ভাগ বাদ যাবে।
  - পেজের বিদ্যমান লেআউট (PB-05) অপরিবর্তিত থাকবে।
- **পলিশ (c) শিক্ষক পোর্টালের ছাত্র কার্ড:**
  - `lib/portal/identity.ts`, `students.ts`: prefix পড়া হবে `prefix / short_code / madrasa_info.prefix / id_prefix` থেকে। prefix না থাকলেও `getStudentIdNumber` প্রয়োগ হবে (`480006` → `MUSE-480006`)।
  - `StudentDirectoryClient.tsx`: শ্রেণি না থাকলে fallback, খালি বক্স দেখাবে না।

---

## যাচাই পরিকল্পনা
1. [NEW] `tests/unit/followup4-regressions.test.ts` নিচের বিষয়গুলো পরীক্ষা করবে:
   - হাজিরা: Late ≠ Absent, রেকর্ড না থাকলে Unmarked, শতভাগ উপস্থিতির শর্ত
   - audit FK retry ও fallback
   - early-warning-এ `student_fees` থেকে ঝুঁকি, আর ০ বিশ্লেষিত হলে সঠিক বার্তা
   - পোর্টালের তিন অবস্থা
   - teacher identity স্বাভাবিকীকরণ
   - ফি ফিল্টার
   - মজুদ `<` তুলনা ও `in_stock_qty`
   - হিফজ regex
   - গেটওয়ে ডিফল্ট
   - ব্যাকআপ মডিউল সংখ্যা
   - BI শ্রেণির নাম
   - save-guard টোকেন
   - সিলেবাসে গতি ০
   - `MUSE-` prefix
2. `npm run lint` (tsc) → exit 0; `npm test` → সব পাস (আগের ২২৪টি টেস্টসহ); `npm run build` → exit 0।
3. Chrome দিয়ে মূল পেজগুলো স্মোক টেস্ট: dashboard, absence-alerts, attendance reports, early-warning, portal, teacher-portal/profile, students, hifz report।
4. `main`-এ `--no-ff` মার্জ, আবার lint, তারপর `git push origin main`; শেষে `walkthrough.md` আপডেট।

> [!NOTE]
> লাইভ Supabase ডেটা এই কন্টেইনার থেকে দেখা যায় না। তাই নির্দিষ্ট ছাত্রভিত্তিক সংখ্যাগুলো (সাকিব, সালমান, তাহমিদ, ইউসুফ আলী) যুক্তি ও ইউনিট টেস্ট দিয়ে যাচাই হবে। চূড়ান্ত লাইভ নিশ্চিতকরণ আপনার QA রাউন্ডে।

