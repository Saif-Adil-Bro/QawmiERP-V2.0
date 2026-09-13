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
  FileCheck,
  MessageSquare,
  Share2,
  QrCode
} from "lucide-react";
import {
  submitOnlineDonation,
  getOnlineDonations,
  initiateOnlineDonationGateway,
} from "@/app/actions/fundraising";
import { printElementIsolated } from "@/lib/printUtils";
import { numberToBanglaWords } from "@/lib/utils";
import {
  OnlineDonationSettings,
  DEFAULT_ONLINE_DONATION_SETTINGS,
  OnlineDonation,
} from "@/lib/fundraising-types";
import { PaymentGatewayConfig } from "@/lib/payment-gateway";
import { FundItem, DEFAULT_FUNDS } from "@/lib/fund-utils";
import {
  PaymentBrandSymbol,
  BkashBadge,
  NagadBadge,
  RocketBadge,
  IslamiBankBadge,
  SSLCommerzIcon,
  CardBrandsIcon,
  PaymentChannelBadgesRow
} from "@/components/payments/PaymentBrandLogos";

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
  funds = [],
}: {
  madrasaInfo?: any;
  paymentGatewayConfig?: PaymentGatewayConfig;
  donationSettings?: OnlineDonationSettings;
  funds?: FundItem[];
}) {
  const settings: OnlineDonationSettings =
    donationSettings || DEFAULT_ONLINE_DONATION_SETTINGS;

  // Active donation funds synchronized from madrasa system funds
  const activeFunds: FundItem[] = (funds && funds.length > 0 ? funds : DEFAULT_FUNDS)
    .filter((f) => f.is_active !== false);

  const defaultFundName = activeFunds[0]?.name || "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)";

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
    fund_category: defaultFundName,
    payment_method: "bKash" as "bKash" | "Nagad" | "Rocket" | "Bank" | "Online Gateway" | "Other",
    trx_id: "",
    message: "",
    is_anonymous: false,
  });

  const [loading, setLoading] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<OnlineDonation | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Search/Track receipt state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<OnlineDonation | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Gateway Interactive Checkout Modal State
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [gatewayProcessing, setGatewayProcessing] = useState(false);
  const [gatewayStep, setGatewayStep] = useState<"CHANNEL" | "VERIFY">("CHANNEL");
  const [selectedGatewayChannel, setSelectedGatewayChannel] = useState<
    "bKash" | "Nagad" | "Rocket" | "Card" | "Islami Bank"
  >("bKash");
  const [gatewayPayerNumber, setGatewayPayerNumber] = useState("");
  const [gatewayPin, setGatewayPin] = useState("");

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

  // Update default fund if active funds load
  useEffect(() => {
    if (activeFunds.length > 0 && (!formData.fund_category || !activeFunds.some(f => f.name === formData.fund_category))) {
      setFormData((prev) => ({ ...prev, fund_category: activeFunds[0].name }));
    }
  }, [funds]);

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
    setGatewayPayerNumber(formData.phone || "");
    setGatewayPin("");
    setGatewayStep("CHANNEL");
    setShowGatewayModal(true);
  };

  // 3. Complete Real Gateway Payment via Provider API
  const handleCompleteGatewayPayment = async () => {
    setGatewayProcessing(true);
    try {
      const channelMapped: "bKash" | "Nagad" | "Rocket" | "Islami Bank" | "Card / Other" =
        selectedGatewayChannel === "bKash"
          ? "bKash"
          : selectedGatewayChannel === "Nagad"
          ? "Nagad"
          : selectedGatewayChannel === "Rocket"
          ? "Rocket"
          : selectedGatewayChannel === "Islami Bank"
          ? "Islami Bank"
          : "Card / Other";

      const res = await initiateOnlineDonationGateway({
        donor_name: formData.donor_name,
        phone: formData.phone || gatewayPayerNumber,
        email: formData.email,
        amount: formData.amount,
        fund_category: formData.fund_category,
        payment_channel: channelMapped,
        message: formData.message,
        is_anonymous: formData.is_anonymous,
      });

      if (res.error || !res.success) {
        alert(res.error || "পেমেন্ট গেটওয়ে সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। গেটওয়ে সেটিংস বা ক্রেডেনশিয়ালস চেক করুন।");
        setGatewayProcessing(false);
        return;
      }

      if (res.redirect_url || res.gateway_url) {
        const targetUrl = res.redirect_url || res.gateway_url;
        // Redirect donor to official checkout
        window.location.href = targetUrl;
        return;
      }

      alert("পেমেন্ট লিঙ্ক তৈরি করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।");
    } catch (err: any) {
      alert(err.message || "পেমেন্ট সম্পন্ন করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setGatewayProcessing(false);
    }
  };

  const madrasaTitle = madrasaInfo?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা ও এতিমখানা";
  const madrasaAddress = madrasaInfo?.address || "ঢাকা, বাংলাদেশ";

  const handleShareReceiptWhatsApp = (donation: OnlineDonation) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const receiptUrl = `${origin}/portal/donate?receipt=${donation.receipt_no}`;
    const text = `আসসালামু আলাইকুম,\n${madrasaTitle}-এ আপনার অনলাইন অনুদান সফলভাবে গৃহীত ও ভেরিফাইড হয়েছে।\n\nরসিদ নং: ${donation.receipt_no}\nপরিমাণ: ৳ ${donation.amount}\nখাত: ${donation.fund_category}\nTrxID: ${donation.trx_id}\n\nআপনার ডিজিটাল রসিদ দেখতে ও ডাউনলোড করতে নিচের লিংকে ক্লিক করুন:\n${receiptUrl}\n\nজাযাকাল্লাহু খাইরান।`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

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
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
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
              className="border-2 border-emerald-800/80 rounded-2xl p-6 bg-white space-y-4 text-xs text-slate-900 shadow-sm relative overflow-hidden"
            >
              {/* Background Watermark */}
              <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
                <Building className="w-40 h-40 text-emerald-900" />
              </div>

              <div className="text-center border-b border-emerald-300 pb-3">
                <div className="text-xs font-serif font-bold text-slate-700">
                  بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                </div>
                <h3 className="font-bold text-base text-emerald-950 mt-1">{madrasaTitle}</h3>
                {madrasaAddress && <p className="text-[10px] text-slate-500">{madrasaAddress}</p>}
                <div className="mt-2 inline-block px-3 py-0.5 bg-emerald-800 text-white font-bold text-[10px] rounded-full uppercase tracking-wider">
                  {submittedReceipt.status === "VERIFIED"
                    ? "অফিসিয়াল ডিজিটাল অনুদান রসিদ (Official e-Receipt)"
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
                  <span className="text-slate-500">অনুদানের খাত (Fund):</span>
                  <span className="font-bold text-emerald-800">{submittedReceipt.fund_category}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">পদ্ধতি (Method):</span>
                  <span className="font-semibold text-slate-900">
                    {submittedReceipt.payment_method}{" "}
                    {submittedReceipt.is_gateway && "(ডিজিটাল গেটওয়ে)"}
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
                  <span className="text-slate-500">ভেরিফিকেশন স্ট্যাটাস:</span>
                  <span
                    className={`font-bold ${
                      submittedReceipt.status === "VERIFIED"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {submittedReceipt.status === "VERIFIED"
                      ? "ভেরিফাইড ও নিশ্চিত (Verified)"
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
                <div className="border-t border-slate-300 pt-1">ডিজিটাল ভেরিফিকেশন সিস্টেম</div>
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
                onClick={() => handleShareReceiptWhatsApp(submittedReceipt)}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp এ শেয়ার করুন</span>
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
                className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <span>আরেকটি অনুদান দিন</span>
              </button>
            </div>
          </div>
        ) : activeTab === "SEARCH" ? (
          /* TAB 3: SEARCH & VERIFY RECEIPT */
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                <span>অনলাইন অনুদান রসিদ যাচাই ও ডাউনলোড</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                আপনার অনুদানের রসিদ নম্বর (উদাঃ DON-2026-00001) বা ট্রানজেকশন আইডি (TrxID) দিয়ে খুঁজুন।
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) lookupReceipt(searchQuery.trim());
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                required
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="রসিদ নং (যেমন: DON-2026-00001) বা TrxID"
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                {searching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>খুঁজুন</span>
              </button>
            </form>

            {searchError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                {searchError}
              </div>
            )}

            {searchResult && (
              <div className="space-y-4 pt-2">
                <div
                  id="search-donation-receipt-sheet"
                  className="border-2 border-emerald-800/70 rounded-2xl p-6 bg-white space-y-4 text-xs text-slate-900 shadow-sm"
                >
                  <div className="text-center border-b border-emerald-300 pb-3">
                    <div className="text-xs font-serif font-bold text-slate-700">
                      بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                    </div>
                    <h3 className="font-bold text-base text-emerald-950 mt-1">{madrasaTitle}</h3>
                    {madrasaAddress && <p className="text-[10px] text-slate-500">{madrasaAddress}</p>}
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
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 mx-auto shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>রসিদ ডাউনলোড / প্রিন্ট করুন</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "GATEWAY" ? (
          /* TAB 1: DIRECT ONLINE GATEWAY */
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>সরাসরি অনলাইন পেমেন্ট গেটওয়ে</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  বিকাশ, নগদ, রকেট, কার্ড বা ইসলামী ব্যাংকের মাধ্যমে নিরাপদ ডিজিটাল পেমেন্ট করুন।
                </p>
              </div>

              <span className="self-start sm:self-auto px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                অটো ভেরিফাইড রসিদ
              </span>
            </div>

            {/* Official Channels Showcase with Brand Logos */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                সমর্থিত পেমেন্ট মাধ্যমসমূহ:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-2.5 rounded-xl border border-pink-200 bg-pink-50/40 flex items-center gap-2">
                  <PaymentBrandSymbol brand="bKash" size="sm" />
                  <span className="text-xs font-bold text-pink-900">বিকাশ</span>
                </div>
                <div className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/40 flex items-center gap-2">
                  <PaymentBrandSymbol brand="Nagad" size="sm" />
                  <span className="text-xs font-bold text-orange-900">নগদ</span>
                </div>
                <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/40 flex items-center gap-2">
                  <PaymentBrandSymbol brand="Rocket" size="sm" />
                  <span className="text-xs font-bold text-purple-900">রকেট</span>
                </div>
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center gap-2">
                  <PaymentBrandSymbol brand="Islami Bank" size="sm" />
                  <span className="text-xs font-bold text-emerald-900 truncate">ইসলামী ব্যাংক</span>
                </div>
                <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/40 flex items-center gap-2 col-span-2 sm:col-span-1">
                  <CardBrandsIcon />
                  <span className="text-xs font-bold text-blue-900">ভিসা / মাস্টারকার্ড</span>
                </div>
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
                  <label className="font-bold text-slate-700 block mb-1">
                    অনুদানের খাত (মাদ্রাসার সিস্টেম ফান্ড) *
                  </label>
                  <select
                    value={formData.fund_category}
                    onChange={(e) => setFormData({ ...formData, fund_category: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                  >
                    {activeFunds.map((f) => (
                      <option key={f.id || f.code || f.name} value={f.name}>
                        {f.name}
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
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
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
                <span>অনলাইন গেটওয়ে দিয়ে ৳ {toBanglaNumber(formData.amount)} দান করুন</span>
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

            {/* Accounts List with Official Logos & Badges */}
            <div className="space-y-3">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                মাদ্রাসার অফিসিয়াল অ্যাকাউন্টসমূহ:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* bKash */}
                <div className="p-3.5 bg-pink-50/60 border border-pink-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PaymentBrandSymbol brand="bKash" size="md" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-pink-900">বিকাশ</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-pink-200/80 text-pink-900 rounded">
                          {settings.bkash_type}
                        </span>
                      </div>
                      <p className="font-mono font-bold text-sm text-slate-900">
                        {settings.bkash_number}
                      </p>
                    </div>
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
                  <div className="flex items-center gap-3">
                    <PaymentBrandSymbol brand="Nagad" size="md" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-orange-900">নগদ</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-orange-200/80 text-orange-900 rounded">
                          {settings.nagad_type}
                        </span>
                      </div>
                      <p className="font-mono font-bold text-sm text-slate-900">
                        {settings.nagad_number}
                      </p>
                    </div>
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
                    <div className="flex items-center gap-3">
                      <PaymentBrandSymbol brand="Rocket" size="md" />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-purple-900">রকেট</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-200/80 text-purple-900 rounded">
                            {settings.rocket_type}
                          </span>
                        </div>
                        <p className="font-mono font-bold text-sm text-slate-900">
                          {settings.rocket_number}
                        </p>
                      </div>
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
                    <div className="flex items-center gap-2.5">
                      <PaymentBrandSymbol brand="Islami Bank" size="md" />
                      <div>
                        <span className="font-bold text-slate-900 text-xs">
                          {settings.bank_name} ({settings.bank_branch})
                        </span>
                        <p className="text-[11px] text-slate-500">
                          অ্যাকাউন্টের নাম: <strong className="text-slate-800">{settings.bank_account_name}</strong>
                        </p>
                      </div>
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
                      <span>{copiedAccount === "bank" ? "হিসাব নং কপি হয়েছে" : "হিসাব নং কপি"}</span>
                    </button>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 font-mono text-xs flex justify-between items-center">
                    <span className="text-slate-500 font-sans">হিসাব নম্বর:</span>
                    <strong className="text-emerald-950 text-sm font-bold tracking-wider">
                      {settings.bank_account_no}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Submission Form */}
            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs pt-2 border-t">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                টাকা পাঠানোর পর নিচের তথ্য পূরণ করুন:
              </h3>

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
                  <label className="font-bold text-slate-700 block mb-1">
                    অনুদানের খাত (মাদ্রাসার সিস্টেম ফান্ড) *
                  </label>
                  <select
                    value={formData.fund_category}
                    onChange={(e) => setFormData({ ...formData, fund_category: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                  >
                    {activeFunds.map((f) => (
                      <option key={f.id || f.code || f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">পেমেন্ট মাধ্যম *</label>
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
                    <option value="Bank">ব্যাংক ডিপোজিট</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">প্রেরিত টাকার পরিমাণ *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                      ৳
                    </span>
                    <input
                      type="number"
                      min="10"
                      required
                      placeholder="1000"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: Number(e.target.value) })
                      }
                      className="w-full pl-8 pr-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    ট্রানজেকশন আইডি (TrxID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ 9J83KL4M"
                    value={formData.trx_id}
                    onChange={(e) => setFormData({ ...formData, trx_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono uppercase font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500/20"
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

      {/* Real Interactive Payment Gateway Modal */}
      {showGatewayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50">
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
                    প্রোভাইডার: {settings.gateway_provider || "SSLCOMMERZ / MFS Direct"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGatewayModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-lg"
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
                <span className="text-slate-500">অনুদানের খাত:</span>
                <span className="font-semibold text-emerald-800">{formData.fund_category}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-emerald-900 text-base">
                <span>মোট প্রদেয়:</span>
                <span>৳ {toBanglaNumber(formData.amount)}</span>
              </div>
            </div>

            {/* Step 1: Channel Selection with Authentic Brand Badges */}
            {gatewayStep === "CHANNEL" ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  পেমেন্ট মাধ্যম বেছে নিন:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "bKash", brand: "bKash" as const, title: "বিকাশ (bKash)" },
                    { id: "Nagad", brand: "Nagad" as const, title: "নগদ (Nagad)" },
                    { id: "Rocket", brand: "Rocket" as const, title: "রকেট (Rocket)" },
                    { id: "Islami Bank", brand: "Islami Bank" as const, title: "ইসলামী ব্যাংক" },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedGatewayChannel(ch.id as any)}
                      className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
                        selectedGatewayChannel === ch.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <PaymentBrandSymbol brand={ch.brand} size="md" />
                      <span className="truncate">{ch.title}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setSelectedGatewayChannel("Card")}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all col-span-2 ${
                      selectedGatewayChannel === "Card"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <CardBrandsIcon />
                    <span>ভিসা, মাস্টারকার্ড ও অন্যান্য গেটওয়ে চ্যানেল</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setGatewayStep("VERIFY")}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>{selectedGatewayChannel}-এর মাধ্যমে অগ্রসর হন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Channel-Specific Payment Authentication */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl">
                  <PaymentBrandSymbol
                    brand={
                      selectedGatewayChannel === "bKash" ? "bKash"
                      : selectedGatewayChannel === "Nagad" ? "Nagad"
                      : selectedGatewayChannel === "Rocket" ? "Rocket"
                      : selectedGatewayChannel === "Islami Bank" ? "Islami Bank"
                      : "SSLCommerz"
                    }
                    size="md"
                  />
                  <div>
                    <strong className="text-xs text-slate-900 block font-bold">
                      {selectedGatewayChannel} সুরক্ষিত পেমেন্ট গেটওয়ে
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      মোট প্রদেয়: ৳ {toBanglaNumber(formData.amount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {selectedGatewayChannel === "Islami Bank" ? "অ্যাকাউন্ট / সেলফিন নম্বর" : `${selectedGatewayChannel} অ্যাকাউন্ট নম্বর`}
                    </label>
                    <input
                      type="tel"
                      value={gatewayPayerNumber}
                      onChange={(e) => setGatewayPayerNumber(e.target.value)}
                      placeholder="01700-000000"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      পেমেন্ট নিশ্চিত করলে স্বয়ংক্রিয়ভাবে ব্যাংক/MFS গেটওয়ে থেকে অর্থ জমা হবে এবং তাৎক্ষণিক ভেরিফাইড ডিজিটাল রসিদ ইস্যু হবে।
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGatewayStep("CHANNEL")}
                    className="py-2.5 px-4 border rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50"
                  >
                    পেছনে যান
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
                        <span>প্রক্রিয়াকরণ ও রসিদ তৈরি হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>৳ {toBanglaNumber(formData.amount)} পরিশোধ সম্পন্ন করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
