# অ্যাকাউন্ট মডেল (User Account + Accounting) — প্রফেশনাল বাগ অডিট রিপোর্ট

**রিপোজিটরি:** `Saif-Adil-Bro/QawmiERP-V2.0`
**ব্রাঞ্চ:** `arena/2f90858d-qawmierp-v2-0` (বেস কমিট `b145e87`)
**অডিটের ধরন:** স্ট্যাটিক কোড অডিট (Next.js 16 · React 19 · Supabase/Postgres · Server Actions)
**তারিখ:** ১৭ অক্টোবর ২০২৬
**স্কোপ (আপনার নির্দেশ অনুযায়ী):** (১) ইউজার অ্যাকাউন্ট মডেল — auth, users, permissions, role/status, RLS; (২) হিসাব মডিউল — ফি, খরচ, ফান্ড, রিপোর্ট
**পদ্ধতি:** শুধুমাত্র রিপোর্ট (কোনো কোড পরিবর্তন করা হয়নি)

---

## ০. সারসংক্ষেপ (Executive Summary)

মোট **৩৭টি বাগ** পাওয়া গেছে — যার মধ্যে **১০টি ক্রিটিক্যাল** (টাকা হারানো, ভুল আর্থিক রিপোর্ট, বা অ্যাকাউন্ট দখল), **১৪টি হাই**, **৯টি মিডিয়াম**, **৪টি লো**।

সবচেয়ে গুরুত্বপূর্ণ ৫টি:

| # | বাগ | ধরন |
|---|---|---|
| ১ | শিক্ষার্থীর ID + পাসওয়ার্ড `123456` দিলে সিস্টেম নিজেই ওই অ্যাকাউন্টের পাসওয়ার্ড রিসেট করে লগইন করিয়ে দেয় — **প্রি-অথ Account Takeover (লগইনের আগেই অ্যাকাউন্ট দখল)** | নিরাপত্তা |
| ২ | `fee_payment_allocations`-এ প্রতি সেভে **ডুপ্লিকেট row** তৈরি হয় → রিপোর্টে ফি থেকে আয় ক্রমাগত ফুলে ওঠে | আর্থিক ডেটা |
| ৩ | ফি আদায়ে নির্বাচিত **ফান্ড (fund_id/fund_name) কখনো ডেটাবেজে সেভই হয় না** → "ফি কাঠামো ও ফান্ড ম্যাপিং" ফিচারটি রিপোর্টে সম্পূর্ণ নিষ্ক্রিয়, সব ফান্ড ব্যালেন্স ভুল | আর্থিক রিপোর্ট |
| ৪ | হিসাব ও ইউজার ব্যবস্থাপনার **সব server action-এ role/permission চেক নেই** (`if (!user)` ছাড়া কিছু নেই) → অভিভাবক/শিক্ষার্থী অ্যাকাউন্ট থেকেও সরাসরি ফি আদায়, খরচ তৈরি/ডিলিট ও রসিদ বাতিল করা সম্ভব | নিরাপত্তা |
| ৫ | `donations` টেবিলে নেই এমন কলাম (`status`) সিলেক্ট করা হয় + `receipt_no` সিলেক্ট না করা হয় → হয় পুরো অনুদান আয় রিপোর্ট থেকে নীরবে হারিয়ে যায়, নয়তো মাহফিল/দানবাক্স/অনলাইন দান **দুইবার** গোনা হয় | আর্থিক ডেটা |

---

## ১. তীব্রতার শ্রেণীবিভাগ

| লেবেল | অর্থ |
|---|---|
| ⛔ **CRITICAL** | টাকা হারানো/ভুল ব্যালেন্স, অ্যাকাউন্ট দখল, ক্রস-টেন্যান্ট ডেটা লিক — এখনই ঠিক করা দরকার |
| 🔴 **HIGH** | ডেটা ইন্টিগ্রিটি ভাঙে, অডিট ট্রেইল অসম্পূর্ণ, শর্তসাপেক্ষে ডাবল-কাউন্টিং |
| 🟡 **MEDIUM** | নির্দিষ্ট পরিস্থিতিতে ভুল ফলাফল, পারফরম্যান্স, রক্ষণাবেক্ষণযোগ্যতা |
| 🟢 **LOW** | কসমেটিক, এজ-কেস, কোড কোয়ালিটি |

---

# পার্ট ১ — ইউজার অ্যাকাউন্ট মডেল

## ⛔ CR-1 · শিক্ষার্থীর অ্যাকাউন্ট দখল (Pre-auth Account Takeover)

**লোকেশন:** `app/actions/auth.ts:80-105`

```ts
// If student login failed with default password (123456), force password sync and retry
if (error && isStudentLogin && password.trim() === "123456") {
  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const authUser = authUsers?.users?.find((u) => /* email মিল */);
  if (authUser) {
    await adminClient.auth.admin.updateUserById(authUser.id, {
      password: "123456",       // ← জোর করে পাসওয়ার্ড রিসেট
      email_confirm: true,
    });
    const reSync = await supabase.auth.signInWithPassword({
      email: authUser.email || targetEmail,
      password: "123456",       // ← সাথে সাথে লগইন
    });
```

**কী হচ্ছে:** যে কেউ শুধু একটি শিক্ষার্থী আইডি (যেমন `AHH480001`) জানলেই — পাসওয়ার্ড হিসেবে `123456` দিয়ে সাবমিট করলে — সিস্টেম নিজে থেকেই ওই শিক্ষার্থীর আসল পাসওয়ার্ড মুছে `123456` সেট করে এবং সেই রিকোয়েস্টেই লগইন করিয়ে দেয়।

**প্রভাব:** শিক্ষার্থী আগে পাসওয়ার্ড পরিবর্তন করে থাকলেও অ্যাটাকার তার অ্যাকাউন্ট দখল করে ফেলবে। শিক্ষার্থী আইডি মাদ্রাসার রসিদ, ID কার্ড ও তালিকায় প্রকাশ্যে থাকে — তাই এটি বাস্তবে সহজেই শোষণযোগ্য।

**পরোক্ষ ক্ষতি:** `adminClient.auth.admin.listUsers({ perPage: 1000 })` — মাদ্রাসার ১০০০-এর বেশি ইউজার থাকলে টার্গেট ইউজার পাওয়া নাও যেতে পারে; আবার প্রতিবার full user list লোড হয় (পারফরম্যান্স ও গোপনীয়তা দুটোরই সমস্যা)।

**প্রস্তাবিত ফিক্স:** এই "force password sync" ব্লকটি সম্পূর্ণ বাদ দিন। দরকার হলে শুধু মেসেজ দেখান — "পাসওয়ার্ড ভুলে গেলে অভিভাবক শিক্ষার্থীর আইডি দিয়ে কাউন্টার থেকে রিসেট করাবেন।" যদি সাময়িক রিসেট আবশ্যক হয়, তবে (ক) ইমেইল/OTP ভেরিফিকেশন লাগান, (খ) `resetUserPassword`-এর মতো একটি অনুমোদিত কর্মপ্রবাহে নিন, (গ) রিসেটের জন্য দায়ী ইউজারকে অডিট লগে রাখুন।

---

## ⛔ CR-2 · সব Server Action-এ Authorization অনুপস্থিত

**লোকেশন:**
- `app/actions/users.ts:115, 220, 270, 301` (create/update/reset/delete user)
- `app/actions/accounting.ts:253, 356, 457` (create/update/delete expense)
- `app/actions/fee-management.ts:1094` (`collectFeePayment`), `:1835`, `:1981`, `:2135`
- `app/actions/permissions.ts:478, 589, 655`

**কী হচ্ছে:** প্রতিটির শুরুতে কেবল এটুকু আছে —

```ts
const user = await getAuthUser(supabase);
if (!user) return { error: "Unauthorized" };
const finalMadrasaId = await getAuthMadrasaId(supabase, user);
```

অর্থাৎ **লগইন করা = সব অনুমতি**। পুরো কোডবেসে `requirePermission`/`checkPermission` জাতীয় কিছু নেই — `grep` করলে শুধু ক্লায়েন্ট কম্পোনেন্টেই permission চেক পাওয়া যায় (নিচের CR-6 দেখুন)।

**কেন গুরুতর:** RLS পলিসি নিজেই মাদ্রাসার **সব** ইউজারকে অনুমতি দেয় —

```sql
-- supabase_schema.sql:56
CREATE FUNCTION public.get_auth_madrasa_id() ... SELECT madrasa_id FROM public.users WHERE id = auth.uid();

-- supabase_schema.sql:197
CREATE POLICY "Users can manage expenses in same madrasa" ON public.expenses
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
```

`parent` রোলের অভিভাবক পোর্টাল থেকেও একই `madrasa_id` পাওয়া যায়। তাই অভিভাবক/শিক্ষার্থী ব্রাউজার থেকে সরাসরি `collectFeePayment()` বা `deleteExpense()` কল করলে সেটি **সফল হবে** — UI-তে বোতাম লুকানো থাকলেও সার্ভার থামাবে না।

**প্রভাব:** টাকার রেকর্ড তৈরি/বদল/মুছে ফেলা, রসিদ void, ইউজারের পাসওয়ার্ড রিসেট, নিরাপত্তা প্রোফাইল পরিবর্তন — সবই নিম্ন-অনুমতির অ্যাকাউন্ট থেকে সম্ভব।

**প্রস্তাবিত ফিক্স:** প্রতিটি write action-এর শুরুতে অনুমতি যাচাই করুন —

```ts
import { assertPermission } from "@/lib/permissions-server"; // নতুন হেল্পার
await assertPermission("fee.create",  madrasaId, user.id);   // collectFeePayment
await assertPermission("expense.create", madrasaId, user.id); // createExpense
await assertPermission("user.create", madrasaId, user.id);    // createUserAccount
```

`lib/permissions.ts`-এর বিদ্যমান `calculateEffectivePermissions` সার্ভারেই চালিয়ে একটি `requirePermission()` হেল্পার বানানো সবচেয়ে ছোট ও সঠিক সমাধান।

---

## ⛔ CR-3 · Cross-Tenant ডেটা লিক + "Strategy E" ফলব্যাক

**লোকেশন:** `lib/data-access-guards.ts:102-116` এবং `:240-244`

```ts
// :102 — இரண்டু branch-ই একই unfiltered query!
let madrasaStudents: any[] = [];
if (madrasaId) {
  const { data: ms } = await adminClient
    .from("students")
    .select("id, first_name, ..., madrasa_id");     // ← .eq("madrasa_id", madrasaId) নেই
  madrasaStudents = ms || [];
} else {
  const { data: ms } = await adminClient.from("students").select(...); // ← একই
  madrasaStudents = ms || [];
}
```

```ts
// :240 — Strategy E: "Resilient Fallback for Parent / Student users"
if (studentIdsSet.size === 0 && madrasaStudents.length > 0) {
  madrasaStudents.forEach((s) => studentIdsSet.add(s.id)); // ← মাদ্রাসার সব ছাত্র!
}
```

**কী হচ্ছে:** `madrasaId` ফিল্টার কোডে লেখা আছে কিন্তু 실제 query-তে নেই → লাইভ ডেটাবেজের **সব মাদ্রাসার** সব শিক্ষার্থী মেমোরিতে লোড হয়। তারপর ফোন (শেষ ১০ ডিজিট), ইমেইল-প্রিফিক্স বা নামের আংশিক মিলের ভিত্তিতে ম্যাচ করা হয় — অর্থাৎ অন্য মাদ্রাসার শিক্ষার্থীও ম্যাচ হতে পারে। আর কোনো মিল না পেলে Strategy E পুরো মাদ্রাসার সব শিক্ষার্থীর id অ্যাক্সেস-লিস্টে ঢুকিয়ে দেয়।

**প্রভাব:** অভিভাবক পোর্টালে ভুল/অতিরিক্ত শিক্ষার্থীর ফি, হাজিরা, নম্বর, সার্টিফিকেট দেখা যাবে। "নামের আংশিক মিল" যুক্তি (Strategy D: `fName.includes(cLower)`) একই মাদ্রাসায় একই নামের অন্যান্য শিক্ষার্থীর ডেটাও খুলে দেবে।

**প্রস্তাবিত ফিক্স:**
1. `madrasaId` সবসময় `.eq("madrasa_id", madrasaId)` দিয়ে ফিল্টার করুন — `if/else` দুটো শাখাই একই রকম হওয়াটা আসলেই বাগের প্রমাণ।
2. Strategy E ফলব্যাক **সরিয়ে দিন**; মিল না পেলে খালি লিস্ট ফেরত দিন এবং অ্যাডমিনকে "লিংক করা হয়নি" বার্তা/নোটিফিকেশন দিন।
3. ফোন/নাম-ভিত্তিক অনুমান বাদ দিয়ে `students.parent_id` / `users.student_id` / `student_guardians` টেবিলের **প্রকৃত foreign-key সম্পর্ক** ব্যবহার করুন।

---

## ⛔ CR-4 · `SUSPENDED`/`DISABLED` শুধু ক্লায়েন্টে এনফোর্স করা হয়

**লোকেশন:** `lib/permissions.ts:1903`, `components/permissions/PermissionContext.tsx:105-128`

```ts
// components/permissions/PermissionContext.tsx:105
if (summary.status === "SUSPENDED" || summary.status === "DISABLED") return false;
```

**কী হচ্ছে:** অ্যাকাউন্ট স্ট্যাটাস `grep` করলে দেখা যায় — `SUSPENDED`/`DISABLED` শুধু (ক) `calculateEffectivePermissions` (ক্লায়েন্টে চলে) এবং (খ) `PermissionContext`-এ ব্যবহৃত হয়। **Login action, middleware, `app/dashboard/layout.tsx`, অথবা কোনো server action স্ট্যাটাস দেখে না।**

**প্রভাব:** স্থগিত (suspended) ইউজার লগইন করতে পারবে, এবং UI-তে মেনু লুকানো থাকলেও server action সরাসরি কল করে সব ডেটা দেখা/বদল করা যাবে। অর্থাৎ "একাউন্ট বন্ধ" করার কার্যকারিতা কার্যত শূন্য।

**প্রস্তাবিত ফিক্স:**
1. `login()`-এ সফল সাইন-ইনের পরে স্ট্যাটাস চেক করুন — `SUSPENDED`/`DISABLED` হলে সঙ্গে সঙ্গে `signOut()` + বার্তা।
2. `middleware.ts` বা `DashboardLayout`-এও স্ট্যাটাস যাচাই করুন (যাতে আগের সেশন থাকলে পুনঃলগইনে আটকে যায়)।
3. স্ট্যাটাসকে `registration_no` JSON থেকে বের করে `users.status` কলামে আনুন (নিচে HI-6 দেখুন) — তাহলে RLS ও server action উভয়েই যাচাই করা সহজ হবে।

---

## ⛔ CR-5 · `adminClient` চুপচাপ anon key-তে নেমে যায়

**লোকেশন:** `lib/supabase/admin.ts:7`

```ts
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY
                    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
```

**কী হচ্ছে:** 환경ভেরিয়েবল `SUPABASE_SERVICE_ROLE_KEY` না থাকলে "admin" ক্লায়েন্ট **anon key** দিয়ে তৈরি হয়। ডেভেলপমেন্টে কাজ করে বলে কেউ ধরে ফেলে না; কিন্তু production-এ ওই env সেট করা না থাকলে — অথবা `.env` বদলানোর পর — প্রতিটি admin-collection write (fee_payments, student_fees, fee_payment_allocations, donations, users) হয় RLS-আটকানো ব্যর্থ হবে, নয়তো সাইলেন্টলি ভিন্ন আচরণ করবে। `lib/student-auth.ts`, `app/actions/permissions.ts` — সবই `createAdminClient()`-এর উপর নির্ভরশীল।

**প্রস্তাবিত ফিক্স:**

```ts
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!serviceKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is required. Refusing to fall back to the anon key — " +
    "privileged writes would silently fail or bypass RLS expectations."
  );
}
```

শুরুতে fail করলেই বোঝা যাবে; চুপচাপ anon-এ নেমে যাওয়া অনেক বেশি বিপজ্জনক।

---

## ⛔ CR-6 · `PermissionGuard` শুধু DOM লুকায়, ডেটা আগেই সার্ভারে ফেচ হয়ে যায়

**লোকেশন:** `app/dashboard/users/page.tsx:9-32`

```tsx
export default async function UsersPage() {
  const [usersRes, profilesRes, rolesRes, madrasaInfo] = await Promise.all([
    getMadrasaUsers(),        // ← গার্ডের আগেই সব ইউজার লোড
    getLinkableProfiles(),    // ← সব শিক্ষক + সব শিক্ষার্থী
    getMadrasaRolesAndPermissions(),
    getMadrasaInfo(),
  ]);

  return (
    <PermissionGuard permission="user.view">   {/* ← এটি ক্লায়েন্ট কম্পোনেন্ট */}
      <UserManagementClient initialUsers={usersRes.users || []} ... />
    </PermissionGuard>
  );
}
```

**কী হচ্ছে:** `PermissionGuard` একটি `"use client"` কম্পোনেন্ট — এটি শুধু রেন্ডার আটকায়। কিন্তু `getMadrasaUsers()` ইতিমধ্যেই সম্পূর্ণ ইউজার লিস্ট (নাম, ইমেইল, ফোন, রোল, সিকিউরিটি প্রোফাইল) সহ সিরিয়ালাইজ হয়ে RSC পেলোডে ব্রাউজারে চলে গেছে।

**প্রভাব:** যেকোনো লগইন করা ইউজার `/dashboard/users` হিট করে `/dashboard/users?_rsc=...` ডেটা দেখলে অথবা RSC পেলোড ইনস্পেক্ট করলে পুরো ইউজার ডিরেক্টরি ও নিরাপত্তা কনফিগারেশন পেয়ে যাবে। একই প্যাটার্ন অন্যান্য পেজেও সম্ভবত আছে।

**প্রস্তাবিত ফিক্স:** সার্ভারেই অনুমতি যাচাই করুন —

```tsx
const perms = await getCurrentUserPermissions();
if (!perms.summary?.effectivePermissions.includes("user.view")) redirect("/dashboard");
const [usersRes, ...] = await Promise.all([...]);  // শুধু অনুমতি পেলে ফেচ করুন
```

`PermissionGuard` UI-এর জন্য রাখুন, নিরাপত্তার জন্য নয়।

---

## ⛔ CR-7 · `fee_payment_allocations`-এ প্রতি সেভে ডুপ্লিকেট row → রিপোর্টে আয় ফুলে ওঠে

**লোকেশন:** `app/actions/fee-management.ts:297-307`

```ts
if (!pErr && p.allocations && Array.isArray(p.allocations)) {
  for (const a of p.allocations) {
    await adminClient.from("fee_payment_allocations").upsert({   // ← onConflict নেই, id নেই
      payment_id: p.id,
      student_fee_id: a.student_fee_id || null,
      fee_type_name: a.fee_type_name || "",
      allocated_amount: Number(a.allocated_amount) || 0,
      discount_applied: Number(a.discount_applied) || 0,
      fine_applied: Number(a.fine_applied) || 0,
    });
  }
}
```

**কী হচ্ছে:** `fee_payment_allocations` টেবিলের প্রাইমারি কী হলো `id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text` (`supabase_schema.sql:684`) এবং `payment_id`-এর উপর কোনো UNIQUE constraint নেই (`:696` শুধু একটি সাধারণ index)।

`upsert()`-এ কোনো `id` দেওয়া হয়নি, `onConflict` অপশনও দেওয়া হয়নি → Supabase এটিকে `onConflict: "id"` ধরে merge-duplicates করে; কিন্তু payload-তে `id` নেই, তাই Postgres প্রতিবার নতুন UUID জেনারেট করে **নতুন row INSERT** করে।

**প্রভাব (গুরুত্বপূর্ণ):** `saveFeeMetadata` প্রতিটি ফি আদায়, প্রতিটি void এবং প্রতিটি reverse-এ কল হয়, এবং `feeData.payments.slice(0, 100)` — অর্থাৎ **সর্বশেষ ১০০টি পেমেন্টের allocation আবার ইনসার্ট হয়**। ফলে:

- ১০টি ফি আদায় করলে প্রথম পেমেন্টের allocation ১০ বার ডুপ্লিকেট হবে (আয় ≈ ১০×)।
- `getFeeMetadata` (`:135`) প্রতিটি পেমেন্টে **সব** allocation row পড়ে।
- `getAccountingReport` (`app/actions/accounting.ts:700-730`) এবং `getUnifiedIncomeHistory` (`:1220-1265`) এই allocated_amount-গুলো যোগ করে → **মোট আয়, ফান্ড ব্যালেন্স ও টাইপ-ব্রেকডাউন সবই ভুলভাবে ফুলে যায়।**

**প্রস্তাবিত ফিক্স (২ ধাপ):**
1. টেবিলে UNIQUE constraint যোগ করুন:
   ```sql
   ALTER TABLE public.fee_payment_allocations
     ADD CONSTRAINT fee_payment_alloc_unique
     UNIQUE (payment_id, student_fee_id, fee_type_id, billing_period);
   ```
   এরপর `.upsert(payload, { onConflict: "payment_id,student_fee_id,fee_type_id,billing_period" })` ব্যবহার করুন।
2. আদর্শভাবে `saveFeeMetadata`-এ sync করার আগে `delete().eq("payment_id", p.id)` করে নতুন করে ইনসার্ট করুন (replace semantics), অথবা পেমেন্ট সেভ হওয়ার সময়ই শুধু **নতুন/পরিবর্তিত** পেমেন্ট sync করুন (`payments[0]`) — পুরো ১০০টি আবার লিখবেন না।
3. **ডেটা রিকভারি:** সবচেয়ে পুরোনো `created_at` row গুলো রেখে বাকি ডুপ্লিকেট মুছে ফেলুন —
   ```sql
   DELETE FROM public.fee_payment_allocations a
   USING public.fee_payment_allocations b
   WHERE a.payment_id = b.payment_id
     AND a.fee_type_id IS NOT DISTINCT FROM b.fee_type_id
     AND a.student_fee_id IS NOT DISTINCT FROM b.student_fee_id
     AND a.created_at > b.created_at;
   ```

---

## ⛔ CR-8 · ফি থেকে আয়ের **ফান্ড ম্যাপিং** কখনো সেভই হয় না

**লোকেশন:** `app/actions/fee-management.ts:135-146` (read) · `:273-296` (write) · `app/actions/accounting.ts:717-720, 1234-1240`

কোডটি ফি আদায়ের সময় ফান্ড হিসাব করে ও অবজেক্টে বসায়:

```ts
// fee-management.ts — collectFeePayment
finalAllocations.push({
  ..., fund_id: fundInfo.fund_id, fund_name: fundInfo.fund_name,   // ← মেমোরিতে ঠিকঠাক
});
const primaryFundId = paymentData.fund_id || finalAllocations[0]?.fund_id || "fund-general";
const newPayment: FeePayment = { ..., fund_id: primaryFundId, fund_name: primaryFundName };
```

কিন্তু **সংরক্ষণ ও পুনরুদ্ধার — দুই জায়গাতেই ফান্ড ফিল্ড হারিয়ে যায়:**

1. **টেবিলে কলামই নেই:** `supabase_schema.sql:683-696` — `fee_payment_allocations`-এ `fund_id`/`fund_name` নেই; `fee_payments`-এও (`:647-671`) `fund_id` নেই। (কোথাও `ADD COLUMN` মাইগ্রেশনও নেই — `grep -rn "ADD COLUMN" *.sql` শুধু `madrasas` ও `students` দেয়।)
2. **`saveFeeMetadata` সেগুলো লেখেও না** (`:273-296`) — upsert payload-এ `fund_id`/`fund_name` নেই।
3. **`getFeeMetadata` পড়েও না** (`:135-146`) — ম্যাপিং করতে গিয়ে `fund_id`, `fund_name`, `cancellation_reason`, `voided_at`, `voided_by` বাদ পড়ে গেছে।

**ফলাফল:** `app/actions/accounting.ts:717` —

```ts
const targetFundId = alloc.fund_id || p.fund_id;   // ← সবসময় undefined
if (targetFundId) { ... } else {
  if (combined.includes("বোর্ডিং") || ...) addIncomeToFund("fund-lillah", ...);
  else addIncomeToFund("fund-general", ...);        // ← নাম দেখে অনুমান
}
```

অর্থাৎ **সব ফি আয় দুইটি ফান্ডে (General / Lillah) নেমে আসে, ফি-প্রকারের নাম দেখে অনুমান করে।** পেজটি যে "ফি কাঠামো ও ফান্ড ম্যাপিং" (`app/dashboard/accounting/structure/page.tsx`) ফিচারটি তৈরি করেছে — যেখানে প্রতি ফি-প্রকারের জন্য নির্দিষ্ট ফান্ড বেছে দেওয়া যায় — সেটি **রিপোর্টে সম্পূর্ণভাবে নিষ্ক্রিয়**। জাকাত/ফিতরা/এতিম ফান্ডে ম্যাপ করা ফিও সাধারণ ফান্ডে গিয়ে পড়ে → ফান্ড-ভিত্তিক ব্যালেন্স সবসময় ভুল।

**প্রস্তাবিত ফিক্স:**
```sql
ALTER TABLE public.fee_payment_allocations
  ADD COLUMN IF NOT EXISTS fund_id TEXT,
  ADD COLUMN IF NOT EXISTS fund_name TEXT;
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS fund_id TEXT,
  ADD COLUMN IF NOT EXISTS fund_name TEXT;
```
তারপর `saveFeeMetadata`-এর upsert payload-এ ও `getFeeMetadata`-এর ম্যাপিং-এ ফান্ড ফিল্ড যোগ করুন। (ফান্ড নাম-ভিত্তিক অনুমান `resolveFund` শুধু fallback হিসেবে থাকুক।)

---

## ⛔ CR-9 · `collectFeePayment` ক্লায়েন্টের পাঠানো টাকার অঙ্ক ও allocation অন্ধভাবে বিশ্বাস করে

**লোকেশন:** `app/actions/fee-management.ts:1282, 1336-1348`

```ts
let amountToDistribute = Number(paymentData.total_amount) || 0;   // :1282 ক্লায়েন্টের সংখ্যা
...
const allocCash = Number(alloc.allocated_amount) || 0;            // :1334 ক্লায়েন্টের সংখ্যা
if (allocCash > 0 || allocDiscount > 0) {
  finalAllocations.push({ ..., allocated_amount: allocCash, ... });
  ...
  const newPaid = Number(target.paid_amount || 0) + allocCash;     // :1344 invoice পেমেন্ট হিসেবে গণ্য
```

**কী হচ্ছে:** সার্ভার কখনো যাচাই করে না যে (ক) allocation-গুলোর যোগফল `total_amount`-এর সমান কি না, (খ) `total_amount` আসলেই গ্রহণ করা হয়েছে কি না, (গ) `discount_amount` কে অনুমোদন করেছে। সবকিছু FormData/JSON থেকে সরাসরি আসে।

**প্রভাব:** ডেভেলপার টুল দিয়ে অথবা ক্ষতিকর ক্লায়েন্ট স্ক্রিপ্ট দিয়ে `total_amount: 100` কিন্তু একটি invoice-এ `allocated_amount: 50000` পাঠালে ওই invoice সম্পূর্ণ PAID হয়ে যাবে — যদিও ক্যাশে মাত্র ১০০ টাকা এসেছে। একইভাবে `discount_amount` ইচ্ছামতো পাঠিয়ে হাজারো টাকার ছাড় অনুমোদনহীনভাবে দেওয়া যাবে (`fee_discount_waivers`/`FEE_DISCOUNT` পারমিশন সম্পূর্ণ বাইপাস)।

**প্রস্তাবিত ফিক্স:** সার্ভারে পুনঃগণনা ও যাচাই —

```ts
const allocTotal = (paymentData.fee_allocations ?? []).reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
if (Math.abs(allocTotal - Number(paymentData.total_amount)) > 0.01) {
  return { error: "মোট আদায় ও খাতভিত্তিক বণ্টনের যোগফল মিলছে না।" };
}
// প্রতিটি invoice-এর due_amount সার্ভারেই ডেটাবেজ থেকে পড়ে সীমা যাচাই করুন
if (allocCash > Number(sf.due_amount) + 0.01) return { error: "নির্ধারিত বকেয়ার চেয়ে বেশি বণ্টন।" };
// discount সবসময় অনুমোদনের পরই
if (Number(paymentData.discount_amount) > 0) await assertPermission("fee.discount", ...);
```

---

## ⛔ CR-10 · `donations` query — নেই এমন কলাম সিলেক্ট + দরকারি কলাম বাদ → আয় হারানো / দুইবার গোনা

**লোকেশন:** `app/actions/accounting.ts:519-521` ও `:687`

```ts
const { data: donationsData, error: donErr } = await supabase
  .from("donations")
  .select("id, amount, donation_type, donation_date, notes, created_at, status")  // :520
  .eq('madrasa_id', finalMadrasaId)
  .gte("donation_date", startDate)
  .lte("donation_date", endDate);

if (donErr) console.error("Error fetching donations for report:", donErr);  // ← চুপচাপ চলে যায়

...

// :687 —But receipt_no কখনো select করা হয়নি!
monthlyDonations.forEach((d: any) => {
  if (d.id) trackedDonationKeys.add(d.id);
  if (d.receipt_no) trackedDonationKeys.add(d.receipt_no);   // ← মৃত কোড
```

**সমস্যা — দুই প্রান্তেই ভুল:**

1. **`status` কলাম:** `supabase_schema.sql:333-343` অনুযায়ী `donations` টেবিলে `status` কলাম **নেই** (কোথাও ADD COLUMN নেই)। যদি লাইভ ডেটাবেজেও না থাকে, Postgres পুরো query ফেল করবে → `donationsData = null` → **মাসিক রিপোর্ট থেকে সব অনুদান/যাকাত আয় নীরবে উধাও** (শুধু `console.error`, ইউজার কিছুই বুঝবে না)। বিপরীতে `app/actions/zakat.ts:2278` এই `status` কলাম **লেখে**, এবং `fundraising.ts:847, 1571, 1870, 2336` metadata আকারে একই দান `donations` টেবিলে sync করে — অর্থাৎ এটি সত্যিই আছে কি নেই, তা migration ছাড়াই ধরে নেওয়া হয়েছে। **(স্কিমা-ড্রিফট — নিচে MD-1 দেখুন।)**

2. **`receipt_no` সিলেক্ট না করা:** `trackedDonationKeys`-এ শুধু `id` আর `notes` থেকে regex-পার্স করা রসিদ নম্বর ঢোকে। কিন্তু `:760, 767, 803, 814, 826, 838` — মাহফিল receipt-book, ডোনার সাবস্ক্রিপশন, দানবাক্স, অনলাইন দান ও চামড়া — সবগুলো ডুপ্লিকেট চেক করে **রসিদ নম্বর** দিয়ে (`!trackedDonationKeys.has(recNo)`)। যেহেতু donation row-এর `receipt_no` সেটে কখনো ঢোকেনি, ওই দানগুলো `donations` টেবিলে আগেই থাকলেও **metadata থেকেও আবার যোগ হয়ে যায় → ডাবল কাউন্টিং** (মাহফিল উত্তোলন, দানবাক্স, অনলাইন গেটওয়ে, আজীবন সদস্য, কুরবানির চামড়া — সব ক্ষেত্রেই)।

**প্রস্তাবিত ফিক্স:**
```ts
.select("id, amount, donation_type, donation_date, notes, created_at, receipt_no") // status বাদ, receipt_no যোগ
```
`status` দরকার হলে আগে মাইগ্রেশন দিয়ে কলামটি যোগ করুন, তারপর select-এ ফেরান। আর `donErr` পেলে ফাংশন থেকে ত্রুটি রিটার্ন করুন — চুপচাপ শূন্য আয় দেখানো কখনোই ঠিক নয়।

---

## 🔴 HI-1 · রসিদ void/reverse করলে ডিসকাউন্ট ফেরত আসে না → বকেয়া কম দেখায়

**লোকেশন:** `app/actions/fee-management.ts:1860-1900` (reverse) এবং `:2010-2050` (void)

```ts
for (const alloc of payment.allocations || []) {
  if (alloc.student_fee_id) {
    const target = studentFees[feeIdx];
    const newPaid = Math.max(0, Number(target.paid_amount || 0) - Number(alloc.allocated_amount || 0));
    const newDue  = Math.max(0, Number(target.payable_amount || 0) - newPaid);
    // ↑ discount_amount ছোঁয়াই হয় না!
```

কিন্তু `collectFeePayment:1336-1340` একই payment-এ `discount_amount` বাড়ায়:
```ts
const newDiscount = Number(target.discount_amount || 0) + allocDiscount;
const newPayable  = Math.max(0, baseAmt + fineAmt - newDiscount);
```

**কী হচ্ছে:** আদায়ের সময় ডিসকাউন্ট invoice-এর `discount_amount`/`payable_amount`-এ স্থায়ীভাবে লেখা হয়, কিন্তু বাতিলের সময় শুধু `paid_amount` ফেরানো হয় — `discount_amount` ফেরানো হয় না।

**উদাহরণ:** base ১০০০, ছাড় ২০০ → payable ৮০০, পরিশোধ ৮০০ → due ০ (PAID)। রসিদ void করলে হবে: `newPaid = 0`, `newDue = 800 - 0 = 800`। **কিন্তু বাস্তবে ছাড়ও বাতিল হওয়া উচিত ছিল → সঠিক বকেয়া ১০০০।** ফলে ২০০ টাকা চিরতরে বকেয়া থেকে হারিয়ে যায়। ভুলভাবে দেওয়া রসিদ বাতিল করে আবার নেওয়ার সবচেয়ে সাধারণ প্রবাহে এটি সরাসরি টাকা হারানোর কারণ।

একই সমস্যা reverse path-এও (`:1860` এলাকা)।

**প্রস্তাবিত ফিক্স:** void/reverse উভয় জায়গায় discount-ও ফেরান, এবং মূল discount কত ছিল তার একটি snapshot পেমেন্ট রেকর্ডে রাখুন:
```ts
const revertedDiscount = Number(alloc.discount_applied ?? 0);
const newDiscount = Math.max(0, Number(target.discount_amount || 0) - revertedDiscount);
const newPayable  = Math.max(0, baseAmt + fineAmt - newDiscount);
const newPaid     = Math.max(0, Number(target.paid_amount || 0) - Number(alloc.allocated_amount || 0));
const newDue      = Math.max(0, newPayable - newPaid);
```
(ব্যবসায়িক নিয়ম ভিন্ন হলে — যেমন ছাড় বাতিল না হওয়া — অন্তত একটি নোটিশ/লগ দেখান।)

---

## 🔴 HI-2 · ১৫ সেকেন্ডের "ডুপ্লিকেট গার্ড" বৈধ দ্বিতীয় পেমেন্ট গিলে ফেলে

**লোকেশন:** `app/actions/fee-management.ts:1130-1160`

```ts
const fifteenSecsAgo = new Date(Date.now() - 15000).toISOString();
...
const recentMatch = recentPayments.find(
  (p: any) => Math.abs(Number(p.total_amount_received) - Number(paymentData.total_amount)) < 0.01
);
if (recentMatch) {
  return { success: true, receipt_no: recentMatch.receipt_no, ... };   // ← নতুন রসিদ তৈরি হয় না
}
```

**কী হচ্ছে:** একই শিক্ষার্থী ১৫ সেকেন্ডের মধ্যে একই অঙ্কের দুইটি **আসল** পেমেন্ট করলে (যেমন দুই মাসের ফি একসাথে দুইবার, বা দুই ভাইয়ের জন্য পরপর একই অঙ্ক) দ্বিতীয়টি সম্পূর্ণ বাদ পড়ে — কিন্তু UI-তে "সফল" দেখানো হয় পুরোনো রসিদ নম্বর দেখিয়ে। ক্যাশ টেবিলে জমা হয় কিন্তু কোনো নতুন `fee_payments` রেকর্ড বা রসিদ তৈরি হয় না — ফলে **নগদ ও হিসাবের মধ্যে ১৫ সেকেন্ডের সব দ্বিতীয় লেনদেনের ব্যবধান**।

উল্লেখ্য, স্কিমাতে ঠিক এই কাজের জন্যই `fee_payments.idempotency_key VARCHAR(150)` কলামটি আছে (`supabase_schema.sql:668`) — কিন্তু কোডে **কখনো ব্যবহারই করা হয় না**।

**প্রস্তাবিত ফিক্স:**
1. ক্লায়েন্ট থেকে একটি `idempotency_key` (যেমন `crypto.randomUUID()`) নিন; একই key থাকলে সেটি ignore করুন — সময়/অঙ্ক-ভিত্তিক অনুমান বাদ।
2. অথবা গার্ডটি শুধু ক্লায়েন্ট-ট্রিগার করা `isRetry` ফ্ল্যাগ থাকলে চালু করুন।
3. দ্বিতীয় পেমেন্ট ব্লক করলে ব্যবহারকারীকে স্পষ্টভাবে দেখান: "১৫ সেকেন্ড আগে একই অঙ্কের রসিদ তৈরি হয়েছে — সেটি ব্যবহার করুন, নাকি নতুন রসিদ চান?"

---

## 🔴 HI-3 · ভাউচার নম্বর `count()` দিয়ে তৈরি → ডিলিট করলেই ডুপ্লিকেট

**লোকেশন:** `app/actions/accounting.ts:216-245` (`getNextExpenseVoucherNo`) ও `:246-290` (`createExpense`)

```ts
const { count: expCount } = await supabase
  .from("expenses").select("id", { count: "exact", head: true })
  .eq("madrasa_id", finalMadrasaId)
  .gte("expense_date", startOfMonth).lte("expense_date", endOfMonth);
const nextSeq = String((expCount || 0) + 1).padStart(3, "0");
const voucherNo = `EXP-${yy}${mm}-${nextSeq}`;
```

**কী হচ্ছে:** সিরিয়াল নম্বর "কতটি সারি আছে" থেকে বের করা হয়। ফলে—
- ০০১, ০০২, ০০৩ তৈরি করার পর ০০২ ডিলিট করলে count = ২ → **পরেরটি আবার ০০৩** → ডুপ্লিকেট ভাউচার।
- একই মুহূর্তে দুইজন খরচ এন্ট্রি করলে দুজনেই একই count পড়ে **একই ভাউচার নম্বর** পাবে (race condition)।
- `expenses` টেবিলে `voucher_no` কলাম নেই, কোনো UNIQUE constraint নেই — তাই ডুপ্লিকেট আটকানোর কোনো উপায় নেই।

**প্রভাব:** অডিট, ভাউচার-ভিত্তিক প্রিন্ট ও ব্যাংক মিলানোর জন্য ভাউচার নম্বর অচল; একই নম্বরের দুইটি ভিন্ন খরচের রশিদ।

**প্রস্তাবিত ফিক্স:**
```sql
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS voucher_no TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_voucher
  ON public.expenses (madrasa_id, voucher_no) WHERE voucher_no IS NOT NULL;
```
তৈরি করুন একটি সিকোয়েন্স/কাউন্টার টেবিল ( বা `MAX(...)+1` একটি transaction-এ, retry সহ) এবং unique-violation ধরা পড়লে পুনরায় চেষ্টা করুন। `getNextExpenseVoucherNo`-এর মতো read-only প্রিভিউ নম্বর শুধু UI hint হিসেবে দেখান, চূড়ান্ত নম্বর নির্ধারিত হোক DB-তে insert করার মুহূর্তে।

---

## 🔴 HI-4 · খরচ তৈরি/আপডেটে "try → fail → fallback" প্যাটার্ন → ডুপ্লিকেট খরচের ঝুঁকি

**লোকেশন:** `app/actions/accounting.ts:300-350` (create) ও `:400-440` (update)

```ts
const { data: directData, error: directError } = await supabase
  .from("expenses").insert(recordWithFundCol).select().single();   // fund_id/fund_name/voucher_no সহ
if (directError) {
  const { data: retryData, error: retryError } = await supabase
    .from("expenses").insert(fallbackRecord).select().single();    // কলাম ছাড়া
```

**কী হচ্ছে:** `supabase_schema.sql:202-210` অনুযায়ী `expenses` টেবিলে `fund_id`, `fund_name`, `voucher_no` কলাম **নেই** (কোনো ADD COLUMN মাইগ্রেশনও নেই)। তাই **প্রতিবার প্রথম insert-টাই ব্যর্থ হয়**, তারপর দ্বিতীয়টি সফল হয়। দুইটি আলাদা round-trip, প্রতিবার console-এ error, এবং—

- নেটওয়ার্ক টাইমআউটের ক্ষেত্রে প্রথম request সার্ভারে পৌঁছে row তৈরি করলেও ক্লায়েন্ট error পেতে পারে → fallback আবার insert করলে **দুইটি একই খরচ**।
- `update`-এও একই প্যাটার্ন; প্রথম update ব্যর্থ হয়ে দ্বিতীয়টিতে "fund/voucher" তথ্য হারায় — অর্থাৎ ফান্ড পরিবর্তন কখনো রেকর্ড হয় না।

**প্রস্তাবিত ফিক্স:** আগে মাইগ্রেশন চালিয়ে কলামগুলো যোগ করুন, তারপর split-fallback কোডটি মুছে দিন — একটি insert, একটি সত্যিকারের schema।

---

## 🔴 HI-5 · `deleteExpense` হার্ড ডিলিট — অডিট ট্রেইল শূন্য

**লোকেশন:** `app/actions/accounting.ts:454-480`

```ts
const { error } = await supabase.from("expenses").delete()
  .eq("id", expenseId).eq("madrasa_id", finalMadrasaId);
```

**কী হচ্ছে:** ফি পেমেন্ট বাতিল হলে চমৎকার soft-delete + audit log হয় (VOID + `fee_audit_logs`), কিন্তু খরচ **সম্পূর্ণ মুছে যায়** — কে মুছলো, কখন, কেন, আগের অঙ্ক কত ছিল — কোনোটাই থাকে না।

**প্রভাব:** আর্থিক দুর্নীতি শনাক্ত করা অসম্ভব; মাদ্রাসার অডিট/রিভিউ-তে বড় ফাঁক। এছাড়া HI-3-এর ডুপ্লিকেট ভাউচারের সাথে মিলে হিসাব মেলানো আরও কঠিন হয়।

**প্রস্তাবিত ফিক্স:** `expenses.status` (`ACTIVE`/`VOID`) + `voided_at`, `voided_by`, `void_reason` কলাম যোগ করে soft-delete করুন এবং `fee_audit_logs`-এর মতো একটি `expense_audit_logs` লিখুন। (অথবা অন্তত বিদ্যমান `activity-logs` মডিউলে লিখুন।)

---

## 🔴 HI-6 · ইউজার স্ট্যাটাস ও সেশন ব্লব `madrasas.registration_no`-তে পড়ে আছে

**লোকেশন:** `app/actions/permissions.ts:35-59, 61-107` · `lib/sessions.ts:213-262`

```ts
// permissions.ts:100
.update({ registration_no: JSON.stringify(newMeta) })   // ← পুরো কলামটি JSON দিয়ে ওভাররাইট
```

```ts
// lib/sessions.ts:250 — fee/session মেটাডেটাও একই কলামে
.update({ registration_no: jsonStr })
```

**সমস্যা তিনটি:**

1. **ডেটা ধ্বংস:** `registration_no` আসলে মাদ্রাসার নিবন্ধন নম্বর সংরক্ষণের কলাম। প্রতি বার পারমিশন প্রোফাইল, কাস্টম রোল, ফি মেটাডেটা বা সেশন মেটাডেটা সেভ হলে কলামটি JSON দিয়ে **সম্পূর্ণ ওভাররাইট** হয় → মাদ্রাসার প্রকৃত নিবন্ধন নম্বর হারিয়ে যায় (যদিও আলাদা `reg_no` কলাম আছে — `supabase_phase_b_migration.sql:13`)। `app/actions/audit.ts:724` — এই ক্ষতির প্রতিরক্ষামূলক কোডই প্রমাণ: `!(...).startsWith("{") ? ... : ""`।
2. **Lost update রেস:** `saveMadrasaSecurityStore` read → mutate → write করে কোনো lock/version ছাড়াই। দুইজন অ্যাডমিন একসাথে রোল সম্পাদনা করলে একজন আরেকজনের পরিবর্তন মুছে দেবে (আর `security_audit_logs`/`custom_roles` নিঃশব্দে হারাবে)।
3. **স্কেলিং:** JSON কলামে অ্যাডমিন/approval/audit ডেটা রাখা — `.slice(0, 150)`/`.slice(0, 250)` দিয়ে ট্রেল কেটে ফেলা হচ্ছে (permissions.ts:94-95), অর্থাৎ পুরোনো অডিট লগ চিরতরে মুছে যায়।

**প্রস্তাবিত ফিক্স:** যথাযথ টেবিল তৈরি করুন — `user_security_profiles`, `custom_roles`, `security_audit_logs`, `approval_requests`। ততদিন পর্যন্ত হলেও একটি নিবেদিত `madrasas.security_metadata JSONB` কলামে সরান, এবং updater-এ optimistic concurrency (`updated_at` মিলিয়ে `.eq("updated_at", expected)`) ব্যবহার করুন। আর `registration_no`-এ কখনো JSON লিখবেন না।

---

## 🔴 HI-7 · Middleware — টোকেনে থাকা ক্ষণস্থায়ী role ট্রাস্ট + soft-navigation চেক সম্পূর্ণ বাইপাস

**লোকেশন:** `middleware.ts:108` ও `:51-53`

```ts
// :108 — redirect সিদ্ধান্ত metaডেটা থেকে
const userRole = user.user_metadata?.role;
if (userRole === 'teacher' || ...) targetPath = '/teacher-portal';
else if (userRole === 'parent' || ...) targetPath = '/portal';
```

```ts
// :51 — RSC হেডার থাকলে সব auth চেক বাদ
const isSoftNavigation = request.headers.get("RSC") === "1";
if (isSoftNavigation && !isApiRoute) return supabaseResponse;
```

**(ক) `user_metadata` ট্রাস্ট:** `user_metadata` ব্যবহারকারী নিজেই লিখতে পারেন (`supabase.auth.updateUser({ data: { role: "teacher" } })`)। তাই role-ভিত্তিক রাউটিং (কার পোর্টালে যাবে) সহজেই বদলে ফেলা যায়। শিক্ষার্থী-টোকেনের role বদলে `/portal`-এর বদলে `/dashboard`-এ পাঠানো সম্ভব — এবং CR-6/CR-2 অনুযায়ী সেখানে ডেটা সুরক্ষার দ্বিতীয় প্রাচীরও নেই। **role নেওয়া উচিত `public.users.role` (DB) থেকে, কখনোই টোকেন মেটাডেটা থেকে নয়।**

**(খ) `RSC: 1` বাইপাস:** হেডারটি ক্লায়েন্ট-নিয়ন্ত্রিত; `curl` দিয়ে `RSC: 1` পাঠালে যে কেউ auth-chck সম্পূর্ণ বাদ দিয়ে `/dashboard`-এর RSC পেলোড চেয়ে নিতে পারে। স্ক্রল-এর কমেন্টে বলা হয়েছে "individual server actions/pages still do their own auth checks" — কিন্তু বাস্তবতা হলো হাজার হাজার server action-এর মধ্যে শুধু `if (!user)` আছে এবং কোনো permission চেক নেই (CR-2), আর middleware-ই একমাত্র সার্ভার-লেভেল দরজা।

**প্রস্তাবিত ফিক্স:** (১) middleware-এ `user_metadata` নয়, DB থেকে role আনুন (অথবা অন্তত ট্রাস্ট করবেন না)। (২) `isSoftNavigation` বাইপাস সরিয়ে ফেলুন; পারফরম্যান্সের জন্য বদলে `getClaims()`-এর মতো লোকাল JWT যাচাই ব্যবহার করুন (নেটওয়ার্ক রাউন্ড-ট্রিপ ছাড়াই)।

---

## 🔴 HI-8 · `getMadrasaUsers` — সাধারণ অ্যাডমিন `madrasa_id IS NULL` ইউজারদের নিজের মাদ্রাসায় "দখল" করে নেয়

**লোকেশন:** `app/actions/users.ts:41-68`

```ts
let { data: users } = await adminClient.from("users").select("*")
  .or(`madrasa_id.eq.${madrasaId},madrasa_id.is.null`)     // ← RLS বাইপাস করে anon/সব null ইউজার
  .order("created_at", { ascending: false });
...
const nullMadrasaUsers = (users || []).filter((u: any) => !u.madrasa_id);
if (nullMadrasaUsers.length > 0) {
  await adminClient.from("users").update({ madrasa_id: madrasaId })   // ← স্থায়ীভাবে দখল
     .in("id", nullMadrasaUsers.map((u: any) => u.id));
}
```

**কী হচ্ছে:** `adminClient` (service role) Firebase-এর মতো tenant ফিল্টার ছাড়াই **প্লাটফর্মের সব madrasa_id-null ইউজার** ফেরত দেয় — স্ব-প্রমাণিত কারণ `.or(...is.null)` এবং admin client। তারপর যেই অ্যাডমিন পেজটি খোলেন, সেই অ্যাডমিনই এই ইউজারগুলোর মালিকানা নিয়ে নেন। অ্যাডমিন PII (নাম, ইমেইল, ফোন, role) দেখতে পান এবং PII অন্যদের থেকে নিজের মাদ্রাসায় টেনে নেন।

**প্রস্তাবিত ফিক্স:** `.or(...)` সরিয়ে `is.null` কেস আলাদা করুন — null থাকলে অ্যাডমিনকে দেখান "অ্যাসাইনমেন্ট প্রয়োজন", স্বয়ংক্রিয়ভাবে দখল করবেন না। এবং auto-repair ধাপটি কেবল সুপার অ্যাডমিনের জন্য বা নোটিফিকেশনসহ রাখুন।

---

## 🔴 HI-9 · প্রথম ইউজার স্বয়ংক্রিয়ভাবে `super_admin` হয়ে যান (bootstrap race)

**লোকেশন:** `app/actions/students.ts:230-255`

```ts
const { count } = await adminClient.from("madrasas").select("id", { count: "exact", head: true });
if (count === 0 && user?.id) {
  const { data: newMadrasa } = await adminClient.from("madrasas").insert({ name: "কওমি মাদরাসা", ... });
  await adminClient.from("users").upsert({ id: user.id, madrasa_id: newMadrasa.id, role: "super_admin" });
```

**কী হচ্ছে:** ডেটাবেজে একটি madrasa-ও না থাকলে **যে কেউ** লগইন করলে স্বয়ংক্রিয়ভাবে মাদ্রাসা তৈরি হয় এবং সে `super_admin` হয়ে যায়। দ্বিতীয়-তৃতীয় লগইন একে অপরের সাথে প্রতিযোগিতা করে count === 0 দেখতে পায় (TOCTOU), তাই একাধিক super_admin তৈরি হতে পারে। এছাড়া কেউ ইচ্ছাকৃতভাবে সব madrasa মুছে দিলে যে কেউ প্রথম লগইন করেই আজীবন admin হয়ে যাবে।

**প্রস্তাবিত ফিক্স:** bootstrap কেবল একটি নিরাপদ migration/seed-এর মাধ্যমে, অথবা `SETUP_TOKEN` env দিয়ে সুরক্ষিত একটি ওয়ান-টাইম রুট দিয়ে করুন — সাধারণ লগইন থেকে কখনোই নয়।

---

## 🔴 HI-10 · `resetUserPassword` — কোনো madrasa স্কোপ নেই (ক্ষতিকর ইউজার নিজেই অ্যাডমিন হতে পারে)

**লোকেশন:** `app/actions/users.ts:270-295`

```ts
export async function resetUserPassword(userId: string, newPassword: string) {
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
  if (!newPassword || newPassword.length < 6) return { error: "..." };
  // ← madrasaId নেই, `if (user.id === userId)` নেই, role চেক নেই — শুধু সোজা:
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
```

তুলনায়— `updateUserAccount` (`users.ts:252`) ও `deleteUserAccount` (`users.ts:322`) অন্তত `.eq("madrasa_id", madrasaId)` দিয়ে scope করে; `deleteUserAccount` নিজেকে মুছতে বাধা দেয়।

**চরম পরিণতি:** একটি কম-অনুমতির অ্যাকাউন্ট (যেমন suspension-এর আগে কেউ) `resetUserPassword(<super_admin_এর_UUID>, "নতুনপাসওয়ার্ড")` কল করে **মাদ্রাসার সুপার অ্যাডমিনের পাসওয়ার্ড সেট করতে পারবে** → সম্পূর্ণ দখল। অথবা অন্য madrasa-র যেকোনো ইউজার, কেবল UUID জানলে।

**প্রস্তাবিত ফিক্স:** এই লাইনগুলো যোগ করুন —
```ts
if (user.id === userId) return { error: "নিজের পাসওয়ার্ড 'আমার প্রোফাইল' থেকে বদলান।" };
const madrasaId = await getAuthMadrasaId(supabase, user);
const { data: target } = await adminClient.from("users")
  .select("id, role").eq("id", userId).eq("madrasa_id", madrasaId).maybeSingle();
if (!target) return { error: "ইউজার পাওয়া যায়নি।" };
await assertPermission("user.reset_password", madrasaId, user.id);
if (target.role === "super_admin" && user.id !== target.id) {
  await assertPermission("user.manage_super_admin", madrasaId, user.id);
}
```

---

## 🔴 HI-11 · রসিদ নম্বর জেনারেশনে রেস কন্ডিশন → legacy orphan row

**লোকেশন:** `app/actions/fee-management.ts:25-80` (জেনারেটর), `:1540-1580` (insert order)

জেনারেটর read-then-write: সর্বোচ্চ `receipt_no` পড়ে (`:37-45`) → `+1` → মাঝখানে একটি unique-check (`:60-70`) → ফেরত। দুইজন ক্যাশিয়ার একসাথে ফি আদায় করলে দুজনেই একই count পড়তে পারেন; `UNIQUE(madrasa_id, receipt_no)` (`supabase_schema.sql:669`) দ্বিতীয়টিকে ফেলে দেবে। কিন্তু—

```ts
// :1542 — legacy fees row আগে insert হয় (সার্ভার-সাইড error মানে না)
const { data: dbFee } = await supabase.from("fees").insert({ ..., notes: `[রিসিট: ${receiptNo}] ...` });
// :1571 — তারপর:
const saved = await saveFeeMetadata(madrasaId, { student_fees, payments, ... });
if (!saved) return { error: "... (টাকা জমা হিসেবে গণ্য হয়নি)" };   // ← fees row তো রয়ে গেল!
```

**ফলাফল:** ব্যর্থতার ক্ষেত্রে `fees` টেবিলে একটি লেজেন্ডারি row থেকে যায় যার কোনো `fee_payments` রেকর্ড নেই। `getFeeDashboardOverview:2495-2520` এই "untracked" row-কে বৈধ আয় হিসেবে ধরে নেয় → **যে পেমেন্ট সিস্টেম নিজেই "জমা হয়নি" বলেছে, সেটি ড্যাশবোর্ডে আয় হিসেবে দেখাবে** — আয় ও রসিদের মধ্যে ব্যবধান।

**প্রস্তাবিত ফিক্স:** ক্রম উল্টান — আগে `fee_payments` + allocations সফলভাবে লিখুন, সফল হলে তারপর legacy `fees` row তৈরি করুন। তদ্ব্যতীত `fee_payments`-এ `idempotency_key` ব্যবহার করে ট্রানজ্যাকশন-সদৃশ নিরাপত্তা আনুন (অথবা একটি Postgres function-এ দুই ধাপ একসাথে করুন)।

---

## 🔴 HI-12 · `advance_amount` সবসময় `0` সেভ হয় → অগ্রিম জমা রিপোর্টে অনুপস্থিত

**লোকেশন:** `app/actions/fee-management.ts:1526` (এবং `:1684`)

```ts
const newPayment: FeePayment = {
  ...
  advance_amount: 0,        // ← অগ্রিম থাকলেও 0
```

`collectFeePayment`-এর auto-allocate শাখায় টাকার বেশি অংশ "অগ্রিম জমা" হিসেবে `finalAllocations`-এ যোগ হয় (`:1450-1470`), কিন্তু পেমেন্ট হেডারে `advance_amount` কখনো সেট হয় না।

**প্রভাব:** `advanceAmount`/`advance` রিপোর্ট সবখানে 0 দেখাবে; `accounting.ts:727`-এর `const extraAdvance = Number(p.advance_amount || 0)` সবসময় 0 → "অতিরিক্ত/অগ্রিম" আয় কেবল নিছক `remainder` হিসেবেই আসে। যেখানে অন্য কিছু स्रोत advance ধরে count করে সেখানে খুঁত তৈরি হবে (যেমন পুরোনো পেমেন্টের সাথে মিশে গেলে ডাবল-কাউন্ট)। অগ্রিম জমার ট্র্যাকিংয়ের জন্য আলাদা `student_advances` রেকর্ড রাখাও শ্রেয়।

**প্রস্তাবিত ফিক্স:** `advance_amount: allocations.reduce((s,a)=> s + (a.billing_period === "অগ্রিম" ? a.allocated_amount : 0), 0)`।

---

## 🔴 HI-13 · `saveFeeMetadata` — ৫০০ শিক্ষার্থীর বেশি হলে পুরোনো invoice কখনো sync হয় না

**লোকেশন:** `app/actions/fee-management.ts:239`

```ts
for (const sf of feeData.student_fees.slice(0, 500)) {
```

`getFeeMetadata` invoice-গুলো এনে অর্ডার করে **নতুন আগে** (`:97` — `.order("created_at", { ascending: false })`)। তাই largest-number-N ছাঁটাইয়ে সবসময় **নতুন ৫০০টি** sync হয়; ৫০১তম পুরোনো invoice ডেটাবেজ টেবিলে আর কখনো আপডেট হয় না — মানে ওই invoice-এ পেমেন্ট করলেও `paid_amount`/`due_amount`/`status` সরাসরি DB-তে বসবে না।

**প্রভাব:** ডু-রিপোর্ট (`getDueManagementData`) মেটাডেটা ও টেবিল মিশিয়ে ব্যবহার করে বলে কোনো এক জায়গায় ভুল দেখাবে; আবার অন্য কোনো মডিউল সরাসরি `student_fees` পড়লে ভুল বকেয়া দেখাবে। একই ধাঁচে পেমেন্টেও `slice(0, 500)` (`:1575`) সীমা আছে।

**প্রস্তাবিত ফিক্স:** `slice` ফেলে দিন এবং শুধু পরিবর্তিত row গুলো sync করুন (dirty-tracking), অথবা সব লেখা একটি Postgres transaction/একক batch-এ করুন। ডেটাবেজে invoice সংখ্যা বাড়লে অচল অনুমান এড়াতে হবে।

---

## 🔴 HI-14 · `generateMonthlyFees` — madrasa না পেলে ডেটাবেজের **প্রথম** মাদ্রাসার জন্য ফি জেনারেট করে

**লোকেশন:** `app/actions/fee-management.ts:632-648`

```ts
let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
const adminClient = await createAdminClient();
if (!madrasaId) {
  const { data: firstMadrasa } = await adminClient
    .from("madrasas").select("id").order("created_at", { ascending: true }).limit(1).single();
  madrasaId = firstMadrasa?.id || null;      // ← অন্য টেন্যান্ট!
}
```

**কী হচ্ছে:** ইউজারের মাদ্রাসা রেজলভ না হলে অ্যালগরিদম শুধু "যে মাদ্রাসা আগে তৈরি" সেটিই ধরে নেয়। ছাত্র তালিকা তখন ওই অন্য মাদ্রাসার `.eq("madrasa_id", madrasaId)`-তে চলে যায়, এবং `saveFeeMetadata` দিয়ে ওই** অন্য মাদ্রাসার** `student_fees`-এ ফি তৈরি/আপডেট হয়।

**প্রভাব:** সম্পূর্ণ ভুল মাদ্রাসার জন্য আর্থিক রেকর্ড তৈরি — cross-tenant ডেটা করাপশন, যেটা RLS লাগানো থাকলেও admin client-এ অনায়াসে ঘটে যায়।

**প্রস্তাবিত ফিক্স:** `if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };` — ঠিক যেমন অন্য সব ফাংশনে আছে। প্রথম-মাদ্রাসা ফলব্যাক কখনো ব্যবহার করবেন না।

---

## 🟡 MEDIUM

### MD-1 · স্কিমা ও কোডের মধ্যে স্পষ্ট বিচ্যুতি (Schema Drift)
| কোড যা স্পর্শ করে | `supabase_schema.sql` অনুযায়ী | প্রমাণ |
|---|---|---|
| `users.phone`, `users.student_id`, `users.teacher_id` | নেই (শুধু id, madrasa_id, role, full_name, email, created_at) | `supabase_schema.sql:11-18`; `app/actions/users.ts:173-183` লিখে; `lib/data-access-guards.ts:73, 156-160` পড়ে |
| `expenses.fund_id/fund_name/voucher_no` | নেই | `supabase_schema.sql:202-210`; `accounting.ts:300-345` fallback প্যাটার্ন |
| `donations.status`, `donations.fund_id` | নেই | `supabase_schema.sql:333-343`; `accounting.ts:519-521`, `zakat.ts:2278` |
| `fee_payment_allocations.fund_id/fund_name` | নেই | `supabase_schema.sql:683-696` |
| `madrasas.registration_no` (JSON blob) | TEXT, নিবন্ধন নম্বরের জন্য | `permissions.ts:100`, `lib/sessions.ts:250` |

**কেন গুরুতর:** `lib/db/schema.ts`-এ ড্রিজল সংজ্ঞাও মেলে না — `madrasaId` সেখানে `.notNull()` ও `role` একটি `pgEnum`, কিন্তু PostgreSQL-এ `madrasa_id UUID` nullable এবং `role TEXT DEFAULT 'staff'`। বাস্তবে কলামগুলো `alter.ts`/`inspect_db.js`-এর মতো স্ক্রিপ্টে `execute_sql` RPC দিয়ে হাতে যোগ করা হয়েছে (কোনো migration ইতিহাস ছাড়াই)। এর অর্থ: নতুন পরিবেশে (staging, নতুন মাদ্রাসা, DR restore) কলামগুলো না থাকলে ứng dụng নীরবে ভুল আচরণ করবে — যেমন `donations` query পুরো fail করে আয় শূন্য দেখাবে, অথবা `users.phone` insert fail করে orphan auth account বানাবে।

**ফিক্স:** একটি প্রামাণিক মাইগ্রেশন ফাইল লিখুন যা সব কলাম যোগ করে; `lib/db/schema.ts` SQL-এর সাথে মিলিয়ে আপডেট করুন; CI-তে স্কিমা-ড্রিফট পরীক্ষা যোগ করুন।

---

### MD-2 · `saveFeeMetadata`-এ লুপেই await → প্রতি ফি আদায়ে শত শত round-trip, transaction নেই

**লোকেশন:** `app/actions/fee-management.ts:239-307`

সর্বনিম্ন ১০০ পেমেন্ট × প্রতিটি N allocations — সব `await` করে সিরিয়ালি। একটি সাধারণ ৮-খাতের বিলে ১০০টি পেমেন্টের জন্য ৮০০+ আলাদা HTTP/Database round-trip। `collectFeePayment` UI-এ "Enter টিপলেই ৫-১০ সেকেন্ড" বিলম্ব এবং টাইমআউটের সম্ভাবনা। আর যেহেতু কোনো transaction নেই, মাঝপথে fail করলে পেমেন্ট সেভ হয়েছে কিন্তু allocation হয়নি (অথবা উল্টো) — অসামঞ্জস্য অটুট থাকে।

**ফিক্স:** বাল্ক `insert([...])` ব্যবহার করুন (Supabase এক call-এ row অ্যারে নেয়); আসলে সব মুভিং-পার্ট একটি Postgres ফাংশন/RPC-এ নিয়ে transaction নিশ্চিত করুন। শুধু পরিবর্তিত (dirty) row sync করুন, সব ১০০টি নয়।

---

### MD-3 · `getExpenses`-এর date ফিল্টার অসম্পূর্ণ
**লোকেশন:** `app/actions/accounting.ts:161`
```ts
if (filters?.month && filters?.year) { ... }   // একটি না দিলে চুপচাপ পুরো ডেটা
```
শুধু মাস দিলে সব বছরের ডেটা আসে — কোনো ত্রুটি বা নোটিশ ছাড়া। প্রতিটি ফিল্টার স্বাধীনভাবে প্রয়োগ করুন, অবৈধ ইনপুটে এরর দিন।

---

### MD-4 · `collectionRate` KPI ভিন্ন সময়ের ডেটা মিশ্রিত করে
**লোকেশন:** `app/dashboard/accounting/page.tsx:39`
আদায় = আজীবন সব পেমেন্ট; বকেয়া = সব session-এর `student_fees.due_amount` (অর্ধেক পুরোনো session হয়তো বাদ)। অনুপাত অর্থহীন হতে পারে (১০০%-এর ওপর চলে যেতে পারে বা নিচে)। album-ভিত্তিক (একই session/period) হিসাব করুন।

---

### MD-5 · `getUnifiedIncomeHistory`-তে Transaction ID সংঘর্ষ
**লোকেশন:** `app/actions/accounting.ts:1242`
```ts
id: `${p.id}_${alloc.fee_type_id || "alloc"}`,
```
একই পেমেন্টে একটি fee_type-এর একাধিক allocation (যেমন দুই মাসের মাসিক ফি) থাকলে React key ডুপ্লিকেট → লিস্ট-রেন্ডারে ভুল রো/মোশন ত্রুটি। `index` যোগ করুন বা `crypto.randomUUID()`।

---

### MD-6 · `formatBanglaCurrency` পয়সার মান নিয়ন্ত্রণ করে না
**লোকেশন:** `lib/numberToBangla.ts:27`
`Number(val).toLocaleString('en-IN')` — ডিফল্টে সর্বোচ্চ ৩ দশমিক অঙ্ক দেখায়; মুদ্রার জন্য ২ অঙ্ক আবশ্যক। `toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` ব্যবহার করুন — নাহলে রসিদ ও রিপোর্টে ফল-ব্যাক ও বৃত্তাকারে অমিল তৈরি হবে।

---

### MD-7 · `middleware.ts` প্রতিটি hard navigation-এ নেটওয়ার্ক round-trip (কমেন্ট নিজেই স্বীকার করে)
লেখক নিজে লিখেছেন "made in-page navigation links feel broken" — সমাধান হিসেবে auth চেক **এড়ানো** হয়েছে। সঠিক সমাধান: `supabase.auth.getClaims()` (লোকাল JWT ভেরিফিকেশন) অথবা `@supabase/ssr`-এর সেশন cookie পাঠ, যাতে প্রতি ক্লিকে নেটওয়ার্ক না লাগে কিন্তু সুরক্ষা বাদ না পড়ে।

---

### MD-8 · `createUserAccount`-এ আংশিক ব্যর্থতা — orphan auth account
**লোকেশন:** `app/actions/users.ts:159-190`
`auth.admin.createUser()` সফল হওয়ার পর `users` টেবিলে upsert ব্যর্থ হলে (যেমন `phone` কলাম না থাকলে — MD-1) ফাংশন এরর রিটার্ন করে, কিন্তু **Auth ইউজারটি থেকে যায়**। ব্যবহারকারী আবার চেষ্টা করলে "email already registered" পাবেন এবং অ্যাকাউন্টটি কোথাও দেখা যাবে না (RLS জন্য `users` row নেই)। কম্পেনসেটিং cleanup / rollback যোগ করুন।

---

### MD-9 · `generateNextReceiptNumber` — DB-তে সর্বোচ্চ রসিদ নয়, লেক্সিকোগ্রাফিক max
**লোকেশন:** `app/actions/fee-management.ts:37-45`
```
.order("receipt_no", { ascending: false }).limit(1)
```
TEXT сортировка; `MR-2026-00151-B` বা `MR-2026-99999` জাতীয় ব্যতিক্রমী মান এলে số lượng সঠিকভাবে পড়া যাবে না। (`:70-76` এর random-suffix fallback-ও `MR-2026-00166-42` তৈরি করে, যা পরে আবার এই max-logic-কে বিভ্রান্ত করে।) DB-তে একটি আসল counter টেবিল/sequence ব্যবহার করা শ্রেয়।

---

## 🟢 LOW

- **L-1** `middleware.ts:26-36` — পাবলিক রুটে `/portal` পুরো সাবস্ক্রিপশন রাখা হয়েছে `startsWith` দিয়ে; ভবিষ্যতে `/portal-something` নামের রুটও পাবলিক হয়ে যাবে। সমান-চিহ্নে (`=== '/portal' || startsWith('/portal/')`) যাচাই করুন।
- **L-2** `app/portal/layout.tsx` — `supabase.auth.getUser()` RSC-তে cookie লিখতে চাইলে ব্যর্থ হয় (`setAll`-এ try/catch-এ ছোড়া হয়েছে) → সেশন রিফ্রেশ কেবল middleware-এর উপর নির্ভর করে। স্পষ্ট মন্তব্য/হ্যান্ডলিং যোগ করুন।
- **L-3** `app/actions/auth.ts:275-283` (`signOut` এরপর `redirect`) — ক্লায়েন্ট ভেরিফিকেশন ছাড়াই সেশন অবসান হয়; মায়ের আকারে cache (`cache()` দিয়ে `createClient`) রিকোয়েস্ট জুড়ে পুরোনো কুকি ধরে রাখতে পারে — পরীক্ষা করে দেখুন।
- **L-4** `app/actions/fee-management.ts:1816-1830` — `syncFeesWithFunds()` কিছুই করে না (শুধু revalidatePath)। UI-তে "রিক্যালকুলেট হয়েছে" দেখানো হয় — ব্যবহারকারীকে বিভ্রান্ত করে।

---

# পার্ট ২ — সমন্বিত যোগফল: কোথায় আগে হাত দিবেন

## ধাপ ১ — আজই (টাকা ও ডেটা বাঁচাতে) — ১-২ দিন
| # | কাজ | ফাইল |
|---|---|---|
| 1 | `force password sync` ব্লক সরান (CR-1) | `app/actions/auth.ts:80-105` |
| 2 | allocation upsert-এ UNIQUE + `onConflict` (CR-7), ডুপ্লিকেট row cleanup | `fee-management.ts:297` + SQL |
| 3 | `donations` query-তে `status` বাদ, `receipt_no` যোগ, error হলে থামুন (CR-10) | `accounting.ts:519-521` |
| 4 | `resetUserPassword`-এ madrasa স্কোপ + অনুমতি (HI-10) | `users.ts:270-295` |
| 5 | `adminClient` anon-key fallback সরান (CR-5) | `lib/supabase/admin.ts:7` |
| 6 | void/reverse-এ discount rollback (HI-1) | `fee-management.ts:1860-1900, 2010-2050` |
| 7 | ১৫s ডুপ্লিকেট গার্ড শিথিল/নিরাপদ করুন (HI-2) | `fee-management.ts:1130-1160` |
| 8 | `generateMonthlyFees`-এর first-madrasa fallback সরান (HI-14) | `fee-management.ts:632-648` |

## ধাপ ২ — এই সপ্তাহে (নিরাপত্তা স্থাপত্য) — ৩-৫ দিন
- server-side `requirePermission()` হেল্পার + সব write action-এ প্রয়োগ (CR-2)
- `PermissionGuard`-এর আগে সার্ভার-সাইড গার্ড (CR-6)
- `data-access-guards.ts`-এ madrasa ফিল্টার + Strategy E অপসারণ (CR-3)
- `SUSPENDED`/`DISABLED` যাচাই login + middleware-এ (CR-4)
- middleware-এ `user_metadata` বাদ, DB role (HI-7)
- `users.ts:46`-এর `.or(madrasa_id.is.null)` অপসারণ (HI-8)
- bootstrap auto-super_admin সরান (HI-9)
- মাইগ্রেশন: `users.phone/student_id/teacher_id`, `expenses.fund_id/voucher_no`, `fee_*_allocations.fund_id/fund_name`, `donations.status` (MD-1)
- ফান্ড ম্যাপিং সেভ/লোড করা (CR-8)

## ধাপ ৩ — পরের স্প্রিন্ট (ডেটা ইন্টিগ্রিটি ও কর্মদক্ষতা) — ১-২ সপ্তাহ
- ফি আদায় একটি Postgres RPC/transaction-এ (HI-11, MD-2)
- ভাউচার নম্বরের UNIQUE + sequence (HI-3), খরচের soft-delete + audit (HI-5)
- `slice(0,500)` অপসারণ + dirty-row sync (HI-13)
- `advance_amount` প্রকৃত হিসাব (HI-12)
- নিরাপত্তা স্টোরের জন্য আসল টেবিল (HI-6)
- `getAuthMadrasaId`-এর teacher-email upsert ও RLS সুরক্ষার পর্যালোচনা

## ধাপ ৪ — যাচাইকরণ (নিয়মিত)
- সময়ে সময়ে যাচাই করুন: `SUM(fee_payment_allocations.allocated_amount)` = `SUM(fee_payments.total_amount_received)`
- ডুপ্লিকেট allocation-এর জন্য পারমাণবিক reconcilliation কোয়েরি চালান (CR-7-এ দেওয়া DELETE-এর মতো)
- CI-তে: `tsc --noEmit`, ESLint, এবং স্কিমা-ড্রিফট চেক
- `grep -rn "getAuthUser" app/actions | xargs -I{} grep -L "permission" {}` — যে action-গুলোতে এখনো অনুমতি চেক নেই সেগুলো ধরা পড়বে

---

## পরিশিষ্ট — ডেটা রিকভারি কোয়েরি (নিরাপদে ব্যাকআপ নিয়ে চালান)

```sql
-- ১) ডুপ্লিকেট fee_payment_allocations শনাক্ত ও পরিষ্কার
SELECT payment_id, fee_type_id, student_fee_id, billing_period, COUNT(*) AS dupes,
       SUM(allocated_amount) AS inflated_sum
FROM public.fee_payment_allocations
GROUP BY 1,2,3,4 HAVING COUNT(*) > 1 ORDER BY dupes DESC;

-- পুরোনোটুকু রেখে বাকিটা মুছুন (created_at থাকলে)
DELETE FROM public.fee_payment_allocations a
USING public.fee_payment_allocations b
WHERE a.ctid <> b.ctid                     -- অথবা a.created_at > b.created_at
  AND a.payment_id = b.payment_id
  AND a.fee_type_id IS NOT DISTINCT FROM b.fee_type_id
  AND a.student_fee_id IS NOT DISTINCT FROM b.student_fee_id
  AND a.billing_period IS NOT DISTINCT FROM b.billing_period;

-- ২) void/reverse-এ হারানো ডিসকাউন্ট শনাক্ত
SELECT p.receipt_no, p.status, a.student_fee_id, a.discount_applied
FROM public.fee_payments p
JOIN public.fee_payment_allocations a ON a.payment_id = p.id
WHERE p.status IN ('VOID','REVERSED') AND COALESCE(a.discount_applied,0) > 0;

-- ৩) legacy fees row যার fee_payment নেই (orphan)
SELECT f.id, f.amount, f.notes, f.payment_date
FROM public.fees f
LEFT JOIN public.fee_payments p
  ON p.id = f.id OR f.notes LIKE '%' || p.receipt_no || '%'
WHERE p.id IS NULL;
```

> ⚠️ **মনে রাখবেন:** এই কোয়েরিগুলো চালানোর আগে অবশ্যই `pg_dump`/ব্যাকআপ নিন এবং প্রথমে একটি স্টেজিং কপিতে চেষ্টা করুন।

---

## পরিশিষ্ট ২ — যা দেখা হলো না / যাচাই করা হয়নি

1. **লাইভ ডেটাবেজ স্কিমা** — এই অডিট রিপোজিটরির SQL ফাইল ও কোডের উপর ভিত্তি করে; লাইভ Supabase ইনস্ট্যান্সে (`execute_sql` RPC দিয়ে যোগ করা) অতিরিক্ত কলাম থাকতে পারে — MD-1-এর প্রমাণ চূড়ান্ত করতে তথ্য পুনরুদ্ধারের কোয়েরি চালিয়ে দেখুন।
2. **`node_modules` ইনস্টল নেই** — `npm run lint` (`tsc --noEmit`) চালানো যায়নি; টাইপ-লেভেলের ত্রুটি ধরা পড়েনি।
3. **RLS পলিসির লাইভ পরীক্ষা** — `check_rls.js` শুধু `madrasas` টেবিলে অ্যাক্সেস পরীক্ষা করে; প্রতিটি টেবিলের প্রকৃত RLS আচরণ যাচাই করা হয়নি।
4. **ফ্রন্টএন্ড ক্লায়েন্টের تمام ইভেন্ট হ্যান্ডলার** — ৫৮টি accounting কম্পোনেন্ট ও ইউজার পেজের সব শাখা পাঠ করা হয়নি; প্যাটার্ন-ভিত্তিক অনুমান শেষ করা হয়েছে।
5. `app/actions/fundraising.ts`, `app/actions/zakat.ts`, `app/actions/backup.ts` — শুধুমাত্র অ্যাকাউন্ট মডেলের সাথে সম্পর্কিত অংশ পাঠ করা হয়েছে, সম্পূর্ণ অডিট নয়।

---

**রিপোর্ট প্রস্তুতকারী:** Arena.ai এজেন্ট (সিনিয়র Next.js/টাইপ-সেফটি অডিট)
**পুনরুৎপাদনের জন্য কমান্ড:** `grep -rn "if (!user) return" app/actions/*.ts` — কত server action-এ শুধু auth-চেক আছে, নিজেই দেখে নিতে পারবেন।
