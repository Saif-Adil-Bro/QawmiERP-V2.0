"use client";

import { deleteHifzLog } from "@/app/actions/hifz";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function HifzDeleteButton({ logId, studentId }: { logId: string, studentId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this hifz log?")) {
      setIsDeleting(true);
      await deleteHifzLog(logId, studentId);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 font-medium transition flex items-center justify-center p-1 rounded hover:bg-red-50 disabled:opacity-50"
      title="Delete Log"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
