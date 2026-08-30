import { getFeeMetadata } from "@/app/actions/fee-management";
import { getAuthMadrasaId } from "@/app/actions/students";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import PaymentsClient from "./PaymentsClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PaymentsHistoryPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const meta = madrasaId ? await getFeeMetadata(madrasaId) : null;
  const payments = meta?.payments || [];
  const auditLogs = meta?.audit_logs || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/accounting"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">পেমেন্ট হিস্ট্রি ও অডিট ট্রানজেকশন</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              সকল মানি রিসিট, আদায়কৃত পেমেন্ট রেকর্ড এবং রিভার্সাল ব্যবস্থাপনা
            </p>
          </div>
        </div>
      </div>

      <PaymentsClient initialPayments={payments} initialAuditLogs={auditLogs} />
    </div>
  );
}
