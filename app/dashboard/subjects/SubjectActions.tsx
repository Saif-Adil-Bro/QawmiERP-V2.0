"use client";

import { deleteSubject } from "@/app/actions/subjects";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export default function SubjectActions({ subjectId }: { subjectId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে এই বিষয়টি মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      try {
        await deleteSubject(subjectId);
      } catch (err) {
        console.error("deleteSubject failed:", err);
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
      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
      title="মুছে ফেলুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
