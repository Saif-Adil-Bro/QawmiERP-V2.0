"use client";

import { useState, useEffect } from "react";
import { getExamSubjects, saveExamSubjects, updateExamDetails } from "@/app/actions/exams";
import { getClassSubjects } from "@/app/actions/class_subjects";
import { Plus, Trash2, Save, Calendar, Sparkles, CheckCircle2 } from "lucide-react";

function getDynamicStatusInfo(startDate: string, endDate: string) {
  if (!startDate) {
    return {
      type: "Upcoming",
      label: "আসন্ন (Upcoming)",
      description: "শুরুর তারিখ ও শেষের তারিখের ওপর ভিত্তি করে অবস্থা স্বয়ংক্রিয়ভাবে হিসাব করা হবে।",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  }

  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Dhaka', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());
  } catch {
    todayStr = new Date().toISOString().split('T')[0];
  }

  const sStr = startDate.split('T')[0];
  const eStr = endDate ? endDate.split('T')[0] : sStr;

  if (todayStr < sStr) {
    return {
      type: "Upcoming",
      label: "আসন্ন (Upcoming)",
      description: "পরীক্ষার তারিখ নির্ধারিত রয়েছে, নির্ধারিত দিনে পরীক্ষা শুরু হবে।",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  } else if (todayStr >= sStr && todayStr <= eStr) {
    return {
      type: "Ongoing",
      label: "চলমান (Ongoing)",
      description: "আজকের তারিখ শুরু ও শেষ তারিখের মধ্যে হওয়ায় পরীক্ষাটি বর্তমানে চলমান।",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      dotClass: "bg-amber-500",
      isPulsing: true,
    };
  } else {
    return {
      type: "Completed",
      label: "সম্পন্ন (Completed)",
      description: "পরীক্ষার সময়সীমা অতিক্রান্ত হয়েছে, পরীক্ষা সফলভাবে সম্পন্ন।",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      isPulsing: false,
    };
  }
}

export default function ExamSetupClient({ examId, exam, classes }: { examId: string, exam?: any, classes: any[] }) {
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Exam Date State
  const [startDate, setStartDate] = useState(exam?.start_date?.split('T')[0] || "");
  const [endDate, setEndDate] = useState(exam?.end_date?.split('T')[0] || exam?.effective_end_date?.split('T')[0] || "");
  const [savingDate, setSavingDate] = useState(false);
  const [dateSuccess, setDateSuccess] = useState(false);

  useEffect(() => {
    if (classId) {
      loadSubjects();
    } else {
      setSubjects([]);
    }
  }, [classId]);

  const statusInfo = getDynamicStatusInfo(startDate, endDate);

  const handleSaveDates = async () => {
    setSavingDate(true);
    setDateSuccess(false);
    const res = await updateExamDetails(examId, {
      title: exam?.title,
      year: exam?.year,
      start_date: startDate || null,
      end_date: endDate || null
    });
    setSavingDate(false);
    if (res?.error) {
      alert("Error: " + res.error);
    } else {
      setDateSuccess(true);
      setTimeout(() => setDateSuccess(false), 3000);
    }
  };

  const loadSubjects = async () => {
    setLoading(true);
    const data = await getExamSubjects(examId, classId);
    if (data && data.length > 0) {
      setSubjects(data);
    } else {
      try {
        const classSubjectsData = await getClassSubjects(classId);
        if (classSubjectsData && classSubjectsData.length > 0) {
          const autoSubjects = classSubjectsData.map((cs: any) => ({
            subject_name: cs.subjects?.name || "",
            total_marks: 100,
            pass_marks: 33,
            exam_type: "Written"
          }));
          setSubjects(autoSubjects);
        } else {
          setSubjects([{ subject_name: "", total_marks: 100, pass_marks: 33, exam_type: "Written" }]);
        }
      } catch (err) {
        setSubjects([{ subject_name: "", total_marks: 100, pass_marks: 33, exam_type: "Written" }]);
      }
    }
    setLoading(false);
  };

  const handleAddSubject = () => {
    setSubjects([...subjects, { subject_name: "", total_marks: 100, pass_marks: 33, exam_type: "Written" }]);
  };

  const handleRemoveSubject = (index: number) => {
    const newSubjects = [...subjects];
    newSubjects.splice(index, 1);
    setSubjects(newSubjects);
  };

  const handleChange = (index: number, field: string, value: string | number) => {
    const newSubjects = [...subjects];
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const handleSave = async () => {
    if (!classId) return alert("দয়া করে ক্লাস নির্বাচন করুন");
    
    for (const sub of subjects) {
      if (!sub.subject_name) return alert("সব বিষয়ের নাম দিতে হবে");
    }
    
    setSaving(true);
    const res = await saveExamSubjects(examId, classId, subjects);
    setSaving(false);
    
    if (res?.error) {
      alert("Error: " + res.error);
    } else {
      alert("সফলভাবে সেভ হয়েছে!");
    }
  };

  return (
    <div className="space-y-8">
      {/* Exam Date & Automatic Status Card */}
      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-800 text-base">পরীক্ষার তারিখ ও স্বয়ংক্রিয় অবস্থা</h3>
            <p className="text-xs text-slate-500">শুরুর তারিখ ও শেষের তারিখ পরিবর্তন করলে অবস্থা নিজে থেকেই আপডেট হবে</p>
          </div>

          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}>
            <span className="relative flex h-2 w-2 mr-1.5">
              {statusInfo.isPulsing && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.dotClass}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.dotClass}`}></span>
            </span>
            {statusInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>শুরুর তারিখ (Start Date)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>শেষের তারিখ (End Date)</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span>{statusInfo.description}</span>
          </p>

          <button
            onClick={handleSaveDates}
            disabled={savingDate}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-md text-xs font-medium transition shadow-xs disabled:opacity-50"
          >
            {savingDate ? "সেভ হচ্ছে..." : dateSuccess ? "আপডেট সম্পন্ন!" : "তারিখ আপডেট করুন"}
            {dateSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
          </button>
        </div>
      </div>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-slate-700 mb-1">ক্লাস নির্বাচন করুন (বিষয় সেটআপের জন্য)</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white"
        >
          <option value="">নির্বাচন করুন...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {classId && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-lg font-medium text-slate-800">বিষয়ের তালিকা ও মান বণ্টন</h3>
            <button
              onClick={handleAddSubject}
              className="flex items-center space-x-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md transition border border-indigo-200"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বিষয়</span>
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500">লোড হচ্ছে...</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                <thead className="bg-slate-50 text-slate-700 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">বিষয়ের নাম</th>
                    <th className="px-4 py-3 font-medium w-24">মোট নম্বর</th>
                    <th className="px-4 py-3 font-medium w-24">পাস নম্বর</th>
                    <th className="px-4 py-3 font-medium w-36">পরীক্ষার ধরন</th>
                    <th className="px-4 py-3 font-medium w-16 text-center">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={sub.subject_name}
                          onChange={(e) => handleChange(idx, 'subject_name', e.target.value)}
                          placeholder="যেমন: কুরআন মাজীদ"
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={sub.total_marks}
                          onChange={(e) => handleChange(idx, 'total_marks', parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={sub.pass_marks}
                          onChange={(e) => handleChange(idx, 'pass_marks', parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={sub.exam_type}
                          onChange={(e) => handleChange(idx, 'exam_type', e.target.value)}
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                          <option value="Written">লিখিত (Written)</option>
                          <option value="Oral">মৌখিক (Oral)</option>
                          <option value="Practical">প্রাক্টিক্যাল (Practical)</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleRemoveSubject(idx)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {subjects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        কোনো বিষয় যোগ করা হয়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving || subjects.length === 0}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 font-medium shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
