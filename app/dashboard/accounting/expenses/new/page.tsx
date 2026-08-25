import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AddExpenseForm from "./AddExpenseForm";

export default function NewExpensePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/accounting/expenses"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">নতুন খরচ এন্ট্রি</h1>
          <p className="text-slate-500 text-sm">মাদরাসার খরচের রেকর্ড যোগ করুন</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <AddExpenseForm />
      </div>
    </div>
  );
}
