"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Award, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Users, 
  Edit3, 
  Trash2, 
  FileText, 
  Printer, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { AddKitabLogModal, EditKitabLogModal, KitabDeleteButton } from "./kitab-actions";
import { useRouter } from "next/navigation";

interface KitabDashboardClientProps {
  students: any[];
  logs: any[];
  classes: any[];
}

export default function KitabDashboardClient({
  students,
  logs,
  classes,
}: KitabDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"students" | "logs" | "classes">("students");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [selectedRating, setSelectedRating] = useState<string>("All");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentForLog, setSelectedStudentForLog] = useState<string | undefined>(undefined);
  const [editingLog, setEditingLog] = useState<any | null>(null);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const roll = (s.roll_number || "").toString().toLowerCase();
      const className = (s.class_name || s.classes?.name || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = fullName.includes(term) || roll.includes(term) || className.includes(term);
      
      const matchesClass = 
        selectedClass === "All" || 
        s.class_name === selectedClass || 
        s.classes?.id === selectedClass ||
        s.classes?.name === selectedClass;

      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, selectedClass]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const studentName = `${log.students?.first_name || ""} ${log.students?.last_name || ""}`.toLowerCase();
      const roll = (log.students?.roll_number || "").toString().toLowerCase();
      const kitab = (log.kitab_name || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = studentName.includes(term) || roll.includes(term) || kitab.includes(term);
      
      const matchesClass = 
        selectedClass === "All" || 
        log.students?.class_name === selectedClass;

      const matchesRating = 
        selectedRating === "All" || 
        log.performance_rating === selectedRating;

      const matchesDate = 
        !selectedDate || 
        (log.log_date && log.log_date.startsWith(selectedDate));

      return matchesSearch && matchesClass && matchesRating && matchesDate;
    });
  }, [logs, searchTerm, selectedClass, selectedRating, selectedDate]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter((l) => l.log_date && l.log_date.startsWith(todayStr));
    const excellentOrGood = logs.filter((l) => l.performance_rating === "Excellent" || l.performance_rating === "Good");
    const satisfactionRate = logs.length > 0 ? Math.round((excellentOrGood.length / logs.length) * 100) : 100;
    
    // Unique kitabs
    const kitabsSet = new Set(logs.map((l) => l.kitab_name).filter(Boolean));

    return {
      totalStudents: students.length,
      todayLogsCount: todayLogs.length,
      satisfactionRate,
      activeKitabsCount: kitabsSet.size || 0,
    };
  }, [students, logs]);

  const handleOpenAddModal = (studentId?: string) => {
    setSelectedStudentForLog(studentId);
    setIsAddModalOpen(true);
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">কিতাব ট্র্যাকিং</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              শিক্ষা বিভাগ
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            শিক্ষার্থীদের কিতাব ভিত্তিক দৈনন্দিন পাঠ, সবক ও পারফরম্যান্স পরিচালনা ও মূল্যায়ন
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Add New Kitab Log Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ নতুন সবক / লগ এন্ট্রি</span>
          </button>

          {/* Add Student Link */}
          <Link
            href="/dashboard/students/new"
            className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold px-3.5 py-2.5 rounded-xl transition"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>+ শিক্ষার্থী ভর্তি</span>
          </Link>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
            title="প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">মোট কিতাব শিক্ষার্থী</div>
            <div className="text-xl font-bold text-slate-800">{stats.totalStudents} জন</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">আজকের সবক লগ</div>
            <div className="text-xl font-bold text-emerald-600">{stats.todayLogsCount} টি</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">সন্তোষজনক অগ্রগতি</div>
            <div className="text-xl font-bold text-slate-800">{stats.satisfactionRate}%</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">পাঠাধীন কিতাবসমূহ</div>
            <div className="text-xl font-bold text-slate-800">{stats.activeKitabsCount} টি</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("students")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "students"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>কিতাব শিক্ষার্থী তালিকা ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "logs"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>দৈনন্দিন সবক ও লগ হিস্ট্রি ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("classes")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "classes"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>জামাত ও কিতাব নির্দেশিকা</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === "logs" 
                ? "শিক্ষার্থী, রোল বা কিতাবের নাম দিয়ে খুঁজুন..."
                : "শিক্ষার্থীর নাম, রোল বা জামাত দিয়ে খুঁজুন..."
            }
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="All">সব জামাত / ক্লাস</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Rating filter (for logs tab) */}
          {activeTab === "logs" && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Award className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="All">সব পারফরম্যান্স</option>
                <option value="Excellent">চমৎকার (Excellent)</option>
                <option value="Good">ভালো (Good)</option>
                <option value="Average">মোটামুটি (Average)</option>
                <option value="Poor">উন্নতি প্রয়োজন (Poor)</option>
              </select>
            </div>
          )}

          {/* Date filter (for logs tab) */}
          {activeTab === "logs" && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate("")}
                  className="text-xs text-red-500 font-bold hover:underline ml-1"
                >
                  ক্লিয়ার
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: Students Table */}
      {activeTab === "students" && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-base font-semibold text-slate-700">কোনো কিতাব শিক্ষার্থী পাওয়া যায়নি</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                নতুন শিক্ষার্থী যোগ করে তাদের জামাত নির্ধারণ করুন অথবা ফিল্টার পরিবর্তন করুন।
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => handleOpenAddModal()}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ নতুন সবক এন্ট্রি</span>
                </button>
                <Link
                  href="/dashboard/students/new"
                  className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-200 transition"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>নতুন শিক্ষার্থী যোগ</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 font-bold w-16 text-center">রোল</th>
                    <th className="px-5 py-3.5 font-bold">শিক্ষার্থীর নাম</th>
                    <th className="px-5 py-3.5 font-bold">জামাত / ক্লাস</th>
                    <th className="px-5 py-3.5 font-bold">স্ট্যাটাস</th>
                    <th className="px-5 py-3.5 font-bold text-right">পদক্ষেপ (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4 text-center font-bold text-slate-800">
                        {student.roll_number || "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {student.id.substring(0, 8)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {student.class_name || student.classes?.name || "অনির্ধারিত"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>নিয়মিত</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Quick Add Log Button */}
                          <button
                            onClick={() => handleOpenAddModal(student.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition"
                            title="নতুন সবক যোগ করুন"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>+ সবক দিন</span>
                          </button>

                          {/* View Logs Button */}
                          <Link
                            href={`/dashboard/kitab/${student.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
                            title="বিস্তারিত লগ ইতিহাস"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>লগ ইতিহাস</span>
                          </Link>

                          {/* Student Profile */}
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            title="শিক্ষার্থীর প্রোফাইল"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: All Logs History with Edit & Delete */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <FileText className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-base font-semibold text-slate-700">কোনো কিতাব সবক লগ পাওয়া যায়নি</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                শিক্ষার্থীদের জন্য নতুন কিতাব সবক বা পাঠ লগ এন্ট্রি করুন।
              </p>
              <button
                onClick={() => handleOpenAddModal()}
                className="mt-2 inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ নতুন সবক এন্ট্রি</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">তারিখ</th>
                    <th className="px-5 py-3.5 font-bold">শিক্ষার্থী ও জামাত</th>
                    <th className="px-5 py-3.5 font-bold">কিতাবের নাম</th>
                    <th className="px-5 py-3.5 font-bold text-center">পৃষ্ঠা / অধ্যায়</th>
                    <th className="px-5 py-3.5 font-bold">পারফরম্যান্স</th>
                    <th className="px-5 py-3.5 font-bold">মন্তব্য</th>
                    <th className="px-5 py-3.5 font-bold text-right">পদক্ষেপ (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {log.log_date ? format(new Date(log.log_date), "dd MMM yyyy") : "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {log.students?.first_name} {log.students?.last_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          রোল: {log.students?.roll_number || 'N/A'} | {log.students?.class_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-semibold text-xs">
                          {log.kitab_name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-medium text-slate-700">
                        {log.page_from || log.page_to ? (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">
                            {log.page_from || '১'} - {log.page_to || '-'}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {log.performance_rating ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            log.performance_rating === 'Excellent' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            log.performance_rating === 'Good' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            log.performance_rating === 'Average' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {log.performance_rating === 'Excellent' ? 'চমৎকার' :
                             log.performance_rating === 'Good' ? 'ভালো' :
                             log.performance_rating === 'Average' ? 'মোটামুটি' : 'উন্নতি প্রয়োজন'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">অনির্ধারিত</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600 max-w-xs truncate">
                        {log.notes || "-"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Log Button */}
                          <button
                            onClick={() => setEditingLog(log)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                            title="লগ সম্পাদনা করুন"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete Log Button */}
                          <KitabDeleteButton
                            logId={log.id}
                            studentId={log.student_id}
                            onDeleted={handleRefresh}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Classes & Curriculum Overview */}
      {activeTab === "classes" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const classStudents = students.filter(
              (s) => s.class_name === cls.name || s.classes?.id === cls.id
            );
            const classLogs = logs.filter(
              (l) => l.students?.class_name === cls.name
            );

            return (
              <div key={cls.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-slate-800 text-base">{cls.name}</h3>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-md">
                      {classStudents.length} জন শিক্ষার্থী
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    মোট রেকর্ডকৃত সবক লগ: <span className="font-bold text-slate-700">{classLogs.length} টি</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <button
                    onClick={() => {
                      setSelectedClass(cls.name);
                      setActiveTab("students");
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <span>শিক্ষার্থী তালিকা দেখুন</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenAddModal()}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md"
                  >
                    + সবক এন্ট্রি
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddKitabLogModal
        students={students}
        selectedStudentId={selectedStudentForLog}
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedStudentForLog(undefined);
        }}
        onCreated={handleRefresh}
      />

      <EditKitabLogModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
        onUpdated={handleRefresh}
      />
    </div>
  );
}
