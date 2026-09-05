import { createClient } from "@/lib/supabase/server";
import {
  getStudentFeeProfile,
  getFeeMetadata,
} from "@/app/actions/fee-management";
import {
  getPaymentGatewayConfig,
  getStudentPublicFeeInfo,
} from "@/app/actions/payment-gateway";
import ParentPortalFeesClient from "./ParentPortalFeesClient";
import DirectPayClient from "@/app/pay/DirectPayClient";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ParentPortalFees(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If unauthenticated parent accesses the direct payment link (e.g. from SMS)
  if (!user) {
    if (params.student_id) {
      const feeData = await getStudentPublicFeeInfo(params.student_id);
      if (feeData) {
        return <DirectPayClient data={feeData} />;
      }
    }

    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 max-w-md mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-800">পোর্টালে লগইন প্রয়োজন</h2>
        <p className="text-xs text-slate-500">
          ফি বিবরণী দেখতে অনুগ্রহ করে আপনার অভিভাবক অ্যাকাউন্টে লগইন করুন অথবা এসএমএসে প্রাপ্ত নির্দিষ্ট পেমেন্ট লিংকটি ব্যবহার করুন।
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition"
        >
          লগইন পেজে যান
        </Link>
      </div>
    );
  }

  // Authenticated flow
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
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted && scope.allowedStudentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  } else if (madrasaId) {
    studentsQuery = studentsQuery.eq("madrasa_id", madrasaId);
  }

  const { data: fetchedStudents } = await studentsQuery;
  let students = fetchedStudents || [];

  if (students.length === 0) {
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
      .limit(5);
    students = fallbackStudents || [];
  }

  if (students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];

  // Get fees from SQL table
  const { data: sqlFees } = await supabase
    .from("fees")
    .select("*")
    .eq("student_id", child.id)
    .order("payment_date", { ascending: false });

  // Get structured student fee profile from metadata
  const feeProfile = await getStudentFeeProfile(child.id);

  // Get payments from metadata
  let metadataPayments: any[] = [];
  if (madrasaId) {
    const meta = await getFeeMetadata(madrasaId);
    metadataPayments = (meta?.payments || []).filter(
      (p) => p.student_id === child.id && p.status !== "REVERSED"
    );
  }

  // Combine payments
  const combinedPayments = [...metadataPayments];
  if (sqlFees) {
    sqlFees.forEach((sf) => {
      if (
        !combinedPayments.some(
          (p) => p.receipt_no === sf.receipt_number || p.id === sf.id
        )
      ) {
        combinedPayments.push({
          id: sf.id,
          receipt_no: sf.receipt_number || `REC-${sf.id.slice(0, 6)}`,
          total_amount_received:
            Number(sf.amount_paid) || Number(sf.amount) || 0,
          payment_date: sf.payment_date,
          payment_method: sf.payment_method || "Cash",
          notes: sf.notes || sf.description,
          student_name: `${child.first_name} ${child.last_name}`,
          class_name: child.class_name,
        });
      }
    });
  }

  const totalPaid = combinedPayments.reduce(
    (sum, p) => sum + (Number(p.total_amount_received) || 0),
    0
  );
  const totalDue = feeProfile?.total_due || 0;
  const unpaidInvoices =
    feeProfile?.fees?.filter((f: any) => f.due_amount > 0) || [];

  // Get gateway configuration
  const gatewayConfig = await getPaymentGatewayConfig();

  return (
    <ParentPortalFeesClient
      child={child}
      students={students}
      totalPaid={totalPaid}
      totalDue={totalDue}
      unpaidInvoices={unpaidInvoices}
      combinedPayments={combinedPayments}
      gatewayConfig={gatewayConfig}
    />
  );
}
