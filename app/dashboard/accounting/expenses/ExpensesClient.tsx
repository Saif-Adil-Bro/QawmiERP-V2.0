"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { 
  Plus, 
  ArrowLeft, 
  Search, 
  FileText, 
  Edit3, 
  Trash2, 
  Printer, 
  Filter, 
  Landmark, 
  Calendar, 
  Loader2, 
  X, 
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { deleteExpense } from "@/app/actions/accounting";
import { FundItem, isTransactionInFund } from "@/lib/fund-utils";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import ExpenseVoucher, { ExpenseItem, MadrasaInfo } from "@/components/accounting/ExpenseVoucher";
import EditExpenseModal from "@/components/accounting/EditExpenseModal";

interface ExpensesClientProps {
  initialExpenses: ExpenseItem[];
  initialBazarExpenses?: any[];
  funds: FundItem[];
  madrasaInfo?: MadrasaInfo;
}

export default function ExpensesClient({
  initialExpenses,
  initialBazarExpenses = [],
  funds,
  madrasaInfo,
}: ExpensesClientProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [bazarExpenses] = useState<any[]>(initialBazarExpenses);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFundId, setSelectedFundId] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Modals state
  const [activeVoucherExpense, setActiveVoucherExpense] = useState<ExpenseItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Filter expenses based on search and dropdowns
  const filteredExpenses = expenses.filter((exp) => {
    // Fund match
    if (selectedFundId !== "all") {
      const fundObj = funds.find((f) => f.id === selectedFundId);
      const directMatch = exp.fund_id === selectedFundId;
      const canonicalMatch = fundObj
        ? isTransactionInFund(fundObj, exp.fund_id, exp.fund_name, funds)
        : false;
      if (!directMatch && !canonicalMatch) {
        return false;
      }
    }
    // Category match
    if (selectedCategory !== "all" && exp.category !== selectedCategory) {
      return false;
    }
    // Query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const descMatch = (exp.description || "").toLowerCase().includes(q);
      const catMatch = (exp.category || "").toLowerCase().includes(q);
      const fundMatch = (exp.fund_name || "").toLowerCase().includes(q);
      const voucherMatch = (exp.voucher_no || "").toLowerCase().includes(q);
      const amountMatch = String(exp.amount).includes(q);
      return descMatch || catMatch || fundMatch || voucherMatch || amountMatch;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  const totalExpenseSum = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalBazarSum = bazarExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalCombinedSum = totalExpenseSum + totalBazarSum;

  // Handle delete modal confirm
  const handleConfirmDelete = () => {
    if (!expenseToDelete) return;
    const expense = expenseToDelete;
    setDeletingId(expense.id);
    startDeleteTransition(async () => {
      try {
        const res = await deleteExpense(expense.id);
        if (res?.error) {
          showNotification("error", "মুছে ফেলতে সমস্যা হয়েছে: " + res.error);
        } else {
          setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
          showNotification("success", "খরচের রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।");
          setExpenseToDelete(null);
        }
      } catch (err) {
        console.error("Delete failed:", err);
        showNotification("error", "একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setDeletingId(null);
      }
    });
  };

  // Handle edit success
  const handleExpenseUpdated = (updated: ExpenseItem) => {
    setExpenses((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    showNotification("success", "খরচের রেকর্ডটি সফলভাবে আপডেট করা হয়েছে।");
    // Optionally open the updated voucher
    setActiveVoucherExpense(updated);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Salary":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">বেতন (Salary)</span>;
      case "Food":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">খাবার ও মেস (Food)</span>;
      case "Utility":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">ইউটিলিটি বিল</span>;
      case "Maintenance":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">রক্ষণাবেক্ষণ</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{category || "অন্যান্য"}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Background Content (Hidden during print if modal is open) */}
      <div className={`space-y-6 ${activeVoucherExpense ? "print:hidden" : ""}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <Link
              href="/dashboard/accounting"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  খরচ ও ব্যয় ব্যবস্থাপনা
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  মোট খরচ: ৳ {formatBanglaCurrency(totalCombinedSum)}
                </span>
                {totalBazarSum > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    বোর্ডিং বাজার: ৳ {formatBanglaCurrency(totalBazarSum)}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                মাদরাসার দৈনন্দিন ব্যয় রেকর্ড, ভাউচার প্রিন্ট, এডিট ও অডিট ট্র্যাকিং
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/accounting/expenses/new"
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন খরচ এন্ট্রি</span>
          </Link>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center justify-between transition ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="বিবরণ, খাত বা ভাউচার নম্বর দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Fund Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-slate-700"
            >
              <option value="all">সকল ফান্ড</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-slate-700"
            >
              <option value="all">সকল খরচের খাত</option>
              <option value="Salary">শিক্ষক/স্টাফ বেতন (Salary)</option>
              <option value="Food">খাবার ও মেস (Food)</option>
              <option value="Utility">বিদ্যুৎ/গ্যাস/পানি বিল</option>
              <option value="Maintenance">রক্ষণাবেক্ষণ ও মেরামত</option>
              <option value="Other">অন্যান্য / বিবিধ</option>
            </select>
          </div>
        </div>

        {/* Boarding Bazar Expense Notice & Breakdown */}
        {bazarExpenses.length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      বোর্ডিং ও মেস বাজার খরচ (ড্যাশবোর্ডের মোট ব্যয়ের উৎস)
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded-full text-[11px] font-bold">
                      {toBanglaNumber(bazarExpenses.length)} টি ভাউচার
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    মাদ্রাসার লিল্লাহ বোর্ডিং ও মেসের দৈনিক বাজার খরচ এখানে ট্র্যাকিং হয় এবং মূল ড্যাশবোর্ডের ব্যয়ের সাথে যোগ হয়
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/boarding/bazar"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto"
              >
                <span>বোর্ডিং বাজার খাতা খুলুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {bazarExpenses.map((bz: any) => {
                const bzVoucher = bz.voucher_no || `BV-${(bz.id || '').substring(0, 6).toUpperCase()}`;
                const bzDate = bz.expense_date
                  ? format(new Date(bz.expense_date), "dd MMM, yyyy")
                  : "-";
                const cleanDetails = (bz.items_details || "")
                  .replace(/\[VOUCHER:[^\]]+\]\s*/i, "")
                  .trim();

                return (
                  <div
                    key={bz.id}
                    className="bg-white p-4 rounded-xl border border-amber-200/90 shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            #{bzVoucher}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {bzDate}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded border border-emerald-100">
                            {bz.fund_name || "লিল্লাহ বোর্ডিং ফান্ড"}
                          </span>
                        </div>
                        {bz.buyer_name && (
                          <p className="text-xs text-slate-600 mt-1.5">
                            বাজারকারী / ক্রেতা: <strong className="text-slate-800">{bz.buyer_name}</strong>
                            {bz.payment_method && ` (${bz.payment_method})`}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold text-rose-600">
                          ৳ {formatBanglaCurrency(bz.amount)}
                        </span>
                      </div>
                    </div>

                    {cleanDetails && (
                      <div className="text-xs text-slate-700 bg-amber-50/40 p-2.5 rounded-lg border border-amber-100 whitespace-pre-line font-medium leading-relaxed">
                        {cleanDetails}
                      </div>
                    )}

                    <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                      <Link
                        href="/dashboard/boarding/bazar"
                        className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline"
                      >
                        ভাউচার দেখুন / পরিবর্তন করুন
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expenses List Table */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <FileText className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-sm text-slate-600">কোনো খরচের রেকর্ড পাওয়া যায়নি।</p>
              <Link
                href="/dashboard/accounting/expenses/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন খরচ যোগ করুন</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">তারিখ ও ভাউচার</th>
                    <th className="px-5 py-3.5 font-bold">ফান্ড (Fund)</th>
                    <th className="px-5 py-3.5 font-bold">খাত (Category)</th>
                    <th className="px-5 py-3.5 font-bold">বিবরণ</th>
                    <th className="px-5 py-3.5 font-bold text-right">পরিমাণ (৳)</th>
                    <th className="px-5 py-3.5 font-bold text-center w-36">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpenses.map((expense) => {
                    const isRowDeleting = isDeleting && deletingId === expense.id;
                    const dateFormatted = expense.expense_date
                      ? format(new Date(expense.expense_date), "dd MMM, yyyy")
                      : "-";
                    const voucherNum = expense.voucher_no || `EXP-${expense.id.slice(0, 6)}`;

                    return (
                      <tr
                        key={expense.id}
                        className={`hover:bg-slate-50/70 transition ${
                          isRowDeleting ? "opacity-40 bg-red-50" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{dateFormatted}</div>
                          <div className="text-[11px] font-mono text-emerald-700 font-bold mt-0.5">
                            #{voucherNum}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {expense.fund_name || "সাধারণ ফান্ড"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {getCategoryBadge(expense.category)}
                        </td>
                        <td className="px-5 py-3.5 max-w-xs truncate" title={expense.description}>
                          <span className="text-slate-800 font-medium">
                            {expense.description || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 text-right font-mono whitespace-nowrap text-sm">
                          ৳ {Number(expense.amount).toLocaleString("bn-BD")}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View / Print Voucher Button */}
                            <button
                              type="button"
                              onClick={() => setActiveVoucherExpense(expense)}
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer border border-emerald-200"
                              title="ভাউচার দেখুন ও প্রিন্ট করুন"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Edit Expense Button */}
                            <button
                              type="button"
                              onClick={() => setEditingExpense(expense)}
                              className="p-1.5 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer border border-blue-200"
                              title="খরচ সম্পাদনা (Edit) করুন"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete Expense Button */}
                            <button
                              type="button"
                              onClick={() => setExpenseToDelete(expense)}
                              disabled={isRowDeleting}
                              className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition cursor-pointer border border-red-200 disabled:opacity-50"
                              title="খরচ বাতিল/মুছে ফেলুন"
                            >
                              {isRowDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Client-Side Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <div>
                    সর্বমোট <strong className="text-slate-800">{filteredExpenses.length}</strong> টি খরচের মধ্যে{" "}
                    <strong className="text-slate-800">
                      {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredExpenses.length)}
                    </strong>{" "}
                    দেখাচ্ছে
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      পূর্ববর্তী
                    </button>
                    <span className="px-2 font-bold text-slate-800">
                      পৃষ্ঠা {toBanglaNumber(currentPage)} / {toBanglaNumber(totalPages)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      পরবর্তী
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete / Void Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold text-base">
                <AlertCircle className="w-5 h-5" />
                <span>খরচের ভাউচার বাতিল/ডিলিট নিশ্চিতকরণ</span>
              </div>
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-red-50/70 border border-red-100 p-3.5 rounded-xl text-xs space-y-1 text-slate-800 font-medium">
              <div>
                ভাউচার নং: <strong className="font-mono text-red-800">#{expenseToDelete.voucher_no || expenseToDelete.id.slice(0, 8)}</strong>
              </div>
              <div>
                খাত ও ফান্ড: <strong>{expenseToDelete.category}</strong> ({expenseToDelete.fund_name || "সাধারণ ফান্ড"})
              </div>
              <div>
                পরিমাণ: <strong className="text-red-700 font-bold text-sm">৳ {Number(expenseToDelete.amount).toLocaleString("bn-BD")}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              আপনি কি নিশ্চিত যে আপনি এই খরচের ইনভয়েসটি স্থায়ীভাবে মুছে ফেলতে চান? এটি মুছে ফেললে ফান্ড ব্যালেন্স ও লেজার স্বয়ংক্রিয়ভাবে রিক্যালকুলেট হবে।
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>রেকর্ডটি মুছে ফেলুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Voucher Modal */}
      {activeVoucherExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="max-w-4xl w-full my-auto py-6">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-200 relative">
              <ExpenseVoucher
                expense={activeVoucherExpense}
                madrasaInfo={madrasaInfo}
                onClose={() => setActiveVoucherExpense(null)}
                showControls={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          funds={funds}
          isOpen={Boolean(editingExpense)}
          onClose={() => setEditingExpense(null)}
          onUpdated={handleExpenseUpdated}
        />
      )}
    </div>
  );
}
