"use client";

import { useState } from "react";
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
  User,
  Phone,
  Copy,
  Check,
  Sparkles
} from "lucide-react";
import { OnlineDonation } from "@/lib/fundraising-types";
import { updateDonationStatus } from "@/app/actions/fundraising";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

export default function OnlineDonationsClient({
  initialDonations,
}: {
  initialDonations: OnlineDonation[];
}) {
  const router = useRouter();
  const [donations, setDonations] = useState<OnlineDonation[]>(initialDonations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDonationForReceipt, setSelectedDonationForReceipt] = useState<OnlineDonation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredDonations = donations.filter((d) => {
    const matchesSearch =
      (d.donor_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.phone || "").includes(search) ||
      (d.trx_id && d.trx_id.toLowerCase().includes(search.toLowerCase())) ||
      (d.receipt_no || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalVerified = donations
    .filter((d) => d.status === "VERIFIED")
    .reduce((acc, d) => acc + (d.amount || 0), 0);

  const pendingCount = donations.filter((d) => d.status === "PENDING").length;

  const handleStatusChange = async (id: string, status: "VERIFIED" | "REJECTED") => {
    try {
      const res = await updateDonationStatus(id, status);
      if (res.error) {
        alert(res.error);
        return;
      }
      setDonations((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status, verified_at: new Date().toISOString() } : d))
      );
      router.refresh();
    } catch (err) {
      alert("স্ট্যাটাস পরিবর্তনে সমস্যা হয়েছে");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200/60">
              <Wallet className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              অনলাইন ডোনেশন ও ডিজিটাল রসিদ ভেরিফিকেশন
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            বিকাশ, নগদ, রকেট ও ব্যাংক একাউন্টে আসা অনুদানের TrxID যাচাই ও ডিজিটাল মানি রিসিট ইস্যু।
          </p>
        </div>

        <a
          href="/portal/donate"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          <span>পাবলিক ডোনেশন পেজ দেখুন</span>
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">অনলাইন অনুদান সংখ্যা</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(donations.length)} টি
          </span>
          <span className="text-[11px] text-slate-400">দেশ-বিদেশ থেকে প্রাপ্ত</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">অপেক্ষমান যাচাই (Pending)</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {toBanglaNumber(pendingCount)} টি
          </span>
          <span className="text-[11px] text-amber-700 font-medium">TrxID যাচাই বাকি</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">মোট ভেরিফাইড জমা</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(totalVerified)}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">তহবিলে সফলভাবে জমা</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">পেমেন্ট গেটওয়ে সুবিধা</span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">
            bKash, Nagad, Rocket, Bank
          </span>
          <span className="text-[11px] text-slate-400">স্বয়ংক্রিয় রসিদ তৈরি</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="দাতার নাম, মোবাইল, TrxID বা রসিদ নং..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "PENDING", "VERIFIED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                statusFilter === st
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "সকল" : st === "PENDING" ? "অপেক্ষমান" : st === "VERIFIED" ? "ভেরিফাইড" : "বাতিল"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filteredDonations.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
          <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-bold text-sm text-slate-600">কোনো অনলাইন অনুদানের রেকর্ড নেই</p>
          <p className="text-xs mt-1">পাবলিক ডোনেশন পেজ থেকে অনুদান জমা হলে এখানে প্রদর্শিত হবে।</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">রসিদ নং</th>
                  <th className="py-3 px-4">দাতার নাম ও মোবাইল</th>
                  <th className="py-3 px-4">ফান্ড / খাত</th>
                  <th className="py-3 px-4">পদ্ধতি ও TrxID</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4">টাকার পরিমাণ</th>
                  <th className="py-3 px-4">স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-right">যাচাই ও অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonations.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{d.receipt_no}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{d.donor_name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{d.phone}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                        {d.fund_category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">{d.payment_method}</span>
                      {d.trx_id ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-500">{d.trx_id}</span>
                          <button
                            onClick={() => handleCopy(d.trx_id, d.id)}
                            className="text-slate-400 hover:text-slate-600"
                            title="কপি করুন"
                          >
                            {copiedId === d.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{toBanglaNumber(d.donation_date)}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700 text-sm">
                      ৳ {toBanglaNumber(d.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" :
                        d.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {d.status === "VERIFIED" ? "ভেরিফাইড" :
                         d.status === "REJECTED" ? "বাতিল" : "অপেক্ষমান"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {d.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(d.id, "VERIFIED")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px]"
                            >
                              অনুমোদন
                            </button>
                            <button
                              onClick={() => handleStatusChange(d.id, "REJECTED")}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[11px]"
                            >
                              বাতিল
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setSelectedDonationForReceipt(d)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                          title="মানি রিসিট"
                        >
                          <Printer className="w-3.5 h-3.5" />
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

      {/* Digital Receipt Modal */}
      {selectedDonationForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm">ডিজিটাল মানি রিসিট (Digital Receipt)</h3>
              <button onClick={() => setSelectedDonationForReceipt(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="border border-emerald-300 rounded-xl p-6 bg-emerald-50/20 space-y-4 text-xs">
              <div className="text-center border-b border-emerald-200 pb-3">
                <div className="inline-flex items-center gap-1 text-emerald-800 font-bold text-xs bg-emerald-100 px-2 py-0.5 rounded-full mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>অফিসিয়াল ডিজিটাল ভেরিফাইড রসিদ</span>
                </div>
                <h4 className="font-bold text-slate-900 text-lg">অনুদান প্রাপ্তির রশিদ</h4>
                <p className="text-[10px] text-slate-500 font-mono">রসিদ নং: {selectedDonationForReceipt.receipt_no}</p>
              </div>

              <div className="space-y-2 text-slate-700 text-xs">
                <div className="flex justify-between">
                  <span>দাতার নাম:</span>
                  <span className="font-bold text-slate-900">{selectedDonationForReceipt.donor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>মোবাইল নম্বর:</span>
                  <span className="font-mono">{selectedDonationForReceipt.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span>অনুদানের খাত:</span>
                  <span className="font-semibold text-emerald-800">{selectedDonationForReceipt.fund_category}</span>
                </div>
                <div className="flex justify-between">
                  <span>পেমেন্ট মেথড:</span>
                  <span>{selectedDonationForReceipt.payment_method}</span>
                </div>
                {selectedDonationForReceipt.trx_id && (
                  <div className="flex justify-between">
                    <span>ট্রানজেকশন আইডি (TrxID):</span>
                    <span className="font-mono font-bold">{selectedDonationForReceipt.trx_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>তারিখ:</span>
                  <span>{toBanglaNumber(selectedDonationForReceipt.donation_date)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-emerald-200 font-bold text-emerald-900 text-base">
                  <span>গৃহীত টাকার পরিমাণ:</span>
                  <span>৳ {toBanglaNumber(selectedDonationForReceipt.amount)}</span>
                </div>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-6 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">অনলাইন অটো জেনারেটেড</div>
                <div className="border-t border-slate-300 pt-1">মুহতামিম / অর্থ সম্পাদক</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedDonationForReceipt(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 text-xs"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
