"use client";

import React, { useState } from "react";
import { 
  PlusCircle, 
  Search, 
  Layers, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  ShieldCheck, 
  DollarSign, 
  Users,
  Building,
  Heart,
  TrendingUp,
  Award
} from "lucide-react";
import { deleteFund } from "@/app/actions/zakat";
import { FundItem, getFundCategoryBadge } from "@/lib/fund-utils";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import FundManagerModal from "@/components/zakat/FundManagerModal";
import Link from "next/link";

interface EnrichedFund extends FundItem {
  total_collected: number;
  donations_count: number;
  unique_donors_count: number;
}

export default function FundsClient({ initialFunds }: { initialFunds: EnrichedFund[] }) {
  const [funds, setFunds] = useState<EnrichedFund[]>(initialFunds);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedFund, setSelectedFund] = useState<FundItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredFunds = funds.filter(fund => {
    const matchesSearch = fund.name.toLowerCase().includes(search.toLowerCase()) ||
      fund.code.toLowerCase().includes(search.toLowerCase()) ||
      (fund.description && fund.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCat = categoryFilter === "ALL" || fund.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalCollectedAll = funds.reduce((sum, f) => sum + (f.total_collected || 0), 0);
  const totalCustomFunds = funds.filter(f => !f.is_default).length;

  const handleDelete = async (fundId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই ফান্ডটি মুছে ফেলতে চান?")) return;
    setDeletingId(fundId);
    try {
      await deleteFund(fundId);
      setFunds(funds.filter(f => f.id !== fundId));
    } catch (err: any) {
      alert(err.message || "ফান্ড মুছতে সমস্যা হয়েছে");
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateModal = () => {
    setSelectedFund(null);
    setIsModalOpen(true);
  };

  const openEditModal = (fund: FundItem) => {
    setSelectedFund(fund);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              ফান্ড ক্যাটাগরি ও ব্যবস্থাপনা
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {toBanglaNumber(funds.length)} টি ফান্ড
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            সাধারণ ফান্ড, লিল্লাহ বোর্ডিং ফান্ড, যাকাত ফান্ড ছাড়াও যেকোনো কাস্টম ফান্ড তৈরি ও পরিচালনা করুন
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition shadow-xs cursor-pointer active:scale-98"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>+ নতুন ফান্ড তৈরি করুন</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">মোট ফান্ড কালেকশন</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              ৳ {formatBanglaCurrency(totalCollectedAll)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">সক্রিয় ফান্ডের সংখ্যা</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {toBanglaNumber(funds.length)} টি
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">কাস্টম ম্যানুয়াল ফান্ড</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {toBanglaNumber(totalCustomFunds)} টি
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
            placeholder="ফান্ডের নাম বা কোড দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 shrink-0">ফিল্টার:</span>
          {["ALL", "General", "Lillah", "Zakat", "Fitra", "Development"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                categoryFilter === cat
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "ALL" ? "সবগুলো" : cat === "General" ? "সাধারণ" : cat === "Lillah" ? "লিল্লাহ" : cat === "Zakat" ? "যাকাত" : cat === "Fitra" ? "ফিতরা" : "উন্নয়ন"}
            </button>
          ))}
        </div>
      </div>

      {/* Funds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredFunds.map((fund) => {
          const badge = getFundCategoryBadge(fund.category);
          const percent = fund.target_amount && fund.target_amount > 0 
            ? Math.min(100, Math.round((fund.total_collected / fund.target_amount) * 100))
            : null;

          return (
            <div
              key={fund.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative group"
            >
              <div>
                {/* Card Top Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {fund.code || "FND"}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>

                  {fund.is_default ? (
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ডিফল্ট
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(fund)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="সম্পাদনা করুন"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(fund.id)}
                        disabled={deletingId === fund.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Fund Name & Description */}
                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {fund.name}
                  </h3>
                  {fund.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {fund.description}
                    </p>
                  )}
                </div>

                {/* Fund Stats Block */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400">মোট সংগৃহীত</span>
                    <p className="text-base font-black text-slate-900 font-mono mt-0.5">
                      ৳ {formatBanglaCurrency(fund.total_collected)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-400">অবদানকারী দাতা</span>
                    <p className="text-sm font-bold text-slate-700 font-mono mt-0.5">
                      {toBanglaNumber(fund.unique_donors_count)} জন ({toBanglaNumber(fund.donations_count)} বার)
                    </p>
                  </div>
                </div>

                {/* Target Progress Bar if target exists */}
                {percent !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium mb-1">
                      <span>টার্গেট: ৳ {formatBanglaCurrency(fund.target_amount || 0)}</span>
                      <span>{toBanglaNumber(percent)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link
                  href={`/dashboard/zakat/collection?fund=${encodeURIComponent(fund.name)}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>এই ফান্ডে অনুদান সংগ্রহ করুন</span>
                </Link>
              </div>
            </div>
          );
        })}

        {filteredFunds.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">কোনো ফান্ড পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              নতুন ফান্ড তৈরি করতে উপরের বোতামে ক্লিক করুন
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>+ নতুন ফান্ড তৈরি করুন</span>
            </button>
          </div>
        )}
      </div>

      {/* Fund Modal */}
      <FundManagerModal
        fund={selectedFund}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
