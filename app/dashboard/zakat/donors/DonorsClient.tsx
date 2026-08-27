"use client";

import React, { useState } from "react";
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Edit3, 
  HeartHandshake, 
  Phone, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Users,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle
} from "lucide-react";
import Link from "next/link";
import { DonorItem, FundItem, getDonorTypeBadge } from "@/lib/fund-utils";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import { deleteDonor } from "@/app/actions/zakat";
import DonorManagerModal from "@/components/zakat/DonorManagerModal";

interface DonorsClientProps {
  initialDonors: DonorItem[];
  funds: FundItem[];
}

export default function DonorsClient({ initialDonors, funds }: DonorsClientProps) {
  const [donors, setDonors] = useState<DonorItem[]>(initialDonors);
  const [search, setSearch] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("ALL");
  const [selectedDonor, setSelectedDonor] = useState<DonorItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredDonors = donors.filter(donor => {
    const matchesSearch = 
      donor.name.toLowerCase().includes(search.toLowerCase()) ||
      (donor.phone && donor.phone.includes(search)) ||
      (donor.address && donor.address.toLowerCase().includes(search.toLowerCase())) ||
      (donor.notes && donor.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesFreq = frequencyFilter === "ALL" || donor.donor_type === frequencyFilter;
    return matchesSearch && matchesFreq;
  });

  const monthlyCount = donors.filter(d => d.donor_type === "Monthly").length;
  const annualCount = donors.filter(d => d.donor_type === "Annual").length;
  const oneTimeCount = donors.filter(d => d.donor_type === "OneTime").length;

  const totalPledgedMonthly = donors
    .filter(d => d.donor_type === "Monthly")
    .reduce((sum, d) => sum + (d.pledge_amount || 0), 0);

  const totalPledgedAnnual = donors
    .filter(d => d.donor_type === "Annual")
    .reduce((sum, d) => sum + (d.pledge_amount || 0), 0);

  const totalDonatedAll = donors.reduce((sum, d) => sum + (d.total_donated || 0), 0);

  const handleDelete = async (donorId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই দাতার তথ্য মুছে ফেলতে চান?")) return;
    setDeletingId(donorId);
    try {
      await deleteDonor(donorId);
      setDonors(donors.filter(d => d.id !== donorId));
    } catch (err: any) {
      alert(err.message || "দাতা মুছতে সমস্যা হয়েছে");
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateModal = () => {
    setSelectedDonor(null);
    setIsModalOpen(true);
  };

  const openEditModal = (donor: DonorItem) => {
    setSelectedDonor(donor);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              দাতাদের তালিকা ও রেজিস্টার
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
              {toBanglaNumber(donors.length)} জন নিবন্ধিত দাতা
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            বার্ষিক, মাসিক ও এককালীন সম্মানিত দাতাদের তথ্য সংরক্ষণ ও পরিচালনা
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition shadow-xs cursor-pointer active:scale-98"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>+ নতুন দাতা যুক্ত করুন</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Donors */}
        <div 
          onClick={() => setFrequencyFilter(frequencyFilter === "Monthly" ? "ALL" : "Monthly")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            frequencyFilter === "Monthly"
              ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
              মাসিক দাতা
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {toBanglaNumber(monthlyCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              প্রতিশ্রুতি: ৳ {formatBanglaCurrency(totalPledgedMonthly)} /মাস
            </p>
          </div>
        </div>

        {/* Annual Donors */}
        <div 
          onClick={() => setFrequencyFilter(frequencyFilter === "Annual" ? "ALL" : "Annual")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            frequencyFilter === "Annual"
              ? "bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
              বার্ষিক দাতা
            </span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {toBanglaNumber(annualCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              প্রতিশ্রুতি: ৳ {formatBanglaCurrency(totalPledgedAnnual)} /বছর
            </p>
          </div>
        </div>

        {/* One-time Donors */}
        <div 
          onClick={() => setFrequencyFilter(frequencyFilter === "OneTime" ? "ALL" : "OneTime")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            frequencyFilter === "OneTime"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              এককালীন দাতা
            </span>
            <HeartHandshake className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {toBanglaNumber(oneTimeCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              যাকাত, সদকা ও সাধারণ দাতা
            </p>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              মোট অনুদান প্রাপ্তি
            </span>
            <DollarSign className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black text-emerald-700 font-mono">
              ৳ {formatBanglaCurrency(totalDonatedAll)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              সব দাতার সমন্বিত অনুদান
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="দাতার নাম, মোবাইল বা ঠিকানা দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 shrink-0">দাতার ধরন:</span>
          {[
            { id: "ALL", label: "সকল দাতা" },
            { id: "Monthly", label: "মাসিক দাতা" },
            { id: "Annual", label: "বার্ষিক দাতা" },
            { id: "OneTime", label: "এককালীন দাতা" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFrequencyFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                frequencyFilter === tab.id
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Donors Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">দাতার তথ্য ও যোগাযোগ</th>
                <th className="py-3.5 px-4">দাতার ধরন / ফ্রিকোয়েন্সি</th>
                <th className="py-3.5 px-4">প্রতিশ্রুত পরিমাণ</th>
                <th className="py-3.5 px-4">মোট দান ও সংখ্যা</th>
                <th className="py-3.5 px-4">সর্বশেষ অনুদান</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
              {filteredDonors.map((donor) => {
                const badge = getDonorTypeBadge(donor.donor_type);
                return (
                  <tr key={donor.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Donor Details */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-bold text-slate-900 text-sm">{donor.name}</div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        {donor.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {toBanglaNumber(donor.phone)}
                          </span>
                        )}
                        {donor.address && (
                          <span className="flex items-center gap-1 line-clamp-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {donor.address}
                          </span>
                        )}
                      </div>
                      {donor.notes && (
                        <div className="text-[11px] text-slate-400 mt-0.5 italic">
                          {donor.notes}
                        </div>
                      )}
                    </td>

                    {/* Donor Frequency Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Pledge Amount */}
                    <td className="py-3.5 px-4">
                      {donor.pledge_amount && donor.pledge_amount > 0 ? (
                        <div>
                          <span className="font-black text-slate-900 font-mono">
                            ৳ {formatBanglaCurrency(donor.pledge_amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {donor.donor_type === "Monthly" ? "/প্রতি মাসে" : donor.donor_type === "Annual" ? "/প্রতি বছর" : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Total Donated */}
                    <td className="py-3.5 px-4">
                      <div className="font-black text-emerald-800 font-mono">
                        ৳ {formatBanglaCurrency(donor.total_donated || 0)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {toBanglaNumber(donor.donation_count || 0)} বার অনুদান
                      </div>
                    </td>

                    {/* Last Donation Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {donor.last_donation_date ? (
                        <div>
                          <span className="font-medium text-slate-800">
                            {toBanglaNumber(new Date(donor.last_donation_date).toLocaleDateString("en-GB"))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">এখনও দান করেননি</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/zakat/collection?donor_id=${donor.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition"
                          title="অনুদান সংগ্রহ করুন"
                        >
                          <HeartHandshake className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">দান সংগ্রহ</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(donor)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="সম্পাদনা করুন"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(donor.id)}
                          disabled={deletingId === donor.id}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredDonors.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">কোনো দাতার তথ্য পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400 mt-1">অনুসন্ধান পরিবর্তন করুন বা নতুন দাতা যোগ করুন</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Donor Modal */}
      <DonorManagerModal
        donor={selectedDonor}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
