"use client";

import { deleteClass } from "@/app/actions/classes";
import { Trash2 } from "lucide-react";

export default function ClassActions({ classId }: { classId: string }) {
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this class?")) {
      await deleteClass(classId);
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
