"use client";

import { useState } from "react";
import { assignSubjectToTeacher } from "@/app/actions/teacher_subjects";

export default function AssignTeacherSubjectForm({ teacherId, unassignedClassSubjects }: { teacherId: string, unassignedClassSubjects: any[] }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    
    const formData = new FormData(e.currentTarget);
    const classSubjectStr = formData.get("class_subject") as string;
    
    if (!classSubjectStr) {
      setError("Please select a subject");
      setIsPending(false);
      return;
    }

    const [classId, subjectId] = classSubjectStr.split("|");

    const res = await assignSubjectToTeacher(teacherId, classId, subjectId);
    if (res.error) {
      setError(res.error);
    }
    
    setIsPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      {unassignedClassSubjects.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border">
          No available subjects to assign. First assign subjects to classes.
        </p>
      ) : (
        <>
          <select
            name="class_subject"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
            defaultValue=""
            required
          >
            <option value="" disabled>Select a subject...</option>
            {unassignedClassSubjects.map((cs) => (
              <option key={cs.id} value={`${cs.class_id}|${cs.subject_id}`}>
                {cs.classes?.name} - {cs.subjects?.name}
              </option>
            ))}
          </select>
          
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? "Assigning..." : "Assign Subject"}
          </button>
        </>
      )}
    </form>
  );
}
