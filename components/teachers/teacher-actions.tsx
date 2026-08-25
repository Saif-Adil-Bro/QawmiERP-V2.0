"use client";

import { deleteTeacher } from "@/app/actions/teachers";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function TeacherDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে আপনি এই শিক্ষক/স্টাফকে মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      await deleteTeacher(id);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 font-medium transition flex items-center justify-center p-1 rounded hover:bg-red-50 disabled:opacity-50"
      title="মুছে ফেলুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
