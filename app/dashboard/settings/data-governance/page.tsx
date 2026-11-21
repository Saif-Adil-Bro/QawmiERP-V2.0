import Link from "next/link";
import { getAccountingPeriods, getCanManageLocks } from "@/app/actions/locks";
import { getExamFreezeList } from "@/app/actions/exams";
import { getAcademicSessions } from "@/app/actions/sessions";
import { getMetadataMigrationStatus } from "@/app/actions/metadata-migration";
import DataGovernanceClient from "./DataGovernanceClient";
import { ShieldCheck, FileSearch } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DataGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialTab =
    resolvedSearchParams?.tab === "exams" ||
    resolvedSearchParams?.tab === "migration"
      ? resolvedSearchParams.tab
      : "accounting";

  const [periodsRes, examList, sessions, migrationStatus, canManageLocks] =
    await Promise.all([
      getAccountingPeriods(),
      getExamFreezeList(),
      getAcademicSessions(),
      getMetadataMigrationStatus(),
      getCanManageLocks(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">
              ডাটা লক, ফ্রিজ ও SQL মাইগ্রেশন কনসোল
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Core ERP Governance
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            মাসিক ও বার্ষিক হিসাব ক্লোজিং লক, পরীক্ষার নম্বর ফ্রিজ, শিক্ষাবর্ষ লক এবং{" "}
            <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              madrasas.metadata
            </code>{" "}
            থেকে রিলেশনাল SQL টেবিলে নিরাপদ মাইগ্রেশন পরিচালনা করুন।
          </p>
        </div>

        <Link
          href="/dashboard/settings/audit-logs"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition self-start sm:self-auto"
        >
          <FileSearch className="w-4 h-4 text-emerald-600" />
          <span>সিস্টেম অডিট লগ দেখুন</span>
        </Link>
      </div>

      <DataGovernanceClient
        initialTab={initialTab}
        initialPeriods={periodsRes.periods}
        periodsStorage={periodsRes.storage}
        examList={examList}
        initialSessions={sessions as any[]}
        initialMigrationStatus={migrationStatus}
        canManageLocks={canManageLocks}
      />
    </div>
  );
}
