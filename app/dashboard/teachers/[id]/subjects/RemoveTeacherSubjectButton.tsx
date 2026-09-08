"use client";

import { removeSubjectFromTeacher } from "@/app/actions/teacher_subjects";
import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveTeacherSubjectButton({
  teacherSubjectId,
  teacherId,
}: {
  teacherSubjectId: string;
  teacherId: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleRemove = async () => {
    if (confirm("আপনি কি নিশ্চিত যে এই শিক্ষক থেকে বিষয়টি বাদ দিতে চান?")) {
      setIsPending(true);
      try {
        const res = await removeSubjectFromTeacher(teacherSubjectId, teacherId);
        if (res?.error) {
          alert(res.error);
        } else {
          router.refresh();
        }
      } catch (err) {
        console.error("removeSubjectFromTeacher failed:", err);
        alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setIsPending(false);
      }
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer border border-transparent hover:border-rose-200"
      title="বিষয়টি বাদ দিন"
      aria-label="Remove subject"
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
