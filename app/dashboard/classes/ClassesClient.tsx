"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Plus, List, ArrowUpDown, Award, Trash2, BookOpen, 
  Settings, ArrowRight, UserCheck, AlertTriangle, RefreshCw, 
  CheckSquare, Square, CheckCircle2, ChevronRight, GraduationCap,
  Layers, Users, ShieldCheck
} from "lucide-react";
import { deleteClass, updateClassSequences, getStudentsByClass, promoteStudents, getClasses } from "@/app/actions/classes";

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  sequence: number;
}

interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string | null;
  father_name: string | null;
}

export default function ClassesClient({ initialClasses }: { initialClasses: ClassItem[] }) {
  const [activeTab, setActiveTab] = useState<"list" | "sequence" | "promotion">("list");
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses || []);
  const [isSavingSequence, setIsSavingSequence] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sequence Configuration State
  const [seqMap, setSeqMap] = useState<Record<string, number>>({});

  // Promotion Portal State
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Sync sequence map when classes change
  useEffect(() => {
    const map: Record<string, number> = {};
    (classes || []).forEach(c => {
      map[c.id] = c.sequence ?? 0;
    });
    setSeqMap(map);
  }, [classes]);

  // Sync classes from server
  const reloadClasses = async () => {
    try {
      const data = await getClasses();
      if (data) {
        setClasses(data as ClassItem[]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch students for promotion when fromClassId changes
  useEffect(() => {
    if (!fromClassId) {
      setStudents([]);
      setSelectedStudentIds({});
      return;
    }

    let isMounted = true;
    async function load() {
      setIsLoadingStudents(true);
      try {
        const list = await getStudentsByClass(fromClassId);
        if (isMounted) {
          setStudents(list || []);
          // Auto select all students initially
          const selMap: Record<string, boolean> = {};
          (list || []).forEach(s => {
            selMap[s.id] = true;
          });
          setSelectedStudentIds(selMap);
        }
      } catch (err) {
        console.error("Error loading students:", err);
      } finally {
        if (isMounted) {
          setIsLoadingStudents(false);
        }
      }
    }

    load();

    // Auto-select target next class based on sequence hierarchy
    const sorted = [...classes].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sorted.findIndex(c => c.id === fromClassId);
    
    if (currentIndex !== -1 && currentIndex < sorted.length - 1) {
      setToClassId(sorted[currentIndex + 1].id);
    } else if (currentIndex !== -1 && currentIndex === sorted.length - 1) {
      setToClassId("graduated"); // If highest class, default to Graduated
    } else {
      setToClassId("");
    }

    return () => {
      isMounted = false;
    };
  }, [fromClassId, classes]);

  // Handle Class Deletion
  const handleDeleteClass = async (id: string, name: string) => {
    if (confirm(`আপনি কি নিশ্চিত যে "${name}" জামাতটি মুছে ফেলতে চান? এর ফলে সংশ্লিষ্ট শিক্ষার্থী ও সাবজেক্ট লিংক প্রভাবিত হতে পারে।`)) {
      const res = await deleteClass(id);
      if (res.success) {
        setMsg({ type: "success", text: `"${name}" জামাতটি সফলভাবে মুছে ফেলা হয়েছে।` });
        setClasses(prev => prev.filter(c => c.id !== id));
      } else {
        setMsg({ type: "error", text: res.error || "মুছে ফেলা যায়নি।" });
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

  // Toggle Single Student
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Toggle Select All
  const toggleSelectAll = () => {
    const allSelected = students.length > 0 && students.every(s => selectedStudentIds[s.id]);
    const nextMap: Record<string, boolean> = {};
    students.forEach(s => {
      nextMap[s.id] = !allSelected;
    });
    setSelectedStudentIds(nextMap);
  };

  // Execute Student Promotion
  const handleExecutePromotion = async () => {
    const studentIdsToPromote = Object.entries(selectedStudentIds)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (studentIdsToPromote.length === 0) {
      setMsg({ type: "error", text: "অনুগ্রহ করে অন্তত একজন শিক্ষার্থী নির্বাচন করুন।" });
      setShowConfirmModal(false);
      return;
    }

    setIsPromoting(true);
    setMsg(null);
    try {
      const res = await promoteStudents(studentIdsToPromote, toClassId || null);
      if (res.success) {
        setMsg({ 
          type: "success", 
          text: `সফলভাবে ${studentIdsToPromote.length} জন শিক্ষার্থীকে প্রমোশন দেওয়া হয়েছে!` 
        });
        setFromClassId("");
        setToClassId("");
        setStudents([]);
        setSelectedStudentIds({});
        await reloadClasses();
        setActiveTab("list");
      } else {
        setMsg({ type: "error", text: res.error || "প্রমোশন সম্পন্ন করা সম্ভব হয়নি।" });
      }
    } catch {
      setMsg({ type: "error", text: "সার্ভারে সমস্যা হয়েছে।" });
    } finally {
      setIsPromoting(false);
      setShowConfirmModal(false);
    }
  };

  const sortedClassesFlow = [...classes].sort((a, b) => a.sequence - b.sequence);
  const selectedStudentsCount = Object.values(selectedStudentIds).filter(Boolean).length;
  const currentClassObj = classes.find(c => c.id === fromClassId);
  const targetClassObj = toClassId === "graduated" ? { name: "শিক্ষা সমাপ্ত (Graduated)" } : classes.find(c => c.id === toClassId);

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
            <span className="text-xs sm:text-sm font-semibold">{msg.text}</span>
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
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {/* TAB 1: LIST */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("list");
              setMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none min-h-[44px] ${
              activeTab === "list"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
            }`}
          >
            <List className={`w-4 h-4 shrink-0 ${activeTab === "list" ? "text-white" : "text-emerald-600"}`} />
            <span className="truncate">জামাত তালিকা</span>
            <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-mono font-bold hidden xs:inline-block ${
              activeTab === "list" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {classes.length}
            </span>
          </button>

          {/* TAB 2: SEQUENCE */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("sequence");
              setMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none min-h-[44px] ${
              activeTab === "sequence"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
            }`}
          >
            <ArrowUpDown className={`w-4 h-4 shrink-0 ${activeTab === "sequence" ? "text-white" : "text-indigo-600"}`} />
            <span className="truncate">জামাত ক্রমবিন্যাস</span>
          </button>

          {/* TAB 3: PROMOTION */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("promotion");
              setMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none min-h-[44px] ${
              activeTab === "promotion"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
            }`}
          >
            <Award className={`w-4 h-4 shrink-0 ${activeTab === "promotion" ? "text-white" : "text-amber-600"}`} />
            <span className="truncate">শিক্ষার্থী প্রমোশন</span>
          </button>
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
          {/* Visual Sequence Flow */}
          {classes.length > 0 && (
            <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-indigo-600" />
                  মাদরাসার জামাত ক্রমবিন্যাস ফ্লোচার্ট (নিম্ন থেকে উচ্চ)
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("sequence")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  <span>ক্রম সাজান</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {sortedClassesFlow.map((cls, index) => (
                  <div key={cls.id} className="flex items-center">
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{cls.name}</span>
                      <span className="text-[10px] bg-white border text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                        ক্রম: {cls.sequence}
                      </span>
                    </div>
                    {index < sortedClassesFlow.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 mx-1 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classes Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-700 text-xs text-center w-20">ক্রম</th>
                    <th className="p-4 font-bold text-slate-700 text-xs">জামাতের নাম</th>
                    <th className="p-4 font-bold text-slate-700 text-xs">বিবরণ</th>
                    <th className="p-4 font-bold text-slate-700 text-xs text-right w-64">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-500 font-medium">
                        কোনো জামাত পাওয়া যায়নি। উপরে থাকা "নতুন জামাত যোগ করুন" বাটনে ক্লিক করে জামাত যোগ করুন।
                      </td>
                    </tr>
                  ) : (
                    classes.map((cls) => (
                      <tr key={cls.id} className="hover:bg-slate-50/70 transition duration-150">
                        <td className="p-4 text-center">
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs px-2.5 py-1 rounded-full">
                            {cls.sequence}
                          </span>
                        </td>
                        <td className="p-4 text-slate-900 font-bold">{cls.name}</td>
                        <td className="p-4 text-slate-500 max-w-xs truncate">{cls.description || "-"}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Link 
                              href={`/dashboard/classes/${cls.id}/subjects`}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 rounded-xl hover:bg-emerald-100 transition flex items-center gap-1.5 border border-emerald-200"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                              <span>বিষয় বরাদ্দ</span>
                            </Link>
                            
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

      {/* ================= TAB 2: DEFINE SEQUENCE ================= */}
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

      {/* ================= TAB 3: STUDENT PROMOTION PORTAL ================= */}
      {activeTab === "promotion" && (
        <div className="space-y-6 animate-fade-in">
          {/* Controls Selector Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <Award className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900">
                প্রমোশন ক্লাস ও টার্গেট ক্লাস নির্ধারণ করুন
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  বর্তমান জামাত (যেখান থেকে প্রমোশন হবে)
                </label>
                <select
                  value={fromClassId}
                  onChange={(e) => {
                    setFromClassId(e.target.value);
                    setMsg(null);
                  }}
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-800 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- বর্তমান জামাত নির্বাচন করুন --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (ক্রম: {cls.sequence})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  পরবর্তী জামাত (যেটিতে প্রমোশন পাবে)
                </label>
                <select
                  value={toClassId}
                  onChange={(e) => {
                    setToClassId(e.target.value);
                    setMsg(null);
                  }}
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-800 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  disabled={!fromClassId}
                >
                  <option value="">-- পরবর্তী জামাত নির্বাচন করুন --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id} disabled={cls.id === fromClassId}>
                      {cls.name} (ক্রম: {cls.sequence})
                    </option>
                  ))}
                  <option value="graduated" className="text-emerald-600 font-bold">
                    🎓 শিক্ষা সমাপ্ত / গ্র্যাজুয়েট (Graduated)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Students List Box */}
          {fromClassId && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-fade-in">
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                    {currentClassObj?.name} জামাতের শিক্ষার্থীদের তালিকা
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    মোট {students.length} জন শিক্ষার্থীর মধ্যে {selectedStudentsCount} জন নির্বাচিত।
                  </p>
                </div>

                {students.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-bold px-3.5 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                  >
                    {students.every(s => selectedStudentIds[s.id]) ? "সব আন-সিলেক্ট করুন" : "সব সিলেক্ট করুন"}
                  </button>
                )}
              </div>

              {isLoadingStudents ? (
                <div className="p-16 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
                  <span className="text-sm font-bold">শিক্ষার্থীদের তালিকা লোড হচ্ছে...</span>
                </div>
              ) : students.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-700">কোনো শিক্ষার্থী পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-400 mt-1">নির্বাচিত বর্তমান জামাতটিতে কোনো শিক্ষার্থীর ডাটা এন্ট্রি করা নেই।</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200">
                          <th className="p-3 text-center w-12 font-bold text-slate-500">সিলেক্ট</th>
                          <th className="p-3 text-center w-20 font-bold text-slate-500">রোল</th>
                          <th className="p-3 font-bold text-slate-700">শিক্ষার্থীর নাম</th>
                          <th className="p-3 font-bold text-slate-700">পিতার নাম</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {students.map((student) => {
                          const isSelected = !!selectedStudentIds[student.id];
                          return (
                            <tr 
                              key={student.id} 
                              onClick={() => toggleStudentSelection(student.id)}
                              className={`cursor-pointer transition duration-150 ${isSelected ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'}`}
                            >
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => toggleStudentSelection(student.id)}
                                  className="text-slate-600 focus:outline-none cursor-pointer"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-amber-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                                  )}
                                </button>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700">
                                {student.roll_number || "-"}
                              </td>
                              <td className="p-3 font-bold text-slate-900">
                                {student.first_name} {student.last_name}
                              </td>
                              <td className="p-3 text-slate-500">
                                {student.father_name || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary & Promotion Execution Bar */}
                  <div className="p-5 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-bold text-slate-800">
                        নির্বাচিত <span className="text-amber-600 font-black px-1 text-base">{selectedStudentsCount}</span> জন শিক্ষার্থীকে
                        <span className="text-indigo-600 font-bold"> {currentClassObj?.name}</span> জামাত থেকে
                        <span className="text-emerald-600 font-bold"> {targetClassObj?.name}</span>-এ স্থানান্তর করা হবে।
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      disabled={selectedStudentsCount === 0 || !toClassId}
                      className="w-full sm:w-auto bg-slate-950 hover:bg-slate-850 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                    >
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>প্রমোশন সম্পন্ন করুন</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= CONFIRM PROMOTION MODAL ================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-8 h-8 shrink-0 bg-amber-50 p-1 rounded-lg" />
              <h3 className="text-lg font-bold text-slate-900">আপনি কি নিশ্চিত?</h3>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed">
              আপনি <span className="font-bold text-slate-950">{selectedStudentsCount}</span> জন শিক্ষার্থীকে 
              <span className="font-bold text-indigo-700"> {currentClassObj?.name} </span> থেকে 
              <span className="font-bold text-emerald-700"> {targetClassObj?.name} </span>-এ প্রমোশন বা স্থানান্তরিত করতে যাচ্ছেন।
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              
              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={isPromoting}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                {isPromoting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>প্রমোশন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>হ্যাঁ, নিশ্চিত করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
