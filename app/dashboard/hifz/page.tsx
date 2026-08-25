"use client";

import { getHifzStudents } from "@/app/actions/hifz";
import { getClasses } from "@/app/actions/students";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useState, useEffect } from "react";

export default function HifzPage() {
  const [classId, setClassId] = useState<string>("All");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClasses() {
      const cls = await getClasses();
      setClasses(cls);
    }
    loadClasses();
  }, []);

  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      const data = await getHifzStudents(classId);
      setStudents(data);
      setLoading(false);
    }
    loadStudents();
  }, [classId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">হিফজ ট্র্যাকিং</h1>
          <p className="text-slate-500 text-sm">দৈনন্দিন সবক, সবকী এবং আমুখতা পরিচালনা করুন</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
          <label htmlFor="class_id" className="text-sm font-medium text-slate-600">ক্লাস:</label>
          <select
            id="class_id"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800 bg-transparent"
          >
            <option value="All">সব ক্লাস</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">লোড হচ্ছে...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p>কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
            <p className="text-sm mt-1">শিক্ষার্থী যুক্ত করুন এবং নির্দিষ্ট ক্লাস নির্বাচন করুন।</p>
            <Link href="/dashboard/students/new" className="inline-block mt-4 text-blue-600 hover:underline">
              নতুন শিক্ষার্থী
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">রোল নম্বর</th>
                  <th className="px-6 py-4 font-medium">শিক্ষার্থীর নাম</th>
                  <th className="px-6 py-4 font-medium">ক্লাস</th>
                  <th className="px-6 py-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-slate-900 font-medium">{student.roll_number || '-'}</td>
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        {student.classes?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/hifz/${student.id}`}
                        className="inline-flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md"
                      >
                        <span>লগ দেখুন</span>
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
