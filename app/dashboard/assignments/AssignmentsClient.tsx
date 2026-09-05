"use client";

import { useState, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Printer,
  RotateCw,
} from "lucide-react";
import {
  AssignmentItem,
  ASSIGNMENT_TYPE_MAP,
} from "@/lib/assignmentTypes";
import { getAssignments } from "@/app/actions/assignments";
import { toBanglaNumber } from "@/lib/numberToBangla";
import AssignmentCard from "@/components/assignments/AssignmentCard";
import AssignmentFormModal from "@/components/assignments/AssignmentFormModal";

interface AssignmentsClientProps {
  initialAssignments: AssignmentItem[];
  classes: any[];
}

export default function AssignmentsClient({
  initialAssignments,
  classes,
}: AssignmentsClientProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initialAssignments);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedTarget, setSelectedTarget] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AssignmentItem | null>(null);

  const refreshData = async () => {
    try {
      setLoading(true);
      const res = await getAssignments();
      if (res && res.assignments) {
        setAssignments(res.assignments);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Filtered assignments
  const filteredList = useMemo(() => {
    return assignments.filter((item) => {
      if (selectedClass !== "ALL" && item.class_id !== selectedClass) return false;
      if (selectedType !== "ALL" && item.type !== selectedType) return false;
      if (selectedTarget !== "ALL" && item.target_type !== selectedTarget) return false;
      if (filterDate && item.assigned_date !== filterDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchClass = item.class_name.toLowerCase().includes(q);
        const matchSubject = item.subject_name?.toLowerCase().includes(q) || false;
        const matchStudent = item.student_name?.toLowerCase().includes(q) || false;
        const matchTeacher = item.teacher_name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchClass && !matchSubject && !matchStudent && !matchTeacher) {
          return false;
        }
      }

      return true;
    });
  }, [assignments, selectedClass, selectedType, selectedTarget, filterDate, searchQuery]);

  // KPI counts
  const todayStr = new Date().toISOString().split("T")[0];
  const todayLessonsCount = assignments.filter(
    (a) => a.type === "TODAY_LESSON" || a.assigned_date === todayStr
  ).length;
  const tomorrowLessonsCount = assignments.filter((a) => a.type === "TOMORROW_LESSON").length;
  const homeworkCount = assignments.filter(
    (a) => a.type === "HOMEWORK" || a.type === "MEMORIZATION"
  ).length;
  const activeCount = assignments.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              দৈনিক অ্যাসাইনমেন্ট ও পড়া (Daily Lessons & Homework)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            ক্লাস ওয়ারি এবং নির্দিষ্ট ছাত্রের জন্য দৈনিক পড়া, বাড়ির কাজ এবং বইয়ের পৃষ্ঠা প্রেরণ করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="রিফ্রেশ করুন"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট শিট</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন পড়া / অ্যাসাইনমেন্ট দিন</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500">আজকের পড়া</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">
            {toBanglaNumber(todayLessonsCount)}
          </div>
          <p className="text-[11px] text-slate-400">আজকের নির্ধারিত পাঠ</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-blue-800">আগামীকালের পড়া</span>
          <div className="text-2xl sm:text-3xl font-black text-blue-700">
            {toBanglaNumber(tomorrowLessonsCount)}
          </div>
          <p className="text-[11px] text-blue-500">আগামীকালের জন্য প্রস্তুতব্য</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-amber-800">হোমওয়ার্ক ও হিফজ সবক</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-700">
            {toBanglaNumber(homeworkCount)}
          </div>
          <p className="text-[11px] text-amber-500">বাড়ির কাজ ও আমুক্তা</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500">মোট সক্রিয় অ্যাসাইনমেন্ট</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {toBanglaNumber(activeCount)}
          </div>
          <p className="text-[11px] text-slate-400">সর্বমোট নিবন্ধিত পাঠ</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="পড়ার শিরোনাম, বিষয়, আয়াত বা ছাত্রের নাম..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল জামাত / শ্রেণি</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল প্রকার পাঠ</option>
              {Object.entries(ASSIGNMENT_TYPE_MAP).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Filter */}
          <div>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল প্রাপক</option>
              <option value="CLASS">পুরো জামাত</option>
              <option value="STUDENT">নির্দিষ্ট ছাত্র</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assignments Cards Grid */}
      {filteredList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => (
            <AssignmentCard
              key={item.id}
              assignment={item}
              onEdit={(it) => {
                setEditingItem(it);
                setIsModalOpen(true);
              }}
              onRefresh={refreshData}
              canManage={true}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-1" />
          <h3 className="text-base font-bold text-slate-700">কোনো পড়া বা অ্যাসাইনমেন্ট পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            এই ফিল্টার বা তারিখে কোনো অ্যাসাইনমেন্ট রেকর্ড করা নেই। নতুন পড়া প্রদান করতে উপরের বাটনে ক্লিক করুন।
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন পড়া যোগ করুন</span>
          </button>
        </div>
      )}

      {/* Assignment Form Modal */}
      <AssignmentFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSaved={refreshData}
        classes={classes}
        initialData={editingItem}
      />
    </div>
  );
}
