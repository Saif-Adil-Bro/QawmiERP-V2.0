import { feeReturnNotice } from "@/lib/payment-return";
import { studentLedger } from "@/lib/portal/ledger";
import { getFullPaymentGatewayConfig } from "@/lib/payment-gateway-config";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import { toPublicPaymentGatewayConfig } from "@/lib/payment-gateway";
import ParentPortalFeesClient from "./ParentPortalFeesClient";
import { getPortalStudentData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ParentPortalFees(props: {
  searchParams?: Promise<{
    student_id?: string;
    success?: string;
    receipt?: string;
    txn?: string;
    error?: string;
  }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);
  if (!portalData || !portalData.user) return null;

  const { students, child, madrasaId, adminClient } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const ledger = await studentLedger(adminClient, madrasaId, child.id, portalData.meta);
  const { total_paid: totalPaid, total_due: totalDue, payments: combinedPayments } = ledger;
  // Get gateway configuration and madrasa info
  // ⛔ পোর্টাল পেজেও গেটওয়ে ক্রেডেনশিয়াল ও মাদ্রাসা metadata পাঠানো হয় না —
  // ক্লায়েন্ট কম্পোনেন্টের prop RSC পেলোড/HTML সোর্সে সিরিয়ালাইজ হয়ে যায়।
  const [gatewayConfigRaw, madrasaInfoRaw] = await Promise.all([
    getFullPaymentGatewayConfig(madrasaId),
    getMadrasaInfo(madrasaId),
  ]);
  const gatewayConfig = toPublicPaymentGatewayConfig(gatewayConfigRaw);
  const madrasaInfo = toPublicMadrasaInfo(madrasaInfoRaw);

  const notice = feeReturnNotice(params, madrasaId, child.id, combinedPayments);
  return (
    <>
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-xl border p-4 text-sm font-semibold ${notice.confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          {notice.message}
        </p>
      )}
      <ParentPortalFeesClient
        child={child}
        students={students}
        totalPaid={totalPaid}
        totalDue={totalDue}
        invoices={ledger.fees}
        discounts={ledger.discounts}
        combinedPayments={combinedPayments}
        gatewayConfig={gatewayConfig}
        madrasaInfo={madrasaInfo}
      />
    </>
  );
}
