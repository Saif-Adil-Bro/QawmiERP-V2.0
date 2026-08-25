"use client";

import { deleteStudent } from "@/app/actions/students";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function StudentDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this student?")) {
      setIsDeleting(true);
      await deleteStudent(id);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-600 hover:text-red-800 font-medium transition flex items-center justify-center p-1 rounded hover:bg-red-50 disabled:opacity-50"
      title="Delete Student"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
