import Link from "next/link";
import { getSystemAuditLogs } from "@/app/actions/system-audit";
import SystemAuditLogsClient from "./SystemAuditLogsClient";
import { ShieldCheck, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SystemAuditLogsPage() {
  const initialResult = await getSystemAuditLogs({ limit: 200 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              সিস্টেম অডিট লগ (Unified Audit Log)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Immutable
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            পরীক্ষার নম্বর পরিবর্তন, খরচ এন্ট্রি/ডিলিট, ফি বাতিল, ইউজার রোল পরিবর্তন ও লক/আনলকসহ সকল ক্রিটিক্যাল অ্যাকশনের অপরিবর্তনযোগ্য ইতিহাস।
          </p>
        </div>

        <Link
          href="/dashboard/settings/data-governance"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Lock className="w-4 h-4 text-amber-300" />
          <span>ডাটা লক ও মাইগ্রেশন কনসোল</span>
        </Link>
      </div>

      <SystemAuditLogsClient initialResult={initialResult} />
    </div>
  );
}
