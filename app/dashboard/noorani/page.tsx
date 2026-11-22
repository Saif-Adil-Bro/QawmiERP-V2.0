"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, Filter, ChevronRight } from "lucide-react";
import { getClasses, getStudents } from "@/app/actions/students";
import { getAllNooraniProgressMap } from "@/app/actions/noorani";
import { NOORANI_TAKHTIS } from "@/lib/noorani-utils";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function NooraniTrackerPage() {
  const [classId, setClassId] = useState<string>("All");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [nooraniMap, setNooraniMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getClasses()
      .then((cls) => setClasses(cls || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getStudents(), getAllNooraniProgressMap()])
      .then(([allStudents, nMap]) => {
        if (!active) return;
        const list = Array.isArray(allStudents) ? allStudents : [];
        const filteredByClass =
          classId === "All" ? list : list.filter((s: any) => s.class_id === classId);
        setStudents(filteredByClass);
        setNooraniMap(nMap || {});
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const roll = String(s.roll_number || "").toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
  }, [students, searchQuery]);

  const getClassName = (student: any) => {
    if (!student.classes) return "N/A";
    if (Array.isArray(student.classes)) return student.classes[0]?.name || "N/A";
    return student.classes.name || "N/A";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">নূরানী ও তাজবীদ ট্র্যাকার</h1>
          <p className="text-slate-500 text-sm">
            নূরানী কায়দার ২৭ তখতি ও ১৭ মাখরাজের অগ্রগতি আলাদাভাবে ট্র্যাকিং ও মূল্যায়ন
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border-none focus:outline-none text-xs font-semibold text-slate-800 bg-transparent"
          >
            <option value="All">সকল জামাত</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">তথ্য লোড হচ্ছে...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5 font-bold text-xs">রোল নম্বর</th>
                  <th className="px-6 py-3.5 font-bold text-xs">শিক্ষার্থীর নাম</th>
                  <th className="px-6 py-3.5 font-bold text-xs">জামাত</th>
                  <th className="px-6 py-3.5 font-bold text-xs">বর্তমান তখতি ও মাখরাজ</th>
                  <th className="px-6 py-3.5 font-bold text-xs text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const nProg = nooraniMap[student.id];
                  const currentTakhti = nProg?.currentTakhtiId
                    ? NOORANI_TAKHTIS.find((t) => t.id === nProg.currentTakhtiId)
                    : null;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 text-slate-900 font-bold font-mono">
                        {student.roll_number || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {getClassName(student)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {currentTakhti ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200">
                              তখতি {toBanglaNumber(currentTakhti.id)}: {currentTakhti.title}
                            </span>
                            {nProg?.makhrajWeaknesses?.length > 0 && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                {toBanglaNumber(nProg.makhrajWeaknesses.length)} মাখরাজ
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">প্রারম্ভিক / নির্ধারিত নয়</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/noorani/${student.id}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200/70 transition"
                        >
                          <span>তখতি আপডেট</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
