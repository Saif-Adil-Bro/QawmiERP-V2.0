"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  BookOpen,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Printer,
  CheckCircle,
  Clock,
  MapPin,
  TrendingUp,
  FileText,
  Phone,
  Tag,
  AlertCircle,
  CheckSquare
} from "lucide-react";
import {
  Mahfil,
  MahfilSpeaker,
  MahfilReceiptBook,
  MahfilTransaction
} from "@/lib/fundraising-types";
import {
  saveMahfilSpeaker,
  deleteMahfilSpeaker,
  saveMahfilReceiptBook,
  deleteMahfilReceiptBook,
  saveMahfilTransaction,
  deleteMahfilTransaction,
  saveMahfil
} from "@/app/actions/fundraising";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

export default function MahfilDetailClient({ mahfil: initialMahfil }: { mahfil: Mahfil }) {
  const router = useRouter();
  const [mahfil, setMahfil] = useState<Mahfil>(initialMahfil);
  const [activeTab, setActiveTab] = useState<"speakers" | "receipts" | "finance" | "audit">("speakers");

  // Speaker Modal State
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Partial<MahfilSpeaker> | null>(null);

  // Receipt Book Modal State
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Partial<MahfilReceiptBook> | null>(null);

  // Transaction Modal State
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Partial<MahfilTransaction> | null>(null);

  const [loading, setLoading] = useState(false);

  // Financial Calculations
  const receiptIncome = (mahfil.receipt_books || []).reduce((acc, b) => acc + (b.total_collected || 0), 0);
  const directIncome = (mahfil.transactions || []).filter(t => t.type === "INCOME").reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalIncome = receiptIncome + directIncome;
  const totalExpense = (mahfil.transactions || []).filter(t => t.type === "EXPENSE").reduce((acc, t) => acc + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  // Speaker CRUD
  const handleOpenSpeakerModal = (spk?: MahfilSpeaker) => {
    if (spk) {
      setEditingSpeaker({ ...spk });
    } else {
      setEditingSpeaker({
        name: "",
        title: "মাওলানা",
        designation: "",
        topic: "তাফসীরুল কুরআন ও ইসলামী জীবন",
        date: mahfil.start_date,
        time_slot: "বাদ মাগরিব",
        phone: "",
        agreed_hadia: 10000,
        paid_hadia: 0,
        status: "CONFIRMED",
        notes: "",
      });
    }
    setSpeakerModalOpen(true);
  };

  const handleSaveSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpeaker?.name?.trim()) return;
    setLoading(true);
    try {
      await saveMahfilSpeaker(mahfil.id, editingSpeaker);
      setSpeakerModalOpen(false);
      router.refresh();
      // optimistic update
      const updatedSpeakers = editingSpeaker.id
        ? (mahfil.speakers || []).map(s => s.id === editingSpeaker.id ? { ...s, ...editingSpeaker } as MahfilSpeaker : s)
        : [...(mahfil.speakers || []), { ...editingSpeaker, id: `spk_${Date.now()}` } as MahfilSpeaker];
      setMahfil(prev => ({ ...prev, speakers: updatedSpeakers }));
    } catch (err) {
      alert("বক্তা সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpeaker = async (speakerId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই বক্তার তথ্য মুছে ফেলতে চান?")) return;
    try {
      await deleteMahfilSpeaker(mahfil.id, speakerId);
      setMahfil(prev => ({ ...prev, speakers: (prev.speakers || []).filter(s => s.id !== speakerId) }));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // Receipt Book CRUD
  const handleOpenBookModal = (bk?: MahfilReceiptBook) => {
    if (bk) {
      setEditingBook({ ...bk });
    } else {
      const nextNum = (mahfil.receipt_books || []).length + 1;
      setEditingBook({
        book_no: `বই #${nextNum}`,
        page_from: 1,
        page_to: 50,
        category: "সাধারণ অনুদান",
        issued_to_name: "",
        issued_to_type: "উস্তাদ",
        issued_to_phone: "",
        issued_date: new Date().toISOString().split("T")[0],
        total_collected: 0,
        status: "ISSUED",
        notes: "",
      });
    }
    setBookModalOpen(true);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook?.issued_to_name?.trim()) {
      alert("গ্রহীতার নাম প্রদান করুন");
      return;
    }
    setLoading(true);
    try {
      await saveMahfilReceiptBook(mahfil.id, editingBook);
      setBookModalOpen(false);
      router.refresh();
      const updatedBooks = editingBook.id
        ? (mahfil.receipt_books || []).map(b => b.id === editingBook.id ? { ...b, ...editingBook } as MahfilReceiptBook : b)
        : [...(mahfil.receipt_books || []), { ...editingBook, id: `bk_${Date.now()}`, total_pages: (Number(editingBook.page_to || 50) - Number(editingBook.page_from || 1) + 1) } as MahfilReceiptBook];
      setMahfil(prev => ({ ...prev, receipt_books: updatedBooks }));
    } catch (err) {
      alert("রসিদ বই সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই রসিদ বইয়ের এন্ট্রি মুছতে চান?")) return;
    try {
      await deleteMahfilReceiptBook(mahfil.id, bookId);
      setMahfil(prev => ({ ...prev, receipt_books: (prev.receipt_books || []).filter(b => b.id !== bookId) }));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // Transaction CRUD
  const handleOpenTxnModal = (type: "INCOME" | "EXPENSE", txn?: MahfilTransaction) => {
    if (txn) {
      setEditingTxn({ ...txn });
    } else {
      setEditingTxn({
        type,
        category: type === "INCOME" ? "মঞ্চের প্রকাশ্য দান" : "বক্তা হাদিয়া",
        amount: 5000,
        description: "",
        date: new Date().toISOString().split("T")[0],
        receipt_no: `MHF-${Date.now().toString().slice(-4)}`,
        paid_to_or_received_from: "",
        payment_method: "Cash",
        voucher_no: "",
      });
    }
    setTxnModalOpen(true);
  };

  const handleSaveTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn?.amount || editingTxn.amount <= 0) {
      alert("সঠিক পরিমাণ উল্লেখ করুন");
      return;
    }
    setLoading(true);
    try {
      await saveMahfilTransaction(mahfil.id, editingTxn);
      setTxnModalOpen(false);
      router.refresh();
      const updatedTxns = editingTxn.id
        ? (mahfil.transactions || []).map(t => t.id === editingTxn.id ? { ...t, ...editingTxn } as MahfilTransaction : t)
        : [...(mahfil.transactions || []), { ...editingTxn, id: `txn_${Date.now()}` } as MahfilTransaction];
      setMahfil(prev => ({ ...prev, transactions: updatedTxns }));
    } catch (err) {
      alert("লেনদেন সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTxn = async (txnId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই ভাউচারটি মুছতে চান?")) return;
    try {
      await deleteMahfilTransaction(mahfil.id, txnId);
      setMahfil(prev => ({ ...prev, transactions: (prev.transactions || []).filter(t => t.id !== txnId) }));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/fundraising/mahfil"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="তালিকায় ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{mahfil.title}</h1>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                {mahfil.year} ({mahfil.hijri_year})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {toBanglaNumber(mahfil.start_date)} {mahfil.end_date !== mahfil.start_date ? `থেকে ${toBanglaNumber(mahfil.end_date)}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {mahfil.venue || "মাদ্রাসা প্রাঙ্গণ"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("audit")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>অডিট ও ব্যালেন্স শীট</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">বক্তা ও অতিথি</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(mahfil.speakers?.length || 0)} জন
          </span>
          <span className="text-[11px] text-slate-400 font-medium">নির্ধারিত সময়সূচি</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">রসিদ বই বিতরণ</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(mahfil.receipt_books?.length || 0)} টি
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">
            আদায়: ৳ {toBanglaNumber(receiptIncome)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">মোট আয় (সকল খাত)</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(totalIncome)}
          </span>
          <span className="text-[11px] text-slate-400">রসিদ বই + মঞ্চের দান</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">নিট উদ্বৃত্ত / স্থিতি</span>
          <span className={`text-2xl font-bold mt-1 block ${netBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            ৳ {toBanglaNumber(netBalance)}
          </span>
          <span className="text-[11px] text-slate-400">ব্যয়: ৳ {toBanglaNumber(totalExpense)}</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 flex items-center gap-1 shadow-xs overflow-x-auto">
        {[
          { id: "speakers", label: "বক্তা ও অতিথি সূচি", icon: Users, count: mahfil.speakers?.length || 0 },
          { id: "receipts", label: "রসিদ বই বিতরণ ও জমা", icon: BookOpen, count: mahfil.receipt_books?.length || 0 },
          { id: "finance", label: "আয় ও ব্যয় খতিয়ান", icon: DollarSign, count: mahfil.transactions?.length || 0 },
          { id: "audit", label: "অডিট রিপোর্ট ও প্রিন্ট", icon: FileText, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                  {toBanglaNumber(tab.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SPEAKERS */}
      {/* ========================================================================= */}
      {activeTab === "speakers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">সম্মানিত বক্তা ও অতিথি সময়সূচি</h3>
            <button
              onClick={() => handleOpenSpeakerModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বক্তা যোগ করুন</span>
            </button>
          </div>

          {(mahfil.speakers || []).length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">এখনো কোনো বক্তার তথ্য যুক্ত করা হয়নি</p>
              <p className="text-xs mt-1">ওপরের বাটন চেপে সম্মানিত মেহমানদের তালিকা ও বয়ানের সময়সূচি এন্ট্রি করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">ক্রমিক</th>
                      <th className="py-3 px-4">বক্তার নাম ও উপাধি</th>
                      <th className="py-3 px-4">প্রতিষ্ঠান / পরিচয়</th>
                      <th className="py-3 px-4">বয়ানের বিষয়</th>
                      <th className="py-3 px-4">নির্ধারিত সময়</th>
                      <th className="py-3 px-4">মোবাইল</th>
                      <th className="py-3 px-4">হাদিয়া (ধার্য / প্রদত্ত)</th>
                      <th className="py-3 px-4">স্ট্যাটাস</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mahfil.speakers.map((spk, idx) => (
                      <tr key={spk.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-500">{toBanglaNumber(idx + 1)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {spk.title ? `${spk.title} ` : ""}{spk.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{spk.designation || "-"}</td>
                        <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">{spk.topic || "-"}</td>
                        <td className="py-3 px-4 font-semibold text-emerald-800 bg-emerald-50/50">{spk.time_slot || "-"}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{spk.phone || "-"}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          ৳ {toBanglaNumber(spk.agreed_hadia || 0)} / <span className="text-emerald-600">৳ {toBanglaNumber(spk.paid_hadia || 0)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            spk.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                            spk.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                            spk.status === "DECLINED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {spk.status === "CONFIRMED" ? "নিশ্চিত" :
                             spk.status === "COMPLETED" ? "উপস্থিত" :
                             spk.status === "DECLINED" ? "অপারগ" : "আমন্ত্রিত"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenSpeakerModal(spk)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpeaker(spk.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIPT BOOKS */}
      {/* ========================================================================= */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">রসিদ বই বিতরণ ও জমা রেজিস্টার</h3>
            <button
              onClick={() => handleOpenBookModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন রসিদ বই ইস্যু করুন</span>
            </button>
          </div>

          {(mahfil.receipt_books || []).length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">এখনো কোনো রসিদ বই ইস্যু করা হয়নি</p>
              <p className="text-xs mt-1">উস্তাদ, ছাত্র বা স্বেচ্ছাসেবকদের নামে রসিদ বই বিতরণ রেকর্ড করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">বই নম্বর</th>
                      <th className="py-3 px-4">পাতা রেঞ্জ</th>
                      <th className="py-3 px-4">খাত / ক্যাটাগরি</th>
                      <th className="py-3 px-4">কার নামে ইস্যু</th>
                      <th className="py-3 px-4">মোবাইল</th>
                      <th className="py-3 px-4">ইস্যুর তারিখ</th>
                      <th className="py-3 px-4">আদায়কৃত জমা</th>
                      <th className="py-3 px-4">স্ট্যাটাস</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mahfil.receipt_books.map((bk) => (
                      <tr key={bk.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{bk.book_no}</td>
                        <td className="py-3 px-4 font-semibold text-slate-600">
                          {toBanglaNumber(bk.page_from)} - {toBanglaNumber(bk.page_to)} ({toBanglaNumber(bk.total_pages)} পাতা)
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[11px]">
                            {bk.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{bk.issued_to_name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{bk.issued_to_type}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{bk.issued_to_phone || "-"}</td>
                        <td className="py-3 px-4 text-slate-600">{toBanglaNumber(bk.issued_date)}</td>
                        <td className="py-3 px-4 font-bold text-emerald-700 text-sm">
                          ৳ {toBanglaNumber(bk.total_collected)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            bk.status === "RETURNED" ? "bg-emerald-100 text-emerald-800" :
                            bk.status === "PARTIALLY_RETURNED" ? "bg-amber-100 text-amber-800" :
                            bk.status === "OVERDUE" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {bk.status === "RETURNED" ? "জমা সম্পন্ন" :
                             bk.status === "PARTIALLY_RETURNED" ? "আংশিক জমা" :
                             bk.status === "OVERDUE" ? "বকেয়া" : "বিতরণকৃত"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenBookModal(bk)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBook(bk.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FINANCE & VOUCHERS */}
      {/* ========================================================================= */}
      {activeTab === "finance" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">মাহফিলের আয় ও ব্যয় ভাউচার খতিয়ান</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenTxnModal("INCOME")}
                className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>আয় / অনুদান ভাউচার</span>
              </button>
              <button
                onClick={() => handleOpenTxnModal("EXPENSE")}
                className="flex items-center gap-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ব্যয় ভাউচার এন্ট্রি</span>
              </button>
            </div>
          </div>

          {(mahfil.transactions || []).length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">এখনো কোনো ভাউচার এন্ট্রি করা হয়নি</p>
              <p className="text-xs mt-1">মঞ্চের দান, স্পন্সর, বক্তা হাদিয়া বা প্যান্ডেল খরচের ভাউচার যুক্ত করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">ধরন</th>
                      <th className="py-3 px-4">তারিখ</th>
                      <th className="py-3 px-4">খাত / বিবরণ</th>
                      <th className="py-3 px-4">গ্রহীতা / দাতা</th>
                      <th className="py-3 px-4">পেমেন্ট মেথড</th>
                      <th className="py-3 px-4">রসিদ / ভাউচার নং</th>
                      <th className="py-3 px-4 text-right">টাকার পরিমাণ</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mahfil.transactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                            txn.type === "INCOME" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {txn.type === "INCOME" ? "আয়" : "ব্যয়"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{toBanglaNumber(txn.date)}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{txn.category}</span>
                          {txn.description && <span className="text-[11px] text-slate-500">{txn.description}</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{txn.paid_to_or_received_from || "-"}</td>
                        <td className="py-3 px-4 text-slate-600">{txn.payment_method}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{txn.receipt_no || txn.voucher_no || "-"}</td>
                        <td className={`py-3 px-4 text-right font-bold text-sm ${txn.type === "INCOME" ? "text-emerald-700" : "text-rose-600"}`}>
                          {txn.type === "INCOME" ? "+" : "-"} ৳ {toBanglaNumber(txn.amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenTxnModal(txn.type, txn)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTxn(txn.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT & PRINTABLE REPORT */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h3 className="text-base font-bold text-slate-900">মাহফিলের পূর্ণাঙ্গ অডিট ও আয়-ব্যয় বিবরণী</h3>
              <p className="text-xs text-slate-500">শুরা কমিটি ও সাধারণ শুভাকাঙ্ক্ষীদের জন্য অফিসিয়াল রিপোর্ট</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট / পিডিএফ ডাউনলোড</span>
            </button>
          </div>

          {/* Printable Container */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs print:p-0 print:border-none print:shadow-none space-y-6">
            {/* Header */}
            <div className="text-center border-b-2 border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-slate-900">{mahfil.title}</h2>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                শিক্ষাবর্ষ: {mahfil.year} ({mahfil.hijri_year}) | স্থান: {mahfil.venue}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                তারিখ: {toBanglaNumber(mahfil.start_date)} {mahfil.end_date !== mahfil.start_date ? `থেকে ${toBanglaNumber(mahfil.end_date)}` : ""}
              </p>
            </div>

            {/* Financial Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Income Column */}
              <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/30">
                <h4 className="font-bold text-emerald-900 border-b border-emerald-200 pb-2 mb-3 text-sm flex items-center justify-between">
                  <span>আয়ের বিবরণী (Income)</span>
                  <span>টাকা</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-emerald-100">
                    <span className="text-slate-700">রসিদ বই কালেকশন (মোট {toBanglaNumber(mahfil.receipt_books?.length || 0)} টি)</span>
                    <span className="font-bold text-slate-900">৳ {toBanglaNumber(receiptIncome)}</span>
                  </div>
                  {(mahfil.transactions || []).filter(t => t.type === "INCOME").map((t, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-emerald-100">
                      <span className="text-slate-700">{t.category} ({t.paid_to_or_received_from || "সাধারণ"})</span>
                      <span className="font-bold text-slate-900">৳ {toBanglaNumber(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-bold text-emerald-900 border-t-2 border-emerald-300">
                    <span>সর্বমোট আয়:</span>
                    <span>৳ {toBanglaNumber(totalIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Expense Column */}
              <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/30">
                <h4 className="font-bold text-rose-900 border-b border-rose-200 pb-2 mb-3 text-sm flex items-center justify-between">
                  <span>ব্যয়ের বিবরণী (Expenditure)</span>
                  <span>টাকা</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {(mahfil.transactions || []).filter(t => t.type === "EXPENSE").map((t, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-rose-100">
                      <span className="text-slate-700">{t.category} ({t.paid_to_or_received_from || t.description || "-"})</span>
                      <span className="font-bold text-slate-900">৳ {toBanglaNumber(t.amount)}</span>
                    </div>
                  ))}
                  {(mahfil.transactions || []).filter(t => t.type === "EXPENSE").length === 0 && (
                    <p className="text-slate-400 py-2">কোনো ব্যয়ের এন্ট্রি নেই</p>
                  )}
                  <div className="flex justify-between pt-2 text-sm font-bold text-rose-900 border-t-2 border-rose-300">
                    <span>সর্বমোট ব্যয়:</span>
                    <span>৳ {toBanglaNumber(totalExpense)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Summary Box */}
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">চূড়ান্ত ফলাফল:</span>
                <span className="text-sm text-slate-600">মোট আয় - মোট ব্যয়</span>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold ${netBalance >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                  {netBalance >= 0 ? "উদ্বৃত্ত: " : "ঘাটতি: "} ৳ {toBanglaNumber(Math.abs(netBalance))}
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-16 grid grid-cols-3 gap-8 text-center text-xs">
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মুহতারাম ক্যাশিয়ার
              </div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মাহফিল পরিচালক / সম্পাদক
              </div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মুহতারাম মুহতামিম / সভাপতি
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SPEAKER */}
      {/* ========================================================================= */}
      {speakerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingSpeaker?.id ? "বক্তা তথ্য সম্পাদনা" : "নতুন বক্তা যোগ করুন"}</span>
              <button onClick={() => setSpeakerModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveSpeaker} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">উপাধি</label>
                  <select
                    value={editingSpeaker?.title || "মাওলানা"}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-2 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="আল্লামা">আল্লামা</option>
                    <option value="মুফতি">মুফতি</option>
                    <option value="মাওলানা">মাওলানা</option>
                    <option value="শায়খ">শায়খ</option>
                    <option value="হাফেজ">হাফেজ</option>
                    <option value="জনাব">জনাব</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">বক্তার নাম <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editingSpeaker?.name || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">প্রতিষ্ঠান / পরিচয়</label>
                <input
                  type="text"
                  placeholder="যেমন: মুহতামিম, জামিয়া ইসলামিয়া ঢাকা"
                  value={editingSpeaker?.designation || ""}
                  onChange={(e) => setEditingSpeaker(prev => ({ ...prev, designation: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বয়ানের বিষয়</label>
                <input
                  type="text"
                  placeholder="যেমন: খতমে বুখারী ও দ্বীনি শিক্ষার গুরুত্ব"
                  value={editingSpeaker?.topic || ""}
                  onChange={(e) => setEditingSpeaker(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বয়ানের সময় স্লট</label>
                  <input
                    type="text"
                    placeholder="যেমন: বাদ মাগরিব"
                    value={editingSpeaker?.time_slot || "বাদ মাগরিব"}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, time_slot: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={editingSpeaker?.phone || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">নির্ধারিত হাদিয়া (টাকা)</label>
                  <input
                    type="number"
                    value={editingSpeaker?.agreed_hadia || 0}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, agreed_hadia: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পরিশোধিত হাদিয়া (টাকা)</label>
                  <input
                    type="number"
                    value={editingSpeaker?.paid_hadia || 0}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, paid_hadia: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSpeakerModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT RECEIPT BOOK */}
      {/* ========================================================================= */}
      {bookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingBook?.id ? "রসিদ বই সম্পাদনা" : "নতুন রসিদ বই ইস্যু করুন"}</span>
              <button onClick={() => setBookModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveBook} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বই নম্বর</label>
                  <input
                    type="text"
                    required
                    value={editingBook?.book_no || ""}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, book_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পাতা হতে</label>
                  <input
                    type="number"
                    value={editingBook?.page_from || 1}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, page_from: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পাতা পর্যন্ত</label>
                  <input
                    type="number"
                    value={editingBook?.page_to || 50}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, page_to: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">কার নামে ইস্যু <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="উস্তাদ / ছাত্র / সদস্যের নাম"
                    value={editingBook?.issued_to_name || ""}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">গ্রহীতার ধরন</label>
                  <select
                    value={editingBook?.issued_to_type || "উস্তাদ"}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="উস্তাদ">উস্তাদ</option>
                    <option value="ছাত্র">ছাত্র</option>
                    <option value="কমিটি সদস্য">কমিটি সদস্য</option>
                    <option value="মুহিব্বিন/স্বেচ্ছাসেবক">মুহিব্বিন/স্বেচ্ছাসেবক</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={editingBook?.issued_to_phone || ""}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ইস্যুর তারিখ</label>
                  <input
                    type="date"
                    value={editingBook?.issued_date || ""}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, issued_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">আদায়কৃত টাকা (জমা)</label>
                  <input
                    type="number"
                    value={editingBook?.total_collected || 0}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, total_collected: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={editingBook?.status || "ISSUED"}
                    onChange={(e) => setEditingBook(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="ISSUED">বিতরণকৃত (চলমান)</option>
                    <option value="PARTIALLY_RETURNED">আংশিক জমা</option>
                    <option value="RETURNED">পূর্ণাঙ্গ জমা সম্পন্ন</option>
                    <option value="OVERDUE">বকেয়া / বিলম্বিত</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT TRANSACTION */}
      {/* ========================================================================= */}
      {txnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingTxn?.type === "INCOME" ? "আয় / দান ভাউচার" : "ব্যয় ভাউচার এন্ট্রি"}</span>
              <button onClick={() => setTxnModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveTxn} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ক্যাটাগরি / খাত</label>
                  <select
                    value={editingTxn?.category || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {editingTxn?.type === "INCOME" ? (
                      <>
                        <option value="মঞ্চের প্রকাশ্য দান">মঞ্চের প্রকাশ্য দান</option>
                        <option value="রসিদ বই কালেকশন">রসিদ বই কালেকশন</option>
                        <option value="দানবাক্স থেকে প্রাপ্ত">দানবাক্স থেকে প্রাপ্ত</option>
                        <option value="বিশেষ স্পন্সর / অনুদান">বিশেষ স্পন্সর / অনুদান</option>
                        <option value="অন্যান্য আয়">অন্যান্য আয়</option>
                      </>
                    ) : (
                      <>
                        <option value="বক্তা হাদিয়া">বক্তা হাদিয়া</option>
                        <option value="প্যান্ডেল ও ডেকোরেশন">প্যান্ডেল ও ডেকোরেশন</option>
                        <option value="মাইক ও সাউন্ড সিস্টেম">মাইক ও সাউন্ড সিস্টেম</option>
                        <option value="মেহমানদারি ও তাবাররুক">মেহমানদারি ও তাবাররুক</option>
                        <option value="প্রচার, মাইকিং ও পোস্টার">প্রচার, মাইকিং ও পোস্টার</option>
                        <option value="আলোকসজ্জা ও বিদ্যুৎ">আলোকসজ্জা ও বিদ্যুৎ</option>
                        <option value="অন্যান্য ব্যয়">অন্যান্য ব্যয়</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">টাকার পরিমাণ <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={editingTxn?.amount || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={editingTxn?.date || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পেমেন্ট মেথড</label>
                  <select
                    value={editingTxn?.payment_method || "Cash"}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, payment_method: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Cash">নগদ (Cash)</option>
                    <option value="bKash">বিকাশ (bKash)</option>
                    <option value="Nagad">নগদ (Nagad)</option>
                    <option value="Bank">ব্যাংক অ্যাকাউন্ট</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editingTxn?.type === "INCOME" ? "দাতার নাম" : "গ্রহীতা / প্রতিষ্ঠানের নাম"}
                  </label>
                  <input
                    type="text"
                    placeholder="নাম..."
                    value={editingTxn?.paid_to_or_received_from || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, paid_to_or_received_from: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">রসিদ / ভাউচার নং</label>
                  <input
                    type="text"
                    value={editingTxn?.receipt_no || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, receipt_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বিবরণ / নোট</label>
                <textarea
                  rows={2}
                  value={editingTxn?.description || ""}
                  onChange={(e) => setEditingTxn(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTxnModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  ভাউচার সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
