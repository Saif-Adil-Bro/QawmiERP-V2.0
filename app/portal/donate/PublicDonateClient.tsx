"use client";

import { useState } from "react";
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
  Wallet
} from "lucide-react";
import { submitOnlineDonation } from "@/app/actions/fundraising";
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

export default function PublicDonateClient({
  madrasaInfo,
  paymentGatewayConfig,
}: {
  madrasaInfo?: any;
  paymentGatewayConfig?: any;
}) {
  const [formData, setFormData] = useState({
    donor_name: "",
    phone: "",
    email: "",
    amount: 1000,
    fund_category: "লিল্লাহ বোর্ডিং ও এতিমখানা",
    payment_method: "bKash" as "bKash" | "Nagad" | "Rocket" | "Bank" | "Other",
    trx_id: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<any | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(id);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.donor_name || !formData.phone || !formData.amount) {
      alert("অনুগ্রহ করে আপনার নাম, মোবাইল ও দানের পরিমাণ উল্লেখ করুন");
      return;
    }

    setLoading(true);
    try {
      const res = await submitOnlineDonation(formData);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }

      setSubmittedReceipt({
        ...formData,
        receipt_no: res.receipt_no,
        donation_date: new Date().toISOString().split("T")[0],
      });
    } catch (err) {
      alert("সাবমিট করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Gateway and Madrasa Accounts
  const bkashNumber =
    paymentGatewayConfig?.bkash?.merchant_number ||
    paymentGatewayConfig?.bkash_number ||
    madrasaInfo?.bkash_number ||
    madrasaInfo?.phone ||
    "01700000000";

  const nagadNumber =
    paymentGatewayConfig?.nagad?.merchant_number ||
    paymentGatewayConfig?.nagad_number ||
    madrasaInfo?.nagad_number ||
    "01800000000";

  const rocketNumber =
    paymentGatewayConfig?.rocket?.merchant_number ||
    paymentGatewayConfig?.rocket_number ||
    madrasaInfo?.rocket_number ||
    "01900000000";

  const bankInfo = {
    bankName:
      paymentGatewayConfig?.islami_bank?.branch_name ||
      madrasaInfo?.bank_name ||
      "ইসলামী ব্যাংক বাংলাদেশ পিএলসি",
    accName:
      paymentGatewayConfig?.islami_bank?.account_title ||
      madrasaInfo?.bank_account_name ||
      madrasaInfo?.name ||
      "মারকাযুল উলুম ইসলামিয়া কওমি মাদ্রাসা",
    accNo:
      paymentGatewayConfig?.islami_bank?.account_no ||
      madrasaInfo?.bank_account_no ||
      "20501234567890",
    routing:
      paymentGatewayConfig?.islami_bank?.routing_no ||
      madrasaInfo?.bank_routing_no ||
      "125272654",
  };

  const madrasaTitle = madrasaInfo?.name || "মারকাযুল উলুম ইসলামিয়া কওমি মাদ্রাসা";
  const madrasaAddress = madrasaInfo?.address || "ঢাকা, বাংলাদেশ";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold mb-1">
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
            লিল্লাহ বোর্ডিং এর এতিম-অসহায় তালেবে ইলমদের খোরাকি, হিফজুল কুরআন ও মাদ্রাসার সার্বিক উন্নয়নে আপনার পবিত্র দান/সাদকাহ প্রদান করুন।
          </p>
        </div>

        {submittedReceipt ? (
          /* Success Receipt Card */
          <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-xl space-y-6 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">জাযাকাল্লাহু খাইরান! আপনার দান গৃহীত হয়েছে</h2>
              <p className="text-xs text-slate-500 font-medium">
                আল্লাহ তায়ালা আপনার এই নেক আমল ও দানকে কবুল করুন এবং দুনিয়া-আখিরাতে উত্তম প্রতিদান দান করুন।
              </p>
            </div>

            {/* Official Digital Money Receipt Printable Sheet */}
            <div
              id="public-donation-receipt-sheet"
              className="border-2 border-emerald-700/60 rounded-2xl p-6 bg-white space-y-4 text-xs text-slate-900 shadow-sm"
            >
              <div className="text-center border-b border-emerald-300 pb-3">
                <div className="text-xs font-serif font-bold text-slate-700">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
                <h3 className="font-bold text-base text-emerald-950 mt-1">{madrasaTitle}</h3>
                {madrasaAddress && <p className="text-[10px] text-slate-500">{madrasaAddress}</p>}
                <div className="mt-2 inline-block px-3 py-0.5 bg-emerald-800 text-white font-bold text-[10px] rounded-full uppercase tracking-wider">
                  অফিসিয়াল ডিজিটাল অনুদান রসিদ
                </div>
                <p className="font-mono text-emerald-800 text-xs font-bold mt-1">
                  রসিদ নং: {submittedReceipt.receipt_no}
                </p>
              </div>

              <div className="space-y-2 text-slate-700">
                <div className="flex justify-between">
                  <span>দাতার নাম:</span>
                  <span className="font-bold text-slate-900">{submittedReceipt.donor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>মোবাইল নম্বর:</span>
                  <span className="font-mono">{submittedReceipt.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span>অনুদানের খাত:</span>
                  <span className="font-semibold text-emerald-800">{submittedReceipt.fund_category}</span>
                </div>
                <div className="flex justify-between">
                  <span>পেমেন্ট মাধ্যম:</span>
                  <span>{submittedReceipt.payment_method}</span>
                </div>
                {submittedReceipt.trx_id && (
                  <div className="flex justify-between">
                    <span>ট্রানজেকশন আইডি (TrxID):</span>
                    <span className="font-mono font-bold">{submittedReceipt.trx_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>তারিখ:</span>
                  <span>{toBanglaNumber(submittedReceipt.donation_date)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-emerald-200 font-bold text-emerald-900 text-base">
                  <span>মোট অনুদান:</span>
                  <span>৳ {toBanglaNumber(submittedReceipt.amount)} ({numberToBanglaWords(submittedReceipt.amount)})</span>
                </div>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-600 border-t border-slate-200 mt-4">
                <div>হিসাব ও অনুদান শাখা</div>
                <div className="font-bold">মুহতামিম / অর্থ সম্পাদক</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
              <button
                onClick={() =>
                  printElementIsolated(
                    "public-donation-receipt-sheet",
                    `ডিজিটাল মানি রিসিট - ${submittedReceipt.receipt_no}`
                  )
                }
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>রসিদ প্রিন্ট বা সংরক্ষণ করুন</span>
              </button>
              <button
                onClick={() => setSubmittedReceipt(null)}
                className="w-full sm:w-auto px-6 py-2.5 border border-slate-300 font-bold rounded-xl text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                নতুন দান পাঠান
              </button>
            </div>
          </div>
        ) : (
          /* Payment Info & Form */
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Accounts Information (Left 2 cols) */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>অফিসিয়াল একাউন্ট নম্বরসমূহ</span>
                </h3>

                {/* bKash */}
                <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-pink-700">বিকাশ (মার্চেন্ট / পার্সোনাল)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(bkashNumber, "bkash")}
                      className="text-pink-600 hover:text-pink-800"
                    >
                      {copiedAccount === "bkash" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="font-mono font-bold text-slate-800 text-sm">{bkashNumber}</p>
                  <p className="text-[10px] text-slate-500">Send Money / Make Payment</p>
                </div>

                {/* Nagad */}
                <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-orange-700">নগদ (পার্সোনাল)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(nagadNumber, "nagad")}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      {copiedAccount === "nagad" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="font-mono font-bold text-slate-800 text-sm">{nagadNumber}</p>
                  <p className="text-[10px] text-slate-500">Send Money</p>
                </div>

                {/* Rocket (if available) */}
                {rocketNumber && (
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-purple-700">রকেট (Rocket)</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(rocketNumber, "rocket")}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        {copiedAccount === "rocket" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="font-mono font-bold text-slate-800 text-sm">{rocketNumber}</p>
                  </div>
                )}

                {/* Bank */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-800">ব্যাংক একাউন্ট</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(bankInfo.accNo, "bank")}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {copiedAccount === "bank" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="font-bold text-slate-800">{bankInfo.bankName}</p>
                  <p className="font-mono text-xs font-semibold text-slate-700">A/C: {bankInfo.accNo}</p>
                  <p className="text-[10px] text-slate-500">{bankInfo.accName}</p>
                </div>
              </div>

              <div className="bg-emerald-800 text-white p-4 rounded-2xl text-xs space-y-2 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>নিরাপদ ও স্বচ্ছ হিসাব</span>
                </div>
                <p className="text-emerald-100 text-[11px] leading-relaxed">
                  আপনার পাঠানো প্রতিটি অনুদানের টাকা সরাসরি মাদ্রাসার কেন্দ্রীয় সার্ভারে নিবন্ধিত হয় এবং স্বয়ংক্রিয় ডিজিটাল রসিদ ইস্যু করা হয়।
                </p>
              </div>
            </div>

            {/* Donation Submit Form (Right 3 cols) */}
            <div className="md:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-base pb-2 border-b border-slate-100">
                অনুদান প্রেরণের তথ্য ফরম
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    আপনার পূর্ণ নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: হাজী আব্দুল কাদের"
                    value={formData.donor_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, donor_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">
                      মোবাইল নম্বর <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="017XXXXXXXX"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">ইমেইল (ঐচ্ছিক)</label>
                    <input
                      type="email"
                      placeholder="example@mail.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">
                      দানের পরিমাণ (টাকা) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">অনুদানের খাত</label>
                    <select
                      value={formData.fund_category}
                      onChange={(e) => setFormData(prev => ({ ...prev, fund_category: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="লিল্লাহ বোর্ডিং ও এতিমখানা">লিল্লাহ বোর্ডিং ও এতিমখানা</option>
                      <option value="সাধারণ অনুদান">সাধারণ অনুদান</option>
                      <option value="মসজিদ ও ভবন নির্মাণ ফান্ড">মসজিদ ও ভবন নির্মাণ ফান্ড</option>
                      <option value="যাকাত ও ফিতরা তহবিল">যাকাত ও ফিতরা তহবিল</option>
                      <option value="হিফজুল কুরআন স্পন্সরশিপ">হিফজুল কুরআন স্পন্সরশিপ</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">পেমেন্ট মেথড</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="bKash">বিকাশ (bKash)</option>
                      <option value="Nagad">নগদ (Nagad)</option>
                      <option value="Rocket">রকেট (Rocket)</option>
                      <option value="Bank">ব্যাংক ট্রান্সফার</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">ট্রানজেকশন আইডি (TrxID)</label>
                    <input
                      type="text"
                      placeholder="যেমন: 9J7X4K2P"
                      value={formData.trx_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, trx_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">দোয়া ও বিশেষ মন্তব্য (ঐচ্ছিক)</label>
                  <textarea
                    rows={2}
                    placeholder="মৃত পিতা-মাতার ঈসালে সাওয়াব বা দোয়ার আবেদন..."
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? "সাবমিট হচ্ছে..." : "অনুদানের তথ্য সাবমিট ও রসিদ গ্রহণ করুন"}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

