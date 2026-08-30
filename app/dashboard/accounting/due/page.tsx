import { getDueManagementData } from "@/app/actions/fee-management";
import { getAcademicSessions } from "@/app/actions/sessions";
import { getClasses } from "@/app/actions/students";
import DueClient from "./DueClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function DueManagementPage() {
  const [dueData, sessions, classes] = await Promise.all([
    getDueManagementData(),
    getAcademicSessions(),
    getClasses(),
  ]);

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
            <h1 className="text-2xl font-bold text-slate-900">বকেয়া ফি ও ডিউ ট্র্যাকিং</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              শিক্ষার্থীদের বকেয়া ফি পর্যবেক্ষণ, এজিং অ্যানালাইসিস এবং এক ক্লিকে আদায়
            </p>
          </div>
        </div>
      </div>

      <DueClient
        initialData={dueData}
        sessions={sessions}
        classes={classes}
      />
    </div>
  );
}
