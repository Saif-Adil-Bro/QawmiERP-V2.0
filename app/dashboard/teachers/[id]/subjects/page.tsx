import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getTeacherSubjects, getAvailableClassSubjects } from "@/app/actions/teacher_subjects";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata } from "@/lib/sessions";
import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, PlusCircle, CheckCircle2, UserCheck } from "lucide-react";
import AssignTeacherSubjectForm from "./AssignTeacherSubjectForm";
import RemoveTeacherSubjectButton from "./RemoveTeacherSubjectButton";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TeacherSubjectsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const teacherId = params.id;
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  let teacherName = "শিক্ষক";
  let teacherDesignation = "ওস্তাদ";
  let teacherPhone = "";

  // 1. Try fetching from SQL teachers table
  if (UUID_REGEX.test(teacherId)) {
    const { data: teacher } = await adminClient.from("teachers").select("*").eq("id", teacherId).maybeSingle();
    if (teacher) {
      teacherName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || "শিক্ষক";
      teacherDesignation = teacher.designation || "ওস্তাদ";
      teacherPhone = teacher.phone || "";
    }
  }

  // 2. If not found or legacy ID, lookup in madrasa metadata staff
  if (madrasaId && teacherName === "শিক্ষক") {
    const meta: any = await getMadrasaMetadata(madrasaId);
    const staffList = meta.staff_members || [];
    const staff = staffList.find((s: any) => s.id === teacherId || s.legacy_id === teacherId);
    if (staff) {
      teacherName = staff.personal?.full_name_bn || `${staff.personal?.first_name || ""} ${staff.personal?.last_name || ""}`.trim() || "শিক্ষক";
      teacherDesignation = staff.employment?.designation || "ওস্তাদ";
      teacherPhone = staff.contact?.phone || "";
    }
  }

  const availableClassSubjects = await getAvailableClassSubjects();
  const assignedSubjects = await getTeacherSubjects(teacherId);

  // Filter out subjects that are already assigned to this teacher for that specific class
  const unassignedClassSubjects = availableClassSubjects.filter(
    (cs) => !assignedSubjects.some((as: any) => as.class_id === cs.class_id && as.subject_id === cs.subject_id)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <Link
          href="/dashboard/teachers"
          className="p-2.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-colors border border-slate-200"
          title="শিক্ষক তালিকায় ফিরে যান"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              শিক্ষকের কিতাব ও বিষয় বণ্টন
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              একাডেমিক বণ্টন
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            <span className="font-bold text-slate-800">শিক্ষক: {teacherName}</span>
            <span>•</span>
            <span className="text-slate-600">{teacherDesignation}</span>
            {teacherPhone && (
              <>
                <span>•</span>
                <span className="text-slate-500">{teacherPhone}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Subjects List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-slate-800 text-sm sm:text-base">নিযুক্ত কিতাব ও বিষয়সমূহ</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                মোট: {assignedSubjects.length} টি
              </span>
            </div>

            <div className="p-0">
              {assignedSubjects.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <p className="text-slate-600 font-semibold text-sm">কোনো বিষয় এখনো বণ্টন করা হয়নি</p>
                  <p className="text-slate-400 text-xs mt-1">ডানপাশের ফর্ম থেকে জামাত ও বিষয় নির্বাচন করে এসাইন করুন।</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {assignedSubjects.map((item: any) => (
                    <li key={item.id} className="flex justify-between items-center p-4 sm:p-5 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{item.subjects?.name || "কিতাব/বিষয়"}</p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="font-medium text-emerald-700">জামাত: {item.classes?.name || "সাধারণ"}</span>
                            {item.subjects?.code && (
                              <>
                                <span>•</span>
                                <span>কোড: {item.subjects.code}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <RemoveTeacherSubjectButton teacherSubjectId={item.id} teacherId={teacherId} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Assign Subject Form */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">নতুন বিষয় এসাইন করুন</h2>
            </div>
            <AssignTeacherSubjectForm 
              teacherId={teacherId} 
              unassignedClassSubjects={unassignedClassSubjects} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
