"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Plus, List, ArrowUpDown, Award, Trash2, BookOpen, 
  Settings, ArrowRight, UserCheck, AlertTriangle, RefreshCw, 
  CheckSquare, Square, CheckCircle2, ChevronRight, GraduationCap,
  Layers, Users, ShieldCheck, Edit, X, Save, Search,
  Phone, Briefcase, Printer, UserX, UserPlus, Filter, Sparkles
} from "lucide-react";
import { 
  deleteClass, 
  updateClass, 
  updateClassSequences, 
  getClasses,
  assignClassTeacher,
  AvailableTeacher,
  EnrichedClassItem
} from "@/app/actions/classes";

interface ClassesClientProps {
  initialClasses: EnrichedClassItem[];
  availableTeachers: AvailableTeacher[];
}

export default function ClassesClient({ initialClasses, availableTeachers = [] }: ClassesClientProps) {
  const [activeTab, setActiveTab] = useState<"list" | "jimmadar" | "sequence">("list");
  const [classes, setClasses] = useState<EnrichedClassItem[]>(initialClasses || []);
  const [teachers, setTeachers] = useState<AvailableTeacher[]>(availableTeachers || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "assigned" | "unassigned">("all");
  const [isSavingSequence, setIsSavingSequence] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Class Modal State
  const [editingClass, setEditingClass] = useState<EnrichedClassItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    sequence: 0,
    classTeacherId: "NONE",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Quick In-Charge Assignment Modal State
  const [assignModalClass, setAssignModalClass] = useState<EnrichedClassItem | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<string>("NONE");
  const [isAssigningTeacher, setIsAssigningTeacher] = useState(false);

  // In-line assignments state for Matrix tab (classId -> teacherId)
  const [matrixAssignments, setMatrixAssignments] = useState<Record<string, string>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  // Sequence Configuration State
  const [seqMap, setSeqMap] = useState<Record<string, number>>({});

  // Sync initial matrix and sequence map
  useEffect(() => {
    const sMap: Record<string, number> = {};
    const mMap: Record<string, string> = {};
    (classes || []).forEach((c) => {
      sMap[c.id] = c.sequence ?? 0;
      mMap[c.id] = c.class_teacher_id || "NONE";
    });
    setSeqMap(sMap);
    setMatrixAssignments(mMap);
  }, [classes]);

  // Sync classes from server
  const reloadClasses = async () => {
    try {
      const data = await getClasses();
      if (data) {
        setClasses(data);
      }
    } catch (err) {
      console.error("reloadClasses error:", err);
    }
  };

  // Open Edit Modal
  const openEditModal = (cls: EnrichedClassItem) => {
    setEditingClass(cls);
    setEditFormData({
      name: cls.name,
      description: cls.description || "",
      sequence: cls.sequence ?? 0,
      classTeacherId: cls.class_teacher_id || "NONE",
    });
  };

  // Save Edit Form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setIsSavingEdit(true);
    try {
      const targetTeacherId = editFormData.classTeacherId === "NONE" ? null : editFormData.classTeacherId;
      const res = await updateClass(
        editingClass.id,
        editFormData.name,
        editFormData.description,
        editFormData.sequence,
        targetTeacherId
      );
      if (res?.success) {
        const assignedTeacherObj = teachers.find(t => t.id === targetTeacherId);
        setMsg({ 
          type: "success", 
          text: `"${editFormData.name}" জামাতের তথ্য ও শ্রেণি শিক্ষক সফলভাবে হালনাগাদ করা হয়েছে।` 
        });
        setClasses(prev => prev.map(c => c.id === editingClass.id ? {
          ...c,
          name: editFormData.name,
          description: editFormData.description,
          sequence: editFormData.sequence,
          class_teacher_id: assignedTeacherObj?.id || null,
          class_teacher_name: assignedTeacherObj?.name || null,
          class_teacher_code: assignedTeacherObj?.staff_id_code || null,
          class_teacher_designation: assignedTeacherObj?.designation || null,
          class_teacher_phone: assignedTeacherObj?.phone || null,
        } : c));
        setEditingClass(null);
        await reloadClasses();
      } else {
        setMsg({ type: "error", text: res?.error || "হালনাগাদ করা যায়নি।" });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "সার্ভার এরর হয়েছে।" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Quick Jimmadar Modal
  const openQuickAssignModal = (cls: EnrichedClassItem) => {
    setAssignModalClass(cls);
    setSelectedTeacherForAssign(cls.class_teacher_id || "NONE");
  };

  // Save Quick Jimmadar Assignment
  const handleSaveQuickAssign = async () => {
    if (!assignModalClass) return;
    setIsAssigningTeacher(true);
    try {
      const targetTeacherId = selectedTeacherForAssign === "NONE" ? null : selectedTeacherForAssign;
      const res = await assignClassTeacher(assignModalClass.id, targetTeacherId);
      if (res?.success) {
        const assignedTeacherObj = teachers.find(t => t.id === targetTeacherId);
        setMsg({
          type: "success",
          text: targetTeacherId 
            ? `"${assignModalClass.name}" জামাতের জিম্মাদার শিক্ষক হিসেবে "${assignedTeacherObj?.name}"-কে নিযুক্ত করা হয়েছে।`
            : `"${assignModalClass.name}" জামাত থেকে জিম্মাদার শিক্ষক অপসারণ করা হয়েছে।`
        });
        setClasses(prev => prev.map(c => c.id === assignModalClass.id ? {
          ...c,
          class_teacher_id: assignedTeacherObj?.id || null,
          class_teacher_name: assignedTeacherObj?.name || null,
          class_teacher_code: assignedTeacherObj?.staff_id_code || null,
          class_teacher_designation: assignedTeacherObj?.designation || null,
          class_teacher_phone: assignedTeacherObj?.phone || null,
        } : c));
        setAssignModalClass(null);
        await reloadClasses();
      } else {
        setMsg({ type: "error", text: res?.error || "শ্রেণি শিক্ষক নিযুক্ত করা যায়নি।" });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "সার্ভার এরর হয়েছে।" });
    } finally {
      setIsAssigningTeacher(false);
    }
  };

  // Save all Matrix assignments
  const handleSaveMatrixAssignments = async () => {
    setIsSavingMatrix(true);
    setMsg(null);
    try {
      let successCount = 0;
      for (const [classId, teacherId] of Object.entries(matrixAssignments)) {
        const targetTeacherId = teacherId === "NONE" ? null : teacherId;
        const currentClass = classes.find(c => c.id === classId);
        if (currentClass && (currentClass.class_teacher_id || "NONE") !== teacherId) {
          await assignClassTeacher(classId, targetTeacherId);
          successCount++;
        }
      }
      setMsg({
        type: "success",
        text: "সকল জামাতের শ্রেণি জিম্মাদার শিক্ষক তালিকা সফলভাবে সংরক্ষিত ও কার্যকর হয়েছে!"
      });
      await reloadClasses();
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "সংরক্ষণ করতে সমস্যা হয়েছে।" });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Handle Class Deletion
  const handleDeleteClass = async (id: string, name: string) => {
    if (confirm(`আপনি কি নিশ্চিত যে "${name}" জামাতটি মুছে ফেলতে চান? এর ফলে সংশ্লিষ্ট শিক্ষার্থী ও সাবজেক্ট লিংক প্রভাবিত হতে পারে।`)) {
      try {
        const res = await deleteClass(id);
        if (res?.success) {
          setMsg({ type: "success", text: `"${name}" জামাতটি সফলভাবে মুছে ফেলা হয়েছে।` });
          setClasses(prev => prev.filter(c => c.id !== id));
        } else {
          setMsg({ type: "error", text: res?.error || "মুছে ফেলা যায়নি।" });
        }
      } catch (err) {
        console.error("deleteClass failed:", err);
        setMsg({
          type: "error",
          text: "একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।",
        });
      }
    }
  };

  // Handle Sequence Change
  const handleSeqValChange = (id: string, val: number) => {
    setSeqMap(prev => ({
      ...prev,
      [id]: isNaN(val) ? 0 : Math.max(0, val)
    }));
  };

  // Save Custom Sequence
  const handleSaveSequence = async () => {
    setIsSavingSequence(true);
    setMsg(null);
    try {
      const dataPayload = Object.entries(seqMap).map(([id, sequence]) => ({
        id,
        sequence: Number(sequence)
      }));
      
      const res = await updateClassSequences(dataPayload);
      if (res.success) {
        setMsg({ type: "success", text: "শ্রেণীবিন্যাস ও জামাত ক্রম সফলভাবে সংরক্ষণ করা হয়েছে!" });
        await reloadClasses();
        setActiveTab("list");
      } else {
        setMsg({ type: "error", text: res.error || "ক্রম সংরক্ষণ করা যায়নি।" });
      }
    } catch {
      setMsg({ type: "error", text: "একটি সমস্যা হয়েছে।" });
    } finally {
      setIsSavingSequence(false);
    }
  };

  // Filtered and sorted classes
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      const matchSearch = !searchQuery || 
        cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cls.class_teacher_name && cls.class_teacher_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cls.description && cls.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (filterStatus === "assigned") return !!cls.class_teacher_id;
      if (filterStatus === "unassigned") return !cls.class_teacher_id;
      return true;
    });
  }, [classes, searchQuery, filterStatus]);

  // Summary stats
  const totalClassesCount = classes.length;
  const assignedClassesCount = classes.filter(c => !!c.class_teacher_id).length;
  const unassignedClassesCount = totalClassesCount - assignedClassesCount;
  const uniqueTeachersAssigned = new Set(classes.map(c => c.class_teacher_id).filter(Boolean)).size;

  const sortedClassesFlow = [...classes].sort((a, b) => a.sequence - b.sequence);
  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {msg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs animate-fade-in ${
          msg.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          <div className="flex items-center gap-2.5">
            {msg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-bold">{msg.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setMsg(null)} 
            className="text-xs hover:underline font-bold px-2 py-1 rounded cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {/* TAB 1: LIST */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("list");
              setMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none min-h-[44px] ${
              activeTab === "list"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
            }`}
          >
            <List className={`w-4 h-4 shrink-0 ${activeTab === "list" ? "text-white" : "text-emerald-600"}`} />
            <span className="truncate">জামাত তালিকা</span>
            <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-mono font-bold ${
              activeTab === "list" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {classes.length}
            </span>
          </button>

          {/* TAB 2: JIMMADAAR TEACHERS (শ্রেণি শিক্ষক বণ্টন) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("jimmadar");
              setMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none min-h-[44px] ${
              activeTab === "jimmadar"
                ? "bg-teal-700 text-white shadow-sm shadow-teal-700/30"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
            }`}
          >
            <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === "jimmadar" ? "text-white" : "text-teal-600"}`} />
            <span className="truncate">শ্রেণি জিম্মাদার শিক্ষক বণ্টন</span>
            <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-mono font-bold ${
              activeTab === "jimmadar" ? "bg-white/20 text-white" : "bg-teal-100 text-teal-800"
            }`}>
              {assignedClassesCount}/{totalClassesCount}
            </span>
          </button>

          {/* TAB 3: SEQUENCE */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("sequence");
              setMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none min-h-[44px] ${
              activeTab === "sequence"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
            }`}
          >
            <ArrowUpDown className={`w-4 h-4 shrink-0 ${activeTab === "sequence" ? "text-white" : "text-indigo-600"}`} />
            <span className="truncate">জামাত ক্রমবিন্যাস</span>
          </button>

          <Link href="/dashboard/students/promotion" className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200/80">
            <Award className="w-4 h-4 text-amber-600" /> শিক্ষার্থী প্রমোশন
          </Link>
        </div>

        {activeTab === "list" && (
          <Link
            href="/dashboard/classes/new"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-xs min-h-[44px] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন জামাত যোগ করুন</span>
          </Link>
        )}
      </div>

      {/* ================= TAB 1: CLASS LIST ================= */}
      {activeTab === "list" && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">মোট জামাত</p>
                <p className="text-lg font-black text-slate-900">{totalClassesCount} টি</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">জিম্মাদার নিযুক্ত</p>
                <p className="text-lg font-black text-teal-700">{assignedClassesCount} টি</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">জিম্মাদারবিহীন</p>
                <p className="text-lg font-black text-amber-700">{unassignedClassesCount} টি</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">নিযুক্ত শিক্ষক সংখ্যা</p>
                <p className="text-lg font-black text-indigo-700">{uniqueTeachersAssigned} জন</p>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="জামাতের নাম অথবা শ্রেণি শিক্ষকের নাম দিয়ে খুঁজুন..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e: any) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">সব জামাত ({classes.length})</option>
                <option value="assigned">জিম্মাদার নিযুক্ত ({assignedClassesCount})</option>
                <option value="unassigned">জিম্মাদার ছাড়া ({unassignedClassesCount})</option>
              </select>
            </div>
          </div>

          {/* Classes Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-700 text-xs text-center w-16">ক্রম</th>
                    <th className="p-4 font-bold text-slate-700 text-xs">জামাতের নাম</th>
                    <th className="p-4 font-bold text-slate-700 text-xs">শ্রেণি জিম্মাদার শিক্ষক (Class In-Charge)</th>
                    <th className="p-4 font-bold text-slate-700 text-xs hidden md:table-cell">বিবরণ</th>
                    <th className="p-4 font-bold text-slate-700 text-xs text-right w-64">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-500 font-medium">
                        কোনো জামাত পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredClasses.map((cls) => (
                      <tr key={cls.id} className="hover:bg-slate-50/70 transition duration-150">
                        <td className="p-4 text-center">
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs px-2.5 py-1 rounded-full">
                            {cls.sequence}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-sm">{cls.name}</div>
                          {cls.description && (
                            <div className="text-xs text-slate-400 truncate max-w-xs md:hidden mt-0.5">
                              {cls.description}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {cls.class_teacher_name ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                                {cls.class_teacher_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                                  <span>{cls.class_teacher_name}</span>
                                  {cls.class_teacher_code && (
                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                      {cls.class_teacher_code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>{cls.class_teacher_designation || "মুদাররিস"}</span>
                                  {cls.class_teacher_phone && (
                                    <span className="text-slate-400 font-mono">| 📞 {cls.class_teacher_phone}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openQuickAssignModal(cls)}
                                className="ml-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg border border-teal-200 transition cursor-pointer"
                                title="জিম্মাদার শিক্ষক পরিবর্তন করুন"
                              >
                                পরিবর্তন
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openQuickAssignModal(cls)}
                              className="px-3 py-1.5 border border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-100/70 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                              <span>+ জিম্মাদার শিক্ষক নির্ধারণ করুন</span>
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 max-w-xs truncate hidden md:table-cell">
                          {cls.description || "-"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Link 
                              href={`/dashboard/classes/${cls.id}/subjects`}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 rounded-xl hover:bg-emerald-100 transition flex items-center gap-1.5 border border-emerald-200"
                              title="বিষয় ও শিক্ষক বণ্টন"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                              <span>বিষয় বণ্টন</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => openEditModal(cls)}
                              className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition flex items-center gap-1.5 border border-indigo-200 cursor-pointer"
                              title="জামাত সম্পাদনা করুন"
                            >
                              <Edit className="w-3.5 h-3.5 text-indigo-600" />
                              <span>সম্পাদনা</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(cls.id, cls.name)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                              title="জামাত মুছে ফেলুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: JIMMADAAR ASSIGNMENT MATRIX ================= */}
      {activeTab === "jimmadar" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-teal-700 mb-1">
                  <UserCheck className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-900">
                    প্রতিটি জামাত ও শ্রেণির জিম্মাদার শিক্ষক নির্বাচন (Class Teacher Matrix)
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  হিফজ, নাজেরা, মিজান, নাহবেমীর ইত্যাদি প্রতিটি শ্রেণির জন্য একজন দায়িত্বপ্রাপ্ত জিম্মাদার শিক্ষক নির্বাচন করুন। তারা ঐ ক্লাসের উপস্থিতি, নজরদারি ও ছাত্র পরিচালনার প্রধান অভিভাবক শিক্ষক হিসেবে দায়িত্ব পালন করবেন।
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>তালিকা প্রিন্ট</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveMatrixAssignments}
                  disabled={isSavingMatrix || classes.length === 0}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSavingMatrix ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>সকল বণ্টন সংরক্ষণ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-teal-900 text-white">
                    <th className="p-3.5 font-bold text-xs text-center w-16">ক্রম</th>
                    <th className="p-3.5 font-bold text-xs w-48 sm:w-60">জামাতের নাম</th>
                    <th className="p-3.5 font-bold text-xs">শ্রেণি জিম্মাদার শিক্ষক নির্বাচন</th>
                    <th className="p-3.5 font-bold text-xs w-36 text-center">বর্তমান অবস্থা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">কোনো জামাত নেই।</td>
                    </tr>
                  ) : (
                    sortedClassesFlow.map((cls) => {
                      const selectedTeacherId = matrixAssignments[cls.id] || "NONE";
                      const isAssigned = selectedTeacherId !== "NONE";
                      const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

                      return (
                        <tr key={cls.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3.5 text-center">
                            <span className="bg-slate-100 font-mono font-bold text-xs px-2 py-0.5 rounded-full text-slate-700">
                              {cls.sequence}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{cls.name}</div>
                            {cls.description && (
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{cls.description}</div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <select
                                value={selectedTeacherId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMatrixAssignments(prev => ({
                                    ...prev,
                                    [cls.id]: val
                                  }));
                                }}
                                className={`w-full sm:max-w-md px-3 py-2 border rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-teal-500 outline-none transition ${
                                  isAssigned 
                                    ? "bg-emerald-50/40 border-emerald-300 text-emerald-950" 
                                    : "bg-white border-slate-300 text-slate-700"
                                }`}
                              >
                                <option value="NONE">-- কোনো শিক্ষক নির্ধারিত নেই --</option>
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    👨‍🏫 {t.name} {t.designation ? `(${t.designation})` : ""} {t.staff_id_code ? `[ID: ${t.staff_id_code}]` : ""}
                                  </option>
                                ))}
                              </select>

                              {currentTeacher?.phone && (
                                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                                  📞 {currentTeacher.phone}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            {isAssigned ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>নিযুক্ত</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>খালি</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveMatrixAssignments}
                disabled={isSavingMatrix || classes.length === 0}
                className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {isSavingMatrix ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>সকল জামাতের শ্রেণি শিক্ষক তালিকা সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: DEFINE SEQUENCE ================= */}
      {activeTab === "sequence" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <ArrowUpDown className="w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-900">জামাতের ক্রমবিন্যাস সাজান (Class Hierarchy)</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                এখানে আপনার মাদরাসার জামাতের স্তর অনুযায়ী ক্রমবিন্যাস নম্বর (যেমন: ১, ২, ৩...) উল্লেখ করুন। প্রমোশন দেওয়ার সময় শিক্ষার্থীরা ক্রমানুসারে নিম্ন থেকে উচ্চ শ্রেণীতে উন্নীত হবে।
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-w-2xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3.5 font-bold text-slate-700 text-xs">জামাতের নাম</th>
                    <th className="p-3.5 font-bold text-slate-700 text-xs w-56 text-center">ক্রম (Sequence Value)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-slate-500">কোনো জামাত নেই।</td>
                    </tr>
                  ) : (
                    classes.map((cls) => (
                      <tr key={cls.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3.5 text-slate-900 font-bold">{cls.name}</td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSeqValChange(cls.id, Math.max(0, (seqMap[cls.id] || 0) - 1))}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold transition cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={seqMap[cls.id] !== undefined ? seqMap[cls.id] : cls.sequence}
                              onChange={(e) => handleSeqValChange(cls.id, parseInt(e.target.value, 10))}
                              className="w-20 text-center py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSeqValChange(cls.id, (seqMap[cls.id] || 0) + 1)}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold transition cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSequence}
                disabled={isSavingSequence || classes.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {isSavingSequence ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>ক্রম সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= QUICK JIMMADAAR ASSIGNMENT MODAL ================= */}
      {assignModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-teal-700">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">
                  জিম্মাদার শিক্ষক নির্বাচন করুন
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalClass(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 font-bold">নির্বাচিত জামাত:</p>
                <p className="text-base font-black text-slate-900 mt-0.5">{assignModalClass.name}</p>
                {assignModalClass.class_teacher_name && (
                  <p className="text-xs text-teal-700 font-bold mt-1">
                    বর্তমান জিম্মাদার: {assignModalClass.class_teacher_name} ({assignModalClass.class_teacher_designation || "মুদাররিস"})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1.5">
                  দায়িত্বপ্রাপ্ত শিক্ষক নির্বাচন করুন *
                </label>
                <select
                  value={selectedTeacherForAssign}
                  onChange={(e) => setSelectedTeacherForAssign(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-bold bg-white text-slate-900 outline-none"
                >
                  <option value="NONE">-- কোনো শিক্ষক নির্ধারিত নয় (অপসারণ করুন) --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      👨‍🏫 {t.name} {t.designation ? `(${t.designation})` : ""} {t.staff_id_code ? `[ID: ${t.staff_id_code}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalClass(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  বাতিল
                </button>

                <button
                  type="button"
                  onClick={handleSaveQuickAssign}
                  disabled={isAssigningTeacher}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isAssigningTeacher ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>সংরক্ষণ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT CLASS MODAL ================= */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">জামাত সম্পাদনা করুন</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">জামাতের নাম *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="যেমন: হিফজ, নাজেরা, মিজান, নাহবেমীর..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                />
              </div>

              {/* Class Teacher Selector */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  শ্রেণি জিম্মাদার শিক্ষক (Class Teacher)
                </label>
                <select
                  value={editFormData.classTeacherId}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, classTeacherId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-slate-900"
                >
                  <option value="NONE">-- কোনো শিক্ষক নির্ধারিত নয় --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      👨‍🏫 {t.name} {t.designation ? `(${t.designation})` : ""} {t.staff_id_code ? `[ID: ${t.staff_id_code}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">ক্রম নম্বর (Sequence)</label>
                <input
                  type="number"
                  min={0}
                  value={editFormData.sequence}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, sequence: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-1">প্রমোশনের সময় এই ক্রম অনুযায়ী পরবর্তী জামাতে যাবে।</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">বিবরণ (ঐচ্ছিক)</label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="জামাতের সংক্ষিপ্ত বিবরণ বা অতিরিক্ত তথ্য..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  বাতিল
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? "সংরক্ষণ হচ্ছে..." : "হালনাগাদ করুন"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
