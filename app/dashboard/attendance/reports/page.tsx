"use client";

import { useState, useEffect } from "react";
import { getAttendanceReport } from "@/app/actions/attendance";
import { format } from "date-fns";
import { ArrowLeft, Download, FileText, Search, Filter, BookOpen, UserCheck, UserX, Clock, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";

export default function AttendanceReportPage() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [month, setMonth] = useState<string>(currentMonth.toString());
  const [year, setYear] = useState<string>(currentYear.toString());
  const [type, setType] = useState<'student' | 'teacher'>('student');
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [madrasaInfo, setMadrasaInfo] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>("");

  // Client-side filtering states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("All");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");

  useEffect(() => {
    async function loadMadrasa() {
      const res = await getMadrasaProfileWithLogo();
      if (res) {
        setMadrasaInfo(res.madrasa);
        setLogoUrl(res.logoUrl);
      }
    }
    loadMadrasa();
  }, []);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const reportData = await getAttendanceReport(month, year, type);
      setData(reportData);
      setLoading(false);
    }
    loadReport();
  }, [month, year, type]);

  // Reset local filters when report type changes
  useEffect(() => {
    setSearchTerm("");
    setSelectedClass("All");
    setAttendanceStatusFilter("all");
  }, [type]);

  const handlePrint = () => {
    window.print();
  };

  // Extract unique classes from student data for dropdown
  const uniqueClasses = Array.from(
    new Set(
      data
        .map((item) => item.classes?.name)
        .filter(Boolean)
    )
  ).sort() as string[];

  // Filter logic
  const filteredData = data.filter((item) => {
    // 1. Search term filter (matches name, roll, or designation)
    const fullName = `${item.first_name || ""} ${item.last_name || ""}`.toLowerCase();
    const designation = (item.designation || "").toLowerCase();
    const roll = (item.roll_number || "").toString().toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) || 
      designation.includes(searchTerm.toLowerCase()) ||
      roll.includes(searchTerm.toLowerCase());

    // 2. Class filter (only for students)
    const matchesClass = 
      type === 'teacher' || 
      selectedClass === 'All' || 
      item.classes?.name === selectedClass;

    // 3. Attendance Status filter
    let matchesStatus = true;
    if (attendanceStatusFilter === 'has_absent') {
      matchesStatus = (item.stats?.absent || 0) > 0;
    } else if (attendanceStatusFilter === 'no_absent') {
      matchesStatus = (item.stats?.absent || 0) === 0;
    } else if (attendanceStatusFilter === 'has_late') {
      matchesStatus = (item.stats?.late || 0) > 0;
    } else if (attendanceStatusFilter === 'has_leave') {
      matchesStatus = (item.stats?.leave || 0) > 0;
    }

    return matchesSearch && matchesClass && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 print:hidden">
        <Link
          href="/dashboard/attendance"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">উপস্থিতি রিপোর্ট</h1>
          <p className="text-slate-500 text-sm">মাসিক উপস্থিতির পরিসংখ্যান এবং উন্নত ফিল্টার</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 print:shadow-none print:border-none print:p-0">
        {/* Main query selection controls */}
        <div className="flex flex-col md:flex-row gap-4 items-end mb-6 print:hidden">
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">রিপোর্টের ধরন</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as 'student' | 'teacher')}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            >
              <option value="student">শিক্ষার্থী</option>
              <option value="teacher">শিক্ষক ও স্টাফ</option>
            </select>
          </div>
          
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">মাস</label>
            <select 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            >
              <option value="1">জানুয়ারি</option>
              <option value="2">ফেব্রুয়ারি</option>
              <option value="3">মার্চ</option>
              <option value="4">এপ্রিল</option>
              <option value="5">মে</option>
              <option value="6">জুন</option>
              <option value="7">জুলাই</option>
              <option value="8">আগস্ট</option>
              <option value="9">সেপ্টেম্বর</option>
              <option value="10">অক্টোবর</option>
              <option value="11">নভেম্বর</option>
              <option value="12">ডিসেম্বর</option>
            </select>
          </div>

          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">বছর</label>
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            >
              <option value={(currentYear - 1).toString()}>{currentYear - 1}</option>
              <option value={currentYear.toString()}>{currentYear}</option>
              <option value={(currentYear + 1).toString()}>{currentYear + 1}</option>
            </select>
          </div>
          
          <div className="ml-auto w-full md:w-auto">
            <button 
              onClick={handlePrint}
              className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition font-medium"
            >
              <FileText className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

        {/* Client-side Filtering controls */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 print:hidden">
            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">অনুসন্ধান</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={type === 'student' ? "নাম বা রোল নম্বর..." : "নাম বা পদবী..."}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>
            </div>

            {/* Class Filter (only for students) */}
            {type === 'student' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">শ্রেণী নির্বাচন</label>
                <div className="relative">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                  >
                    <option value="All">সকল শ্রেণী (All Classes)</option>
                    {uniqueClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Attendance Status Filter */}
            <div className={type === 'student' ? '' : 'md:col-span-2'}>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">উপস্থিতি অবস্থা</label>
              <select
                value={attendanceStatusFilter}
                onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              >
                <option value="all">সবাই (সব হাজিরা রেকর্ড)</option>
                <option value="has_absent">অনুপস্থিতি আছে এমন (অনুপস্থিত &gt; ০)</option>
                <option value="no_absent">শতভাগ উপস্থিত (কোনো অনুপস্থিতি নেই)</option>
                <option value="has_late">দেরি হয়েছে এমন (দেরি &gt; ০)</option>
                <option value="has_leave">ছুটি নিয়েছেন এমন (ছুটি &gt; ০)</option>
              </select>
            </div>
          </div>
        )}

        {/* KPI highlights */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:hidden">
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
              <span className="text-xs text-slate-500 font-medium">মোট দেখানো হচ্ছে</span>
              <span className="text-lg font-bold text-slate-800">{filteredData.length} জন</span>
            </div>
            <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 flex flex-col justify-center">
              <span className="text-xs text-red-600/80 font-medium">অনুপস্থিতি আছে</span>
              <span className="text-lg font-bold text-red-700">
                {filteredData.filter(item => (item.stats?.absent || 0) > 0).length} জন
              </span>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 flex flex-col justify-center">
              <span className="text-xs text-emerald-600/80 font-medium">শতভাগ উপস্থিত</span>
              <span className="text-lg font-bold text-emerald-700">
                {filteredData.filter(item => (item.stats?.absent || 0) === 0 && (item.stats?.total || 0) > 0).length} জন
              </span>
            </div>
            <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 flex flex-col justify-center">
              <span className="text-xs text-amber-600/80 font-medium">দেরি বা লেট হয়েছে</span>
              <span className="text-lg font-bold text-amber-700">
                {filteredData.filter(item => (item.stats?.late || 0) > 0).length} জন
              </span>
            </div>
          </div>
        )}

        {/* Print Header & Content Wrapped inside Madrasa Letterpad */}
        <PrintLetterpad madrasaInfo={madrasaInfo} logoUrl={logoUrl}>
          <div className="mb-6 text-center border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-800">
              {type === 'student' ? 'শিক্ষার্থীদের' : 'শিক্ষক ও স্টাফদের'} মাসিক উপস্থিতি রিপোর্ট
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              মাস: {month === "1" ? "জানুয়ারি" : month === "2" ? "ফেব্রুয়ারি" : month === "3" ? "মার্চ" : month === "4" ? "এপ্রিল" : month === "5" ? "মে" : month === "6" ? "জুন" : month === "7" ? "জুলাই" : month === "8" ? "আগস্ট" : month === "9" ? "সেপ্টেম্বর" : month === "10" ? "অক্টোবর" : month === "11" ? "নভেম্বর" : "ডিসেম্বর"} / বছর: {year}
            </p>
            {selectedClass !== 'All' && type === 'student' && (
              <p className="text-slate-700 font-semibold text-xs mt-1">শ্রেণী: {selectedClass}</p>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500">রিপোর্ট তৈরি হচ্ছে...</div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-slate-500">কোনো তথ্য পাওয়া যায়নি।</div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
              <p className="text-slate-500 font-medium">আপনার ফিল্টার অনুযায়ী কোনো তথ্য পাওয়া যায়নি।</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedClass("All");
                  setAttendanceStatusFilter("all");
                }}
                className="px-4 py-1.5 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
              >
                ফিল্টার রিসেট করুন
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-medium border-b print:bg-white print:border-b-2 print:border-black">
                  <tr>
                    <th className="px-4 py-3 print:border print:border-slate-300">নাম</th>
                    {type === 'student' && <th className="px-4 py-3 print:border print:border-slate-300">ক্লাস</th>}
                    {type === 'student' && <th className="px-4 py-3 print:border print:border-slate-300">রোল</th>}
                    {type === 'teacher' && <th className="px-4 py-3 print:border print:border-slate-300">পদবী</th>}
                    <th className="px-4 py-3 text-center print:border print:border-slate-300 text-emerald-600">উপস্থিত</th>
                    <th className="px-4 py-3 text-center print:border print:border-slate-300 text-red-600">অনুপস্থিত</th>
                    <th className="px-4 py-3 text-center print:border print:border-slate-300 text-amber-600">দেরি</th>
                    <th className="px-4 py-3 text-center print:border print:border-slate-300 text-purple-600">ছুটি</th>
                    <th className="px-4 py-3 text-center print:border print:border-slate-300">মোট দিন</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-600">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition print:hover:bg-white">
                      <td className="px-4 py-3 font-medium text-slate-900 print:border print:border-slate-300">
                        {item.first_name} {item.last_name}
                      </td>
                      {type === 'student' && <td className="px-4 py-3 print:border print:border-slate-300">{item.classes?.name || '-'}</td>}
                      {type === 'student' && <td className="px-4 py-3 print:border print:border-slate-300">{item.roll_number || '-'}</td>}
                      {type === 'teacher' && <td className="px-4 py-3 print:border print:border-slate-300">{item.designation || '-'}</td>}
                      
                      <td className="px-4 py-3 text-center font-medium text-emerald-600 print:border print:border-slate-300">{item.stats.present}</td>
                      <td className="px-4 py-3 text-center font-medium text-red-600 print:border print:border-slate-300">{item.stats.absent}</td>
                      <td className="px-4 py-3 text-center font-medium text-amber-600 print:border print:border-slate-300">{item.stats.late}</td>
                      <td className="px-4 py-3 text-center font-medium text-purple-600 print:border print:border-slate-300">{item.stats.leave}</td>
                      <td className="px-4 py-3 text-center font-medium text-slate-900 print:border print:border-slate-300">{item.stats.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PrintLetterpad>
      </div>
    </div>
  );
}
