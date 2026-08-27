"use client";

import { useState, useEffect } from "react";
import {
  getBazarExpenses,
  saveBazarExpense,
  deleteBazarExpense,
  getNextBazarVoucherNo,
  getBoardingMadrasaInfo,
  BazarExpenseItem,
} from "@/app/actions/boarding";
import { getFunds } from "@/app/actions/zakat";
import { FundItem, DEFAULT_FUNDS } from "@/lib/fund-utils";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CalendarDays,
  Receipt,
  X,
  Info,
  Printer,
  Search,
  RefreshCw,
  ShoppingBag,
  CreditCard,
  UserCheck,
  CheckCircle,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import BazarVoucherModal from "@/components/boarding/BazarVoucherModal";
import { MadrasaInfoType } from "@/components/boarding/BazarVoucherPrint";

export default function BazarExpensesPage() {
  const [expenses, setExpenses] = useState<BazarExpenseItem[]>([]);
  const [funds, setFunds] = useState<FundItem[]>(DEFAULT_FUNDS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [madrasaInfo, setMadrasaInfo] = useState<MadrasaInfoType>({});

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVoucherNo, setFormVoucherNo] = useState("");
  const [generatingVoucher, setGeneratingVoucher] = useState(false);
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formAmount, setFormAmount] = useState("");
  const [formBuyerName, setFormBuyerName] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Cash");
  const [formFundId, setFormFundId] = useState("fund-lillah");
  const [formDetails, setFormDetails] = useState("");

  // Voucher Print Modal state
  const [activeVoucherExpense, setActiveVoucherExpense] = useState<BazarExpenseItem | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const [data, info, fundsList] = await Promise.all([
        getBazarExpenses(),
        getBoardingMadrasaInfo(),
        getFunds(),
      ]);
      setExpenses(data);
      if (info) setMadrasaInfo(info);
      if (fundsList && fundsList.length > 0) setFunds(fundsList);
    } catch (e) {
      console.error("Error loading bazar expenses:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  // Fetch next auto voucher number
  const handleAutoGenerateVoucher = async () => {
    setGeneratingVoucher(true);
    try {
      const nextVoucher = await getNextBazarVoucherNo();
      setFormVoucherNo(nextVoucher);
    } catch (e) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const rand = Math.floor(100 + Math.random() * 900);
      setFormVoucherNo(`BV-${yy}${mm}${rand}`);
    }
    setGeneratingVoucher(false);
  };

  const handleOpenAddForm = async () => {
    setEditingId(null);
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormAmount("");
    setFormBuyerName("");
    setFormPaymentMethod("Cash");
    setFormFundId("fund-lillah");
    setFormDetails("");
    setIsFormOpen(true);
    setMessage(null);

    // Auto-generate fresh voucher number
    await handleAutoGenerateVoucher();
  };

  const handleOpenEditForm = (exp: BazarExpenseItem) => {
    setEditingId(exp.id);
    setFormVoucherNo(exp.voucher_no || "");
    setFormDate(exp.expense_date);
    setFormAmount(exp.amount.toString());
    setFormBuyerName(exp.buyer_name || "");
    setFormPaymentMethod(exp.payment_method || "Cash");
    setFormFundId(exp.fund_id || "fund-lillah");
    setFormDetails(exp.items_details || "");
    setIsFormOpen(true);
    setMessage(null);
  };

  const handleOpenVoucherPrint = (exp: BazarExpenseItem) => {
    setActiveVoucherExpense(exp);
    setIsVoucherModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      setMessage({ type: "error", text: "অনুগ্রহ করে সঠিক খরচের পরিমাণ দিন।" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const selectedFundObj = funds.find(f => f.id === formFundId) || funds[0];

    const expensePayload = {
      id: editingId || undefined,
      voucher_no: formVoucherNo.trim(),
      amount: Number(formAmount),
      expense_date: formDate,
      buyer_name: formBuyerName.trim(),
      payment_method: formPaymentMethod,
      fund_id: formFundId,
      fund_name: selectedFundObj?.name || "লিল্লাহ বোর্ডিং ফান্ড",
      items_details: formDetails,
    };

    const res = await saveBazarExpense(expensePayload);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({
        type: "success",
        text: editingId
          ? `বাজার খরচ (${expensePayload.voucher_no || "ভাউচার"}) সফলভাবে আপডেট হয়েছে!`
          : `নতুন বাজার খরচ ভাউচার (${expensePayload.voucher_no}) সফলভাবে তৈরি হয়েছে!`,
      });
      setIsFormOpen(false);
      await loadExpenses();

      // Open print voucher preview if newly created
      if (res.expense) {
        setActiveVoucherExpense(res.expense);
        setIsVoucherModalOpen(true);
      }

      setTimeout(() => setMessage(null), 4000);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string, voucherNo?: string) => {
    if (!confirm(`আপনি কি নিশ্চিতভাবে ভাউচার (${voucherNo || "এই এন্ট্রি"}) মুছে ফেলতে চান?`)) return;

    const res = await deleteBazarExpense(id);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "বাজার খরচ ভাউচার সফলভাবে মুছে ফেলা হয়েছে।" });
      loadExpenses();
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Filtered expenses by search keyword
  const filteredExpenses = expenses.filter((exp) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const vNo = (exp.voucher_no || "").toLowerCase();
    const details = (exp.items_details || "").toLowerCase();
    const buyer = (exp.buyer_name || "").toLowerCase();
    const dateStr = exp.expense_date || "";
    return vNo.includes(query) || details.includes(query) || buyer.includes(query) || dateStr.includes(query);
  });

  const totalBazarAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const latestVoucherNo = expenses.length > 0 ? expenses[0].voucher_no : "BV-0000";

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3.5">
          <Link
            href="/dashboard/boarding"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            id="back_to_boarding_dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">বাজার খরচ ও ভাউচার (Bazar Expenses)</h1>
              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                স্বয়ংক্রিয় ভাউচার ও প্রিন্ট
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              বোর্ডিং ও মেস বিভাগের দৈনন্দিন বাজার খরচ, মালামাল হিসাব ও অফিশিয়াল ভাউচার তৈরি
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddForm}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm flex items-center gap-2 cursor-pointer active:scale-98"
          id="btn_add_bazar"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>+ নতুন বাজার খরচ ও ভাউচার যোগ করুন</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
          id="bazar_message_alert"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Amount */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 shrink-0">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">মোট খরচের পরিমাণ</p>
            <h3 className="text-xl font-black text-slate-900 font-mono mt-0.5">
              ৳ {formatBanglaCurrency(totalBazarAmount)}
            </h3>
          </div>
        </div>

        {/* Total Days */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 shrink-0">
            <CalendarDays className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">মোট বাজারের দিন</p>
            <h3 className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {toBanglaNumber(expenses.length)} দিন
            </h3>
          </div>
        </div>

        {/* Average Expense */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 shrink-0">
            <Info className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">গড় বাজার খরচ</p>
            <h3 className="text-xl font-black text-slate-900 font-mono mt-0.5">
              ৳ {formatBanglaCurrency(expenses.length > 0 ? Math.round(totalBazarAmount / expenses.length) : 0)}
            </h3>
          </div>
        </div>

        {/* Latest Voucher */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 shrink-0">
            <ShoppingBag className="w-6 h-6 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">সর্বশেষ ভাউচার নং</p>
            <h3 className="text-base font-black text-purple-950 font-mono truncate mt-0.5" title={latestVoucherNo}>
              {latestVoucherNo}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="ভাউচার নং, মালামাল বা বাজারকারী দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 self-end sm:self-auto">
          <span>মোট ভাউচার: <span className="font-mono text-slate-900">{toBanglaNumber(filteredExpenses.length)}</span> টি</span>
        </div>
      </div>

      {/* Main Table List */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-14 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
            <span className="text-xs sm:text-sm font-semibold">বাজার খরচ ও ভাউচার রেকর্ড লোড হচ্ছে...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-14 text-center text-slate-500">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">কোনো বাজার খরচের রেকর্ড পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">
              নতুন বাজার খরচ ও স্বয়ংক্রিয় ভাউচার যোগ করতে উপরের বাটনে ক্লিক করুন
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6 w-44">ভাউচার নং ও তারিখ</th>
                  <th className="py-3.5 px-4 sm:px-6">বাজারের মালামাল বিবরণ</th>
                  <th className="py-3.5 px-4 sm:px-6 w-40">খরচের ফান্ড ও ক্রেতা</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right w-36">পরিমাণ ৳</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right w-44">ভাউচার ও অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Voucher No & Date */}
                    <td className="py-3 px-4 sm:px-6">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-black bg-slate-900 text-white shadow-2xs">
                        {exp.voucher_no || "BV-AUTO"}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 mt-1">
                        {toBanglaNumber(format(new Date(exp.expense_date), "dd-MM-yyyy"))}
                      </div>
                    </td>

                    {/* Items Details */}
                    <td className="py-3 px-4 sm:px-6">
                      <div className="font-medium text-slate-900 whitespace-pre-line leading-relaxed text-xs">
                        {exp.items_details || "বিবরণ দেওয়া হয়নি"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.2 rounded border border-slate-200">
                          {exp.payment_method === "Bkash"
                            ? "বিকাশ"
                            : exp.payment_method === "Bank"
                            ? "ব্যাংক"
                            : "নগদ (Cash)"}
                        </span>
                      </div>
                    </td>

                    {/* Fund & Buyer / Responsible */}
                    <td className="py-3 px-4 sm:px-6">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mb-1">
                        <Landmark className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{exp.fund_name || "লিল্লাহ বোর্ডিং ফান্ড"}</span>
                      </div>
                      <div className="font-bold text-slate-800 text-xs">
                        {exp.buyer_name || "মাদরাসা প্রতিনিধি"}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <div className="font-black text-emerald-800 text-sm sm:text-base font-mono">
                        ৳ {formatBanglaCurrency(exp.amount)}
                      </div>
                    </td>

                    {/* Actions & Print Button */}
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print Voucher Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenVoucherPrint(exp)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                          title="ভাউচার ভিউ ও প্রিন্ট করুন"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ভাউচার</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(exp)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="এডিট করুন"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id, exp.voucher_no)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
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

      {/* Editor Modal / Form Overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingId ? "বাজার খরচ ভাউচার এডিট করুন" : "নতুন বাজার খরচ ও স্বয়ংক্রিয় ভাউচার"}
                  </h2>
                  <p className="text-[11px] text-slate-500">বোর্ডিং বাজার খরচের বিবরণী ও ভাউচার তৈরি</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                id="btn_close_modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
              {/* Row 1: Voucher No & Auto Generate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="voucher_no" className="font-bold text-slate-800">
                    ভাউচার নম্বর <span className="text-emerald-600 font-normal">(অটোমেটিক জেনারেটেড)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateVoucher}
                    disabled={generatingVoucher}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${generatingVoucher ? "animate-spin" : ""}`} />
                    <span>নতুন ভাউচার নম্বর নিন</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    id="voucher_no"
                    required
                    value={formVoucherNo}
                    onChange={(e) => setFormVoucherNo(e.target.value)}
                    placeholder="যেমন: BV-2608001"
                    className="w-full font-mono font-bold text-slate-900 border border-slate-300 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Row 2: Date & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label htmlFor="expense_date" className="font-bold text-slate-800">
                    বাজারের তারিখ *
                  </label>
                  <input
                    type="date"
                    id="expense_date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="amount" className="font-bold text-slate-800">
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    id="amount"
                    required
                    placeholder="যেমন: ২৪০"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full font-bold text-slate-900 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Row 3: Buyer Name, Payment Method & Fund Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="bazar_fund_id" className="font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                      <span>খরচের ফান্ড (Fund Selection) *</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      আয়-ব্যয় হিসাব সমন্বয়
                    </span>
                  </label>
                  <select
                    id="bazar_fund_id"
                    value={formFundId}
                    onChange={(e) => setFormFundId(e.target.value)}
                    className="w-full border border-emerald-300 rounded-xl px-3 py-2 bg-emerald-50/40 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.code ? `(${f.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="buyer_name" className="font-bold text-slate-800">
                    বাজারকারী / ক্রেতার নাম
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="buyer_name"
                      placeholder="যেমন: মাওলানা আব্দুল করিম / বাবুর্চি"
                      value={formBuyerName}
                      onChange={(e) => setFormBuyerName(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="payment_method" className="font-bold text-slate-800">
                    পরিশোধের মাধ্যম
                  </label>
                  <select
                    id="payment_method"
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="Cash">নগদ (Cash)</option>
                    <option value="Bkash">বিকাশ / নগদ (Mobile)</option>
                    <option value="Bank">ব্যাংক চেক / ট্রান্সফার</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Items Details */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="items_details" className="font-bold text-slate-800">
                    বাজারের মালামালের তালিকা ও দরদাম
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">প্রতি লাইনে একটি করে লিখুন</span>
                </div>
                <textarea
                  id="items_details"
                  placeholder={"Chal 2kg - 120\nIce-cream - 70\nMilk - 50\nঅথবা: আলু ৫ কেজি - ১৫০ টাকা"}
                  rows={4}
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 font-bold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  id="btn_submit_bazar"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{submitting ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ ও ভাউচার প্রস্তুত"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher Print Modal */}
      <BazarVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        expense={activeVoucherExpense}
        madrasaInfo={madrasaInfo}
      />
    </div>
  );
}

