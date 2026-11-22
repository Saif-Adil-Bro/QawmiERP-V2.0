import { toDhakaDateString } from "@/lib/date-utils";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import HifzForm from "./HifzForm";
import TeacherHifzTabsClient from "./TeacherHifzTabsClient";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getHifzUpgradeBundleAction } from "@/app/actions/hifz-upgrade";

export const dynamic = "force-dynamic";

export default async function TeacherHifzPage(props: { searchParams?: Promise<{ date?: string, class_id?: string }> }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) return null;

  // Safe user lookup with admin client fallback
  let madrasaId = "";
  try {
    const admin = await createAdminClient();
    const { data: uAdmin } = await admin.from("users").select("madrasa_id").eq("id", user.id).maybeSingle();
    madrasaId = uAdmin?.madrasa_id || "";
  } catch {
    const { data: u } = await supabase.from("users").select("madrasa_id").eq("id", user.id).maybeSingle();
    madrasaId = u?.madrasa_id || "";
  }

  // Safe teacher lookup
  let teacherId: string | undefined = undefined;
  if (madrasaId && user.email) {
    try {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("madrasa_id", madrasaId)
        .eq("email", user.email)
        .maybeSingle();
      teacherId = teacher?.id;
    } catch {
      // ignore
    }
  }

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let classesQuery = supabase.from("classes").select("id, name").eq("madrasa_id", madrasaId).order("name");

  if (!scope.isUnrestricted && scope.userRole === "teacher") {
    if (scope.allowedClassIds.length === 0) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Hifz Sabak</h1>
            <p className="text-slate-500">Update Sabak, Saboki, and Amukhta progress for your class.</p>
          </div>
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            আপনাকে কোনো হিফজ ক্লাস অর্পণ করা হয়নি। মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
          </div>
        </div>
      );
    }
    classesQuery = classesQuery.in("id", scope.allowedClassIds);
  }

  const [{ data: classes }, meta] = await Promise.all([
    classesQuery,
    madrasaId ? getMadrasaMetadata(madrasaId) : null,
  ]);

  // Await search params
  const awaitedSearchParams = props.searchParams ? (await props.searchParams) || {} : {};
  const dateStr = awaitedSearchParams?.date || toDhakaDateString();
  const classId = awaitedSearchParams?.class_id || (classes?.[0]?.id || "");

  let students: any[] = [];
  let existingLogs: any[] = [];

  if (classId) {
    let rawStudents: any[] = [];
    try {
      const admin = await createAdminClient();
      const { data: sAdmin } = await admin
        .from("students")
        .select("id, first_name, last_name, roll_number, photo_url, parent_phone, class_id")
        .eq("class_id", classId)
        .order("roll_number", { ascending: true });
      if (sAdmin) rawStudents = sAdmin;
    } catch {
      // fallback
    }

    if (rawStudents.length === 0) {
      const { data: s } = await supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, photo_url, parent_phone, class_id")
        .eq("class_id", classId)
        .order("roll_number", { ascending: true });
      rawStudents = s || [];
    }

    students = (rawStudents || []).map((s: any) => {
      const profile = meta?.student_profiles?.[s.id] || {};
      const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === s.id);
      const resolvedPhoto = profile.photo_url || s.photo_url || admission?.photo_url || "";
      const resolvedPhone = profile.parent_phone || s.parent_phone || admission?.guardian_phone || admission?.emergency_phone || "";

      return {
        ...s,
        first_name: profile.first_name || s.first_name || "",
        last_name: profile.last_name || s.last_name || "",
        roll_number: profile.roll_number !== undefined && profile.roll_number !== "" ? profile.roll_number : (s.roll_number || ""),
        photo_url: resolvedPhoto,
        phone: resolvedPhone,
        parent_phone: resolvedPhone,
      };
    });

    // Guard: Only query logs if there are students, preventing PostgREST in.() 400 error
    if (students.length > 0) {
      const studentIds = students.map((st: any) => st.id);
      const { data: l } = await supabase
        .from("hifz_logs")
        .select("*")
        .in("student_id", studentIds)
        .eq("log_date", dateStr);
      existingLogs = l || [];
    }
  }

  const hifzBundle = madrasaId
    ? await getHifzUpgradeBundleAction(madrasaId).catch(() => ({
        profiles: {},
        weeklySabinas: [],
        specialSabinas: [],
      }))
    : { profiles: {}, weeklySabinas: [], specialSabinas: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">হিফজুল কুরআন ও সবিনা ব্যবস্থাপনা</h1>
        <p className="text-slate-500 text-sm">
          সবকী (৩ স্তর), খতমী (সকাল ও বিকেল সেশন), বৃহস্পতিবারের সাপ্তাহিক সবিনা এবং বিশেষ সবিনা ট্র্যাকিং
        </p>
      </div>

      <TeacherHifzTabsClient
        students={students}
        teacherId={teacherId}
        dateStr={dateStr}
        initialProfiles={hifzBundle.profiles}
        initialWeeklySabinas={hifzBundle.weeklySabinas}
        initialSpecialSabinas={hifzBundle.specialSabinas}
      />

      <details className="bg-white rounded-2xl border border-slate-200 p-4">
        <summary className="text-xs font-bold text-slate-600 cursor-pointer select-none">
          ক্লাসিক বাল্ক হিফজ এন্ট্রি ও জামাত/তারিখ ফিল্টার (Classic View)
        </summary>
        <div className="pt-4">
          <HifzForm
            classes={classes || []}
            students={students}
            existingLogs={existingLogs}
            currentDate={dateStr}
            currentClassId={classId}
            teacherId={teacherId}
            madrasaId={madrasaId}
          />
        </div>
      </details>
    </div>
  );
}
