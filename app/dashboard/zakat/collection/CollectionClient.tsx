"use client";

import React, { useState } from "react";
import { 
  HeartHandshake, 
  PlusCircle, 
  Search, 
  Printer, 
  Trash2, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  UserPlus, 
  Layers, 
  X,
  FileText,
  CheckCircle2,
  Filter,
  Sparkles,
  Phone,
  MapPin,
  Check,
  UserCheck,
  User
} from "lucide-react";
import { addDonation, deleteDonation, addDonor } from "@/app/actions/zakat";
import { 
  DonationItem, 
  DonorItem, 
  FundItem, 
  DonorFrequency,
  getFundCategoryBadge, 
  getDonorTypeBadge, 
  getPaymentMethodName 
} from "@/lib/fund-utils";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import DonationReceipt from "@/components/zakat/DonationReceipt";
import FundManagerModal from "@/components/zakat/FundManagerModal";
import DonorManagerModal from "@/components/zakat/DonorManagerModal";
import Link from "next/link";

interface CollectionClientProps {
  initialDonations: DonationItem[];
  donors: DonorItem[];
  funds: FundItem[];
  madrasaInfo: any;
  preselectedDonorId?: string;
  preselectedFundName?: string;
}

export default function CollectionClient({
  initialDonations,
  donors: initialDonors,
  funds,
  madrasaInfo,
  preselectedDonorId,
  preselectedFundName,
}: CollectionClientProps) {
  const [donations, setDonations] = useState<DonationItem[]>(initialDonations);
  const [donorList, setDonorList] = useState<DonorItem[]>(initialDonors);

  // Donor Mode: 'existing' | 'new' | 'anonymous'
  const [donorMode, setDonorMode] = useState<"existing" | "new" | "anonymous">(
    preselectedDonorId ? "existing" : "new"
  );

  // Existing donor selection
  const [selectedDonorId, setSelectedDonorId] = useState(preselectedDonorId || "");

  // Inline New Donor state (1-Click Auto Add)
  const [newDonorName, setNewDonorName] = useState("");
  const [newDonorPhone, setNewDonorPhone] = useState("");
  const [newDonorAddress, setNewDonorAddress] = useState("");
  const [newDonorType, setNewDonorType] = useState<DonorFrequency>("OneTime");
  const [newDonorPledge, setNewDonorPledge] = useState("");
  const [autoSaveDonor, setAutoSaveDonor] = useState(true);
  const [quickSavingDonor, setQuickSavingDonor] = useState(false);

  // Collection form state
  const [selectedFundName, setSelectedFundName] = useState(preselectedFundName || "সাধারণ ফান্ড (General Fund)");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amount, setAmount] = useState("");
  const [donationDate, setDonationDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptNo, setReceiptNo] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search and Filter states for table
  const [search, setSearch] = useState("");
  const [tableFundFilter, setTableFundFilter] = useState("ALL");

  // Modals state
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [activeReceiptDonation, setActiveReceiptDonation] = useState<DonationItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Preselected donor info
  const currentSelectedDonor = donorList.find(d => d.id === selectedDonorId);

  // Quick 1-click Save Donor only (without donation)
  const handleQuickSaveDonorOnly = async () => {
    if (!newDonorName.trim()) {
      setFormError("অনুগ্রহ করে নতুন দাতার নাম লিখুন");
      return;
    }
    setQuickSavingDonor(true);
    setFormError(null);

    const formData = new FormData();
    formData.set("name", newDonorName.trim());
    formData.set("phone", newDonorPhone.trim());
    formData.set("address", newDonorAddress.trim());
    formData.set("donor_type", newDonorType);
    formData.set("pledge_amount", newDonorPledge);
    formData.set("notes", "কালেকশন ফর্ম থেকে দ্রুত যুক্ত");

    try {
      const res = await addDonor(formData);
      if (res?.success && res.donor) {
        setDonorList([res.donor, ...donorList]);
        setSelectedDonorId(res.donor.id);
        setDonorMode("existing");
        setSuccessToast(`দাতা '${res.donor.name}' সফলভাবে যুক্ত হয়েছে!`);
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (err: any) {
      setFormError(err.message || "দাতা যুক্ত করতে সমস্যা হয়েছে");
    } finally {
      setQuickSavingDonor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setSuccessToast(null);

    // Validation
    if (donorMode === "new" && !newDonorName.trim() && autoSaveDonor) {
      setFormError("নতুন দাতার নাম আবশ্যক অথবা 'নামবিহীন / সাধারণ দাতা' নির্বাচন করুন");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.set("amount", amount);
    formData.set("donation_type", selectedFundName);
    formData.set("donation_date", donationDate);
    formData.set("payment_method", paymentMethod);
    formData.set("receipt_no", receiptNo);
    formData.set("notes", notes);

    if (donorMode === "existing") {
      formData.set("donor_id", selectedDonorId);
      formData.set("is_new_donor", "false");
    } else if (donorMode === "new") {
      formData.set("is_new_donor", "true");
      formData.set("new_donor_name", newDonorName.trim());
      formData.set("new_donor_phone", newDonorPhone.trim());
      formData.set("new_donor_address", newDonorAddress.trim());
      formData.set("new_donor_type", newDonorType);
      formData.set("new_donor_pledge", newDonorPledge);
      formData.set("auto_save_donor", autoSaveDonor ? "true" : "false");
      formData.set("donor_id", "");
    } else {
      // Anonymous
      formData.set("donor_id", "");
      formData.set("is_new_donor", "false");
    }

    try {
      const res = await addDonation(null, formData);
      if (res?.error) {
        setFormError(res.error);
        setLoading(false);
        return;
      }

      if (res?.success && res.donation) {
        // If a new donor was auto created, add to state
        if (res.createdDonor) {
          setDonorList(prev => [res.createdDonor!, ...prev]);
        }

        const donorInfo = res.createdDonor ? {
          name: res.createdDonor.name,
          phone: res.createdDonor.phone,
          address: res.createdDonor.address,
          donor_type: res.createdDonor.donor_type,
        } : (donorMode === "existing" && currentSelectedDonor ? {
          name: currentSelectedDonor.name,
          phone: currentSelectedDonor.phone,
          address: currentSelectedDonor.address,
          donor_type: currentSelectedDonor.donor_type,
        } : (newDonorName.trim() ? {
          name: newDonorName.trim(),
          phone: newDonorPhone.trim(),
          address: newDonorAddress.trim(),
          donor_type: newDonorType,
        } : null));

        const createdDonation: DonationItem = {
          id: res.donation.id,
          donor_id: res.donation.donor_id,
          amount: Number(res.donation.amount),
          donation_type: res.donation.donation_type,
          fund_name: res.donation.donation_type,
          donation_date: res.donation.donation_date,
          receipt_no: res.donation.receipt_no,
          payment_method: res.donation.payment_method,
          notes: res.donation.notes,
          donors: donorInfo,
        };

        setDonations([createdDonation, ...donations]);
        
        // Reset form
        setAmount("");
        setNotes("");
        setReceiptNo("");
        if (donorMode === "new") {
          setNewDonorName("");
          setNewDonorPhone("");
          setNewDonorAddress("");
          setNewDonorPledge("");
        }

        // Open receipt modal immediately
        setActiveReceiptDonation(createdDonation);
      }
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setFormError(err.message || "সংগ্রহ সম্পন্ন করতে ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই কালেকশন রেকর্ডটি মুছে ফেলতে চান?")) return;
    setDeletingId(id);
    try {
      await deleteDonation(id);
      setDonations(donations.filter(d => d.id !== id));
    } catch (err: any) {
      alert(err.message || "কালেকশন মুছতে সমস্যা হয়েছে");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDonations = donations.filter(d => {
    const donorName = d.donors?.name || "সাধারণ দাতা";
    const matchesSearch = 
      donorName.toLowerCase().includes(search.toLowerCase()) ||
      (d.receipt_no && d.receipt_no.toLowerCase().includes(search.toLowerCase())) ||
      (d.notes && d.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesFund = tableFundFilter === "ALL" || 
      d.donation_type === tableFundFilter || 
      d.fund_name === tableFundFilter;

    return matchesSearch && matchesFund;
  });

  const totalCollectedAmount = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              যাকাত ও অনুদান সংগ্রহ
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              মোট কালেকশন: ৳ {formatBanglaCurrency(totalCollectedAmount)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            সাধারণ ফান্ড, লিল্লাহ বোর্ডিং ফান্ড, যাকাত ফান্ড বা কাস্টম ফান্ড নির্বাচন করে অনুদান গ্রহণ ও রসিদ তৈরি করুন
          </p>
        </div>
      </div>

      {/* Main Grid: Form Left, List Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Box (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                নতুন অনুদান / যাকাত গ্রহণ
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100 font-medium">
                {formError}
              </div>
            )}

            {successToast && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs border border-emerald-200 font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successToast}</span>
              </div>
            )}

            {/* Fund Selection (User Requirement: সিলেক্ট করা যাবে যে এটা কোন ফান্ডে যাবে - সাধারণ ফান্ড, লিল্লাহ ফান্ড বা কাস্টম ফান্ড) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>জমার ফান্ড নির্বাচন করুন <span className="text-red-500">*</span></span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsFundModalOpen(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>+ নতুন ফান্ড তৈরি</span>
                </button>
              </div>

              <select
                value={selectedFundName}
                onChange={(e) => setSelectedFundName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm bg-white font-medium"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name} {f.code ? `[${f.code}]` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Donor Mode Selector (User Requirement: নতুন দাতা থেকে ফান্ড সংগ্রহ করলে ১-ক্লিক অটো-অ্যাড অপশন) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>দাতার ধরন নির্বাচন</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ⚡ ১-ক্লিক অটো-অ্যাড সুবিধা
                </span>
              </label>

              {/* 3 Mode Tabs */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDonorMode("new")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    donorMode === "new"
                      ? "bg-white text-emerald-800 shadow-xs border border-emerald-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>নতুন দাতা</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDonorMode("existing")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    donorMode === "existing"
                      ? "bg-white text-purple-800 shadow-xs border border-purple-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>তালিকায় থাকা</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDonorMode("anonymous")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    donorMode === "anonymous"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>নামবিহীন</span>
                </button>
              </div>

              {/* 1) NEW DONOR INLINE FORM WITH 1-CLICK AUTO ADD */}
              {donorMode === "new" && (
                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3 animate-in fade-in zoom-in-98 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>নতুন দাতার বিবরণ (তাৎক্ষণিক কালেকশন)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleQuickSaveDonorOnly}
                      disabled={quickSavingDonor || !newDonorName.trim()}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300 hover:bg-emerald-50 transition cursor-pointer disabled:opacity-50"
                      title="অনুদানের আগেই এই দাতাকে সিস্টেমে সেভ করতে চান?"
                    >
                      {quickSavingDonor ? "সেভ হচ্ছে..." : "⚡ শুধু দাতা সেভ করুন"}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700">
                      দাতার পূর্ণ নাম <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={donorMode === "new" && autoSaveDonor}
                      placeholder="যেমন: জনাব আলহাজ্ব রফিকুল ইসলাম"
                      value={newDonorName}
                      onChange={(e) => setNewDonorName(e.target.value)}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>মোবাইল নম্বর</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="যেমন: 01712345678"
                        value={newDonorPhone}
                        onChange={(e) => setNewDonorPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>ঠিকানা / এলাকা</span>
                      </label>
                      <input
                        type="text"
                        placeholder="যেমন: চকবাজার, ঢাকা"
                        value={newDonorAddress}
                        onChange={(e) => setNewDonorAddress(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Frequency: OneTime, Monthly, Annual */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      দাতার ধরন / ফ্রিকোয়েন্সি
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewDonorType("OneTime")}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          newDonorType === "OneTime"
                            ? "bg-amber-500 text-white border-amber-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        এককালীন
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDonorType("Monthly")}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          newDonorType === "Monthly"
                            ? "bg-blue-600 text-white border-blue-700"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        মাসিক দাতা
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDonorType("Annual")}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          newDonorType === "Annual"
                            ? "bg-purple-600 text-white border-purple-700"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        বার্ষিক দাতা
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Auto Save Checkbox */}
                  <div className="pt-1 flex items-center justify-between bg-emerald-100/60 p-2 rounded-lg border border-emerald-200">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-950">
                      <input
                        type="checkbox"
                        checked={autoSaveDonor}
                        onChange={(e) => setAutoSaveDonor(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                      <span>স্থায়ী দাতা তালিকায় অটোমেটিক সংরক্ষণ করুন (১-ক্লিক অটো-অ্যাড)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 2) EXISTING DONOR SELECT */}
              {donorMode === "existing" && (
                <div className="space-y-2 p-3 bg-purple-50/40 rounded-xl border border-purple-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-900">
                      নিবন্ধিত দাতা নির্বাচন ({toBanglaNumber(donorList.length)} জন)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDonorModalOpen(true)}
                      className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ সম্পূর্ণ ফর্ম</span>
                    </button>
                  </div>

                  <select
                    value={selectedDonorId}
                    onChange={(e) => setSelectedDonorId(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 transition text-xs bg-white font-medium"
                  >
                    <option value="">-- দাতা নির্বাচন করুন --</option>
                    {donorList.map((donor) => {
                      const badge = getDonorTypeBadge(donor.donor_type);
                      return (
                        <option key={donor.id} value={donor.id}>
                          {donor.name} • {badge.label} {donor.phone ? `(${donor.phone})` : ""}
                        </option>
                      );
                    })}
                  </select>

                  {currentSelectedDonor && (
                    <div className="p-2 bg-white rounded-lg border border-purple-200 text-xs text-purple-900 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-bold">{currentSelectedDonor.name}</span>
                        <span className="text-[10px] text-purple-700 ml-1.5">
                          ({getDonorTypeBadge(currentSelectedDonor.donor_type).label})
                        </span>
                        {currentSelectedDonor.phone && (
                          <div className="text-[10px] font-mono text-slate-500">{currentSelectedDonor.phone}</div>
                        )}
                      </div>
                      {currentSelectedDonor.pledge_amount ? (
                        <span className="font-mono font-bold text-purple-800 text-[11px]">
                          প্রতিশ্রুতি: ৳ {formatBanglaCurrency(currentSelectedDonor.pledge_amount)}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* 3) ANONYMOUS WALK-IN */}
              {donorMode === "anonymous" && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>নামবিহীন সাধারণ অনুদান / নগদ রসিদ তৈরি হবে।</span>
                </div>
              )}
            </div>

            {/* Amount and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  অনুদানের পরিমাণ ৳ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="যেমন: 5000"
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-black font-mono text-emerald-800"
                  />
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  সংগ্রহের তারিখ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={donationDate}
                    onChange={(e) => setDonationDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method and Receipt No */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  পরিশোধের মাধ্যম
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm bg-white font-medium"
                >
                  <option value="Cash">নগদ (Cash)</option>
                  <option value="bKash">বিকাশ (bKash)</option>
                  <option value="Nagad">নগদ (Nagad)</option>
                  <option value="Rocket">রকেট (Rocket)</option>
                  <option value="Bank">ব্যাংক ট্রান্সফার (Bank)</option>
                  <option value="Cheque">চেক (Cheque)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  রসিদ নম্বর (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="খালি রাখলে অটো তৈরি হবে"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-xs font-mono"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                বিবরণ / উদ্দেশ্য / মন্তব্য
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: বার্ষিক মাহফিল অনুদান / যাকাত / বিশেষ দোয়া"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {loading 
                    ? "সংগ্রহ ও দাতা সংরক্ষিত হচ্ছে..." 
                    : (donorMode === "new" && autoSaveDonor 
                        ? "১-ক্লিকে দাতা যুক্ত, অনুদান গ্রহণ ও রসিদ তৈরি" 
                        : "অনুদান গ্রহণ ও রসিদ তৈরি করুন")}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Collection Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter and Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="দাতার নাম বা রসিদ দিয়ে খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={tableFundFilter}
                onChange={(e) => setTableFundFilter(e.target.value)}
                className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none"
              >
                <option value="ALL">সকল ফান্ড</option>
                {funds.map(f => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">তারিখ ও রসিদ</th>
                    <th className="py-3.5 px-4">দাতার নাম ও ফান্ড</th>
                    <th className="py-3.5 px-4">পরিমাণ ৳</th>
                    <th className="py-3.5 px-4 text-right">রসিদ ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredDonations.map((donation) => (
                    <tr key={donation.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date & Receipt No */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {toBanglaNumber(new Date(donation.donation_date).toLocaleDateString("en-GB"))}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {donation.receipt_no || "ZR-Auto"}
                        </div>
                      </td>

                      {/* Donor & Fund */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {donation.donors?.name || "সাধারণ দাতা"}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                            {donation.fund_name || donation.donation_type}
                          </span>
                          {donation.payment_method && donation.payment_method !== "Cash" && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              • {donation.payment_method}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4">
                        <div className="font-black text-emerald-800 text-sm font-mono">
                          ৳ {formatBanglaCurrency(donation.amount)}
                        </div>
                      </td>

                      {/* Receipt & Action */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveReceiptDonation(donation)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="A4 মানি রসিদ প্রিন্ট করুন"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            <span>রসিদ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(donation.id)}
                            disabled={deletingId === donation.id}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredDonations.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-500">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">কোনো কালেকশন পাওয়া যায়নি</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">নতুন অনুদান গ্রহণ করতে বামপাশের ফর্ম পূরণ করুন</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Money Receipt Modal */}
      {activeReceiptDonation && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:static print:bg-transparent">
          <div className="bg-slate-100 rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full p-4 sm:p-6 relative my-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-300 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  দান ও অনুদান মানি রসিদ (A4 Dual-Copy Print)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceiptDonation(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DonationReceipt
              donation={activeReceiptDonation}
              madrasaInfo={madrasaInfo}
              showControls={true}
            />
          </div>
        </div>
      )}

      {/* Fund Modal */}
      <FundManagerModal
        isOpen={isFundModalOpen}
        onClose={() => setIsFundModalOpen(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />

      {/* Donor Modal */}
      <DonorManagerModal
        isOpen={isDonorModalOpen}
        onClose={() => setIsDonorModalOpen(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
