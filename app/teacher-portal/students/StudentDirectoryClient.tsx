"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Phone,
  MessageSquare,
  GraduationCap,
  Heart,
  Calendar,
  Layers,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  classes: any[];
  students: any[];
  currentClassId: string;
}

export default function StudentDirectoryClient({
  classes,
  students,
  currentClassId,
}: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/teacher-portal/students?class_id=${e.target.value}`);
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        s.guardian_name?.toLowerCase().includes(q) ||
        s.guardian_phone?.includes(q) ||
        String(s.roll_number || "").includes(q) ||
        String(s.student_id || "").toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">শিক্ষার্থী ও অভিভাবক ডিরেক্টরি</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থীদের রোল, রক্তের গ্রুপ এবং অভিভাবকদের সাথে সরাসরি কল বা SMS যোগাযোগ করুন।
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-64 shrink-0">
          <select
            value={currentClassId}
            onChange={handleClassChange}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম, রোল, অভিভাবক বা ফোন নম্বর দিয়ে সার্চ করুন..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 font-bold text-base flex items-center justify-center shrink-0">
                    {(s.first_name || "শ")[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                      {s.first_name} {s.last_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      রোল: <strong className="text-slate-800">{toBanglaNumber(s.roll_number || "-")}</strong> | আইডি: {s.student_id || s.id.slice(0, 6)}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {s.status === "Active" ? "সক্রিয়" : "অধ্যয়নরত"}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">জামাত:</span>
                  <span className="font-semibold text-slate-900">{s.classes?.name || s.class_name || "হিফজ"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">অভিভাবকের নাম:</span>
                  <span className="font-semibold text-slate-900">{s.guardian_name || s.father_name || "অনির্দিষ্ট"}</span>
                </div>
                {s.blood_group && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">রক্তের গ্রুপ:</span>
                    <span className="font-bold text-red-600 flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current" />
                      {s.blood_group}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons: 1-click Call & SMS */}
              {s.guardian_phone ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${s.guardian_phone}`}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>কল দিন</span>
                  </a>
                  <a
                    href={`sms:${s.guardian_phone}`}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>SMS পাঠান</span>
                  </a>
                </div>
              ) : (
                <div className="text-center py-2 bg-slate-100 text-slate-400 text-xs rounded-xl font-medium">
                  মোবাইল নম্বর যুক্ত নেই
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700">কোন শিক্ষার্থী পাওয়া যায়নি</h4>
            <p className="text-xs text-slate-400 mt-1">অন্য জামাত নির্বাচন করুন অথবা সার্চ কুয়েরি পরিবর্তন করুন।</p>
          </div>
        )}
      </div>
    </div>
  );
}
