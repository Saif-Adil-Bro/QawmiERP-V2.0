import { getAcademicSessions } from "@/app/actions/sessions";
import { getClasses } from "@/app/actions/students";
import { getFeeTypes } from "@/app/actions/fee-management";
import GenerateClient from "./GenerateClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function GenerateFeesPage() {
  const [sessions, classes, feeTypes] = await Promise.all([
    getAcademicSessions(),
    getClasses(),
    getFeeTypes(),
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3">
        <Link
          href="/dashboard/accounting"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">মাসিক ফি জেনারেট করুন</h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            এক ক্লিকে সকল শিক্ষার্থীর জন্য শিক্ষাবর্ষ ও মাস অনুযায়ী স্বয়ংক্রিয় ফি চার্জ তৈরি
          </p>
        </div>
      </div>

      <GenerateClient
        sessions={sessions}
        classes={classes}
        feeTypes={feeTypes}
      />
    </div>
  );
}
