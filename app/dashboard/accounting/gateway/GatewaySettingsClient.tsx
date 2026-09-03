"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Building2,
  Smartphone,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Globe,
  RefreshCw,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  History,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import type {
  PaymentGatewayConfig,
  PaymentGatewayProvider,
  GatewayEnvironment,
  OnlinePaymentTransaction,
} from "@/lib/payment-gateway";
import { savePaymentGatewayConfig } from "@/app/actions/payment-gateway";
import OnlinePaymentCheckoutModal from "@/components/payments/OnlinePaymentCheckoutModal";

interface Props {
  initialConfig: PaymentGatewayConfig;
  recentTransactions: OnlinePaymentTransaction[];
  sampleStudent?: any;
}

export default function GatewaySettingsClient({
  initialConfig,
  recentTransactions,
  sampleStudent,
}: Props) {
  const [config, setConfig] = useState<PaymentGatewayConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [showSecret, setShowSecret] = useState(false);
  const [activeTab, setActiveTab] = useState<"SETTINGS" | "CHANNELS" | "ISLAMI_BANK" | "HISTORY">("SETTINGS");

  // Test Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setAlert(null);
    try {
      const res = await savePaymentGatewayConfig(config);
      if (res.error) {
        setAlert({ type: "error", text: res.error });
      } else {
        setAlert({
          type: "success",
          text: res.message || "গেটওয়ে কনফিগারেশন সফলভাবে সেভ হয়েছে!",
        });
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        text: err.message || "কনফিগারেশন সংরক্ষণে ত্রুটি দেখা দিয়েছে।",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
              অটোমেটেড পেমেন্ট ইঞ্জিন
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">
            অনলাইন পেমেন্ট গেটওয়ে কনফিগারেশন
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            বিকাশ, নগদ, রকেট ও ইসলামী ব্যাংক (IBBL) সহ সকল ডিজিটাল মাধ্যমে শিক্ষার্থীদের মাসিক ফি ও বকেয়া সরাসরি আদায়ের স্বয়ংক্রিয় গেটওয়ে সংযোগ।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs sm:text-sm border border-white/20 flex items-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>পেমেন্ট গেটওয়ে টেস্ট করুন</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "সংরক্ষণ হচ্ছে..." : "কনফিগারেশন সেভ করুন"}</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-in fade-in ${
            alert.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alert.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{alert.text}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Status KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">গেটওয়ে স্ট্যাটাস</div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-3 h-3 rounded-full ${
                config.is_enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
              }`}
            />
            <span className="text-lg font-bold text-slate-800">
              {config.is_enabled ? "সক্রিয় (Active)" : "স্থগিত (Inactive)"}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            অভিভাবকরা অনলাইনে ফি দিতে পারবেন
          </span>
        </div>

        {/* Environment */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">বর্তমান মোড (Environment)</div>
          <div className="text-lg font-bold text-slate-800 mt-1 flex items-center gap-1.5">
            {config.environment === "LIVE" ? (
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                LIVE PRODUCTION
              </span>
            ) : (
              <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                SANDBOX / DEMO
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {config.environment === "LIVE" ? "আসল টাকার লেনদেন" : "টেস্টিং ও ডেমো ট্রানজেকশন"}
          </span>
        </div>

        {/* Active Provider */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">প্রধান প্রোভাইডার</div>
          <div className="text-lg font-bold text-indigo-700 mt-1 font-mono">
            {config.active_provider}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            বিকাশ, নগদ ও আইবিবিএল ইন্টিগ্রেটেড
          </span>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">মোট অনলাইন ট্রানজেকশন</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {toBanglaNumber(recentTransactions.length)} টি
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
            সরাসরি ডেটাবেজে সংরক্ষিত
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab("SETTINGS")}
          className={`pb-3 border-b-2 transition whitespace-nowrap ${
            activeTab === "SETTINGS"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          গেটওয়ে প্রোভাইডার ও ক্রেডেনশিয়াল
        </button>

        <button
          onClick={() => setActiveTab("ISLAMI_BANK")}
          className={`pb-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "ISLAMI_BANK"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>ইসলামী ব্যাংক (IBBL) অ্যাকাউন্ট</span>
        </button>

        <button
          onClick={() => setActiveTab("CHANNELS")}
          className={`pb-3 border-b-2 transition whitespace-nowrap ${
            activeTab === "CHANNELS"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          পেমেন্ট মেথড চ্যানেল (বিকাশ / নগদ / কার্ড)
        </button>

        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`pb-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "HISTORY"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4 text-slate-500" />
          <span>অনলাইন ট্রানজেকশন লগ ({toBanglaNumber(recentTransactions.length)})</span>
        </button>
      </div>

      {/* TAB 1: PROVIDER SETTINGS */}
      {activeTab === "SETTINGS" && (
        <div className="space-y-6">
          {/* Main Activation & Provider Selector */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h3 className="font-bold text-slate-900 text-base">অনলাইন পেমেন্ট সক্রিয়তা</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  চালু থাকলে অভিভাবকরা পোর্টালে সরাসরি বিকাশ, নগদ ও ইসলামী ব্যাংকের মাধ্যমে ফি দিতে পারবেন।
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, is_enabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-bold text-slate-800">
                  {config.is_enabled ? "চালু রয়েছে" : "বন্ধ রয়েছে"}
                </span>
              </label>
            </div>

            {/* Provider Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                পেমেন্ট গেটওয়ে প্রোভাইডার নির্বাচন করুন:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* SSLCommerz */}
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, active_provider: "SSLCOMMERZ" }))
                  }
                  className={`p-4 rounded-2xl border text-left transition relative ${
                    config.active_provider === "SSLCOMMERZ"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900">SSLCommerz</span>
                    {config.active_provider === "SSLCOMMERZ" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    বাংলাদেশের সবচেয়ে বড় গেটওয়ে। বিকাশ, নগদ, রকেট, ইসলামী ব্যাংক, কার্ড এক ছাদের নিচে।
                  </p>
                  <span className="mt-2.5 inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                    ★ সর্বাধিক ব্যবহৃত
                  </span>
                </button>

                {/* ShurjoPay */}
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, active_provider: "SHURJOPAY" }))
                  }
                  className={`p-4 rounded-2xl border text-left transition relative ${
                    config.active_provider === "SHURJOPAY"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900">ShurjoPay</span>
                    {config.active_provider === "SHURJOPAY" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    বাংলাদেশ ব্যাংকের পিএসও অনুমোদিত। মোবাইল ব্যাংকিং ও ইসলামিক ব্যাংকিংয়ের জন্য উপযুক্ত।
                  </p>
                </button>

                {/* bKash Checkout */}
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, active_provider: "BKASH_CHECKOUT" }))
                  }
                  className={`p-4 rounded-2xl border text-left transition relative ${
                    config.active_provider === "BKASH_CHECKOUT"
                      ? "border-[#D12053] bg-pink-50/50 shadow-sm ring-2 ring-[#D12053]/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900">bKash Direct</span>
                    {config.active_provider === "BKASH_CHECKOUT" && (
                      <CheckCircle2 className="w-4 h-4 text-[#D12053]" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    মাদরাসার নিজস্ব বিকাশ মার্চেন্ট একাউন্টের অফিসিয়াল পিজিডব্লিউ এপিআই।
                  </p>
                </button>

                {/* Direct Islami Bank */}
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, active_provider: "DIRECT_ISLAMI_BANK" }))
                  }
                  className={`p-4 rounded-2xl border text-left transition relative ${
                    config.active_provider === "DIRECT_ISLAMI_BANK"
                      ? "border-emerald-700 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-700/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900">আইবিবিএল ডিরেক্ট</span>
                    {config.active_provider === "DIRECT_ISLAMI_BANK" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ইসলামী ব্যাংক বাংলাদেশ (CellFin / iBanking) সরাসরি একাউন্ট সংযোগ।
                  </p>
                </button>
              </div>
            </div>

            {/* Mode: Sandbox vs Live */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-800 block">এনভায়রনমেন্ট মোড:</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  টেস্টিংয়ের সময় Sandbox মোড ব্যবহার করুন। রিয়েল পেমেন্টের জন্য Live নির্বাচন করুন।
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, environment: "SANDBOX", sandbox_test_mode: true }))
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    config.environment === "SANDBOX"
                      ? "bg-amber-500 text-slate-950 shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  Sandbox (ডেমো টেস্টিং)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, environment: "LIVE", sandbox_test_mode: false }))
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    config.environment === "LIVE"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  Live Production (বাস্তব পেমেন্ট)
                </button>
              </div>
            </div>
          </div>

          {/* Provider Credentials Form (SSLCommerz) */}
          {config.active_provider === "SSLCOMMERZ" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  SSLCommerz API ক্রেডেনশিয়াল
                </h3>
                <span className="text-xs text-slate-400">Merchant Settings</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Store ID (স্টোর আইডি):
                  </label>
                  <input
                    type="text"
                    value={config.sslcommerz.store_id}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        sslcommerz: { ...prev.sslcommerz, store_id: e.target.value },
                      }))
                    }
                    placeholder="e.g. jamia_islamia_live"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Store Password / Secret Key:
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={config.sslcommerz.store_passwd}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sslcommerz: { ...prev.sslcommerz, store_passwd: e.target.value },
                        }))
                      }
                      placeholder="••••••••••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Provider Credentials Form (bKash) */}
          {config.active_provider === "BKASH_CHECKOUT" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  bKash PGW API Credentials
                </h3>
                <span className="text-xs text-slate-400">bKash Merchant Panel</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">App Key:</label>
                  <input
                    type="text"
                    value={config.bkash.app_key}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        bkash: { ...prev.bkash, app_key: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">App Secret:</label>
                  <input
                    type={showSecret ? "text" : "password"}
                    value={config.bkash.app_secret}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        bkash: { ...prev.bkash, app_secret: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ISLAMI BANK CONFIGURATION */}
      {activeTab === "ISLAMI_BANK" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                ইসলামী ব্যাংক বাংলাদেশ (IBBL) অ্যাকাউন্ট তথ্য
              </h3>
              <p className="text-xs text-slate-500">
                অভিভাবকরা সরাসরি সেলফিন (CellFin) বা ইন্টারনেট ব্যাংকিংয়ের মাধ্যমে এই অ্যাকাউন্টে ফি পাঠাতে পারবেন।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                হিসাবের শিরোনাম (Account Name):
              </label>
              <input
                type="text"
                value={config.islami_bank.account_name}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    islami_bank: { ...prev.islami_bank, account_name: e.target.value },
                  }))
                }
                placeholder="মাদরাসার অফিশিয়াল নাম"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                ১৭-ডিজিট অ্যাকাউন্ট নম্বর (Account No):
              </label>
              <input
                type="text"
                value={config.islami_bank.account_number}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    islami_bank: { ...prev.islami_bank, account_number: e.target.value },
                  }))
                }
                placeholder="20501450200XXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                শাখা (Branch Name):
              </label>
              <input
                type="text"
                value={config.islami_bank.branch_name}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    islami_bank: { ...prev.islami_bank, branch_name: e.target.value },
                  }))
                }
                placeholder="e.g. মিরপুর শাখা, ঢাকা"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                রাউটিং নম্বর (Routing No):
              </label>
              <input
                type="text"
                value={config.islami_bank.routing_number || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    islami_bank: { ...prev.islami_bank, routing_number: e.target.value },
                  }))
                }
                placeholder="125262728"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                মাদরাসার সেলফিন নম্বর (CellFin Number / Optional):
              </label>
              <input
                type="text"
                value={config.islami_bank.cellfin_number || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    islami_bank: { ...prev.islami_bank, cellfin_number: e.target.value },
                  }))
                }
                placeholder="01XXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                অভিভাবকদের জন্য বিশেষ নির্দেশনা:
              </label>
              <textarea
                rows={2}
                value={config.islami_bank.instructions || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    islami_bank: { ...prev.islami_bank, instructions: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CHANNELS ENABLE/DISABLE */}
      {activeTab === "CHANNELS" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              পেমেন্ট মাধ্যম সক্রিয়করণ (Channel Management)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              অভিভাবকদের জন্য কোন কোন মাধ্যম প্রদর্শিত হবে তা নির্ধারণ করুন:
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* bKash */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-pink-300 transition">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#D12053] text-white flex items-center justify-center font-black text-xs">
                  bK
                </span>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">বিকাশ (bKash)</span>
                  <span className="text-slate-500 text-[11px]">১-ক্লিক অটো অনলাইন ফি কালেকশন</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enabled_methods.bkash}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    enabled_methods: { ...prev.enabled_methods, bkash: e.target.checked },
                  }))
                }
                className="w-5 h-5 text-pink-600 rounded"
              />
            </div>

            {/* Nagad */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-orange-300 transition">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#EA1D25] text-white flex items-center justify-center font-black text-xs">
                  নগ
                </span>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">নগদ (Nagad)</span>
                  <span className="text-slate-500 text-[11px]">ইনস্ট্যান্ট পেমেন্ট গেটওয়ে</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enabled_methods.nagad}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    enabled_methods: { ...prev.enabled_methods, nagad: e.target.checked },
                  }))
                }
                className="w-5 h-5 text-orange-600 rounded"
              />
            </div>

            {/* Islami Bank */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-300 transition">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs">
                  IB
                </span>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">
                    ইসলামী ব্যাংক বাংলাদেশ (IBBL / CellFin)
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    ইন্টারনেট ব্যাংকিং ও সেলফিন অ্যাকাউন্ট
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enabled_methods.islami_bank}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    enabled_methods: { ...prev.enabled_methods, islami_bank: e.target.checked },
                  }))
                }
                className="w-5 h-5 text-emerald-600 rounded"
              />
            </div>

            {/* Rocket */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-purple-300 transition">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#8C3494] text-white flex items-center justify-center font-black text-xs">
                  র
                </span>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">রকেট (Rocket)</span>
                  <span className="text-slate-500 text-[11px]">ডিবিবিএল রকেট অ্যাকাউন্ট</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enabled_methods.rocket}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    enabled_methods: { ...prev.enabled_methods, rocket: e.target.checked },
                  }))
                }
                className="w-5 h-5 text-purple-600 rounded"
              />
            </div>

            {/* Cards */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 transition">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-700 text-white flex items-center justify-center font-black text-xs">
                  Card
                </span>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">
                    ভিসা, মাস্টারকার্ড ও অন্যান্য কার্ড
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    সকল ব্যাংকের ডেবিট/ক্রেডিট কার্ড
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enabled_methods.cards}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    enabled_methods: { ...prev.enabled_methods, cards: e.target.checked },
                  }))
                }
                className="w-5 h-5 text-blue-600 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSACTION HISTORY LOG */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                অনলাইন পেমেন্ট ট্রানজেকশন তালিকা
              </h3>
              <p className="text-xs text-slate-500">
                অভিভাবকদের মাধ্যমে সম্পাদিত সকল ডিজিটাল ফি পেমেন্ট হিস্ট্রি
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3.5">ট্রানজেকশন আইডি</th>
                  <th className="px-4 py-3.5">শিক্ষার্থী</th>
                  <th className="px-4 py-3.5">মাধ্যম</th>
                  <th className="px-4 py-3.5 text-right">টাকার পরিমাণ</th>
                  <th className="px-4 py-3.5">রসিদ নং</th>
                  <th className="px-4 py-3.5 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {t.transaction_id}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {t.created_at.split("T")[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{t.student_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {t.class_name} {t.student_roll ? `(রোল: ${toBanglaNumber(t.student_roll)})` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                          {t.payment_channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800 text-sm">
                        ৳ {formatBanglaCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        {t.receipt_no || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            t.status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "PENDING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.status === "SUCCESS"
                            ? "সফল"
                            : t.status === "PENDING"
                            ? "অপেক্ষমান"
                            : "ব্যর্থ"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      কোন অনলাইন পেমেন্ট ট্রানজেকশন এখনও সম্পন্ন হয়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Checkout Modal Dialog */}
      <OnlinePaymentCheckoutModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        studentId={sampleStudent?.id || "test_student_1"}
        studentName={sampleStudent?.name || "মুহাম্মাদ আব্দুল্লাহ (টেস্ট শিক্ষার্থী)"}
        studentRoll={sampleStudent?.roll || "১"}
        className={sampleStudent?.className || "হিফজুল কুরআন জামাত"}
        totalDue={2500}
        unpaidFees={[
          {
            id: "fee_test_1",
            fee_type_name: "মাসিক বেতন",
            billing_period: "শাওয়াল ১৪৪৭",
            due_amount: 1500,
          },
          {
            id: "fee_test_2",
            fee_type_name: "খোরাকি ফি (বোর্ডিং)",
            billing_period: "শাওয়াল ১৪৪৭",
            due_amount: 1000,
          },
        ]}
        islamiBankConfig={config.islami_bank}
        onPaymentSuccess={(receipt) => {
          setAlert({
            type: "success",
            text: `টেস্ট পেমেন্ট সফলভাবে সম্পন্ন হয়েছে! রসিদ নং: ${receipt.receipt_no}`,
          });
        }}
      />
    </div>
  );
}
