"use client";

import { deleteFee, deleteExpense } from "@/app/actions/accounting";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function FeeDeleteButton({ feeId }: { feeId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে আপনি এই ফি রেকর্ডটি মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      await deleteFee(feeId);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 font-medium transition inline-flex items-center justify-center p-1.5 rounded hover:bg-red-50 disabled:opacity-50"
      title="রেকর্ড মুছুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export function ExpenseDeleteButton({ expenseId }: { expenseId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে আপনি এই খরচের রেকর্ডটি মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      await deleteExpense(expenseId);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 font-medium transition inline-flex items-center justify-center p-1.5 rounded hover:bg-red-50 disabled:opacity-50"
      title="রেকর্ড মুছুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
