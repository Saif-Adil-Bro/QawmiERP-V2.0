"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Printer,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Building,
  Phone,
  Copy,
  Check,
  Settings,
  Send,
  MessageSquare,
  Trash2,
  Save,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  OnlineDonation,
  OnlineDonationSettings,
  DEFAULT_ONLINE_DONATION_SETTINGS,
} from "@/lib/fundraising-types";
import {
  updateOnlineDonationStatus,
  saveOnlineDonationSettings,
  deleteOnlineDonation,
  sendDonationNotificationSMS,
} from "@/app/actions/fundraising";
import { PaymentGatewayConfig } from "@/lib/payment-gateway";
import { printElementIsolated } from "@/lib/printUtils";
import { numberToBanglaWords } from "@/lib/utils";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

function formatWhatsAppPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("880")) return cleaned;
  if (cleaned.startsWith("0")) return "88" + cleaned;
  if (cleaned.length === 10 && !cleaned.startsWith("0")) return "880" + cleaned;
  return cleaned;
}

function generateWhatsAppMessage(donation: OnlineDonation, madrasaName: string, receiptUrl: string): string {
  const donor = donation.donor_name || "শুভাকাঙ্ক্ষী";
  const fund = donation.fund_category || "সাধারণ";
  const dateStr = donation.donation_date || new Date().toISOString().split("T")[0];

  return (
    "আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ,\n" +
    "মুহতারাম " + donor + ",\n\n" +
    "আলহামদুলিল্লাহ, " + madrasaName + "-এ আপনার প্রেরিত অনুদান সফলভাবে গৃহীত ও অনুমোদিত হয়েছে।\n\n" +
    "📋 অনুদানের বিবরণ:\n" +
    "• রসিদ নং: " + donation.receipt_no + "\n" +
    "• অনুদানের পরিমাণ: ৳ " + donation.amount + "\n" +
    "• খাত: " + fund + "\n" +
    "• পেমেন্ট মেথড: " + donation.payment_method + "\n" +
    "• তারিখ: " + dateStr + "\n\n" +
    "📄 আপনার অনলাইন ডিজিটাল মানি রিসিট দেখতে ও ডাউনলোড করতে নিচের লিংকে ক্লিক করুন:\n" +
    receiptUrl + "\n\n" +
    "জাযাকুমুল্লাহু খাইরান। আল্লাহ তাআলা আপনার এই নেক দানকে কবুল করুন এবং দুনিয়া ও আখিরাতে উত্তম প্রতিদান দান করুন। আমীন।\n" +
    "- " + madrasaName
  );
}

export default function OnlineDonationsClient({
  initialDonations = [],
  initialSettings,
  paymentGatewayConfig,
  madrasaInfo,
}: {
  initialDonations: OnlineDonation[];
  initialSettings?: OnlineDonationSettings;
  paymentGatewayConfig?: PaymentGatewayConfig;
  madrasaInfo?: any;
}) {
  const router = useRouter();
  const [donations, setDonations] = useState<OnlineDonation[]>(initialDonations);
  const [settings, setSettings] = useState<OnlineDonationSettings>(
    initialSettings || DEFAULT_ONLINE_DONATION_SETTINGS
  );

  useEffect(() => {
    setDonations(initialDonations);
  }, [initialDonations]);

  useEffect(() => {
    if (initialSettings) setSettings(initialSettings);
  }, [initialSettings]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedDonationForReceipt, setSelectedDonationForReceipt] = useState<OnlineDonation | null>(null);
  const [approvalModalDonation, setApprovalModalDonation] = useState<OnlineDonation | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [settingsForm, setSettingsForm] = useState<OnlineDonationSettings>(settings);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const filteredDonations = donations.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (d.donor_name || "").toLowerCase().includes(q) ||
      (d.phone || "").includes(q) ||
      (d.trx_id && d.trx_id.toLowerCase().includes(q)) ||
      (d.receipt_no || "").toLowerCase().includes(q) ||
      (d.fund_category || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    const matchesMethod =
      methodFilter === "ALL" ||
      (methodFilter === "GATEWAY" && (d.is_gateway || d.payment_method === "Online Gateway")) ||
      (methodFilter === "MANUAL" && !d.is_gateway && d.payment_method !== "Online Gateway") ||
      d.payment_method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalVerified = donations
    .filter((d) => d.status === "VERIFIED")
    .reduce((acc, d) => acc + (d.amount || 0), 0);

  const pendingCount = donations.filter((d) => d.status === "PENDING").length;
  const gatewayCount = donations.filter((d) => d.is_gateway || d.payment_method === "Online Gateway").length;

  const handleStatusChange = async (donation: OnlineDonation, newStatus: "VERIFIED" | "REJECTED") => {
    try {
      const res = await updateOnlineDonationStatus(donation.id, newStatus);
      if (res.error) {
        showToast("error", res.error);
        return;
      }
      setDonations((prev) =>
        prev.map((d) =>
          d.id === donation.id
            ? { ...d, status: newStatus, verified_at: new Date().toISOString(), verified_by: "অ্যাডমিন" }
            : d
        )
      );

      if (newStatus === "VERIFIED") {
        showToast("success", "অনুদান সফলভাবে অনুমোদন করা হয়েছে!");
        setApprovalModalDonation({
          ...donation,
          status: "VERIFIED",
          verified_at: new Date().toISOString(),
        });
      } else {
        showToast("success", "অনুদান বাতিল করা হয়েছে।");
      }
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই অনুদান রেকর্ডটি ডিলিট করতে চান?")) return;
    try {
      const res = await deleteOnlineDonation(id);
      if (res.error) {
        showToast("error", res.error);
        return;
      }
      setDonations((prev) => prev.filter((d) => d.id !== id));
      showToast("success", "রেকর্ডটি মুছে ফেলা হয়েছে।");
      router.refresh();
    } catch (err: any) {
      showToast("error", "মুছতে সমস্যা হয়েছে");
    }
  };

  const handleSendSMS = async (donation: OnlineDonation) => {
    if (!donation.phone) {
      showToast("error", "দাতার কোনো মোবাইল নম্বর নেই!");
      return;
    }
    setSendingSmsId(donation.id);
    try {
      const res = await sendDonationNotificationSMS({
        phone: donation.phone,
        donor_name: donation.donor_name || "শুভাকাঙ্ক্ষী",
        amount: donation.amount || 0,
        receipt_no: donation.receipt_no,
        fund_category: donation.fund_category,
      });

      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "এসএমএস সফলভাবে পাঠানো হয়েছে!");
      }
    } catch (err: any) {
      showToast("error", err.message || "এসএমএস প্রেরণে সমস্যা হয়েছে");
    } finally {
      setSendingSmsId(null);
    }
  };

  const handleShareWhatsApp = (donation: OnlineDonation) => {
    const madrasaName = madrasaInfo?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const receiptUrl = `${origin}/portal/donate?receipt=${donation.receipt_no}`;
    const text = generateWhatsAppMessage(donation, madrasaName, receiptUrl);

    const phone = donation.phone ? formatWhatsAppPhone(donation.phone) : "";
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(waUrl, "_blank");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await saveOnlineDonationSettings(settingsForm);
      if (res.error) {
        showToast("error", res.error);
      } else {
        setSettings(settingsForm);
        showToast("success", "অনলাইন ডোনেশন সেটিংস সফলভাবে সংরক্ষিত ও সিঙ্ক হয়েছে!");
        setIsSettingsOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      showToast("error", err.message || "সেটিংস সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const madrasaTitle = madrasaInfo?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা ও এতিমখানা";
  const madrasaAddress = madrasaInfo?.address || "ঢাকা, বাংলাদেশ";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Feedback Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition-all animate-in slide-in-from-bottom-3 ${
            toast.type === "success"
              ? "bg-emerald-800 text-white"
              : "bg-rose-800 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/60">
              <Wallet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                অনলাইন ডোনেশন ও গেটওয়ে ব্যবস্থাপনা
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                বিকাশ, নগদ, রকেট ও ব্যাংক একাউন্টের তথ্য সেট করুন এবং অনলাইন পেমেন্ট গেটওয়েতে প্রাপ্ত অনুদান পরিচালনা করুন।
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all text-xs"
          >
            <Settings className="w-4 h-4" />
            <span>অনলাইন ডোনেশন সেটিংস</span>
          </button>

          <a
            href="/portal/donate"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-all text-xs"
          >
            <ExternalLink className="w-4 h-4" />
            <span>পাবলিক ডোনেশন পেজ</span>
          </a>
        </div>
      </div>

      {/* Gateway & Accounts Status Banner */}
      <div className="bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-950 text-sm">
                অনলাইন পেমেন্ট গেটওয়ে সিঙ্ক সক্রিয়
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                {settings.gateway_provider || "SSLCOMMERZ"}
              </span>
              {settings.gateway_enabled ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  সরাসরি গেটওয়ে চালু
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">গেটওয়ে বন্ধ</span>
              )}
            </div>
            <p className="text-slate-600 mt-0.5">
              বিকাশ: <strong className="font-mono text-slate-900">{settings.bkash_number}</strong> ({settings.bkash_type}) • নগদ: <strong className="font-mono text-slate-900">{settings.nagad_number}</strong> • ব্যাংক: <strong className="text-slate-900">{settings.bank_name}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="text-xs font-bold text-emerald-800 hover:text-emerald-900 underline underline-offset-4 shrink-0"
        >
          অ্যাকাউন্ট নম্বর ও সেটিংস পরিবর্তন করুন →
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">মোট অনুদান সংখ্যা</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(donations.length)} টি
          </span>
          <span className="text-[11px] text-slate-400">অনলাইন পোর্টাল থেকে প্রাপ্ত</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">অপেক্ষমান যাচাই (Pending)</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {toBanglaNumber(pendingCount)} টি
          </span>
          <span className="text-[11px] text-amber-700 font-medium">TrxID যাচাই বাকি</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">মোট ভেরিফাইড অনুদান</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(totalVerified)}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">মাদ্রাসার তহবিলে জমা</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">ডাইরেক্ট গেটওয়ে পেমেন্ট</span>
          <span className="text-2xl font-bold text-blue-700 mt-1 block">
            {toBanglaNumber(gatewayCount)} টি
          </span>
          <span className="text-[11px] text-blue-600 font-medium">অটো ভেরিফাইড ট্রানজেকশন</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="দাতার নাম, মোবাইল, TrxID বা রসিদ নং..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium bg-slate-50 text-slate-700"
          >
            <option value="ALL">সব মেথড</option>
            <option value="GATEWAY">ডাইরেক্ট গেটওয়ে</option>
            <option value="MANUAL">ম্যানুয়াল TrxID</option>
            <option value="bKash">বিকাশ</option>
            <option value="Nagad">নগদ</option>
            <option value="Rocket">রকেট</option>
            <option value="Bank">ব্যাংক</option>
          </select>

          <div className="flex items-center gap-1">
            {[
              { key: "ALL", label: "সকল" },
              { key: "PENDING", label: `অপেক্ষমান (${pendingCount})` },
              { key: "VERIFIED", label: "ভেরিফাইড" },
              { key: "REJECTED", label: "বাতিল" },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors ${
                  statusFilter === st.key
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredDonations.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
          <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-bold text-sm text-slate-600">কোনো অনলাইন অনুদানের রেকর্ড নেই</p>
          <p className="text-xs mt-1 text-slate-500">
            পাবলিক ডোনেশন পেজ বা অনলাইন গেটওয়ে থেকে অনুদান আসলে এখানে প্রদর্শিত হবে।
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">রসিদ নং ও ধরন</th>
                  <th className="py-3 px-4">দাতার নাম ও মোবাইল</th>
                  <th className="py-3 px-4">খাত</th>
                  <th className="py-3 px-4">পদ্ধতি ও TrxID</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4">পরিমাণ</th>
                  <th className="py-3 px-4">স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-right">যাচাই, শেয়ার ও অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonations.map((d) => {
                  const isGateway = d.is_gateway || d.payment_method === "Online Gateway";

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-emerald-800">{d.receipt_no}</div>
                        {isGateway ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded mt-0.5">
                            <CreditCard className="w-2.5 h-2.5" />
                            ডাইরেক্ট গেটওয়ে
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded mt-0.5">
                            ম্যানুয়াল TrxID
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{d.donor_name}</span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Phone className="w-2.5 h-2.5 text-slate-400" />
                          <span>{d.phone || "নম্বর নেই"}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[11px] font-semibold border border-emerald-100">
                          {d.fund_category || "সাধারণ তহবিল"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{d.payment_method}</span>
                        {d.trx_id ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 rounded">
                              {d.trx_id}
                            </span>
                            <button
                              onClick={() => handleCopy(d.trx_id, d.id)}
                              className="text-slate-400 hover:text-slate-600"
                              title="TrxID কপি করুন"
                            >
                              {copiedId === d.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {toBanglaNumber(d.donation_date || d.created_at?.split("T")[0])}
                      </td>

                      <td className="py-3 px-4 font-bold text-emerald-700 text-sm whitespace-nowrap">
                        ৳ {toBanglaNumber(d.amount)}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.status === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : d.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {d.status === "VERIFIED" ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              ভেরিফাইড
                            </>
                          ) : d.status === "REJECTED" ? (
                            <>
                              <XCircle className="w-2.5 h-2.5 text-rose-600" />
                              বাতিল
                            </>
                          ) : (
                            <>
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              অপেক্ষমান
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {d.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleStatusChange(d, "VERIFIED")}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] shadow-xs flex items-center gap-1"
                                title="যাচাই ও অনুমোদন"
                              >
                                <Check className="w-3 h-3" />
                                অনুমোদন
                              </button>
                              <button
                                onClick={() => handleStatusChange(d, "REJECTED")}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[11px] border border-rose-200"
                                title="বাতিল করুন"
                              >
                                বাতিল
                              </button>
                            </>
                          )}

                          {d.status === "VERIFIED" && (
                            <>
                              <button
                                onClick={() => handleShareWhatsApp(d)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200/80 transition-colors"
                                title="WhatsApp এ রসিদ পাঠান"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleSendSMS(d)}
                                disabled={sendingSmsId === d.id}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200/80 transition-colors disabled:opacity-50"
                                title="মোবাইলে SMS পাঠান"
                              >
                                {sendingSmsId === d.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setSelectedDonationForReceipt(d)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors"
                            title="ডিজিটাল মানি রিসিট দেখুন ও প্রিন্ট করুন"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(d.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="মুছে ফেলুন"
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

      {/* Online Donation Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Settings className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    অনলাইন ডোনেশন ও একাউন্ট সেটিংস
                  </h3>
                  <p className="text-xs text-slate-500">
                    মাদ্রাসার কাস্টম বিকাশ, নগদ, রকেট নম্বর ও ব্যাংক অ্যাকাউন্ট তথ্য কনফিগার করুন।
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>মোবাইল ব্যাংকিং অ্যাকাউন্ট নম্বর</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">বিকাশ (bKash) নম্বর *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.bkash_number}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, bkash_number: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      placeholder="01700-000000"
                    />
                    <select
                      value={settingsForm.bkash_type}
                      onChange={(e: any) =>
                        setSettingsForm({ ...settingsForm, bkash_type: e.target.value })
                      }
                      className="w-full mt-1 px-2.5 py-1.5 border rounded-lg bg-white text-[11px]"
                    >
                      <option value="Merchant">মার্চেন্ট (Merchant)</option>
                      <option value="Personal">পার্সোনাল (Personal)</option>
                      <option value="Agent">এজেন্ট (Agent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">নগদ (Nagad) নম্বর *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.nagad_number}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, nagad_number: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      placeholder="01800-000000"
                    />
                    <select
                      value={settingsForm.nagad_type}
                      onChange={(e: any) =>
                        setSettingsForm({ ...settingsForm, nagad_type: e.target.value })
                      }
                      className="w-full mt-1 px-2.5 py-1.5 border rounded-lg bg-white text-[11px]"
                    >
                      <option value="Personal">পার্সোনাল (Personal)</option>
                      <option value="Merchant">মার্চেন্ট (Merchant)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">রকেট (Rocket) নম্বর</label>
                    <input
                      type="text"
                      value={settingsForm.rocket_number}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, rocket_number: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      placeholder="01900-000000"
                    />
                    <select
                      value={settingsForm.rocket_type}
                      onChange={(e: any) =>
                        setSettingsForm({ ...settingsForm, rocket_type: e.target.value })
                      }
                      className="w-full mt-1 px-2.5 py-1.5 border rounded-lg bg-white text-[11px]"
                    >
                      <option value="Personal">পার্সোনাল (Personal)</option>
                      <option value="Merchant">মার্চেন্ট (Merchant)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span>ব্যাংক অ্যাকাউন্ট তথ্য</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">ব্যাংকের নাম *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.bank_name}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, bank_name: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="ইসলামী ব্যাংক বাংলাদেশ পিএলসি"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">শাখার নাম (Branch) *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.bank_branch}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, bank_branch: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="মিরপুর শাখা, ঢাকা"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">হিসাবের শিরোনাম (Account Title) *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.bank_account_name}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, bank_account_name: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="মাদ্রাসার অফিসিয়াল নাম"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">হিসাব নম্বর (Account No) *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.bank_account_no}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, bank_account_no: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      placeholder="20501234567890"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">রাউটিং নম্বর (Routing Number)</label>
                    <input
                      type="text"
                      value={settingsForm.bank_routing_no}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, bank_routing_no: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      placeholder="125272654"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h4 className="font-bold text-emerald-950 text-sm">
                        অনলাইন পেমেন্ট গেটওয়ে দিয়ে সরাসরি দান গ্রহণ
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        সক্রিয় থাকলে ডোনাররা সরাসরি গেটওয়ের মাধ্যমে কার্ড/মোবাইল ব্যাংকিং দিয়ে পরিশোধ করতে পারবে।
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.gateway_enabled}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, gateway_enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">গেটওয়ে প্রোভাইডার</label>
                    <select
                      value={settingsForm.gateway_provider || "SSLCOMMERZ"}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, gateway_provider: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="SSLCOMMERZ">SSLCOMMERZ</option>
                      <option value="bKash Direct">bKash Direct Gateway</option>
                      <option value="Shurjopay">Shurjopay</option>
                      <option value="AamarPay">AamarPay</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end pb-1 space-y-1">
                    <span className="text-[11px] text-slate-500">
                      গেটওয়ের প্রধান ক্রেডেনশিয়ালস (Store ID, Password) ও লাইভ/টেস্ট মোড মূল <strong>পেমেন্ট গেটওয়ে</strong> সেটিংস থেকে সিঙ্ক হয়।
                    </span>
                    <a
                      href="/dashboard/accounting/gateway"
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2"
                    >
                      <span>গেটওয়ে ক্রেডেনশিয়ালস কনফিগারেশন পেজ খুলুন</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  দাতার জন্য বিশেষ নির্দেশনা বা নোটিশ (Public Notice)
                </label>
                <textarea
                  rows={2}
                  value={settingsForm.instructions || ""}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, instructions: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="যেমন: অনুদান পাঠানোর পর ট্রানজেকশন আইডি (TrxID) দিয়ে সাবমিট করুন।"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>সেটিংস সেভ ও সিঙ্ক করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Success Share Modal */}
      {approvalModalDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in zoom-in-95">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">অনুদান সফলভাবে অনুমোদিত হয়েছে!</h3>
              <p className="text-xs text-slate-500 mt-1">
                দাতার সাথে তাৎক্ষণিক রসিদ শেয়ার করতে নিচের বাটনটি ব্যবহার করুন:
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">দাতার নাম:</span>
                <span className="font-bold text-slate-800">{approvalModalDonation.donor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">মোবাইল:</span>
                <span className="font-mono text-slate-800">{approvalModalDonation.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">টাকার পরিমাণ:</span>
                <span className="font-bold text-emerald-700">৳ {toBanglaNumber(approvalModalDonation.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">রসিদ নং:</span>
                <span className="font-mono font-bold text-slate-800">{approvalModalDonation.receipt_no}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  handleShareWhatsApp(approvalModalDonation);
                  setApprovalModalDonation(null);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp এ পাঠান</span>
              </button>

              <button
                onClick={async () => {
                  await handleSendSMS(approvalModalDonation);
                  setApprovalModalDonation(null);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>অটো SMS পাঠান</span>
              </button>
            </div>

            <button
              onClick={() => setApprovalModalDonation(null)}
              className="text-xs text-slate-500 hover:text-slate-700 pt-2 font-medium"
            >
              এখন নয়, পরে পাঠাবো
            </button>
          </div>
        </div>
      )}

      {/* Official Digital Money Receipt Modal */}
      {selectedDonationForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm">
                অফিসিয়াল ডিজিটাল অনুদান রসিদ
              </h3>
              <button
                onClick={() => setSelectedDonationForReceipt(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Printable Receipt Sheet */}
            <div
              id="admin-donation-receipt-sheet"
              className="border-2 border-emerald-800/60 rounded-2xl p-6 bg-white space-y-4 text-xs text-slate-900 shadow-sm font-sans"
            >
              <div className="text-center border-b border-emerald-300 pb-3">
                <div className="text-xs font-serif font-bold text-emerald-950">
                  بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                </div>
                <h4 className="font-black text-lg text-emerald-950 mt-1">
                  {madrasaTitle}
                </h4>
                <p className="text-[10px] text-slate-500">{madrasaAddress}</p>
                <div className="mt-2 inline-block px-3 py-0.5 bg-emerald-800 text-white font-bold text-[10px] rounded-full uppercase tracking-wider">
                  অনলাইন অনুদান প্রাপ্তির ডিজিটাল রসিদ
                </div>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <p className="font-mono text-emerald-900 font-bold text-xs">
                    রসিদ নং: {selectedDonationForReceipt.receipt_no}
                  </p>
                  <span className="text-slate-300">•</span>
                  <p className="text-[11px] text-slate-600">
                    তারিখ: {toBanglaNumber(selectedDonationForReceipt.donation_date || selectedDonationForReceipt.created_at?.split("T")[0])}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-slate-800 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">দাতার নাম:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDonationForReceipt.donor_name}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">মোবাইল নম্বর:</span>
                  <span className="font-mono font-bold">
                    {selectedDonationForReceipt.phone || "তথ্য নেই"}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">অনুদানের খাত:</span>
                  <span className="font-bold text-emerald-800">
                    {selectedDonationForReceipt.fund_category || "সাধারণ তহবিল"}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">পেমেন্ট মেথড:</span>
                  <span className="font-semibold">
                    {selectedDonationForReceipt.payment_method}{" "}
                    {selectedDonationForReceipt.is_gateway && "(ডাইরেক্ট গেটওয়ে)"}
                  </span>
                </div>

                {selectedDonationForReceipt.trx_id && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">ট্রানজেকশন আইডি (TrxID):</span>
                    <span className="font-mono font-bold text-emerald-900">
                      {selectedDonationForReceipt.trx_id}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">ভেরিফিকেশন স্ট্যাটাস:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedDonationForReceipt.status === "VERIFIED"
                      ? "অনুমোদিত ও ভেরিফাইড (গৃহীত)"
                      : selectedDonationForReceipt.status === "PENDING"
                      ? "যাচাই অপেক্ষমান (Pending)"
                      : "বাতিলকৃত"}
                  </span>
                </div>

                <div className="flex justify-between pt-2 pb-1 font-bold text-emerald-950 text-base">
                  <span>গৃহীত টাকার পরিমাণ:</span>
                  <span>৳ {toBanglaNumber(selectedDonationForReceipt.amount)}</span>
                </div>

                <div className="text-[11px] text-slate-600 italic bg-emerald-50/60 p-2 rounded-lg border border-emerald-200/60">
                  কথায়: {numberToBanglaWords(selectedDonationForReceipt.amount || 0)}
                </div>
              </div>

              <div className="text-center pt-2 pb-1 border-t border-dashed border-emerald-300">
                <p className="text-[10px] text-slate-500 font-serif">
                  "জাযাকুমুল্লাহু খাইরান" — আল্লাহ তায়ালা আপনার এই নেক দানকে কবুল করুন।
                </p>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">
                  হিসাবরক্ষক / অনলাইন ভেরিফায়ার
                </div>
                <div className="border-t border-slate-300 pt-1">
                  মুহতামিম / অর্থ সম্পাদক
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleShareWhatsApp(selectedDonationForReceipt)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-emerald-200"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => handleSendSMS(selectedDonationForReceipt)}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-blue-200"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SMS</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDonationForReceipt(null)}
                  className="px-3.5 py-2 border rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  বন্ধ করুন
                </button>

                <button
                  onClick={() =>
                    printElementIsolated(
                      "admin-donation-receipt-sheet",
                      `Donation-Receipt-${selectedDonationForReceipt.receipt_no}`
                    )
                  }
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট / ডাউনলোড</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
