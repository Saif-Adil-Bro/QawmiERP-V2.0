import { createClient } from "@/lib/supabase/server";
import { getStudentDigitalId } from "@/app/actions/id-card-management";
import DigitalIdCardView from "@/app/components/DigitalIdCardView";
import PrintButton from "@/app/components/PrintButton";
import { IdCard, ShieldCheck, UserCheck, BookOpen } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudentPortalDigitalIdPage(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_id, classes(name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted) {
    if (scope.allowedStudentIds.length === 0) {
      return (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500">
          কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
        </div>
      );
    }
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  }

  const { data: students } = await studentsQuery;

  if (!students || students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];

  const digitalIdData = await getStudentDigitalId(child.id);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <IdCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">ডিজিটাল স্টুডেন্ট আইডি কার্ড</h1>
              <p className="text-xs text-slate-500 mt-0.5">মাদরাসার অফিসিয়াল ডিজিটাল পরিচয়পত্র ও কিউআর যাচাইকরণ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Digital ID Card Display */}
      {digitalIdData?.card ? (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>অফিসিয়াল ডিজিটাল আইডি কার্ড</span>
          </div>

          <DigitalIdCardView
            card={digitalIdData.card}
            madrasaInfo={digitalIdData.madrasaInfo}
            showActions={true}
          />
        </div>
      ) : (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center text-slate-500 space-y-2">
          <IdCard className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800">ডিজিটাল আইডি কার্ড প্রক্রিয়াধীন</h3>
          <p className="text-xs text-slate-400">
            শিক্ষার্থীর প্রোফাইল তথ্য বা এনরোলমেন্ট চেক করা হচ্ছে। মাদরাসা অফিসের সাথে যোগাযোগ করুন।
          </p>
        </div>
      )}
    </div>
  );
}
