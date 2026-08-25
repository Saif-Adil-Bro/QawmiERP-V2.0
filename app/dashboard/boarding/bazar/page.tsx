"use client";

import { useState, useEffect } from "react";
import { getBazarExpenses, saveBazarExpense, deleteBazarExpense } from "@/app/actions/boarding";
import { format } from "date-fns";
import { ArrowLeft, Plus, Edit, Trash2, CalendarDays, Receipt, X, Info } from "lucide-react";
import Link from "next/link";

interface Expense {
  id: string;
  amount: string | number;
  expense_date: string;
  items_details: string;
}

export default function BazarExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formAmount, setFormAmount] = useState("");
  const [formDetails, setFormDetails] = useState("");

  const loadExpenses = async () => {
    setLoading(true);
    const data = await getBazarExpenses();
    setExpenses(data);
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormAmount("");
    setFormDetails("");
    setIsFormOpen(true);
    setMessage(null);
  };

  const handleOpenEditForm = (exp: Expense) => {
    setEditingId(exp.id);
    setFormDate(exp.expense_date);
    setFormAmount(exp.amount.toString());
    setFormDetails(exp.items_details || "");
    setIsFormOpen(true);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      setMessage({ type: "error", text: "অনুগ্রহ করে সঠিক খরচের পরিমাণ দিন।" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const expensePayload = {
      id: editingId || undefined,
      amount: Number(formAmount),
      expense_date: formDate,
      items_details: formDetails
    };

    const res = await saveBazarExpense(expensePayload);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({
        type: "success",
        text: editingId ? "বাজার খরচের হিসাব সফলভাবে আপডেট করা হয়েছে!" : "নতুন বাজার খরচ সফলভাবে যোগ করা হয়েছে!"
      });
      setIsFormOpen(false);
      loadExpenses();
      setTimeout(() => setMessage(null), 3000);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই খরচের বিবরণটি মুছে ফেলতে চান?")) return;

    const res = await deleteBazarExpense(id);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "বাজার খরচ সফলভাবে মুছে ফেলা হয়েছে।" });
      loadExpenses();
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const totalBazarAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/boarding"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            id="back_to_boarding_dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">বাজার খরচ (Bazar Expenses)</h1>
            <p className="text-slate-500 text-sm">বোর্ডিংয়ের জন্য প্রতিদিনের বাজার খরচের হিসাব</p>
          </div>
        </div>

        <button
          onClick={handleOpenAddForm}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-md hover:bg-slate-800 font-semibold transition shadow-sm flex items-center"
          id="btn_add_bazar"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          বাজার খরচ যোগ করুন
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm font-medium ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
          id="bazar_message_alert"
        >
          {message.text}
        </div>
      )}

      {/* Summary Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-emerald-50 p-4 rounded-lg">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">মোট খরচের পরিমাণ</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalBazarAmount.toLocaleString()} ৳</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <CalendarDays className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">মোট বাজারের দিন</p>
            <h3 className="text-2xl font-bold text-slate-800">{expenses.length} বার</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <Info className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">গড় বাজার খরচ</p>
            <h3 className="text-2xl font-bold text-slate-800">
              {expenses.length > 0 ? Math.round(totalBazarAmount / expenses.length).toLocaleString() : 0} ৳
            </h3>
          </div>
        </div>
      </div>

      {/* Editor Modal / Form overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? "বাজার খরচ এডিট করুন" : "নতুন বাজার খরচ যুক্ত করুন"}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 transition"
                id="btn_close_modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="expense_date" className="text-sm font-bold text-slate-700">তারিখ</label>
                <input
                  type="date"
                  id="expense_date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="amount" className="text-sm font-bold text-slate-700">টাকার পরিমাণ (৳)</label>
                <input
                  type="number"
                  id="amount"
                  required
                  placeholder="যেমন: ১৫০০"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="items_details" className="text-sm font-bold text-slate-700">বাজারের বিবরণ (জিনিসপত্রের তালিকা)</label>
                <textarea
                  id="items_details"
                  placeholder="যেমন: চাল ৫০ কেজি, ডাল ৫ কেজি, আলু ১০ কেজি ইত্যাদি..."
                  rows={4}
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border rounded-md hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition"
                  id="btn_submit_bazar"
                >
                  {submitting ? "সংরক্ষণ করা হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
            <span>বাজার খরচের রেকর্ড লোড হচ্ছে...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            কোনো বাজার খরচের রেকর্ড পাওয়া যায়নি। বাজার খরচ যোগ করতে উপরের বাটনে ক্লিক করুন।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium w-36">তারিখ</th>
                  <th className="px-6 py-4 font-medium">বাজারের মালামাল বিবরণ</th>
                  <th className="px-6 py-4 font-medium text-right w-44">টাকার পরিমাণ</th>
                  <th className="px-6 py-4 font-medium text-center w-36">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {format(new Date(exp.expense_date), "dd-MM-yyyy")}
                    </td>
                    <td className="px-6 py-4 text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                      {exp.items_details || "বিবরণ দেওয়া হয়নি"}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900 font-bold text-base">
                      {Number(exp.amount).toLocaleString()} ৳
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center space-x-2">
                        <button
                          onClick={() => handleOpenEditForm(exp)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="এডিট করুন"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
