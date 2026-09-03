"use client";

import { getHifzStudents } from "@/app/actions/hifz";
import { getClasses } from "@/app/actions/students";
import Link from "next/link";
import { BookOpen, Search, Users, Sparkles, Filter, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

export default function HifzPage() {
  const [classId, setClassId] = useState<string>("All");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadClasses() {
      try {
        const cls = await getClasses();
        setClasses(cls || []);
      } catch (err) {
        console.error("loadClasses failed:", err);
      }
    }
    loadClasses();
  }, []);

  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      try {
        const data = await getHifzStudents(classId);
        setStudents(data || []);
      } catch (err) {
        console.error("getHifzStudents failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, [classId]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const roll = (s.roll_number || "").toString().toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
  }, [students, searchQuery]);

  const getClassName = (student: any) => {
    if (!student.classes) return "N/A";
    if (Array.isArray(student.classes)) {
      return student.classes[0]?.name || "N/A";
    }
    return student.classes.name || "N/A";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">হিফজুল কুরআন ট্র্যাকিং</h1>
          <p className="text-slate-500 text-sm">দৈনন্দিন সবক, সবকী এবং আমুখতার অগ্রগতি তদারকি ও মূল্যায়ন</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">মোট হিফজ শিক্ষার্থী</div>
            <div className="text-xl font-bold text-slate-800">{students.length} জন</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">ফিল্টারকৃত জামাত</div>
            <div className="text-sm font-bold text-slate-800 truncate">
              {classId === "All" ? "সকল জামাত" : classes.find(c => c.id === classId)?.name || "নির্বাচিত জামাত"}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">খুঁজে পাওয়া গেছে</div>
            <div className="text-xl font-bold text-slate-800">{filteredStudents.length} জন</div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
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
          <label htmlFor="class_id" className="text-xs font-bold text-slate-600 shrink-0">জামাত:</label>
          <select
            id="class_id"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border-none focus:outline-none text-xs font-semibold text-slate-800 bg-transparent"
          >
            <option value="All">সকল জামাত</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">তথ্য লোড হচ্ছে...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="font-semibold text-slate-700">কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
            <p className="text-xs text-slate-400 mt-1">অনুসন্ধান ফিল্টার পরিবর্তন করুন বা নতুন শিক্ষার্থী ভর্তি করুন।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5 font-bold text-xs">রোল নম্বর</th>
                  <th className="px-6 py-3.5 font-bold text-xs">শিক্ষার্থীর নাম</th>
                  <th className="px-6 py-3.5 font-bold text-xs">জামাত</th>
                  <th className="px-6 py-3.5 font-bold text-xs text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
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
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/hifz/${student.id}`}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-200 transition"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>লগ দেখুন ও এন্ট্রি করুন</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

