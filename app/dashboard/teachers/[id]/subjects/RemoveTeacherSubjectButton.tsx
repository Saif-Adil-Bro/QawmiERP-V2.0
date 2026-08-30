"use client";

import { removeSubjectFromTeacher } from "@/app/actions/teacher_subjects";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export default function RemoveTeacherSubjectButton({ teacherSubjectId, teacherId }: { teacherSubjectId: string, teacherId: string }) {
  const [isPending, setIsPending] = useState(false);

  const handleRemove = async () => {
    if (confirm("আপনি কি নিশ্চিত যে এই শিক্ষক থেকে বিষয়টি বাদ দিতে চান?")) {
      setIsPending(true);
      try {
        await removeSubjectFromTeacher(teacherSubjectId, teacherId);
      } catch (err) {
        console.error("removeSubjectFromTeacher failed:", err);
        alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setIsPending(false);
      }
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
      title="বিষয়টি বাদ দিন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
