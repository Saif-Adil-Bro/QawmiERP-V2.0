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

interface TeacherAssignmentsClientProps {
  initialAssignments: AssignmentItem[];
  classes: any[];
  teacherName: string;
}

export default function TeacherAssignmentsClient({
  initialAssignments,
  classes,
  teacherName,
}: TeacherAssignmentsClientProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initialAssignments);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal
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

  const filteredList = useMemo(() => {
    return assignments.filter((item) => {
      if (selectedClass !== "ALL" && item.class_id !== selectedClass) return false;
      if (selectedType !== "ALL" && item.type !== selectedType) return false;
      if (filterDate && item.assigned_date !== filterDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchClass = item.class_name.toLowerCase().includes(q);
        const matchSubject = item.subject_name?.toLowerCase().includes(q) || false;
        const matchStudent = item.student_name?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchClass && !matchSubject && !matchStudent) {
          return false;
        }
      }

      return true;
    });
  }, [assignments, selectedClass, selectedType, filterDate, searchQuery]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayCount = assignments.filter(
    (a) => a.type === "TODAY_LESSON" || a.assigned_date === todayStr
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              দৈনিক পড়া ও অ্যাসাইনমেন্ট প্রেরণ (Teacher Portal)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            ক্লাসের পাঠদান শেষে আজকের পড়া, আগামীকালের সবক বা হোমওয়ার্ক বইয়ের ছবিসহ পাঠিয়ে দিন।
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
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
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন পড়া বা কাজ দিন</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="পড়ার নাম, কিতাব বা ছাত্র..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

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
        </div>
      </div>

      {/* Assignments Cards List */}
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
          <h3 className="text-base font-bold text-slate-700">কোনো পড়া পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            ক্লাসের শিক্ষার্থীদের জন্য আজকের পড়া বা বাড়ির কাজ প্রদান করতে উপরের বাটনে ক্লিক করুন।
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
            <span>নতুন পড়া দিন</span>
          </button>
        </div>
      )}

      {/* Form Modal */}
      <AssignmentFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSaved={refreshData}
        classes={classes}
        initialData={editingItem}
        defaultTeacherName={teacherName}
      />
    </div>
  );
}
