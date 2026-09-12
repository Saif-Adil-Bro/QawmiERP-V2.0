"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Search,
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Edit2,
  Trash2,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  FileText,
  Printer
} from "lucide-react";
import { Mahfil, MahfilStatus } from "@/lib/fundraising-types";
import { saveMahfil, deleteMahfil } from "@/app/actions/fundraising";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

const statusMap: Record<MahfilStatus, { label: string; bg: string; text: string }> = {
  UPCOMING: { label: "আসন্ন মাহফিল", bg: "bg-amber-100", text: "text-amber-800" },
  ONGOING: { label: "চলমান", bg: "bg-emerald-100", text: "text-emerald-800" },
  COMPLETED: { label: "সম্পন্ন", bg: "bg-blue-100", text: "text-blue-800" },
  ARCHIVED: { label: "সংরক্ষিত", bg: "bg-slate-100", text: "text-slate-700" },
};

export default function MahfilListClient({ initialMahfils }: { initialMahfils: Mahfil[] }) {
  const router = useRouter();
  const [mahfils, setMahfils] = useState<Mahfil[]>(initialMahfils);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMahfil, setEditingMahfil] = useState<Partial<Mahfil> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredMahfils = mahfils.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.venue && m.venue.toLowerCase().includes(search.toLowerCase())) ||
      (m.year && m.year.includes(search));
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Totals
  const totalMahfils = mahfils.length;
  const upcomingCount = mahfils.filter((m) => m.status === "UPCOMING" || m.status === "ONGOING").length;
  
  let totalReceiptCollected = 0;
  let totalExpenses = 0;

  mahfils.forEach((m) => {
    (m.receipt_books || []).forEach((b) => {
      totalReceiptCollected += b.total_collected || 0;
    });
    (m.transactions || []).forEach((t) => {
      if (t.type === "INCOME") totalReceiptCollected += t.amount || 0;
      if (t.type === "EXPENSE") totalExpenses += t.amount || 0;
    });
  });

  const handleOpenCreate = () => {
    setEditingMahfil({
      title: "",
      year: "২০২৬-২৭",
      hijri_year: "১৪৪৭-৪৮",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      venue: "মাদ্রাসা প্রাঙ্গণ",
      president: "",
      host: "",
      target_budget: 150000,
      status: "UPCOMING",
      notes: "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Mahfil) => {
    setEditingMahfil({ ...m });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMahfil?.title?.trim()) {
      setErrorMsg("মাহফিলের শিরোনাম প্রদান করুন");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      const res = await saveMahfil(editingMahfil);
      if (res.error) {
        setErrorMsg(res.error);
        setSaving(false);
        return;
      }
      setIsModalOpen(false);
      router.refresh();
      // Optimistic update
      if (editingMahfil.id) {
        setMahfils(prev => prev.map(m => m.id === editingMahfil.id ? { ...m, ...editingMahfil } as Mahfil : m));
      } else if (res.id) {
        setMahfils(prev => [{ ...editingMahfil, id: res.id, speakers: [], receipt_books: [], transactions: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Mahfil, ...prev]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`আপনি কি নিশ্চিতভাবে "${title}" মুছে ফেলতে চান?`)) return;
    try {
      const res = await deleteMahfil(id);
      if (res.error) {
        alert(res.error);
        return;
      }
      setMahfils(prev => prev.filter(m => m.id !== id));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/60">
              <CalendarDays className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              বার্ষিক ইসলামী মহাসম্মেলন ও মাহফিল ব্যবস্থাপনা
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            মাহফিলের বক্তা তালিকা, রসিদ বই বিতরণ, মঞ্চের দান ও পূর্ণাঙ্গ আয়-ব্যয় অডিট খতিয়ান।
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন মাহফিল তৈরি করুন</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">মোট মাহফিল রেকর্ড</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{toBanglaNumber(totalMahfils)} টি</p>
            <span className="text-[11px] text-emerald-600 font-medium">আর্কাইভ সহ</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">আসন্ন সম্মেলন</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{toBanglaNumber(upcomingCount)} টি</p>
            <span className="text-[11px] text-amber-700 font-medium">প্রস্তুতি চলছে</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">রসিদ বই ও দান কালেকশন</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">৳ {toBanglaNumber(totalReceiptCollected)}</p>
            <span className="text-[11px] text-slate-400">সর্বমোট জমা</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">মাহফিল মোট ব্যয়</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">৳ {toBanglaNumber(totalExpenses)}</p>
            <span className="text-[11px] text-slate-400">হাদিয়া ও ডেকোরেশন</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="মাহফিলের নাম বা সাল খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {["ALL", "UPCOMING", "ONGOING", "COMPLETED", "ARCHIVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "সকল" : statusMap[st as MahfilStatus]?.label || st}
            </button>
          ))}
        </div>
      </div>

      {/* Mahfil Cards Grid */}
      {filteredMahfils.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">কোনো মাহফিল পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            বার্ষিক মহাসম্মেলন পরিচালনার জন্য ওপরের "নতুন মাহফিল তৈরি করুন" বাটনে ক্লিক করে তথ্য এন্ট্রি করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMahfils.map((mahfil) => {
            const statusConfig = statusMap[mahfil.status] || statusMap.UPCOMING;
            const speakerCount = mahfil.speakers?.length || 0;
            const bookCount = mahfil.receipt_books?.length || 0;
            
            // Calculate mahfil specific finance
            let mIncome = 0;
            let mExpense = 0;
            (mahfil.receipt_books || []).forEach(b => mIncome += b.total_collected || 0);
            (mahfil.transactions || []).forEach(t => {
              if (t.type === "INCOME") mIncome += t.amount || 0;
              if (t.type === "EXPENSE") mExpense += t.amount || 0;
            });
            const netBalance = mIncome - mExpense;

            return (
              <div
                key={mahfil.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Top Bar with Badge */}
                  <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2 bg-slate-50/50">
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold ml-2">
                        {mahfil.year} ({mahfil.hijri_year || "হিজরি"})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        onClick={() => handleOpenEdit(mahfil)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="সম্পাদনা"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(mahfil.id, mahfil.title)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <Link
                      href={`/dashboard/fundraising/mahfil/${mahfil.id}`}
                      className="block text-base font-bold text-slate-900 hover:text-emerald-700 transition-colors leading-snug"
                    >
                      {mahfil.title}
                    </Link>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>তারিখ: {toBanglaNumber(mahfil.start_date)} {mahfil.end_date !== mahfil.start_date ? `থেকে ${toBanglaNumber(mahfil.end_date)}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{mahfil.venue || "মাদ্রাসা প্রাঙ্গণ"}</span>
                      </div>
                      {mahfil.president && (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">সভাপতি: {mahfil.president}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-medium">বক্তা ও অতিথি</span>
                        <span className="font-bold text-slate-800">{toBanglaNumber(speakerCount)} জন</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-medium">রসিদ বই</span>
                        <span className="font-bold text-slate-800">{toBanglaNumber(bookCount)} টি</span>
                      </div>
                    </div>

                    {/* Financial bar */}
                    <div className="bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-emerald-800 block font-medium">মোট কালেকশন</span>
                        <span className="font-bold text-emerald-900">৳ {toBanglaNumber(mIncome)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-medium">নিট ব্যালেন্স</span>
                        <span className={`font-bold ${netBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          ৳ {toBanglaNumber(netBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">পূর্ণাঙ্গ ম্যানেজমেন্ট হাব</span>
                  <Link
                    href={`/dashboard/fundraising/mahfil/${mahfil.id}`}
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    <span>প্রবেশ করুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Mahfil */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingMahfil?.id ? "মাহফিল তথ্য সম্পাদনা" : "নতুন মাহফিল তৈরি করুন"}</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </h2>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  মাহফিলের শিরোনাম / নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ৫৪তম বার্ষিক ইসলামী মহাসম্মেলন ও খতমে বুখারী"
                  value={editingMahfil?.title || ""}
                  onChange={(e) => setEditingMahfil((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শিক্ষাবর্ষ / সাল</label>
                  <input
                    type="text"
                    value={editingMahfil?.year || "২০২৬-২৭"}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">হিজরি সাল</label>
                  <input
                    type="text"
                    value={editingMahfil?.hijri_year || "১৪৪৭-৪৮"}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, hijri_year: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শুরুর তারিখ</label>
                  <input
                    type="date"
                    required
                    value={editingMahfil?.start_date || ""}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সমাপ্তির তারিখ</label>
                  <input
                    type="date"
                    value={editingMahfil?.end_date || ""}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">স্থান (Venue)</label>
                  <input
                    type="text"
                    value={editingMahfil?.venue || "মাদ্রাসা প্রাঙ্গণ"}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, venue: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={editingMahfil?.status || "UPCOMING"}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, status: e.target.value as MahfilStatus }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="UPCOMING">আসন্ন মাহফিল</option>
                    <option value="ONGOING">চলমান</option>
                    <option value="COMPLETED">সম্পন্ন</option>
                    <option value="ARCHIVED">সংরক্ষিত (Archived)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সম্মেলন সভাপতি</label>
                  <input
                    type="text"
                    placeholder="হযরত আল্লামা..."
                    value={editingMahfil?.president || ""}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, president: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সঞ্চালক / পরিচালক</label>
                  <input
                    type="text"
                    placeholder="মাওলানা..."
                    value={editingMahfil?.host || ""}
                    onChange={(e) => setEditingMahfil((prev) => ({ ...prev, host: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">প্রাক্কলিত বাজেট (টাকা)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={editingMahfil?.target_budget || ""}
                  onChange={(e) => setEditingMahfil((prev) => ({ ...prev, target_budget: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">মন্তব্য / বিশেষ নির্দেশনা</label>
                <textarea
                  rows={2}
                  placeholder="মাহফিলের উদ্দেশ্য বা নোট..."
                  value={editingMahfil?.notes || ""}
                  onChange={(e) => setEditingMahfil((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition-colors"
                >
                  {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
