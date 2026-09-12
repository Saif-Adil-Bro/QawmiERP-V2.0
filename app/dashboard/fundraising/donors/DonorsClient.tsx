"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  FileText,
  Printer,
  Edit2,
  Trash2,
  Copy,
  Award,
  Filter,
  Check,
  Building,
  CreditCard,
  Receipt,
  X
} from "lucide-react";
import { Donor, DonorPayment } from "@/lib/fundraising-types";
import { saveDonor, deleteDonor, recordDonorPayment } from "@/app/actions/fundraising";
import { numberToBanglaWords } from "@/lib/utils";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

export default function DonorsClient({
  initialDonors,
  initialPayments,
}: {
  initialDonors: Donor[];
  initialPayments: DonorPayment[];
}) {
  const router = useRouter();
  const [donors, setDonors] = useState<Donor[]>(initialDonors);
  const [payments, setPayments] = useState<DonorPayment[]>(initialPayments);
  const [activeTab, setActiveTab] = useState<"directory" | "collections" | "certificate">("directory");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Current Month for collection tracking
  const currentMonthStr = new Date().toISOString().slice(0, 7); // "2026-09"
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Modals
  const [donorModalOpen, setDonorModalOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Partial<Donor> | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDonorForPayment, setSelectedDonorForPayment] = useState<Donor | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: 1000,
    month: selectedMonth,
    payment_method: "Cash",
    trx_id: "",
    fund_category: "সাধারণ ফান্ড",
    receipt_no: `DN-${Date.now().toString().slice(-5)}`,
    collector_name: "",
    notes: "",
  });

  // Receipt Preview Modal
  const [receiptToPrint, setReceiptToPrint] = useState<{ donor: Donor; payment: DonorPayment } | null>(null);
  const [selectedDonorForCert, setSelectedDonorForCert] = useState<Donor | null>(donors[0] || null);
  const [printRegisterOpen, setPrintRegisterOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Filtered Donors
  const filteredDonors = donors.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.member_no.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      (d.address && d.address.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "ALL" || (d.membership_type || d.member_type) === typeFilter;
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate stats
  const lifeMembers = donors.filter((d) => (d.membership_type || d.member_type) === "LIFE_MEMBER");
  const monthlyDonors = donors.filter((d) => (d.membership_type || d.member_type) === "MONTHLY" || (d.membership_type || d.member_type) === "MONTHLY_DONOR");
  const totalMonthlyCommitment = donors.reduce((acc, d) => acc + (d.committed_amount || d.pledge_amount || 0), 0);

  // Month-wise payments
  const currentMonthPayments = payments.filter((p) => p.month === selectedMonth);
  const currentMonthCollected = currentMonthPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const paidDonorIds = new Set(currentMonthPayments.map((p) => p.donor_id));

  // Open Create Donor Modal
  const handleOpenCreateDonor = () => {
    const nextNo = `M-${(donors.length + 1).toString().padStart(4, "0")}`;
    setEditingDonor({
      member_no: nextNo,
      name: "",
      father_name: "",
      phone: "",
      email: "",
      address: "",
      occupation: "ব্যবসায়ী",
      blood_group: "A+",
      membership_type: "MONTHLY",
      committed_amount: 1000,
      pledge_amount: 1000,
      preferred_fund: "সাধারণ ফান্ড",
      status: "ACTIVE",
      joined_date: new Date().toISOString().split("T")[0],
      join_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setDonorModalOpen(true);
  };

  const handleOpenEditDonor = (donor: Donor) => {
    setEditingDonor({ ...donor });
    setDonorModalOpen(true);
  };

  const handleSaveDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonor?.name?.trim() || !editingDonor?.phone?.trim()) {
      alert("নাম ও মোবাইল নম্বর আবশ্যক");
      return;
    }
    setLoading(true);
    try {
      const res = await saveDonor(editingDonor);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setDonorModalOpen(false);
      router.refresh();
      if (editingDonor.id) {
        setDonors((prev) =>
          prev.map((d) => (d.id === editingDonor.id ? ({ ...d, ...editingDonor } as Donor) : d))
        );
      } else if (res.id) {
        setDonors((prev) => [
          {
            ...editingDonor,
            id: res.id,
            total_donated: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Donor,
          ...prev,
        ]);
      }
    } catch (err) {
      alert("সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDonor = async (id: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিতভাবে "${name}" এর তথ্য মুছে ফেলতে চান?`)) return;
    try {
      await deleteDonor(id);
      setDonors((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // Record Payment
  const handleOpenPaymentModal = (donor: Donor) => {
    setSelectedDonorForPayment(donor);
    setPaymentFormData({
      amount: donor.committed_amount || donor.pledge_amount || 1000,
      month: selectedMonth,
      payment_method: "Cash",
      trx_id: "",
      fund_category: donor.preferred_fund || "সাধারণ ফান্ড",
      receipt_no: `MR-${Date.now().toString().slice(-5)}`,
      collector_name: "",
      notes: "",
    });
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonorForPayment) return;
    setLoading(true);
    try {
      const res = await recordDonorPayment({
        donor_id: selectedDonorForPayment.id,
        amount: Number(paymentFormData.amount),
        month: paymentFormData.month,
        date: new Date().toISOString().split("T")[0],
        payment_method: paymentFormData.payment_method as any,
        trx_id: paymentFormData.trx_id,
        fund_category: paymentFormData.fund_category,
        receipt_no: paymentFormData.receipt_no,
        collector_name: paymentFormData.collector_name,
        notes: paymentFormData.notes,
      });

      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }

      setPaymentModalOpen(false);
      router.refresh();

      const newPayment: DonorPayment = {
        id: res.id || `pay_${Date.now()}`,
        donor_id: selectedDonorForPayment.id,
        donor_name: selectedDonorForPayment.name,
        amount: Number(paymentFormData.amount),
        month: paymentFormData.month,
        date: new Date().toISOString().split("T")[0],
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: paymentFormData.payment_method as any,
        trx_id: paymentFormData.trx_id,
        fund_name: paymentFormData.fund_category,
        fund_category: paymentFormData.fund_category,
        receipt_no: paymentFormData.receipt_no,
        collector_name: paymentFormData.collector_name,
        collected_by: paymentFormData.collector_name,
        notes: paymentFormData.notes,
        created_at: new Date().toISOString(),
      };

      setPayments((prev) => [newPayment, ...prev]);
      setDonors((prev) =>
        prev.map((d) =>
          d.id === selectedDonorForPayment.id
            ? { ...d, total_donated: (d.total_donated || 0) + Number(paymentFormData.amount) }
            : d
        )
      );

      // Trigger Instant Printable Receipt
      setReceiptToPrint({ donor: selectedDonorForPayment, payment: newPayment });
    } catch (err) {
      alert("পেমেন্ট সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySms = (donor: Donor) => {
    const amount = donor.committed_amount || donor.pledge_amount || 0;
    const text = `আসসালামু আলাইকুম মুহতারাম ${donor.name} ছাহেব, মারকাযের মাসিক প্রতিশ্রুত অনুদান (৳${amount}) চলতি মাসের জন্য বকেয়া রয়েছে। দ্বীনি খেদমতের অংশ হিসেবে পাঠানোর অনুরোধ রইল। জাযাকাল্লাহু খাইরান।`;
    navigator.clipboard.writeText(text);
    setCopiedId(donor.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/60">
              <Users className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              আজীবন সদস্য ও মাসিক দাতা রেজিস্টার
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            মাদ্রাসার সম্মানিত আজীবন সদস্য, নিয়মিত মাসিক দাতা ও শুভাকাঙ্ক্ষীদের তালিকা, চাঁদা আদায় ও ডিজিটাল মানি রিসিট।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintRegisterOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-xl border border-slate-200 transition-all text-sm shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>রেজিস্টার প্রিন্ট</span>
          </button>

          <button
            onClick={handleOpenCreateDonor}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন সদস্য / দাতা যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">আজীবন সদস্য</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(lifeMembers.length)} জন
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">স্থায়ী সম্মানিত দাতা</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">নিয়মিত মাসিক দাতা</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(monthlyDonors.length)} জন
          </span>
          <span className="text-[11px] text-slate-400 font-medium">মাসিক চাঁদা প্রদানকারী</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">মাসিক প্রতিশ্রুত লক্ষ্যমাত্রা</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            ৳ {toBanglaNumber(totalMonthlyCommitment)}
          </span>
          <span className="text-[11px] text-slate-400">প্রতি মাসের টার্গেট</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">চলতি মাসে সংগৃহীত</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(currentMonthCollected)}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">
            {toBanglaNumber(paidDonorIds.size)} জন পরিশোধ করেছেন
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 flex items-center gap-1 shadow-xs overflow-x-auto">
        {[
          { id: "directory", label: "সম্মানিত দাতা রেজিস্টার", icon: Users, count: donors.length },
          { id: "collections", label: "মাসিক চাঁদা আদায় ও তাগাদা", icon: DollarSign, count: donors.length - paidDonorIds.size },
          { id: "certificate", label: "আজীবন সদস্যপদ সনদপত্র", icon: Award, count: null },
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
      {/* TAB 1: DONOR DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="নাম, মোবাইল বা সদস্য নম্বর দিয়ে খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium"
              >
                <option value="ALL">সকল সদস্যপদ</option>
                <option value="LIFE_MEMBER">আজীবন সদস্য</option>
                <option value="MONTHLY">মাসিক নিয়মিত দাতা</option>
                <option value="YEARLY">বার্ষিক দাতা</option>
                <option value="WELL_WISHER">শুভাকাঙ্ক্ষী</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium"
              >
                <option value="ALL">সকল স্ট্যাটাস</option>
                <option value="ACTIVE">সক্রিয়</option>
                <option value="INACTIVE">নিষ্ক্রিয়</option>
              </select>
            </div>
          </div>

          {/* Donors Table */}
          {filteredDonors.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">কোনো দাতার তথ্য পাওয়া যায়নি</p>
              <p className="text-xs mt-1">নতুন আজীবন সদস্য বা শুভাকাঙ্ক্ষীদের তালিকাভুক্ত করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">সদস্য নং</th>
                      <th className="py-3 px-4">দাতার নাম ও পেশা</th>
                      <th className="py-3 px-4">যোগাযোগ</th>
                      <th className="py-3 px-4">সদস্যপদ ধরন</th>
                      <th className="py-3 px-4">প্রতিশ্রুত চাঁদা</th>
                      <th className="py-3 px-4">মোট দান</th>
                      <th className="py-3 px-4">পছন্দের ফান্ড</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDonors.map((donor) => {
                      const mType = donor.membership_type || donor.member_type;
                      return (
                        <tr key={donor.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-800">{donor.member_no}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{donor.name}</span>
                            <span className="text-[11px] text-slate-500">{donor.occupation || donor.address || "-"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-slate-800 block">{donor.phone}</span>
                            {donor.address && <span className="text-[10px] text-slate-400 truncate max-w-[150px] block">{donor.address}</span>}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              mType === "LIFE_MEMBER" ? "bg-amber-100 text-amber-800" :
                              mType === "MONTHLY" || mType === "MONTHLY_DONOR" ? "bg-emerald-100 text-emerald-800" :
                              "bg-blue-100 text-blue-800"
                            }`}>
                              {mType === "LIFE_MEMBER" ? "আজীবন সদস্য" :
                               mType === "MONTHLY" || mType === "MONTHLY_DONOR" ? "মাসিক দাতা" :
                               mType === "YEARLY" ? "বার্ষিক দাতা" : "শুভাকাঙ্ক্ষী"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            ৳ {toBanglaNumber(donor.committed_amount || donor.pledge_amount || 0)}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700">
                            ৳ {toBanglaNumber(donor.total_donated || 0)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{donor.preferred_fund}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPaymentModal(donor)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] transition-colors flex items-center gap-1"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>চাঁদা গ্রহণ</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDonorForCert(donor);
                                  setActiveTab("certificate");
                                }}
                                className="p-1 text-slate-400 hover:text-amber-600 rounded"
                                title="সনদপত্র"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditDonor(donor)}
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDonor(donor.id, donor.name)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY COLLECTION TRACKING & REMINDERS */}
      {/* ========================================================================= */}
      {activeTab === "collections" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">মাসভিত্তিক চাঁদা আদায় ও তাগাদা খতিয়ান</h3>
              <p className="text-xs text-slate-500">চলতি মাসের বকেয়া চেক করুন এবং এক ক্লিকে তাগাদা বার্তা পাঠান।</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">মাস নির্বাচন:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Pending Donors for this month */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h4 className="font-bold text-slate-900 text-sm">
                    চলতি মাসের বকেয়া তালিকা ({toBanglaNumber(donors.filter(d => !paidDonorIds.has(d.id)).length)} জন)
                  </h4>
                </div>
              </div>

              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {donors.filter(d => !paidDonorIds.has(d.id)).map(donor => (
                  <div
                    key={donor.id}
                    className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{donor.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                          {donor.member_no}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{donor.phone}</span>
                        <span>•</span>
                        <span className="font-bold text-amber-700">৳ {toBanglaNumber(donor.committed_amount || donor.pledge_amount)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopySms(donor)}
                        className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                          copiedId === donor.id
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        title="তাগাদা বার্তা কপি"
                      >
                        {copiedId === donor.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-bold">{copiedId === donor.id ? "কপি হয়েছে" : "তাগাদা"}</span>
                      </button>

                      <button
                        onClick={() => handleOpenPaymentModal(donor)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
                      >
                        আদায়
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Paid Donors for this month */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="font-bold text-slate-900 text-sm">
                    চলতি মাসে পরিশোধিত তালিকা ({toBanglaNumber(currentMonthPayments.length)} জন)
                  </h4>
                </div>
                <span className="font-bold text-emerald-800 text-xs">
                  মোট: ৳ {toBanglaNumber(currentMonthCollected)}
                </span>
              </div>

              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {currentMonthPayments.map((p) => {
                  const donor = donors.find((d) => d.id === p.donor_id);
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{donor?.name || p.donor_name || "সম্মানিত দাতা"}</span>
                          <span className="text-[10px] text-emerald-700 font-semibold">{toBanglaNumber(p.payment_date || p.date)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>রসিদ নং: {p.receipt_no}</span>
                          <span>•</span>
                          <span className="text-slate-600">{p.payment_method}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-emerald-800 text-sm">৳ {toBanglaNumber(p.amount)}</span>
                        {donor && (
                          <button
                            onClick={() => setReceiptToPrint({ donor, payment: p })}
                            className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
                            title="রসিদ প্রিন্ট"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MEMBERSHIP CERTIFICATE */}
      {/* ========================================================================= */}
      {activeTab === "certificate" && selectedDonorForCert && (
        <div className="space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h3 className="text-base font-bold text-slate-900">সম্মানিত আজীবন সদস্য / শুভাকাঙ্ক্ষী সনদপত্র</h3>
              <p className="text-xs text-slate-500">মাদ্রাসার পক্ষ থেকে আজীবন দাতাদের সম্মাননা ও স্বীকৃতিপত্র</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
            >
              <Printer className="w-4 h-4" />
              <span>সনদপত্র প্রিন্ট করুন</span>
            </button>
          </div>

          <div className="bg-white p-10 rounded-2xl border-4 border-amber-500/40 shadow-lg print:border-4 print:border-amber-600 print:p-8 space-y-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-radial from-amber-50/50 to-transparent pointer-events-none" />
            
            <div className="relative z-10 space-y-2">
              <div className="text-sm font-serif font-bold text-slate-700">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
              <Award className="w-14 h-14 text-amber-600 mx-auto" />
              <h2 className="text-2xl font-black text-slate-900 tracking-wide font-serif">
                আজীবন সদস্য সম্মাননা সনদপত্র
              </h2>
              <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase">
                LIFE MEMBERSHIP RECOGNITION CERTIFICATE
              </p>
            </div>

            <div className="relative z-10 py-4 max-w-xl mx-auto space-y-4 text-slate-800 text-sm leading-relaxed">
              <p>
                আল্লাহ তায়ালার সন্তুষ্টি অর্জনের মহান উদ্দেশ্যে দ্বীনি শিক্ষার প্রসার ও মাদ্রাসার সার্বিক উন্নয়নে বিশেষ অবদানের স্বীকৃতিস্বরূপ:
              </p>
              
              <div className="py-2 border-b-2 border-amber-400 font-bold text-2xl text-emerald-900 font-serif">
                {selectedDonorForCert.name}
              </div>

              <p className="text-xs text-slate-600">
                পিতা/স্বামী: {selectedDonorForCert.father_name || "---"} | ঠিকানা: {selectedDonorForCert.address || "---"}
              </p>

              <p className="text-xs text-slate-700">
                তাঁকে অত্র মাদ্রাসার <span className="font-bold text-amber-800">"আজীবন সদস্য ও শুভাকাঙ্ক্ষী"</span> হিসেবে তালিকাভুক্ত করা হলো।
                সদস্য নম্বর: <span className="font-mono font-bold">{selectedDonorForCert.member_no}</span>।
              </p>
            </div>

            <div className="relative z-10 pt-12 grid grid-cols-2 gap-12 text-xs">
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মুহতারাম মুহতামিম
              </div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মুহতারাম সভাপতি / শুরা প্রধান
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT DONOR */}
      {/* ========================================================================= */}
      {donorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingDonor?.id ? "দাতার তথ্য সম্পাদনা" : "নতুন সদস্য / দাতা নিবন্ধন"}</span>
              <button onClick={() => setDonorModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveDonor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সদস্য নম্বর</label>
                  <input
                    type="text"
                    required
                    value={editingDonor?.member_no || ""}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, member_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সদস্যপদ ধরন</label>
                  <select
                    value={editingDonor?.membership_type || editingDonor?.member_type || "MONTHLY"}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, membership_type: e.target.value as any, member_type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="LIFE_MEMBER">আজীবন সদস্য (Life Member)</option>
                    <option value="MONTHLY">মাসিক নিয়মিত দাতা</option>
                    <option value="YEARLY">বার্ষিক দাতা</option>
                    <option value="WELL_WISHER">সাধারণ শুভাকাঙ্ক্ষী</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">দাতার পূর্ণ নাম <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editingDonor?.name || ""}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পিতা / স্বামীর নাম</label>
                  <input
                    type="text"
                    value={editingDonor?.father_name || ""}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, father_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="017XXXXXXXX"
                    value={editingDonor?.phone || ""}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পেশা</label>
                  <input
                    type="text"
                    placeholder="যেমন: প্রবাসী / ব্যবসায়ী"
                    value={editingDonor?.occupation || ""}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, occupation: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">স্থায়ী / বর্তমান ঠিকানা</label>
                <input
                  type="text"
                  placeholder="গ্রাম, ডাকঘর, থানা, জেলা"
                  value={editingDonor?.address || ""}
                  onChange={(e) => setEditingDonor(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">প্রতিশ্রুত চাঁদা (টাকা)</label>
                  <input
                    type="number"
                    value={editingDonor?.committed_amount || editingDonor?.pledge_amount || 0}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, committed_amount: Number(e.target.value), pledge_amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পছন্দের ফান্ড</label>
                  <select
                    value={editingDonor?.preferred_fund || "সাধারণ ফান্ড"}
                    onChange={(e) => setEditingDonor(prev => ({ ...prev, preferred_fund: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="সাধারণ ফান্ড">সাধারণ ফান্ড</option>
                    <option value="লিল্লাহ বোডিং ও এতিমখানা">লিল্লাহ বোডিং ও এতিমখানা</option>
                    <option value="মসজিদ ও নির্মাণ ফান্ড">মসজিদ ও নির্মাণ ফান্ড</option>
                    <option value="শিক্ষক বেতন তহবিল">শিক্ষক বেতন তহবিল</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDonorModalOpen(false)}
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
      {/* MODAL: COLLECT PAYMENT */}
      {/* ========================================================================= */}
      {paymentModalOpen && selectedDonorForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h2 className="text-base font-bold text-slate-900 mb-1">মাসিক চাঁদা / অনুদান গ্রহণ</h2>
            <p className="text-xs text-slate-500 mb-4 pb-2 border-b border-slate-100">
              দাতা: <span className="font-bold text-slate-800">{selectedDonorForPayment.name}</span> ({selectedDonorForPayment.member_no})
            </p>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">টাকার পরিমাণ <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">কোন মাসের চাঁদা</label>
                  <input
                    type="month"
                    required
                    value={paymentFormData.month}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, month: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পেমেন্ট মেথড</label>
                  <select
                    value={paymentFormData.payment_method}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Cash">নগদ (Cash)</option>
                    <option value="bKash">বিকাশ (bKash)</option>
                    <option value="Nagad">নগদ (Nagad)</option>
                    <option value="Bank">ব্যাংক ডিপোজিট</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">রসিদ নম্বর</label>
                  <input
                    type="text"
                    value={paymentFormData.receipt_no}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, receipt_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">কালেক্টর / আদায়কারীর নাম</label>
                <input
                  type="text"
                  placeholder="যেমন: হাফেজ আব্দুর রহমান"
                  value={paymentFormData.collector_name}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, collector_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  জমা গ্রহণ ও রসিদ তৈরি
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINT OFFICIAL DUAL MONEY RECEIPT (দাতার কপি ও অফিস কপি) */}
      {/* ========================================================================= */}
      {receiptToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-2 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">অফিসিয়াল ডিজিটাল মানি রিসিট</h3>
              </div>
              <button onClick={() => setReceiptToPrint(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Area - Dual Copy Voucher */}
            <div className="space-y-6 print:space-y-4 text-slate-900">
              {/* Copy 1: Donor Copy */}
              <div className="border-2 border-emerald-800 rounded-xl p-4 bg-white space-y-3 relative">
                <div className="flex justify-between items-start border-b border-emerald-700 pb-2">
                  <div>
                    <div className="text-[11px] font-serif font-bold text-slate-600">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
                    <h4 className="font-bold text-base text-emerald-950">মাদ্রাসাতুল হিকমাহ আল ইসলামিয়া</h4>
                    <p className="text-[10px] text-slate-500">স্থায়ী আজীবন সদস্য ও মাসিক অনুদান আদায় রসিদ</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 bg-emerald-800 text-white text-[10px] font-bold rounded">
                      দাতার কপি (Donor Copy)
                    </span>
                    <p className="text-[10px] font-mono font-bold text-slate-700 mt-1">
                      রসিদ নং: {receiptToPrint.payment.receipt_no}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      তারিখ: {toBanglaNumber(receiptToPrint.payment.payment_date || receiptToPrint.payment.date || new Date().toISOString().split("T")[0])}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-800">
                  <div>
                    <span className="text-slate-500">দাতার নাম: </span>
                    <span className="font-bold text-slate-900">{receiptToPrint.donor.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">সদস্য নম্বর: </span>
                    <span className="font-mono font-bold text-emerald-800">{receiptToPrint.donor.member_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">মোবাইল: </span>
                    <span className="font-mono">{receiptToPrint.donor.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">বাবদ (মাস): </span>
                    <span className="font-bold">{receiptToPrint.payment.month}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ফান্ড / খাত: </span>
                    <span className="font-semibold">{receiptToPrint.payment.fund_name || receiptToPrint.payment.fund_category || "সাধারণ তহবিল"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">পেমেন্ট মাধ্যম: </span>
                    <span>{receiptToPrint.payment.payment_method} {receiptToPrint.payment.trx_id ? `(Trx: ${receiptToPrint.payment.trx_id})` : ""}</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 block">কথায়:</span>
                    <span className="font-bold text-emerald-950 text-xs">
                      {numberToBanglaWords(receiptToPrint.payment.amount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">মোট প্রাপ্তি:</span>
                    <span className="font-black text-emerald-900 text-base">
                      ৳ {toBanglaNumber(receiptToPrint.payment.amount)}
                    </span>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-600">
                  <div className="border-t border-slate-400 pt-1">আদায়কারী: {receiptToPrint.payment.collector_name || "হিসাব বিভাগ"}</div>
                  <div className="border-t border-slate-400 pt-1 font-bold">মুহতামিম / অর্থ সম্পাদক</div>
                </div>
              </div>

              {/* Scissors Divider */}
              <div className="border-t-2 border-dashed border-slate-300 relative my-2">
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-[10px] text-slate-400 font-mono">
                  ✂ ক্যাশ মেমো / অফিস কপি
                </span>
              </div>

              {/* Copy 2: Office Copy */}
              <div className="border-2 border-slate-700 rounded-xl p-4 bg-slate-50/30 space-y-3 relative">
                <div className="flex justify-between items-start border-b border-slate-300 pb-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">মাদ্রাসাতুল হিকমাহ আল ইসলামিয়া</h4>
                    <p className="text-[10px] text-slate-500">হিসাব শাখা - অফিস রসিদ কপি</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 bg-slate-800 text-white text-[10px] font-bold rounded">
                      অফিস কপি (Office Copy)
                    </span>
                    <p className="text-[10px] font-mono font-bold text-slate-700 mt-0.5">
                      রসিদ নং: {receiptToPrint.payment.receipt_no}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500">দাতা: </span>
                    <span className="font-bold">{receiptToPrint.donor.name} ({receiptToPrint.donor.member_no})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">মাস: </span>
                    <span className="font-bold">{receiptToPrint.payment.month}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">পরিমাণ: </span>
                    <span className="font-black text-emerald-800 text-sm">৳ {toBanglaNumber(receiptToPrint.payment.amount)}</span>
                  </div>
                </div>

                <div className="pt-4 grid grid-cols-2 gap-8 text-center text-[9px] text-slate-500">
                  <div className="border-t border-slate-300 pt-0.5">আদায়কারী স্বাক্ষর</div>
                  <div className="border-t border-slate-300 pt-0.5">ক্যাশিয়ার / মুহতামিম</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setReceiptToPrint(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 text-xs font-medium"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>মানি রিসিট প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FULL DONOR REGISTER PRINT SHEET */}
      {/* ========================================================================= */}
      {printRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-2 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">সম্মানিত দাতা রেজিস্টার প্রিন্ট প্রিভিউ</h3>
              </div>
              <button onClick={() => setPrintRegisterOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Sheet */}
            <div className="space-y-4 text-slate-900">
              <div className="text-center border-b pb-3">
                <div className="text-xs font-serif font-bold text-slate-600">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
                <h2 className="text-xl font-black text-slate-900">মাদ্রাসাতুল হিকমাহ আল ইসলামিয়া</h2>
                <h3 className="text-sm font-bold text-emerald-800">আজীবন সদস্য ও মাসিক নিয়মিত দাতা খতিয়ান রেজিস্টার</h3>
                <p className="text-[11px] text-slate-500">প্রিন্ট তারিখ: {toBanglaNumber(new Date().toISOString().split("T")[0])}</p>
              </div>

              <table className="w-full text-[11px] border border-slate-300 divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-800 font-bold">
                  <tr>
                    <th className="py-2 px-2 border">ক্র নং</th>
                    <th className="py-2 px-2 border">সদস্য নং</th>
                    <th className="py-2 px-3 border">দাতার নাম ও পিতা</th>
                    <th className="py-2 px-2 border">মোবাইল ও ঠিকানা</th>
                    <th className="py-2 px-2 border">সদস্যপদ</th>
                    <th className="py-2 px-2 border">প্রতিশ্রুত চাঁদা</th>
                    <th className="py-2 px-2 border">সর্বমোট জমা</th>
                    <th className="py-2 px-2 border">ফান্ড</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {donors.map((d, idx) => {
                    const mType = d.membership_type || d.member_type;
                    return (
                      <tr key={d.id} className="text-center">
                        <td className="py-2 px-2 border">{toBanglaNumber(idx + 1)}</td>
                        <td className="py-2 px-2 border font-mono font-bold text-emerald-800">{d.member_no}</td>
                        <td className="py-2 px-3 border text-left">
                          <span className="font-bold block">{d.name}</span>
                          {d.father_name && <span className="text-[10px] text-slate-500">পিং: {d.father_name}</span>}
                        </td>
                        <td className="py-2 px-2 border text-left">
                          <span className="font-mono">{d.phone}</span>
                          {d.address && <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">{d.address}</span>}
                        </td>
                        <td className="py-2 px-2 border font-semibold">
                          {mType === "LIFE_MEMBER" ? "আজীবন" :
                           mType === "MONTHLY" || mType === "MONTHLY_DONOR" ? "মাসিক" :
                           mType === "YEARLY" ? "বার্ষিক" : "শুভাকাঙ্ক্ষী"}
                        </td>
                        <td className="py-2 px-2 border font-bold">৳ {toBanglaNumber(d.committed_amount || d.pledge_amount || 0)}</td>
                        <td className="py-2 px-2 border font-bold text-emerald-800">৳ {toBanglaNumber(d.total_donated || 0)}</td>
                        <td className="py-2 px-2 border text-[10px]">{d.preferred_fund}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                <div className="border-t border-slate-400 pt-1 font-bold">হিসাবরক্ষক</div>
                <div className="border-t border-slate-400 pt-1 font-bold">মুহতামিম / সাধারণ সম্পাদক</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setPrintRegisterOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-600 text-xs font-medium"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>রেজিস্টার প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
