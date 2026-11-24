# QawmiERP — পোর্টাল ও অ্যাডমিন বাগ ফিক্স রিপোর্ট (PB-01 থেকে PB-14)
**তারিখ:** ২৪ নভেম্বর ২০২৬  
**রেফারেন্স ফাইল:** `PORTAL_BUGS_FOR_AGENT_2026-11-24.md`  
**স্ট্যাটাস:** ১৪টি বাগের সবকটি (`PB-01` – `PB-14`) কোডবেসে সমাধান করা হয়েছে।

---

## সংক্ষিপ্ত সারসংক্ষেপ

| বাগ আইডি | শিরোনাম | গুরুত্ব | পরিবর্তিত ফাইলসমূহ | স্ট্যাটাস |
| :--- | :--- | :---: | :--- | :---: |
| **PB-01** | স্টুডেন্ট পোর্টাল লগইন ও প্রোফাইল লিংকিং সম্পূর্ণ অচল | CRITICAL | `lib/student-auth.ts`, `app/api/auth/login/route.ts`, `app/actions/auth.ts`, `lib/portal/identity.ts` | ✅ ফিক্সড |
| **PB-02** | বিষয়-শিক্ষক (Subject Teacher) নির্ধারণ ও পোর্টালে পরীক্ষার নম্বর এন্ট্রি অচল | CRITICAL | `app/actions/teacher_subjects.ts`, `app/dashboard/classes/[id]/subjects/page.tsx`, `app/dashboard/classes/[id]/subjects/ClassSubjectsManager.tsx`, `lib/portal/teacher-entry.ts` | ✅ ফিক্সড |
| **PB-03** | শিক্ষক পোর্টালের নোটিফিকেশনে `৳০` এবং অন্য ক্লাসের অপ্রাসঙ্গিক ডেটা লিক | HIGH | `app/actions/notifications.ts` | ✅ ফিক্সড |
| **PB-04** | শিক্ষক ড্যাশবোর্ডের ঝুঁকি মূল্যায়ন কার্ডে বকেয়া ফি হিসাব না করা | MEDIUM | `app/actions/early-warning.ts` | ✅ ফিক্সড |
| **PB-05** | শিক্ষক পোর্টালে সিলেবাস ও পাঠ ট্র্যাকার পেজ সম্পূর্ণ ফাঁকা (`/teacher-portal/syllabus`) | MEDIUM | `app/actions/syllabus.ts`, `app/teacher-portal/syllabus/TeacherSyllabusClient.tsx` | ✅ ফিক্সড |
| **PB-06** | স্টাফ প্রোফাইলের "দায়িত্ব ও ক্লাস" ট্যাবে জিম্মাদার ক্লাস ও বিষয় না দেখানো | MEDIUM | `lib/teacher-identity.ts`, `lib/portal/identity.ts` | ✅ ফিক্সড |
| **PB-07** | অনলাইনে সেভ করার পরেও বিভ্রান্তিকর অফলাইন কিউ বার্তা আটকে থাকা | MEDIUM | `lib/portal-sync.ts`, `app/teacher-portal/hifz/HifzForm.tsx` | ✅ ফিক্সড |
| **PB-08** | অ্যাডমিন হিফজ রিপোর্টে কিতাব বিভাগের ছাত্র ও এন্ট্রিহীন ছাত্রদের ডিফল্ট গ্রেড দেখানো | MEDIUM | `lib/hifz-utils.ts`, `app/actions/hifz.ts` | ✅ ফিক্সড |
| **PB-09** | শিক্ষক পোর্টালে প্রোফাইল, বেতন, লাইব্রেরি ও পাসওয়ার্ড পরিবর্তনের সমন্বিত পেজ যুক্তকরণ | MEDIUM | `app/teacher-portal/profile/page.tsx`, `app/teacher-portal/profile/TeacherProfileClient.tsx`, `app/teacher-portal/TeacherNav.tsx`, `app/teacher-portal/TeacherShell.tsx` | ✅ ফিক্সড |
| **PB-10** | ভর্তি-নিশ্চিতকৃত শিক্ষার্থীর আইডি শিক্ষক পোর্টালে `"—"` দেখানো | LOW | `lib/portal/identity.ts`, `app/teacher-portal/students/StudentDirectoryClient.tsx` | ✅ ফিক্সড |
| **PB-11** | ঝুঁকি মূল্যায়ন কার্ডের "বিস্তারিত রিপোর্ট →" লিংক অ্যাডমিন পেজে রিডাইরেক্ট হওয়া | LOW | `components/EarlyWarningWidget.tsx` | ✅ ফিক্সড |
| **PB-12** | স্বাস্থ্য ও চিকিৎসা মডিউলে শিক্ষকের কাছে পুরো মাদরাসার সব ক্লাসের ছাত্র দেখানো | LOW | `lib/student-health/staff.ts` | ✅ ফিক্সড |
| **PB-13** | ক্লাস বরাদ্দহীন শিক্ষকের পোর্টালে কোনো নির্দেশনামূলক বার্তা না থাকা | LOW | `app/teacher-portal/TeacherDashboardClient.tsx`, `app/teacher-portal/students/StudentDirectoryClient.tsx`, `app/teacher-portal/attendance/AttendanceForm.tsx` | ✅ ফিক্সড |
| **PB-14** | ইউজার ম্যানেজমেন্টে শিক্ষার্থী একাউন্ট বাটন, স্টাফ তালিকা ও অ্যাডমিন পোর্টাল প্রিভিউ সমস্যা | HIGH | `app/dashboard/users/UserManagementClient.tsx`, `app/actions/users.ts`, `lib/portal/identity.ts`, `lib/portal/teacher-entry.ts`, `lib/portal/snapshot.ts`, `lib/portal-data.ts`, `app/teacher-portal/layout.tsx`, `app/portal/layout.tsx`, `app/teacher-portal/page.tsx`, `app/teacher-portal/routine/page.tsx`, `app/teacher-portal/notices/page.tsx`, `app/teacher-portal/hifz/page.tsx` | ✅ ফিক্সড |

---

## প্রতিটি বাগের বিস্তারিত রুট কজ (Root Cause) ও কোড ফিক্স বিবরণী

### ১. PB-01 [CRITICAL] — স্টুডেন্ট পোর্টাল লগইন ও প্রোফাইল লিংকিং
* **সমস্যার মূল কারণ:**
  1. `lib/student-auth.ts`-এর `findStudentByIdentifier()` শুধু `student_${code}@qawmi.app` প্যাটার্ন চিনত। কিন্তু ইউজার ম্যানেজমেন্ট থেকে কাস্টম ইমেইল (`muse-480004@qawmi.app`) বা হাইফেনযুক্ত আইডি (`MUSE-480004`) দিলে তা স্টুডেন্ট প্রোফাইলের সাথে ম্যাচ করত না।
  2. `app/api/auth/login/route.ts` ও `app/actions/auth.ts`-এ স্টুডেন্ট আইডি দিয়ে লগইন করার সময় যদি ইউজার টেবিলে কাস্টম ইমেইল (`muse-480004@qawmi.app`) থাকত, তবে লগইন রাউট শুধু `student_muse480004@qawmi.app` দিয়ে অথেন্টিকেট করার চেষ্টা করত এবং ব্যর্থ হতো।
  3. ইউজার টেবিলে `student_id` কলাম `null` থাকলে লগইন সফল হলেও `/portal`-এ গিয়ে `linkedStudents()` ফাঁকা অ্যারে ফেরত দিত (`"কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি"`)।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `lib/student-auth.ts`: `findStudentByIdentifier()`-এ পূর্ণ ইমেইল (`@` সহ), হাইফেনযুক্ত বা হাইফেনবিহীন আইডি (`MUSE-480004`, `MUSE480004`, `480004`) এবং `users` টেবিলের `student_id` বা নামের মাধ্যমে স্টুডেন্ট প্রোফাইল খুঁজে বের করার লজিক যুক্ত করা হয়েছে।
  - `app/api/auth/login/route.ts` ও `app/actions/auth.ts`: স্টুডেন্টের সাথে লিংককৃত সব সম্ভাব্য ইমেইল (`users.email`, `student_${code}@qawmi.app`, `${rawId}@qawmi.app`) যাচাই করে লগইন সম্পন্ন করার ব্যবস্থা করা হয়েছে এবং লগইনের সময় `users.student_id` ফাঁকা থাকলে তা স্বয়ংক্রিয়ভাবে ডাটাবেজে আপডেট (Auto-heal) করা হয়েছে।
  - `lib/portal/identity.ts`: `linkedStudents()` ফাংশনে যদি `users.student_id` না থাকে, তবে ইউজারের ইমেইল ও নাম থেকে স্টুডেন্ট খুঁজে স্বয়ংক্রিয়ভাবে `users.student_id` লিংক করে স্টুডেন্ট প্রোফাইল লোড করার ফলব্যাক যুক্ত করা হয়েছে।

---

### ২. PB-02 [CRITICAL] — বিষয়-শিক্ষক (Subject Teacher) নির্ধারণ ও পোর্টালে পরীক্ষার নম্বর এন্ট্রি
* **সমস্যার মূল কারণ:**
  1. `app/actions/teacher_subjects.ts`-এ `assignSubjectToTeacher()` ফাংশনটি `classes` ও `subjects` টেবিলে কঠোরভাবে `subjectRow.data.madrasa_id !== finalMadrasaId` চেক করত। গ্লোবাল বা `madrasa_id = null` সাবজেক্ট/ক্লাস থাকলে `"নির্বাচিত জামাত বা কিতাব এই প্রতিষ্ঠানের নয়"` এরর দিয়ে সেভ ব্লক করে দিত।
  2. `getAvailableClassSubjects()`-এ জয়েন (`classes(id, name)`, `subjects(id, name, code)`) কখনো `null` ফেরত দিলে ড্রপডাউনে শুধু `" — "` দেখাত।
  3. `/dashboard/classes/[id]/subjects` পেজে কিতাব যুক্ত করার সময় বা তালিকায় সরাসরি বিষয়-শিক্ষক নির্ধারণের কোনো ড্রপডাউন ছিল না।
  4. `lib/portal/teacher-entry.ts`-এ `teacherExamData()` কঠোরভাবে `exam_subjects` ও `teacher_subjects`-এর হুবহু নাম ম্যাচ করত; জিম্মাদার শিক্ষকের জন্য ক্লাসের কিতাবগুলোর ফলব্যাক ছিল না।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `app/actions/teacher_subjects.ts`:
    - `getAvailableClassSubjects()`-এ `classes` ও `subjects` আলাদাভাবে হাইড্রেট করা হয়েছে যাতে কখনো `" — "` না দেখায়।
    - `assignSubjectToTeacher()`-এ গ্লোবাল বা `null` `madrasa_id` যুক্ত কিতাব/জামাত গ্রহণযোগ্য করা হয়েছে।
    - ক্লাসের বিষয় পেজ থেকে সরাসরি শিক্ষক অ্যাসাইন করার জন্য `getClassTeacherSubjects(classId)` এবং `setClassSubjectTeacher(classId, subjectId, teacherId)` অ্যাকশন যুক্ত করা হয়েছে।
  - `app/dashboard/classes/[id]/subjects/page.tsx` ও `ClassSubjectsManager.tsx`:
    - নতুন কিতাব যুক্ত করার ফর্মে **"বিষয় শিক্ষক (ঐচ্ছিক)"** ড্রপডাউন এবং নিচের তালিকায় প্রতিটি কিতাবের পাশে সরাসরি শিক্ষক নির্বাচন/পরিবর্তন করার ড্রপডাউন যুক্ত করা হয়েছে।
  - `lib/portal/teacher-entry.ts`:
    - `teacherExamData()`-এ বিষয়ের নাম নরমালাইজ (`trim` ও স্পেস ক্লিন) করা হয়েছে এবং জিম্মাদার শিক্ষকের জন্য ক্লাসের বিষয়গুলোর ফলব্যাক যুক্ত করা হয়েছে, যাতে `/teacher-portal/exams`-এ বিষয় ও ছাত্র তালিকা সবসময় লোড হয়।

---

### ৩. PB-03 [HIGH] — শিক্ষক পোর্টালের নোটিফিকেশনে `৳০` এবং অন্য ক্লাসের ডেটা লিক
* **সমস্যার মূল কারণ:**
  - `app/actions/notifications.ts`-এ ফি পেমেন্টের নোটিফিকেশন তৈরির সময় `pay.paid_amount || pay.net_amount || 0` পড়া হচ্ছিল, অথচ পেমেন্ট রেকর্ডে টাকার পরিমাণ `total_amount_received` বা `amount` ফিল্ডে সংরক্ষিত থাকে। ফলে সব রশিদে `৳০` দেখাচ্ছিল।
  - নোটিফিকেশন জেনারেটর শিক্ষকের নিজের জামাত (`t.scope.classes`) চেক না করে পুরো মাদরাসার সব ভর্তি, পেমেন্ট, ডোনেশন ও ইনভেন্টরি নোটিফিকেশন পাঠাচ্ছিল এবং অভিভাবকের পূর্ণ মোবাইল নম্বরও আনমাস্কড অবস্থায় দেখাচ্ছিল।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `app/actions/notifications.ts`:
    - পেমেন্টের পরিমাণ পড়ার ক্রম ঠিক করা হয়েছে: `pay.total_amount_received ?? pay.paid_amount ?? pay.net_amount ?? pay.total_amount ?? pay.amount ?? 0`।
    - শিক্ষক পোর্টালের জন্য (`await webTeacher()`) নোটিফিকেশনগুলো শুধুমাত্র শিক্ষকের বরাদ্দকৃত জামাতের (`t.scope.classes`) শিক্ষার্থীদের মধ্যে সীমাবদ্ধ করা হয়েছে।
    - ভর্তি নোটিফিকেশনে অভিভাবকের ফোন নম্বর মাস্ক (`019******56`) করা হয়েছে এবং সাধারণ শিক্ষকের পোর্টাল থেকে মাদরাসার সামগ্রিক ডোনেশন, ইনভেন্টরি ও অন্যান্য স্টাফদের বেতন নোটিফিকেশন হাইড করা হয়েছে।

---

### ৪. PB-04 [MEDIUM] ও PB-11 [LOW] — ঝুঁকি মূল্যায়ন (Early Warning) কার্ডে বকেয়া ফি ও ডেড লিংক ফিক্স
* **সমস্যার মূল কারণ:**
  - `app/actions/early-warning.ts`-এ শুধু হাজিরা, পরীক্ষার নম্বর এবং হিফজ লগ চেক করা হতো; শিক্ষার্থীর বকেয়া ফি (`fee_invoices` / `fees`) একেবারেই চেক করা হতো না। ফলে বকেয়া থাকা সত্ত্বেও `"আলহামদুলিল্লাহ! কোনো ঝুঁকিপূর্ণ শিক্ষার্থী নেই"` দেখাত।
  - `components/EarlyWarningWidget.tsx`-এ `"বিস্তারিত রিপোর্ট →"` লিংকটি সবসময় `/dashboard/analytics/early-warning`-এ পয়েন্ট করত, যা শিক্ষক পোর্টাল থেকে ক্লিক করলে রিডাইরেক্ট হয়ে যেত।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `app/actions/early-warning.ts`: শিক্ষার্থীর বকেয়া ফি (`meta.fee_invoices` ও SQL `fees`) হিসাব করে বকেয়া থাকলে ঝুঁকি স্কোর ও কারণ (`"বকেয়া ফি: ৳৮,৬০০ (২টি ইনভয়েস)"`) যুক্ত করা হয়েছে।
  - `components/EarlyWarningWidget.tsx`: `isTeacherView === true` হলে `"বিস্তারিত রিপোর্ট →"` লিংকটি `/teacher-portal/students`-এ রাউট করা হয়েছে।

---

### ৫. PB-05 [MEDIUM] — সিলেবাস ও পাঠ ট্র্যাকার পেজ সম্পূর্ণ ফাঁকা (`/teacher-portal/syllabus`)
* **সমস্যার মূল কারণ:**
  - `app/actions/syllabus.ts`-এ শিক্ষকের বরাদ্দকৃত বিষয়ের বিপরীতে আগে থেকে কোনো সিলেবাস রেকর্ড তৈরি না থাকলে `filteredSyllabuses` ফাঁকা আসত।
  - `TeacherSyllabusClient.tsx`-এ `!currentMetrics || !currentSyllabus` হলে কোনো এম্পটি স্টেট না দেখিয়ে নিচের পুরো সেকশন `null` হয়ে যেত।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `app/actions/syllabus.ts`: শিক্ষকের বরাদ্দকৃত বিষয় বা জিম্মাদার ক্লাসের কিতাবগুলোর জন্য কোনো সিলেবাস এন্ট্রি না থাকলে স্বয়ংক্রিয়ভাবে প্রাথমিক সিলেবাস কাঠামো (Auto-bridged syllabus items) তৈরি করে দেওয়ার ব্যবস্থা করা হয়েছে।
  - `app/teacher-portal/syllabus/TeacherSyllabusClient.tsx`: কোনো কিতাব বা সিলেবাস না থাকলে ফাঁকা পেজের বদলে স্পষ্ট বাংলা গাইডলাইন কার্ড দেখানোর ব্যবস্থা করা হয়েছে।

---

### ৬. PB-06 [MEDIUM] — স্টাফ প্রোফাইলের "দায়িত্ব ও ক্লাস" ট্যাবে অসামঞ্জস্যতা
* **সমস্যার মূল কারণ:**
  - `lib/teacher-identity.ts`-এর `resolveTeacherIdentity()` এবং `lib/portal/identity.ts`-এর `teacherScope()`-এ স্টাফ মেটাডেটা (`meta.staff_members`) ও SQL `teachers` টেবিলের মধ্যকার ম্যাচিং শুধুমাত্র `id` বা `email`-এর ওপর নির্ভরশীল ছিল। মুহতামিম বা যেসব শিক্ষকের প্রোফাইল মেটাডেটায় বাংলা নাম বা ফোন নম্বর দিয়ে যুক্ত ছিল, তাদের জিম্মাদার ক্লাস (`meta.class_teachers`) স্টাফ প্রোফাইলে ম্যাচ হচ্ছিল না।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `lib/teacher-identity.ts` ও `lib/portal/identity.ts`: ফোন নম্বর (ডিজিট নরমালাইজড) এবং বাংলা পুরো নামের মাধ্যমে `teachers` ও `staff_members` ক্রস-ম্যাচিং যুক্ত করা হয়েছে এবং `meta.class_teachers?.[c.id]?.teacher_name` দিয়েও জিম্মাদার ক্লাস শনাক্ত করার ব্যবস্থা করা হয়েছে।

---

### ৭. PB-07 [MEDIUM] — অনলাইনে সেভ করার পরেও অফলাইন কিউ বার্তা দেখানো
* **সমস্যার মূল কারণ:**
  - `lib/portal-sync.ts`-এর `postTeacherEntry()`-এ IndexedDB আউটবক্সে আগে থেকে ১টি পুরনো আইটেমও থাকলে (`pending > 0`), নতুন এন্ট্রি সার্ভারকে কল না করে সরাসরি অফলাইন কিউতে ঢুকে যেত এবং `"ডিভাইসে সংরক্ষিত। সংযোগ ফিরলে সিঙ্ক হবে।"` বার্তা দেখাত। এরপর ব্যাকগ্রাউন্ডে সিঙ্ক হয়ে গেলেও `HifzForm.tsx`-এ বার্তাটি আপডেট হতো না।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `lib/portal-sync.ts`: অনলাইন থাকা অবস্থায় `pending > 0` থাকলে প্রথমে `await processOfflineOutbox()` চালিয়ে পুরনো কিউ খালি করা হয়েছে, রিকোয়েস্ট টাইমআউট ১২ সেকেন্ড থেকে ৩০ সেকেন্ড করা হয়েছে এবং কিউতে গেলে সাথে সাথেই সিঙ্ক ড্রেন করার ব্যবস্থা করা হয়েছে।
  - `app/teacher-portal/hifz/HifzForm.tsx`: আউটবক্স কিউ `0` হওয়ার সাথে সাথেই বার্তাটি স্বয়ংক্রিয়ভাবে `"এন্ট্রি সংরক্ষিত ও সিঙ্ক সম্পন্ন হয়েছে।"`-তে রূপান্তরিত হওয়ার `useEffect` যুক্ত করা হয়েছে।

---

### ৮. PB-08 [MEDIUM] — অ্যাডমিন হিফজ রিপোর্টে সব ছাত্রকে "HIFZ" ও ডিফল্ট গ্রেড দেখানো
* **সমস্যার মূল কারণ:**
  1. `lib/hifz-utils.ts`-এ `buildStudentHifzReportFromLogs()` ফাংশনে কোনো লগ না থাকলেও (`ratingScores.length === 0`) ডিফল্টভাবে `qawmi_grade = "জায়্যিদ জিদ্দান (উত্তম)"` সেট করা ছিল।
  2. `app/actions/hifz.ts`-এ `directory()` ও `getMonthlyHifzSummary()` ফাংশনে `classId === "All"` থাকলে কিতাব বিভাগসহ মাদরাসার সব ক্লাসের ছাত্রদের হিফজ তালিকায় নিয়ে আসা হতো এবং `profiles[index]` দিয়ে ভুল ইনডেক্সে প্রোফাইল ম্যাপ করা হচ্ছিল।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `lib/hifz-utils.ts`: কোনো সবক বা লগ না থাকলে (`totalLogDays === 0`) গ্রেড হিসেবে `"প্রযোজ্য নয় (কোনো এন্ট্রি নেই)"` এবং রেটিং `"N/A"` দেখানোর ব্যবস্থা করা হয়েছে।
  - `app/actions/hifz.ts`: ডিফল্ট হিফজ তালিকায় শুধুমাত্র হিফজ/নাজেরা/মক্তব/কায়দা জামাতের ছাত্র অথবা যাদের বাস্তব হিফজ লগ/প্রোফাইল আছে তাদের ফিল্টার করা হয়েছে এবং `student_id` ম্যাপ ব্যবহার করে প্রোফাইল লুকআপ নিখুঁত করা হয়েছে।

---

### ৯. PB-09 [MEDIUM] — শিক্ষক পোর্টালে সমন্বিত প্রোফাইল পেজ (`/teacher-portal/profile`)
* **সমস্যার মূল কারণ:**
  - শিক্ষক পোর্টালে শিক্ষকের নিজস্ব প্রোফাইল, বেতন/পে-স্লিপ, লাইব্রেরি বই ইস্যু রেকর্ড এবং পাসওয়ার্ড পরিবর্তনের কোনো পেজ বা মেনু ছিল না।
* **কীভাবে ফিক্স করা হয়েছে:**
  - নতুন `/app/teacher-portal/profile/page.tsx` ও `/app/teacher-portal/profile/TeacherProfileClient.tsx` তৈরি করা হয়েছে, যেখানে ৪টি সমন্বিত ট্যাব রয়েছে:
    1. **প্রোফাইল ও দায়িত্ব:** ব্যক্তিগত তথ্য, জিম্মাদার জামাত ও বরাদ্দকৃত কিতাবের তালিকা।
    2. **বেতন ও পে-স্লিপ:** মাসিক বেতন কাঠামো এবং পরিশোধিত বেতনের পে-স্লিপ রেকর্ড।
    3. **লাইব্রেরি রেকর্ড:** শিক্ষকের নামে ইস্যুকৃত কিতাব ও ফেরতের স্ট্যাটাস।
    4. **পাসওয়ার্ড পরিবর্তন:** নিজের বর্তমান পাসওয়ার্ড যাচাই করে নতুন পাসওয়ার্ড সেট করার ফর্ম।
  - `TeacherNav.tsx` ও `TeacherShell.tsx`-এ **"প্রোফাইল ও বেতন"** নেভিগেশন লিংক যুক্ত করা হয়েছে।

---

### ১০. PB-10 [LOW] — ভর্তি-নিশ্চিতকৃত শিক্ষার্থীর আইডি `"—"` দেখানো
* **সমস্যার মূল কারণ:**
  - অনলাইন ভর্তি অনুমোদনের পর তৈরি হওয়া কিছু শিক্ষার্থীর `student_id` কলাম ফাঁকা থাকলে `teacherStudents()` ও `StudentDirectoryClient.tsx`-এ `"—"` দেখাত।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `lib/portal/identity.ts`-এর `teacherStudents()`-এ `getStudentIdNumber(s, allTenantStudents, prefix)` দিয়ে সার্ভার-সাইডেই ফরম্যাটেড আইডি (`MUSE-480005` ইত্যাদি) জেনারেট করে দেওয়া হয়েছে এবং `StudentDirectoryClient.tsx`-এ `resolveStudentIdBn(s, idx)` ফলব্যাক যুক্ত করা হয়েছে।

---

### ১১. PB-12 [LOW] — স্বাস্থ্য ও চিকিৎসা মডিউলে শিক্ষকের কাছে সব ক্লাসের ছাত্র দেখানো
* **সমস্যার মূল কারণ:**
  - `lib/student-health/staff.ts`-এর `roster()` ফাংশনটি `madrasa_id` দিয়ে সব ছাত্র লোড করত, লগইনকৃত ইউজার সাধারণ শিক্ষক কি না তা চেক করত না।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `lib/student-health/staff.ts`-এর `roster()` ফাংশনে `await webTeacher()` চেক যুক্ত করা হয়েছে। সাধারণ শিক্ষক হলে শুধুমাত্র তার বরাদ্দকৃত ক্লাসের (`t.scope.classes`) শিক্ষার্থীদের রোস্টার ও হেলথ রেকর্ড দেখানো হবে।

---

### ১২. PB-13 [LOW] — ক্লাস বরাদ্দহীন শিক্ষকের পোর্টালে নির্দেশনামূলক বার্তা
* **সমস্যার মূল কারণ:**
  - যে শিক্ষকের নামে এখনো কোনো জামাত বা কিতাব বরাদ্দ করা হয়নি, তার ড্যাশবোর্ড, হাজিরা ও স্টুডেন্ট ডিরেক্টরিতে শুধু `"কোন শিক্ষার্থী পাওয়া যায়নি"` দেখাত।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `TeacherDashboardClient.tsx`, `StudentDirectoryClient.tsx` এবং `AttendanceForm.tsx`-এ `classes.length === 0` হলে স্পষ্ট বাংলা নির্দেশনামূলক ব্যানার যুক্ত করা হয়েছে:  
    **"আপনার জন্য এখনো কোনো জামাত বা বিষয় বরাদ্দ করা হয়নি — অনুগ্রহ করে মাদরাসা অ্যাডমিনের সাথে যোগাযোগ করুন।"**

---

### ১৩. PB-14 [HIGH] — ইউজার ম্যানেজমেন্ট ও অ্যাডমিন পোর্টাল প্রিভিউ ফিক্স
* **সমস্যার মূল কারণ:**
  1. `/dashboard/users` পেজে `+ শিক্ষক একাউন্ট` ও `+ অভিভাবক একাউন্ট` বাটন থাকলেও `+ শিক্ষার্থী একাউন্ট` তৈরির আলাদা বাটন বা মোড ছিল না।
  2. শিক্ষার্থী সিলেক্ট করলে `handleStudentSelect` সবসময় রোল `"parent"` করে দিত।
  3. লগইন আইডি ইনপুট ফিল্ডটি `type="email"` হওয়ায় ব্রাউজার ভ্যালিডেশন স্টুডেন্ট আইডি (`MUSE-480004`) লিখতে বাধা দিত।
  4. `getLinkableProfiles()` শুধু SQL `teachers` টেবিল থেকে তথ্য আনত, ফলে `meta.staff_members`-এ থাকা মুহতামিম বা অন্যান্য স্টাফ ড্রপডাউনে আসত না।
  5. অ্যাডমিন সাইডবার থেকে `"শিক্ষক পোর্টাল (Teacher)"` বা `"শিক্ষার্থী ও অভিভাবক পোর্টাল"` ক্লিক করলে `app/teacher-portal/layout.tsx` এবং `app/portal/layout.tsx` অ্যাডমিন রোলকে ব্লক করে পুনরায় `/dashboard`-এ রিডাইরেক্ট করে দিত।
* **কীভাবে ফিক্স করা হয়েছে:**
  - `app/dashboard/users/UserManagementClient.tsx`:
    - উপরে **"+ শিক্ষার্থী একাউন্ট"** বাটন এবং মডালে ৪টি ক্যাটাগরি ট্যাব (`শিক্ষক`, `শিক্ষার্থী`, `অভিভাবক`, `কাস্টম / স্টাফ`) যুক্ত করা হয়েছে।
    - লগইন আইডি/ইমেইল ইনপুট ফিল্ডটি `type="text"` করা হয়েছে যাতে স্টুডেন্ট আইডি বা ইমেইল উভয়ই দেওয়া যায়।
    - `handleStudentSelect`-এ শিক্ষার্থী মোড বা `student` রোল সিলেক্ট করা থাকলে রোল `"student"` এবং শিক্ষার্থীর নিজস্ব নাম অক্ষুণ্ণ রাখা হয়েছে।
  - `app/actions/users.ts`: `getLinkableProfiles()`-এ SQL `teachers`-এর সাথে `meta.staff_members` মার্জ করা হয়েছে, যাতে মুহতামিমসহ সকল শিক্ষক ও স্টাফ ড্রপডাউনে প্রদর্শিত হন।
  - `app/teacher-portal/layout.tsx`, `app/portal/layout.tsx`, `lib/portal/identity.ts`, `lib/portal/teacher-entry.ts`, `lib/portal/snapshot.ts` ও `lib/portal-data.ts`: অ্যাডমিন (`super_admin`, `admin`, `muhtamim`) যাতে সাইডবার থেকে সরাসরি শিক্ষক পোর্টাল ও শিক্ষার্থী পোর্টাল প্রিভিউ করতে পারেন তার অনুমতি যুক্ত করা হয়েছে।
