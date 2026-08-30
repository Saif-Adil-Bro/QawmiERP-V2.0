"use client";

import { deleteTeacher } from "@/app/actions/teachers";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function TeacherDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে আপনি এই শিক্ষক/স্টাফকে মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      try {
        await deleteTeacher(id);
      } catch (err) {
        console.error("deleteTeacher failed:", err);
        alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 font-medium transition flex items-center justify-center p-1 rounded hover:bg-red-50 disabled:opacity-50 cursor-pointer"
      title="মুছে ফেলুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
