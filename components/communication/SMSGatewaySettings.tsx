"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Key,
  Globe,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Radio,
  Sliders,
  ExternalLink,
  Zap,
  Activity,
  Code2,
} from "lucide-react";
import {
  SMSGatewayConfig,
  SMSProvider,
  SMS_PROVIDER_PRESETS,
  DEFAULT_SMS_GATEWAY_CONFIG,
  normalizePhoneNumber,
} from "@/lib/sms-gateway";
import {
  saveSMSGatewayConfig,
  testSMSGateway,
  checkSMSBalance,
} from "@/app/actions/communication";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  initialConfig?: SMSGatewayConfig;
  onConfigUpdated?: (config: SMSGatewayConfig) => void;
}

export default function SMSGatewaySettings({
  initialConfig = DEFAULT_SMS_GATEWAY_CONFIG,
  onConfigUpdated,
}: Props) {
  const [config, setConfig] = useState<SMSGatewayConfig>(initialConfig);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live Testing State
  const [testPhone, setTestPhone] = useState("01812345678");
  const [testMessage, setTestMessage] = useState(
    "টেস্ট এসএমএস: কওমি ম্যানেজার এসএমএস গেটওয়ে সফলভাবে কানেক্ট হয়েছে।"
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    rawResponse: string;
    statusCode: number;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // Live Balance State
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceData, setBalanceData] = useState<{
    balance?: string;
    error?: string;
    updatedAt?: string;
  } | null>(null);

  // Update internal state if props change
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  // Handle Provider Change
  const handleProviderSelect = (providerId: SMSProvider) => {
    const preset = SMS_PROVIDER_PRESETS.find((p) => p.id === providerId);
    if (!preset) return;

    setConfig((prev) => ({
      ...prev,
      provider: providerId,
      apiEndpoint: preset.defaultEndpoint || prev.apiEndpoint,
      httpMethod: preset.defaultMethod || "GET",
      senderId: prev.senderId || preset.defaultSenderId || "",
    }));
    setSaveSuccess(null);
    setSaveError(null);
  };

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await saveSMSGatewayConfig(config);
      if (res.error) {
        setSaveError(res.error);
      } else {
        setSaveSuccess("এসএমএস গেটওয়ে কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!");
        if (res.config && onConfigUpdated) {
          onConfigUpdated(res.config);
        }
      }
    } catch (err: any) {
      setSaveError(err.message || "সংরক্ষণে ব্যর্থ হয়েছে");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Test SMS Dispatch
  const handleRunTest = async () => {
    if (!testPhone) {
      alert("অনুগ্রহ করে টেস্ট মোবাইল নম্বর প্রদান করুন।");
      return;
    }
    if (!config.apiKey && config.provider !== "custom") {
      alert("অনুগ্রহ করে প্রথমে এপিআই কী (API Key) প্রদান করুন।");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testSMSGateway(config, testPhone, testMessage);
      setTestResult(res);
      if (res.success) {
        setSaveSuccess("টেস্ট এসএমএস সফলভাবে গেটওয়েতে পাঠানো হয়েছে!");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        rawResponse: err.message || "Error",
        statusCode: 500,
        error: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Live Balance Check
  const handleCheckBalance = async () => {
    if (!config.apiKey) {
      alert("ব্যালেন্স চেক করতে এপিআই কী দেওয়া আবশ্যক।");
      return;
    }
    setIsCheckingBalance(true);
    try {
      const res = await checkSMSBalance(config);
      if (res.error) {
        setBalanceData({ error: res.error, updatedAt: new Date().toLocaleTimeString("bn-BD") });
      } else {
        setBalanceData({ balance: res.balance, updatedAt: new Date().toLocaleTimeString("bn-BD") });
      }
    } catch (e: any) {
      setBalanceData({ error: e.message || "ব্যালেন্স চেক ব্যর্থ", updatedAt: new Date().toLocaleTimeString("bn-BD") });
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const selectedPreset = SMS_PROVIDER_PRESETS.find((p) => p.id === config.provider) || SMS_PROVIDER_PRESETS[0];

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
                <Server className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                এসএমএস এপিআই ও কাস্টম গেটওয়ে সেটিংস
              </h2>
              {config.isEnabled && config.apiKey ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  সক্রিয় লাইভ গেটওয়ে
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  সিমুলেশন / ডেমো মোড
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Mram SMS, Greenweb, BulkSMS BD বা আপনার পছন্দের যেকোনো বাংলাদেশি বাল্ক এসএমএস কোম্পানির এপিআই লিঙ্ক করে সরাসরি অভিভাবকদের মোবাইলে লাইভ এসএমএস পাঠান।
            </p>
          </div>

          {/* Quick Balance Tool */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15 min-w-[200px] shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                একাউন্ট ব্যালেন্স
              </span>
              <button
                type="button"
                onClick={handleCheckBalance}
                disabled={isCheckingBalance || !config.apiKey}
                className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                title="ব্যালেন্স রিফ্রেশ করুন"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingBalance ? "animate-spin" : ""}`} />
                <span>চেক করুন</span>
              </button>
            </div>
            <div className="text-base sm:text-lg font-bold text-white tracking-wide">
              {balanceData?.balance ? (
                <span className="text-emerald-300">{balanceData.balance}</span>
              ) : balanceData?.error ? (
                <span className="text-xs text-amber-300 font-normal">{balanceData.error}</span>
              ) : config.apiKey ? (
                <span className="text-xs text-slate-400 font-normal">চেক বাটনে চাপুন</span>
              ) : (
                <span className="text-xs text-slate-400 font-normal">API কী দিন</span>
              )}
            </div>
            {balanceData?.updatedAt && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                আপডেট: {balanceData.updatedAt}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-red-700 hover:text-red-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Form Left, Test Console Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Provider selection and API details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Provider Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-600" />
                ১. এসএমএস গেটওয়ে প্রোভাইডার নির্বাচন
              </h3>
              <span className="text-[11px] font-medium text-slate-500">
                ৬টি প্রিসেট ও কাস্টম API
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SMS_PROVIDER_PRESETS.map((preset) => {
                const isSelected = config.provider === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleProviderSelect(preset.id)}
                    className={`text-left p-3.5 rounded-xl border transition relative cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                          <span>{preset.nameBangla}</span>
                          {preset.id === "mram" && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                              জনপ্রিয়
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {preset.description}
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPreset.website && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="text-slate-600">
                  {selectedPreset.nameBangla}-তে একাউন্ট না থাকলে ওয়েবসাইট ভিজিট করুন:
                </span>
                <a
                  href={selectedPreset.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline"
                >
                  <span>{selectedPreset.website}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Step 2: Gateway Credentials & Parameters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                ২. এপিআই ক্রেডেনশিয়াল ও প্যারামিটার
              </h3>

              {/* Master Enable/Disable Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-slate-700">
                  গেটওয়ে সক্রিয় করুন:
                </span>
                <input
                  type="checkbox"
                  checked={config.isEnabled}
                  onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="space-y-4">
              {/* API Endpoint */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    এপিআই এন্ডপয়েন্ট ইউআরএল (API Endpoint URL)
                    <span className="text-red-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({ ...config, apiEndpoint: selectedPreset.defaultEndpoint })
                    }
                    className="text-[11px] text-indigo-600 hover:underline font-normal"
                  >
                    ডিফল্ট ইউআরএল বসান
                  </button>
                </label>
                <input
                  type="text"
                  value={config.apiEndpoint}
                  onChange={(e) => setConfig({ ...config, apiEndpoint: e.target.value })}
                  placeholder="https://smsapi.mram.com.bd/smsapi"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* API Key / Token */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    এপিআই কী / টোকেন (API Key / Token)
                    <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {config.provider === "greenweb" ? "Greenweb Token" : "Secret API Key"}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="e.g. 1928374650abcdef123456"
                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sender ID & HTTP Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    সেন্ডার আইডি / মাস্কিং নাম (Sender ID)
                  </label>
                  <input
                    type="text"
                    value={config.senderId}
                    onChange={(e) => setConfig({ ...config, senderId: e.target.value })}
                    placeholder="e.g. 8809612345678 বা MADRASA"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    প্রোভাইডারের অনুমোদিত মাস্কিং বা নন-মাস্কিং আইডি
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    এইচটিটিপি মেথড (HTTP Method)
                  </label>
                  <select
                    value={config.httpMethod}
                    onChange={(e: any) =>
                      setConfig({ ...config, httpMethod: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="GET">GET Request (সাধারণত ব্যবহৃত)</option>
                    <option value="POST_JSON">POST (JSON Body)</option>
                    <option value="POST_FORM">POST (Form UrlEncoded)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mram/Greenweb এর জন্য GET মেথড স্বয়ংক্রিয়
                  </p>
                </div>
              </div>

              {/* Unicode Checkbox */}
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-indigo-950">
                    বাংলা ইউনিকোড সাপোর্ট (Unicode / Bengali SMS)
                  </div>
                  <div className="text-[11px] text-indigo-700">
                    বাংলা বর্ণমালার এসএমএস ভাঙা ছাড়া নিখুঁতভাবে পৌঁছানোর জন্য ইউনিকোড চালু রাখুন।
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.unicode !== false}
                  onChange={(e) => setConfig({ ...config, unicode: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Custom Parameter Mappings for Custom API */}
              {config.provider === "custom" && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Code2 className="w-4 h-4 text-indigo-600" />
                    কাস্টম প্যারামিটার নাম ম্যাপিং
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        API Key প্যারামিটার:
                      </label>
                      <input
                        type="text"
                        value={config.apiKeyParamName || "api_key"}
                        onChange={(e) =>
                          setConfig({ ...config, apiKeyParamName: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        placeholder="api_key"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Phone প্যারামিটার:
                      </label>
                      <input
                        type="text"
                        value={config.phoneParamName || "contacts"}
                        onChange={(e) =>
                          setConfig({ ...config, phoneParamName: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        placeholder="contacts / to"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Message প্যারামিটার:
                      </label>
                      <input
                        type="text"
                        value={config.messageParamName || "msg"}
                        onChange={(e) =>
                          setConfig({ ...config, messageParamName: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        placeholder="msg / message"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Sender ID প্যারামিটার:
                      </label>
                      <input
                        type="text"
                        value={config.senderIdParamName || "senderid"}
                        onChange={(e) =>
                          setConfig({ ...config, senderIdParamName: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        placeholder="senderid"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
                <span>{isSaving ? "সংরক্ষণ হচ্ছে..." : "গেটওয়ে সেটিংস সংরক্ষণ করুন"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Testing Console & Response Inspector */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Test SMS Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                লাইভ কানেকশন ও টেস্ট এসএমএস
              </h3>
              <span className="text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                রিয়েল-টাইম টেস্ট
              </span>
            </div>

            <p className="text-xs text-slate-500">
              আপনার প্রবেশকৃত এপিআই কী ও গেটওয়ে সঠিকভাবে কাজ করছে কিনা দেখতে নিচের নম্বরে একটি টেস্ট এসএমএস পাঠিয়ে যাচাই করুন।
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  টেস্ট প্রাপকের মোবাইল নম্বর:
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="01812345678"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  টেস্ট মেসেজ:
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={handleRunTest}
                disabled={isTesting}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Send className={`w-4 h-4 ${isTesting ? "animate-spin text-amber-400" : "text-amber-400"}`} />
                <span>{isTesting ? "টেস্ট এসএমএস পাঠানো হচ্ছে..." : "টেস্ট এসএমএস পাঠান"}</span>
              </button>
            </div>

            {/* Test Response Console */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  testResult.success
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : "bg-red-50/70 border-red-200 text-red-950"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    {testResult.success ? "গেটওয়ে রেসপন্স: সফল" : "গেটওয়ে রেসপন্স: ব্যর্থ / ত্রুটি"}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-white/80 border">
                      HTTP {testResult.statusCode}
                    </span>
                    {testResult.latencyMs && (
                      <span className="px-1.5 py-0.5 rounded bg-white/80 border">
                        {toBanglaNumber(testResult.latencyMs)} ms
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto max-h-32">
                  <div className="text-[10px] text-slate-400 mb-1 border-b border-slate-800 pb-0.5">
                    // API Raw Response:
                  </div>
                  <pre className="whitespace-pre-wrap break-all">
                    {testResult.rawResponse || "No body response returned."}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Quick FAQ / Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
            <h4 className="font-bold text-slate-800">
              💡 Mram SMS এবং অন্যান্য গেটওয়ে সেটআপ নির্দেশিকা:
            </h4>
            <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
              <li>
                <strong>Mram SMS:</strong> আপনার Mram পোর্টাল হতে API Key সংগ্রহ করে উপরের ঘরে পেস্ট করুন।
              </li>
              <li>
                <strong>মাস্কিং / নন-মাস্কিং:</strong> মাস্কিং এপ্রুভ থাকলে সেন্ডার আইডির ঘরে নাম লিখুন, নয়তো ৮৮০৯৬... নম্বরটি দিন।
              </li>
              <li>
                <strong>সিমুলেশন মোড:</strong> কোনো গেটওয়ে চালু না থাকলেও সিস্টেমে এসএমএস লগ ও হিস্টোরি নিখুঁতভাবে সংরক্ষিত হবে।
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
