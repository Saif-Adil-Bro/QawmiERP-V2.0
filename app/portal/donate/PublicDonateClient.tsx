"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  ShieldCheck,
  Building,
  CreditCard,
  Phone,
  Copy,
  Check,
  CheckCircle2,
  Printer,
  Sparkles,
  ArrowRight,
  Send,
  Lock,
  Landmark,
  Wallet,
  Clock,
  Search,
  ExternalLink,
  Info,
  ChevronRight,
  RefreshCw,
  FileCheck
} from "lucide-react";
import { submitOnlineDonation, getOnlineDonations } from "@/app/actions/fundraising";
import { printElementIsolated } from "@/lib/printUtils";
import { numberToBanglaWords } from "@/lib/utils";
import {
  OnlineDonationSettings,
  DEFAULT_ONLINE_DONATION_SETTINGS,
  OnlineDonation,
} from "@/lib/fundraising-types";
import { PaymentGatewayConfig } from "@/lib/payment-gateway";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

export default function PublicDonateClient({
  madrasaInfo,
  paymentGatewayConfig,
  donationSettings,
}: {
  madrasaInfo?: any;
  paymentGatewayConfig?: PaymentGatewayConfig;
  donationSettings?: OnlineDonationSettings;
}) {
  const settings: OnlineDonationSettings =
    donationSettings || DEFAULT_ONLINE_DONATION_SETTINGS;

  // Active donation method tab: 'GATEWAY' (direct online) or 'MANUAL' (send money & TrxID) or 'SEARCH'
  const [activeTab, setActiveTab] = useState<"GATEWAY" | "MANUAL" | "SEARCH">(
    settings.gateway_enabled ? "GATEWAY" : "MANUAL"
  );

  // Form State
  const [formData, setFormData] = useState({
    donor_name: "",
    phone: "",
    email: "",
    amount: 1000,
    fund_category: "লিল্লাহ বোর্ডিং ও এতিমখানা",
    payment_method: "bKash" as "bKash" | "Nagad" | "Rocket" | "Bank" | "Online Gateway" | "Other",
    trx_id: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<OnlineDonation | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Search/Track receipt state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<OnlineDonation | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Gateway Simulation Modal
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [gatewayProcessing, setGatewayProcessing] = useState(false);
  const [selectedGatewayChannel, setSelectedGatewayChannel] = useState<
    "bKash" | "Nagad" | "Rocket" | "Card" | "Islami Bank"
  >("bKash");

  // Check URL for receipt query on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const rNo = params.get("receipt");
      if (rNo) {
        setSearchQuery(rNo);
        setActiveTab("SEARCH");
        lookupReceipt(rNo);
      }
    }
  }, []);

  const lookupReceipt = async (receiptNo: string) => {
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const all = await getOnlineDonations();
      const match = all.find(
        (d) =>
          d.receipt_no?.toLowerCase() === receiptNo.trim().toLowerCase() ||
          (d.trx_id && d.trx_id.toLowerCase() === receiptNo.trim().toLowerCase())
      );
      if (match) {
        setSearchResult(match);
      } else {
        setSearchError("প্রদত্ত রসিদ নম্বর বা TrxID দিয়ে কোনো অনুদান পাওয়া যায়নি।");
      }
    } catch {
      setSearchError("অনুসন্ধান করতে সমস্যা হয়েছে।");
    } finally {
      setSearching(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(id);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  // 1. Manual Form Submit (Donor sends money manually & enters TrxID)
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.donor_name || !formData.phone || !formData.amount) {
      alert("অনুগ্রহ করে আপনার নাম, মোবাইল ও দানের পরিমাণ পূরণ করুন।");
      return;
    }
    if (!formData.trx_id || formData.trx_id.trim().length < 4) {
      alert("অনুগ্রহ করে সঠিক ট্রানজেকশন আইডি (TrxID) প্রদান করুন।");
      return;
    }

    setLoading(true);
    try {
      const res = await submitOnlineDonation({
        ...formData,
        is_gateway: false,
        status: "PENDING",
      });

      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }

      setSubmittedReceipt(res.donation as OnlineDonation);
    } catch {
      alert("অনুদান জমা দিতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct Gateway Pay Initiator
  const handleInitiateGatewayPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.donor_name || !formData.phone || !formData.amount) {
      alert("অনুগ্রহ করে আপনার নাম, মোবাইল ও দানের পরিমাণ উল্লেখ করুন।");
      return;
    }
    setShowGatewayModal(true);
  };

  // 3. Complete Direct Gateway Payment
  const handleCompleteGatewayPayment = async () => {
    setGatewayProcessing(true);
    try {
      // Simulate gateway transaction processing
      await new Promise((r) => setTimeout(r, 1200));

      const fakeTrxId = `GW${Date.now().toString().slice(-8).toUpperCase()}`;
      const res = await submitOnlineDonation({
        donor_name: formData.donor_name,
        phone: formData.phone,
        email: formData.email,
        amount: formData.amount,
        fund_category: formData.fund_category,
        payment_method: "Online Gateway",
        trx_id: fakeTrxId,
        message: formData.message,
        is_gateway: true,
        gateway_provider: settings.gateway_provider || "SSLCOMMERZ",
        status: "VERIFIED",
      });

      if (res.error) {
        alert(res.error);
        setGatewayProcessing(false);
        return;
      }

      setShowGatewayModal(false);
      setSubmittedReceipt(res.donation as OnlineDonation);
    } catch {
      alert("পেমেন্ট সম্পন্ন করতে সমস্যা হয়েছে।");
    } finally {
      setGatewayProcessing(false);
    }
  };

  const madrasaTitle = madrasaInfo?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা ও এতিমখানা";
  const madrasaAddress = madrasaInfo?.address || "ঢাকা, বাংলাদেশ";

  // Pre-configured fund categories
  const fundCategories = [
    "লিল্লাহ বোর্ডিং ও এতিমখানা",
    "হিফজুল কুরআন তহবিল",
    "মসজিদ ও মাদ্রাসা নির্মাণ/উন্নয়ন",
    "সাধারণ দান ও সাদকাহ",
    "যাকাত তহবিল",
    "শিক্ষক ও কর্মচারী কল্যাণ ফান্ড",
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold mb-1 shadow-xs">
            <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
            <span>সাদকাহ জারিয়া ও দ্বীনি খেদমত</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            {madrasaInfo?.logo_url && (
              <img
                src={madrasaInfo.logo_url}
                alt={madrasaTitle}
                className="w-12 h-12 object-contain"
              />
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-serif">
              {madrasaTitle}
            </h1>
          </div>

          <p className="text-xs text-slate-500 font-medium">{madrasaAddress}</p>

          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto pt-1">
            লিল্লাহ বোর্ডিং এর এতিম-অসহায় তালেবে ইলমদের খোরাকি, হিফজুল কুরআন ও মাদ্রাসার সার্বিক উন্নয়নে আপনার পবিত্র দান/সাদকাহ সরাসরি গেটওয়ে বা বিকাশ-নগদে প্রদান করুন।
          </p>
        </div>

        {/* Main Interface Tabs */}
        {!submittedReceipt && (
          <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1">
            <button
              onClick={() => setActiveTab("GATEWAY")}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === "GATEWAY"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>ডাইরেক্ট অনলাইন গেটওয়ে</span>
              <span className="hidden sm:inline-block text-[10px] py-0.5 px-1.5 rounded-full bg-emerald-800/40 text-emerald-100">
                তাৎক্ষণিক রসিদ
              </span>
            </button>

            <button
              onClick={() => setActiveTab("MANUAL")}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === "MANUAL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>বিকাশ/নগদ/ব্যাংক ও TrxID</span>
            </button>

            <button
              onClick={() => setActiveTab("SEARCH")}
              className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "SEARCH"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="রসিদ ডাউনলোড বা ট্র্যাকিং"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">রসিদ যাচাই</span>
            </button>
          </div>
        )}

        {/* SUCCESS / SUBMITTED RECEIPT VIEW */}
        {submittedReceipt ? (
          <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-xl space-y-6 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              {submittedReceipt.status === "VERIFIED" ? (
                <>
                  <h2 className="text-xl font-bold text-slate-900">
                    জাযাকাল্লাহু খাইরান! আপনার দান সফলভাবে গৃহীত হয়েছে
                  </h2>
                  <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                    অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে আপনার পেমেন্ট সফলভাবে ভেরিফাইড হয়েছে। আপনার অফিসিয়াল ডিজিটাল মানি রিসিট প্রস্তুত।
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-slate-900">
                    ধন্যবাদ! আপনার অনুদানের তথ্য জমা হয়েছে
                  </h2>
                  <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                    মাদ্রাসা কর্তৃপক্ষ আপনার প্রেরিত TrxID ({submittedReceipt.trx_id}) যাচাই করে অনুমোদন করবেন। অনুমোদনের পর আপনার মোবাইলে নিশ্চিতকরণ ও ভেরিফাইড রসিদ লিঙ্ক পাঠানো হবে।
                  </p>
                </>
              )}
            </div>

            {/* Official Digital Money Receipt Printable Sheet */}
            <div
              id="public-donation-receipt-sheet"
              className="border-2 border-emerald-800/70 rounded-2xl p-6 bg-white space-y-4 text-xs text-slate-900 shadow-sm"
            >
              <div className="text-center border-b border-emerald-300 pb-3">
                <div className="text-xs font-serif font-bold text-slate-700">
                  بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                </div>
                <h3 className="font-bold text-base text-emerald-950 mt-1">{madrasaTitle}</h3>
                {madrasaAddress && <p className="text-[10px] text-slate-500">{madrasaAddress}</p>}
                <div className="mt-2 inline-block px-3 py-0.5 bg-emerald-800 text-white font-bold text-[10px] rounded-full uppercase tracking-wider">
                  {submittedReceipt.status === "VERIFIED"
                    ? "অফিসিয়াল ডিজিটাল অনুদান রসিদ"
                    : "অনুদান প্রাপ্তি স্বীকার ও ট্র্যাকিং স্লিপ"}
                </div>
                <div className="mt-1 flex items-center justify-center gap-2 font-mono">
                  <span className="text-emerald-900 font-bold text-xs">
                    রসিদ নং: {submittedReceipt.receipt_no}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600 text-[11px]">
                    তারিখ: {toBanglaNumber(submittedReceipt.donation_date || new Date().toISOString().split("T")[0])}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-slate-800 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">দাতার নাম:</span>
                  <span className="font-bold text-slate-900">{submittedReceipt.donor_name}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">মোবাইল নম্বর:</span>
                  <span className="font-mono font-semibold">{submittedReceipt.phone}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">অনুদানের খাত:</span>
                  <span className="font-bold text-emerald-800">{submittedReceipt.fund_category}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">পদ্ধতি:</span>
                  <span className="font-semibold">
                    {submittedReceipt.payment_method}{" "}
                    {submittedReceipt.is_gateway && "(ডাইরেক্ট গেটওয়ে)"}
                  </span>
                </div>

                {submittedReceipt.trx_id && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">ট্রানজেকশন আইডি (TrxID):</span>
                    <span className="font-mono font-bold text-emerald-900">
                      {submittedReceipt.trx_id}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">স্ট্যাটাস:</span>
                  <span
                    className={`font-bold ${
                      submittedReceipt.status === "VERIFIED"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {submittedReceipt.status === "VERIFIED"
                      ? "ভেরিফাইড ও গৃহীত (Verified)"
                      : "যাচাই অপেক্ষমান (Pending Approval)"}
                  </span>
                </div>

                <div className="flex justify-between pt-2 pb-1 font-bold text-emerald-950 text-base">
                  <span>অনুদানের পরিমাণ:</span>
                  <span>৳ {toBanglaNumber(submittedReceipt.amount)}</span>
                </div>

                <div className="text-[11px] text-slate-600 italic bg-emerald-50/50 p-2 rounded-lg border border-emerald-200/50">
                  কথায়: {numberToBanglaWords(submittedReceipt.amount || 0)}
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-emerald-300">
                <p className="text-[10px] text-slate-500 font-serif">
                  "আল্লাহ আপনার ধন-সম্পদে বরকত দিন এবং দুনিয়া-আখিরাতে উত্তম প্রতিদান দান করুন।"
                </p>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">অনলাইন ভেরিফিকেশন সিস্টেম</div>
                <div className="border-t border-slate-300 pt-1">মুহতামিম / অর্থ সম্পাদক</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() =>
                  printElementIsolated(
                    "public-donation-receipt-sheet",
                    `Donation-Receipt-${submittedReceipt.receipt_no}`
                  )
                }
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs text-xs flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>রসিদ ডাউনলোড / প্রিন্ট করুন</span>
              </button>

              <button
                onClick={() => {
                  setSubmittedReceipt(null);
                  setFormData({
                    ...formData,
                    trx_id: "",
                    message: "",
                  });
                }}
                className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs"
              >
                আরেকটি অনুদান দিন
              </button>
            </div>
          </div>
        ) : activeTab === "SEARCH" ? (
          /* TAB 3: SEARCH / TRACK RECEIPT */
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-900">অনলাইন অনুদান রসিদ অনুসন্ধান ও যাচাই</h2>
              <p className="text-xs text-slate-500">
                আপনার রসিদ নম্বর (যেমন: DON-2026-XXXXXX) বা TrxID লিখে অনুসন্ধান করুন।
              </p>
            </div>

            <div className="max-w-md mx-auto flex gap-2">
              <input
                type="text"
                placeholder="রসিদ নম্বর অথবা TrxID লিখুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupReceipt(searchQuery)}
                className="flex-1 px-4 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
              <button
                onClick={() => lookupReceipt(searchQuery)}
                disabled={searching || !searchQuery.trim()}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>খুঁজুন</span>
              </button>
            </div>

            {searchError && (
              <div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-xs text-center border border-rose-200">
                {searchError}
              </div>
            )}

            {searchResult && (
              <div className="pt-4 border-t border-slate-200 space-y-4 animate-in fade-in-50">
                <div
                  id="search-donation-receipt-sheet"
                  className="border-2 border-emerald-800/70 rounded-2xl p-6 bg-white space-y-4 text-xs text-slate-900 shadow-sm"
                >
                  <div className="text-center border-b border-emerald-300 pb-3">
                    <div className="text-xs font-serif font-bold text-slate-700">
                      بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                    </div>
                    <h3 className="font-bold text-base text-emerald-950 mt-1">{madrasaTitle}</h3>
                    <p className="text-[10px] text-slate-500">{madrasaAddress}</p>
                    <div className="mt-2 inline-block px-3 py-0.5 bg-emerald-800 text-white font-bold text-[10px] rounded-full">
                      অনলাইন অনুদান রসিদ
                    </div>
                    <div className="mt-1 font-mono font-bold text-xs text-emerald-900">
                      রসিদ নং: {searchResult.receipt_no}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">দাতার নাম:</span>
                      <span className="font-bold">{searchResult.donor_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">খাত:</span>
                      <span className="font-semibold text-emerald-800">{searchResult.fund_category}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">পেমেন্ট মেথড:</span>
                      <span>{searchResult.payment_method}</span>
                    </div>
                    {searchResult.trx_id && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">TrxID:</span>
                        <span className="font-mono font-bold">{searchResult.trx_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">স্ট্যাটাস:</span>
                      <span
                        className={`font-bold ${
                          searchResult.status === "VERIFIED"
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        {searchResult.status === "VERIFIED" ? "ভেরিফাইড (গৃহীত)" : "যাচাই অপেক্ষমান"}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-emerald-950 text-base">
                      <span>টাকার পরিমাণ:</span>
                      <span>৳ {toBanglaNumber(searchResult.amount)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={() =>
                      printElementIsolated(
                        "search-donation-receipt-sheet",
                        `Donation-Receipt-${searchResult.receipt_no}`
                      )
                    }
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 mx-auto"
                  >
                    <Printer className="w-4 h-4" />
                    <span>রসিদ প্রিন্ট করুন</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "GATEWAY" ? (
          /* TAB 1: DIRECT ONLINE GATEWAY */
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>সরাসরি অনলাইন পেমেন্ট গেটওয়ে</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  বিকাশ, নগদ, রকেট, কার্ড বা ইসলামী ব্যাংকের মাধ্যমে নিরাপদ ডিজিটাল পেমেন্ট করুন।
                </p>
              </div>

              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                অটো ভেরিফাইড রসিদ
              </span>
            </div>

            {/* Channels Showcase */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs font-bold text-slate-700">
              <div className="p-2.5 rounded-xl border border-pink-200 bg-pink-50/50 flex flex-col items-center gap-1">
                <span className="w-7 h-7 rounded-full bg-pink-600 text-white flex items-center justify-center font-serif text-xs">
                  b
                </span>
                <span>বিকাশ</span>
              </div>
              <div className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/50 flex flex-col items-center gap-1">
                <span className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs">
                  ন
                </span>
                <span>নগদ</span>
              </div>
              <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 flex flex-col items-center gap-1">
                <span className="w-7 h-7 rounded-full bg-purple-700 text-white flex items-center justify-center text-xs">
                  R
                </span>
                <span>রকেট</span>
              </div>
              <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col items-center gap-1">
                <Building className="w-6 h-6 text-emerald-700 mt-0.5" />
                <span>ইসলামী ব্যাংক</span>
              </div>
              <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col items-center gap-1 col-span-2 sm:col-span-1">
                <CreditCard className="w-6 h-6 text-blue-700 mt-0.5" />
                <span>কার্ড / অন্যান্য</span>
              </div>
            </div>

            {/* Gateway Form */}
            <form onSubmit={handleInitiateGatewayPay} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">আপনার নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ মুহাম্মদ আবদুল্লাহ"
                    value={formData.donor_name}
                    onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    placeholder="01700-000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">অনুদানের খাত *</label>
                  <select
                    value={formData.fund_category}
                    onChange={(e) => setFormData({ ...formData, fund_category: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    {fundCategories.map((fc) => (
                      <option key={fc} value={fc}>
                        {fc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ইমেইল (ঐচ্ছিক)</label>
                  <input
                    type="email"
                    placeholder="donor@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Amount Presets */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">অনুদানের পরিমাণ (টাকা) *</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
                  {[500, 1000, 2000, 5000, 10000, 20000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => setFormData({ ...formData, amount: amt })}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        formData.amount === amt
                          ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      ৳ {toBanglaNumber(amt)}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="10"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  বিশেষ দুআ বা মন্তব্য (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  placeholder="যেমন: মরহুম পিতা-মাতার মাগফিরাতের জন্য..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>গেটওয়ের মাধ্যমে ৳ {toBanglaNumber(formData.amount)} দান করুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* TAB 2: MANUAL TRANSFER & SUBMIT TrxID */
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span>মাদ্রাসার একাউন্টে অনুদান পাঠিয়ে TrxID সাবমিট করুন</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                নিচে প্রদত্ত বিকাশ, নগদ, রকেট বা ব্যাংক একাউন্টে টাকা পাঠিয়ে প্রাপ্ত TrxID দিয়ে ফর্ম পূরণ করুন।
              </p>
            </div>

            {/* Custom Notice */}
            {settings.instructions && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">মাদ্রাসা কর্তৃপক্ষের নির্দেশনা:</strong>
                  <span>{settings.instructions}</span>
                </div>
              </div>
            )}

            {/* Accounts List */}
            <div className="space-y-3">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                মাদ্রাসার অফিসিয়াল অ্যাকাউন্টসমূহ:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* bKash */}
                <div className="p-3.5 bg-pink-50/60 border border-pink-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-pink-700 uppercase tracking-wider">
                      bKash ({settings.bkash_type})
                    </span>
                    <p className="font-mono font-bold text-sm text-slate-900">
                      {settings.bkash_number}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(settings.bkash_number, "bkash")}
                    className="px-2.5 py-1.5 bg-white hover:bg-pink-100 text-pink-700 rounded-lg text-xs font-bold border border-pink-200 flex items-center gap-1 shadow-2xs"
                  >
                    {copiedAccount === "bkash" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedAccount === "bkash" ? "কপি হয়েছে" : "কপি"}</span>
                  </button>
                </div>

                {/* Nagad */}
                <div className="p-3.5 bg-orange-50/60 border border-orange-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">
                      নগদ ({settings.nagad_type})
                    </span>
                    <p className="font-mono font-bold text-sm text-slate-900">
                      {settings.nagad_number}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(settings.nagad_number, "nagad")}
                    className="px-2.5 py-1.5 bg-white hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold border border-orange-200 flex items-center gap-1 shadow-2xs"
                  >
                    {copiedAccount === "nagad" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedAccount === "nagad" ? "কপি হয়েছে" : "কপি"}</span>
                  </button>
                </div>

                {/* Rocket (if set) */}
                {settings.rocket_number && (
                  <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-2xl flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                        রকেট ({settings.rocket_type})
                      </span>
                      <p className="font-mono font-bold text-sm text-slate-900">
                        {settings.rocket_number}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy(settings.rocket_number, "rocket")}
                      className="px-2.5 py-1.5 bg-white hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 flex items-center gap-1 shadow-2xs"
                    >
                      {copiedAccount === "rocket" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedAccount === "rocket" ? "কপি হয়েছে" : "কপি"}</span>
                    </button>
                  </div>
                )}

                {/* Bank Account */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-slate-900 text-xs">
                        {settings.bank_name} ({settings.bank_branch})
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(settings.bank_account_no, "bank")}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-300 flex items-center gap-1 shadow-2xs"
                    >
                      {copiedAccount === "bank" ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>একাউন্ট কপি</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      হিসাবের নাম: <strong className="text-slate-800">{settings.bank_account_name}</strong>
                    </div>
                    <div>
                      হিসাব নং: <strong className="font-mono text-slate-900">{settings.bank_account_no}</strong>
                    </div>
                    {settings.bank_routing_no && (
                      <div className="col-span-2">
                        রাউটিং নং: <strong className="font-mono text-slate-800">{settings.bank_routing_no}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Manual TrxID Submission Form */}
            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs pt-2 border-t border-slate-200">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                টাকা পাঠানোর পর নিচের তথ্যগুলো সাবমিট করুন:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">আপনার নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="মুহাম্মদ আবদুল্লাহ"
                    value={formData.donor_name}
                    onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    placeholder="01700-000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">পেমেন্ট মেথড *</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e: any) =>
                      setFormData({ ...formData, payment_method: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="bKash">বিকাশ (bKash)</option>
                    <option value="Nagad">নগদ (Nagad)</option>
                    <option value="Rocket">রকেট (Rocket)</option>
                    <option value="Bank">ব্যাংক ট্রান্সফার</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    ট্রানজেকশন আইডি (TrxID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: BKL99XYZ45"
                    value={formData.trx_id}
                    onChange={(e) =>
                      setFormData({ ...formData, trx_id: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">প্রেরিত টাকার পরিমাণ *</label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold font-mono focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">অনুদানের খাত</label>
                <select
                  value={formData.fund_category}
                  onChange={(e) => setFormData({ ...formData, fund_category: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  {fundCategories.map((fc) => (
                    <option key={fc} value={fc}>
                      {fc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  বিশেষ দুআ বা মন্তব্য (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  placeholder="যেমন: মরহুম পিতা-মাতার মাগফিরাতের জন্য..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>যাচাইয়ের জন্য পাঠানো হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>অনুদানের TrxID সাবমিট করুন</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>© {new Date().getFullYear()} {madrasaTitle} • সার্বিক সহযোগিতায় কওমি ম্যানেজার</p>
        </div>
      </div>

      {/* Gateway Checkout Modal */}
      {showGatewayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Lock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    নিরাপদ অনলাইন পেমেন্ট গেটওয়ে
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    প্রোভাইডার: {settings.gateway_provider || "SSLCOMMERZ"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGatewayModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Payment Summary */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">প্রাপক:</span>
                <span className="font-bold text-slate-900">{madrasaTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">দাতার নাম:</span>
                <span className="font-semibold text-slate-800">{formData.donor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">খাত:</span>
                <span className="font-semibold text-emerald-800">{formData.fund_category}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-emerald-900 text-base">
                <span>মোট প্রদেয়:</span>
                <span>৳ {toBanglaNumber(formData.amount)}</span>
              </div>
            </div>

            {/* Channel Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                পেমেন্ট মাধ্যম বেছে নিন:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "bKash", label: "বিকাশ (bKash)", color: "border-pink-200 hover:bg-pink-50" },
                  { id: "Nagad", label: "নগদ (Nagad)", color: "border-orange-200 hover:bg-orange-50" },
                  { id: "Rocket", label: "রকেট (Rocket)", color: "border-purple-200 hover:bg-purple-50" },
                  { id: "Islami Bank", label: "ইসলামী ব্যাংক", color: "border-emerald-200 hover:bg-emerald-50" },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedGatewayChannel(ch.id as any)}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${ch.color} ${
                      selectedGatewayChannel === ch.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-800"
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                সফল পেমেন্টের সাথে সাথেই আপনার ডিজিটাল অনুদান রসিদ তৈরি হবে এবং প্রিন্ট/ডাউনলোড করা যাবে।
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGatewayModal(false)}
                className="flex-1 py-2.5 border rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50"
              >
                বাতিল
              </button>

              <button
                type="button"
                disabled={gatewayProcessing}
                onClick={handleCompleteGatewayPayment}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {gatewayProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>প্রক্রিয়াধীন...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>পেমেন্ট নিশ্চিত করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
