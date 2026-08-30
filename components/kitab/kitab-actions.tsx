"use client";

import { deleteKitabLog, updateKitabLog, createKitabLog } from "@/app/actions/kitab";
import { useState, useTransition } from "react";
import { Trash2, Edit3, Plus, X, BookOpen, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import StudentSearchSelector from "@/components/common/StudentSearchSelector";

export function KitabDeleteButton({ 
  logId, 
  studentId,
  onDeleted 
}: { 
  logId: string; 
  studentId?: string;
  onDeleted?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const res = await deleteKitabLog(logId, studentId);
        if (res?.error) {
          alert(res.error);
          return;
        }
        setShowConfirm(false);
        if (onDeleted) onDeleted();
      } catch (err) {
        console.error("deleteKitabLog failed:", err);
        alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="text-red-500 hover:text-red-700 font-medium transition flex items-center justify-center p-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
        title="লগ মুছুন"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">লগ মুছে ফেলতে চান?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              আপনি কি নিশ্চিত যে এই কিতাব পাঠের লগটি স্থায়ীভাবে মুছে ফেলতে চান? এই তথ্য আর পুনরুদ্ধার করা যাবে না।
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-xs transition disabled:opacity-50"
              >
                {isPending ? "মুছে ফেলা হচ্ছে..." : "হ্যাঁ, মুছে ফেলুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EditKitabLogModal({
  log,
  isOpen,
  onClose,
  onUpdated,
}: {
  log: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen || !log) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const res = await updateKitabLog(null, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            onClose();
            if (onUpdated) onUpdated();
          }, 600);
        }
      } catch (err) {
        console.error("updateKitabLog failed:", err);
        setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2 text-slate-800">
            <Edit3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">কিতাব লগ সম্পাদনা</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>লগ সফলভাবে আপডেট করা হয়েছে!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="log_id" value={log.id} />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              তারিখ <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                name="log_date"
                defaultValue={log.log_date ? new Date(log.log_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              কিতাবের নাম <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="kitab_name"
              defaultValue={log.kitab_name || ""}
              required
              placeholder="যেমন: হেদায়াতুন্নাহু, মিজান, কানযুদ দাকায়িক"
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পৃষ্ঠা/অধ্যায় (শুরু)
              </label>
              <input
                type="text"
                name="page_from"
                defaultValue={log.page_from || ""}
                placeholder="যেমন: ১২"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পৃষ্ঠা/অধ্যায় (শেষ)
              </label>
              <input
                type="text"
                name="page_to"
                defaultValue={log.page_to || ""}
                placeholder="যেমন: ১৫"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              পারফরম্যান্স রেটিং
            </label>
            <select
              name="performance_rating"
              defaultValue={log.performance_rating || ""}
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">রেটিং নির্বাচন করুন</option>
              <option value="Excellent">চমৎকার (Excellent)</option>
              <option value="Good">ভালো (Good)</option>
              <option value="Average">মোটামুটি (Average)</option>
              <option value="Poor">উন্নতি প্রয়োজন (Poor)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              মন্তব্য (ঐচ্ছিক)
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={log.notes || ""}
              placeholder="শিক্ষার্থীর পাঠ বা বুঝ সম্পর্কে কোনো মন্তব্য..."
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {isPending ? "সংরক্ষণ হচ্ছে..." : "আপডেট করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddKitabLogModal({
  students,
  selectedStudentId,
  isOpen,
  onClose,
  onCreated,
}: {
  students: any[];
  selectedStudentId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [studentId, setStudentId] = useState<string>(selectedStudentId || (students[0]?.id || ""));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (!formData.get("student_id")) {
      formData.set("student_id", studentId);
    }

    startTransition(async () => {
      try {
        const res = await createKitabLog(null, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            onClose();
            if (onCreated) onCreated();
          }, 600);
        }
      } catch (err) {
        console.error("createKitabLog failed:", err);
        setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2 text-slate-800">
            <Plus className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold">নতুন কিতাব সবক / লগ এন্ট্রি</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>লগ সফলভাবে যুক্ত হয়েছে!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <StudentSearchSelector
              students={students}
              name="student_id"
              value={studentId}
              onChange={(id) => setStudentId(id)}
              label="শিক্ষার্থী নির্বাচন করুন"
              placeholder="শিক্ষার্থী বাছাই করুন (নাম বা রোল লিখে খুঁজুন)..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              তারিখ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="log_date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              কিতাবের নাম <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="kitab_name"
              required
              placeholder="যেমন: হেদায়াতুন্নাহু, কাফিয়া, নূরুল আনওয়ার"
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পৃষ্ঠা/অধ্যায় (শুরু)
              </label>
              <input
                type="text"
                name="page_from"
                placeholder="যেমন: ১২"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পৃষ্ঠা/অধ্যায় (শেষ)
              </label>
              <input
                type="text"
                name="page_to"
                placeholder="যেমন: ১৫"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              পারফরম্যান্স রেটিং
            </label>
            <select
              name="performance_rating"
              defaultValue="Good"
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">রেটিং নির্বাচন করুন</option>
              <option value="Excellent">চমৎকার (Excellent)</option>
              <option value="Good">ভালো (Good)</option>
              <option value="Average">মোটামুটি (Average)</option>
              <option value="Poor">উন্নতি প্রয়োজন (Poor)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              মন্তব্য (ঐচ্ছিক)
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="আজকের সবক বা পড়ার কোনো বিশেষ নোট..."
              className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {isPending ? "সংরক্ষণ হচ্ছে..." : "লগ সেভ করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
