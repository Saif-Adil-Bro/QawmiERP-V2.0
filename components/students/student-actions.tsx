"use client";

import { deleteStudent } from "@/app/actions/students";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function StudentDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে এই শিক্ষার্থীকে মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      try {
        await deleteStudent(id);
      } catch (err) {
        console.error("deleteStudent failed:", err);
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
      className="text-red-600 hover:text-red-800 font-medium transition flex items-center justify-center p-1 rounded hover:bg-red-50 disabled:opacity-50 cursor-pointer"
      title="শিক্ষার্থী মুছুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
