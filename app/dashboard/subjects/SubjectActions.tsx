"use client";

import { deleteSubject } from "@/app/actions/subjects";
import { Trash2 } from "lucide-react";

export default function SubjectActions({ subjectId }: { subjectId: string }) {
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this subject?")) {
      await deleteSubject(subjectId);
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
      title="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
