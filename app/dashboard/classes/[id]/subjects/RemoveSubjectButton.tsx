"use client";

import { removeSubjectFromClass } from "@/app/actions/class_subjects";
import { Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveSubjectButton({ 
  classSubjectId, 
  classId,
  subjectName 
}: { 
  classSubjectId: string; 
  classId: string;
  subjectName?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleRemove = async () => {
    const confirmText = subjectName 
      ? `আপনি কি নিশ্চিত যে "${subjectName}" বিষয়টিকে এই জামাত থেকে বাদ দিতে চান?`
      : "আপনি কি নিশ্চিত যে এই বিষয়টিকে জামাত থেকে বাদ দিতে চান?";

    if (confirm(confirmText)) {
      setIsPending(true);
      try {
        await removeSubjectFromClass(classSubjectId, classId);
        router.refresh();
      } catch (err) {
        console.error("removeSubjectFromClass failed:", err);
        alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setIsPending(false);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isPending}
      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
      title="বিষয়টি বাদ দিন"
    >
      {isPending ? (
        <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  );
}
