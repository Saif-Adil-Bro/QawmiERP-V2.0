"use client";

import { useState, useTransition } from "react";
import { deleteSubject, updateSubject } from "@/app/actions/subjects";
import { Trash2, Edit, RefreshCw, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface SubjectData {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
}

interface SubjectActionsProps {
  subjectId?: string;
  subject?: SubjectData;
}

export default function SubjectActions({ subjectId, subject }: SubjectActionsProps) {
  const currentSubjectId = subject?.id || subjectId || "";
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form states for edit modal
  const [name, setName] = useState(subject?.name || "");
  const [code, setCode] = useState(subject?.code || "");
  const [description, setDescription] = useState(subject?.description || "");

  const handleDelete = async () => {
    const subName = subject?.name || "এই বিষয়টি";
    if (confirm(`আপনি কি নিশ্চিত যে "${subName}" মুছে ফেলতে চান?`)) {
      setIsDeleting(true);
      try {
        const res = await deleteSubject(currentSubjectId);
        if (res?.error) {
          alert(res.error);
        } else {
          router.refresh();
        }
      } catch (err) {
        console.error("deleteSubject failed:", err);
        alert("বিষয়টি মুছে ফেলতে সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("code", code);
    formData.append("description", description);

    startTransition(async () => {
      try {
        const res = await updateSubject(currentSubjectId, null, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setIsEditModalOpen(false);
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message || "সংরক্ষণ করতে সমস্যা হয়েছে।");
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* Edit Button */}
        <button
          type="button"
          onClick={() => {
            setName(subject?.name || "");
            setCode(subject?.code || "");
            setDescription(subject?.description || "");
            setError(null);
            setIsEditModalOpen(true);
          }}
          className="p-1.5 sm:p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
          title="সম্পাদনা করুন"
        >
          <Edit className="w-4 h-4" />
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 sm:p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer border border-transparent hover:border-rose-100"
          title="মুছে ফেলুন"
        >
          {isDeleting ? (
            <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Edit className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">বিষয় / কিতাব সম্পাদনা</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs sm:text-sm border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিষয়ের নাম (Name) *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium"
                  placeholder="যেমন: হেদায়াতুন্নাহু, তাজবীদ"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিষয় কোড (Code - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-mono"
                  placeholder="যেমন: ARB-101"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিবরণ (Description - ঐচ্ছিক)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                  placeholder="বিষয় বা কিতাব সম্পর্কিত বিবরণ..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>পরিবর্তন সংরক্ষণ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

