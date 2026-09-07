import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import ExamMarksForm from "./ExamMarksForm";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getAuthMadrasaId } from "@/app/actions/students";

export const dynamic = "force-dynamic";

export default async function TeacherExamsPage(props: {
  searchParams?: Promise<{ exam_id?: string; class_id?: string; subject_name?: string }>;
}) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) return null;

  let madrasaId = "";
  let admin: any = null;
  try {
    admin = await createAdminClient();
    const { data: uAdmin } = await admin
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();
    madrasaId = uAdmin?.madrasa_id || "";
  } catch {
    const { data: u } = await supabase
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();
    madrasaId = u?.madrasa_id || "";
  }

  if (!madrasaId) {
    try {
      madrasaId = await getAuthMadrasaId(supabase, user);
    } catch {
      // fallback
    }
  }

  if (!admin) {
    try {
      admin = await createAdminClient();
    } catch {
      admin = supabase;
    }
  }

  // Await search params
  const awaitedSearchParams = props.searchParams ? (await props.searchParams) || {} : {};

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  let scope = { isUnrestricted: false, allowedClassIds: [] as string[], userRole: "teacher" };
  try {
    scope = await getUserDataAccessScope();
  } catch (scopeErr) {
    console.warn("Scope lookup warning in TeacherExamsPage:", scopeErr);
  }

  // 1. Fetch Exams (using admin client to prevent RLS blocks)
  let exams: any[] = [];
  try {
    const { data: exData } = await admin
      .from("exams")
      .select("id, title, year, start_date, status")
      .eq("madrasa_id", madrasaId)
      .order("start_date", { ascending: false });

    if (exData && exData.length > 0) {
      exams = exData;
    } else {
      // Fallback: fetch any active exams in the database
      const { data: fallbackExams } = await admin
        .from("exams")
        .select("id, title, year, start_date, status")
        .order("start_date", { ascending: false })
        .limit(20);
      exams = fallbackExams || [];
    }
  } catch (exErr) {
    console.warn("Error fetching exams:", exErr);
  }

  // 2. Fetch Classes (using admin client to prevent RLS blocks)
  let classes: any[] = [];
  try {
    if (!scope.isUnrestricted && scope.userRole === "teacher" && scope.allowedClassIds.length > 0) {
      const { data: assignedClasses } = await admin
        .from("classes")
        .select("id, name")
        .in("id", scope.allowedClassIds)
        .order("name");
      classes = assignedClasses || [];
    }

    if (classes.length === 0) {
      const { data: madrasaClasses } = await admin
        .from("classes")
        .select("id, name")
        .eq("madrasa_id", madrasaId)
        .order("name");
      classes = madrasaClasses || [];
    }

    if (classes.length === 0) {
      // General fallback to all classes in case of multi-tenant mismatch
      const { data: allCls } = await admin
        .from("classes")
        .select("id, name")
        .order("name")
        .limit(30);
      classes = allCls || [];
    }
  } catch (clsErr) {
    console.warn("Error fetching classes:", clsErr);
  }

  // Fetch metadata
  let meta: any = null;
  if (madrasaId) {
    try {
      meta = await getMadrasaMetadata(madrasaId);
    } catch {
      // ignore
    }
  }

  const examId = awaitedSearchParams?.exam_id || (exams?.[0]?.id || "");
  const classId = awaitedSearchParams?.class_id || (classes?.[0]?.id || "");
  const subjectName = awaitedSearchParams?.subject_name || "কুরআন মাজীদ";

  let students: any[] = [];
  let existingMarks: any[] = [];

  if (classId) {
    let rawStudents: any[] = [];
    try {
      // Note: `students.phone` column does not exist, use `parent_phone`
      const { data: sAdmin } = await admin
        .from("students")
        .select("id, first_name, last_name, roll_number, photo_url, parent_phone, class_id")
        .eq("class_id", classId)
        .order("roll_number", { ascending: true });
      if (sAdmin) rawStudents = sAdmin;
    } catch (sErr) {
      console.warn("Failed to fetch students with admin client:", sErr);
      try {
        const { data: s } = await supabase
          .from("students")
          .select("id, first_name, last_name, roll_number, photo_url, parent_phone, class_id")
          .eq("class_id", classId)
          .order("roll_number", { ascending: true });
        rawStudents = s || [];
      } catch {
        rawStudents = [];
      }
    }

    students = (rawStudents || []).map((s: any) => {
      const profile = meta?.student_profiles?.[s.id] || {};
      const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === s.id);
      const resolvedPhoto = profile.photo_url || s.photo_url || admission?.photo_url || "";
      const resolvedPhone =
        profile.parent_phone ||
        s.parent_phone ||
        admission?.guardian_phone ||
        admission?.emergency_phone ||
        "";

      return {
        ...s,
        first_name: profile.first_name || s.first_name || "",
        last_name: profile.last_name || s.last_name || "",
        roll_number:
          profile.roll_number !== undefined && profile.roll_number !== ""
            ? profile.roll_number
            : s.roll_number || "",
        photo_url: resolvedPhoto,
        phone: resolvedPhone,
        parent_phone: resolvedPhone,
      };
    });

    if (students.length > 0 && examId) {
      try {
        const studentIds = students.map((st: any) => st.id);
        const { data: m } = await admin
          .from("exam_results")
          .select("*")
          .in("student_id", studentIds)
          .eq("exam_id", examId);

        if (m) {
          existingMarks = m.filter(
            (r: any) => !subjectName || r.subject_name === subjectName
          );
        }
      } catch (mErr) {
        console.warn("Error fetching existing marks:", mErr);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">পরীক্ষার নম্বর এন্ট্রি</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          পরীক্ষা, জামাত এবং বিষয় নির্বাচন করে শিক্ষার্থীদের নম্বর ও গ্রেড লিপিবদ্ধ করুন।
        </p>
      </div>

      <ExamMarksForm
        exams={exams || []}
        classes={classes || []}
        students={students}
        existingMarks={existingMarks}
        currentExamId={examId}
        currentClassId={classId}
        currentSubject={subjectName}
        madrasaId={madrasaId}
      />
    </div>
  );
}
