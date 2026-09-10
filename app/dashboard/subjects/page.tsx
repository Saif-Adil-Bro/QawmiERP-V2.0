import { getSubjects } from "@/app/actions/subjects";
import Link from "next/link";
import { Plus, BookOpen, Layers } from "lucide-react";
import SubjectActions from "./SubjectActions";

export default async function SubjectsPage() {
  const subjects = await getSubjects();

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">বিষয় ও কিতাব তালিকা</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              মাদরাসার সকল জামাত ও ক্লাসের পাঠ্য বিষয় এবং কিতাব ব্যবস্থাপনা
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            মোট বিষয়: {subjects?.length || 0}টি
          </span>
          <Link
            href="/dashboard/subjects/new"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন বিষয় যোগ করুন</span>
          </Link>
        </div>
      </div>

      {/* Subjects Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-600">
                <th className="p-4 pl-6">বিষয় / কিতাবের নাম</th>
                <th className="p-4">কোড</th>
                <th className="p-4">বিবরণ</th>
                <th className="p-4 pr-6 text-right">অ্যাকশন (সম্পাদনা / মুছুন)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {subjects?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Layers className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">কোনো বিষয় বা কিতাব পাওয়া যায়নি।</p>
                      <p className="text-xs text-slate-400">
                        উপরের "নতুন বিষয় যোগ করুন" বাটনে ক্লিক করে প্রথম বিষয় যুক্ত করুন।
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                subjects?.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 pl-6 text-slate-900 font-bold">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{sub.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 font-mono text-xs font-semibold">
                      {sub.code ? (
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded">
                          {sub.code}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 text-xs max-w-md truncate">
                      {sub.description || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <SubjectActions subject={sub} subjectId={sub.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

