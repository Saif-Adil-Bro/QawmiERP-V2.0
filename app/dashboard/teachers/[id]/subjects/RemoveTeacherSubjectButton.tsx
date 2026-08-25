"use client";

import { removeSubjectFromTeacher } from "@/app/actions/teacher_subjects";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export default function RemoveTeacherSubjectButton({ teacherSubjectId, teacherId }: { teacherSubjectId: string, teacherId: string }) {
  const [isPending, setIsPending] = useState(false);

  const handleRemove = async () => {
    if (confirm("Remove this subject from the teacher?")) {
      setIsPending(true);
      await removeSubjectFromTeacher(teacherSubjectId, teacherId);
      setIsPending(false);
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      title="Remove Subject"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
