"use client";

import React, { useState } from "react";
import {
  BellRing,
  Send,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Search,
  Filter,
  Check,
  MessageCircle,
  Settings,
  Sparkles,
  Smartphone,
  Layers,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Sliders,
  Flame,
  ShieldAlert,
  Info,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  type AbsentStudentInfo,
  type AbsenceAlertSettings,
  DEFAULT_ABSENCE_SETTINGS,
} from "@/app/actions/parent-communication-types";
import {
  getAbsenceAlertData,
  sendAbsenceAlertSMS,
  saveAbsenceAlertSettings,
} from "@/app/actions/parent-communication";

interface Props {
  initialData: {
    absentStudents: AbsentStudentInfo[];
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    madrasaName: string;
    date?: string;
    settings?: AbsenceAlertSettings;
  };
  classes: any[];
}

export default function AbsenceAlertsClient({ initialData, classes }: Props) {
  const [data, setData] = useState(initialData);
  const [selectedDate, setSelectedDate] = useState(initialData.date || new Date().toISOString().split("T")[0]);
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "threshold_only" | "non_threshold">("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialData.absentStudents.map((s) => s.id)
  );

  // Settings with Granular Absence Thresholds
  const [settings, setSettings] = useState<AbsenceAlertSettings>(
    initialData.settings || DEFAULT_ABSENCE_SETTINGS
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Sending status
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [alertStatus, setAlertStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh data based on date & class
  const handleRefreshData = async (newDate?: string, newClass?: string) => {
    setIsRefreshing(true);
    const targetDate = newDate !== undefined ? newDate : selectedDate;
    const targetClass = newClass !== undefined ? newClass : selectedClass;

    const res = await getAbsenceAlertData(targetDate, targetClass);
    setData(res);
    setSelectedStudentIds(res.absentStudents.map((s) => s.id));
    setIsRefreshing(false);
  };

  // Filter students by search & threshold
  const filteredStudents = data.absentStudents.filter((s) => {
    if (filterMode === "threshold_only" && !s.isThresholdMet) return false;
    if (filterMode === "non_threshold" && s.isThresholdMet) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.parent_phone.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q)
    );
  });

  const thresholdStudentsCount = data.absentStudents.filter((s) => s.isThresholdMet).length;

  // Preset Handlers for Granular Control
  const applyPreset = (preset: "strict" | "standard" | "critical") => {
    if (preset === "strict") {
      setSettings((prev) => ({
        ...prev,
        absenceThresholdDays: 1,
        triggerType: "daily",
        whatsappNotificationMode: "all",
      }));
    } else if (preset === "standard") {
      setSettings((prev) => ({
        ...prev,
        absenceThresholdDays: 2,
        triggerType: "consecutive",
        whatsappNotificationMode: "threshold_only",
      }));
    } else if (preset === "critical") {
      setSettings((prev) => ({
        ...prev,
        absenceThresholdDays: 3,
        triggerType: "consecutive",
        whatsappNotificationMode: "threshold_only",
      }));
    }
  };

  // Select / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleSelectThresholdOnly = () => {
    const thresholdIds = data.absentStudents.filter((s) => s.isThresholdMet).map((s) => s.id);
    setSelectedStudentIds(thresholdIds);
  };

  const handleToggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((item) => item !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  // Send Bulk SMS to selected
  const handleSendBulkSMS = async () => {
    const selectedList = filteredStudents.filter((s) => selectedStudentIds.includes(s.id));
    if (selectedList.length === 0) {
      setAlertStatus({ type: "error", text: "কোনো অনুপস্থিত ছাত্র নির্বাচিত করা হয়নি" });
      return;
    }

    setIsSendingSMS(true);
    setAlertStatus(null);

    const payload = selectedList.map((s) => ({
      id: s.id,
      name: s.full_name,
      phone: s.parent_phone,
      message: s.customMessage,
    }));

    const res = await sendAbsenceAlertSMS(payload);
    setIsSendingSMS(false);

    if (res.error) {
      setAlertStatus({ type: "error", text: res.error });
    } else {
      const count = (res as any).successCount || selectedList.length;
      setAlertStatus({
        type: "success",
        text: `মোট ${toBanglaNumber(count)} জন অনুপস্থিত ছাত্রের অভিভাবককে সফলভাবে এসএমএস পাঠানো হয়েছে!`,
      });
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    const res = await saveAbsenceAlertSettings(settings);
    setIsSavingSettings(false);
    if (res.error) {
      setAlertStatus({ type: "error", text: res.error });
    } else {
      setAlertStatus({ type: "success", text: "স্বয়ংক্রিয় অনুপস্থিতি অ্যালার্ট সেটিংস সফলভাবে সংরক্ষিত হয়েছে!" });
      setIsSettingsOpen(false);
      handleRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              ইনস্ট্যান্ট নোটিফিকেশন ইঞ্জিন
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              স্বয়ংক্রিয় হোয়াটসঅ্যাপ ও অনুপস্থিতি অ্যালার্ট
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 mt-1 max-w-2xl">
              সকালের ফজর বা ক্লাসে কোনো ছাত্র অনুপস্থিত থাকলে সকাল ৮টার মধ্যে তাৎক্ষণিক ১-ক্লিক হোয়াটসঅ্যাপ এবং গেটওয়ের মাধ্যমে অভিভাবকদের বার্তা পাঠান।
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-emerald-300" />
              অ্যালার্ট সেটিংস
            </button>

            <button
              id="btn-send-absence-sms"
              onClick={handleSendBulkSMS}
              disabled={isSendingSMS || selectedStudentIds.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              {isSendingSMS ? (
                "এসএমএস পাঠানো হচ্ছে..."
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  নির্বাচিতদের এসএমএস পাঠান ({toBanglaNumber(selectedStudentIds.length)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Alert Status Banner */}
      {alertStatus && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            alertStatus.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {alertStatus.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{alertStatus.text}</p>
          </div>
          <button onClick={() => setAlertStatus(null)} className="text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
      )}

      {/* Granular Settings Panel (Collapsible) */}
      {isSettingsOpen && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-1">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                গ্র্যানুলার নোটিফিকেশন রুলস
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                স্বয়ংক্রিয় হোয়াটসঅ্যাপ ও অনুপস্থিতি অ্যালার্ট সেটিংস
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                কত দিন বা কতবার অনুপস্থিতির পর স্বয়ংক্রিয় WhatsApp নোটিফিকেশন পাঠানো হবে তা পুঙ্খানুপুঙ্খভাবে নিয়ন্ত্রণ করুন।
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">দ্রুত প্রিসেট:</span>
              <button
                type="button"
                onClick={() => applyPreset("strict")}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 font-semibold text-slate-700 transition"
                title="১ম দিনের অনুপস্থিতিতেই অ্যালার্ট"
              >
                ⚡ ১ম দিন থেকেই
              </button>
              <button
                type="button"
                onClick={() => applyPreset("standard")}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 font-semibold text-slate-700 transition"
                title="টানা ২ দিন অনুপস্থিতিতে অ্যালার্ট"
              >
                🎯 টানা ২ দিন
              </button>
              <button
                type="button"
                onClick={() => applyPreset("critical")}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:border-rose-500 hover:bg-rose-50 font-semibold text-slate-700 transition"
                title="টানা ৩ দিন অনুপস্থিতিতে কড়া অ্যালার্ট"
              >
                🚨 টানা ৩ দিন (জরুরি)
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs sm:text-sm">
            {/* Row 1: Granular Threshold Control */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                  ১. অনুপস্থিতি থ্রেশহোল্ড নির্ধারণ (Absence Threshold & Trigger Rules)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Threshold Number of Days */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    কত দিন / কতবার অনুপস্থিত হলে অ্যালার্ট সক্রিয় হবে?
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={settings.absenceThresholdDays || 1}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          absenceThresholdDays: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-24 px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 text-base text-center focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[1, 2, 3, 5, 7].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSettings({ ...settings, absenceThresholdDays: num })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            (settings.absenceThresholdDays || 1) === num
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {toBanglaNumber(num)} দিন
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    যেমন: ২ নির্ধারণ করলে টানা ২ দিন বা মাসে ২ দিন অনুপস্থিত হলেই হোয়াটসঅ্যাপ বার্তা যাবে।
                  </p>
                </div>

                {/* Trigger Type Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    অ্যালার্ট ট্রিগারের হিসাবের নিয়ম (Trigger Condition)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, triggerType: "consecutive" })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        settings.triggerType === "consecutive"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 font-bold shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="font-bold text-xs">🔥 টানা অনুপস্থিতি</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">টানা নির্দিষ্ট দিন না আসলে</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, triggerType: "total_in_month" })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        settings.triggerType === "total_in_month"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 font-bold shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="font-bold text-xs">📅 চলতি মাসে মোট</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">মাসে মোট দিন সংখ্যা ছুঁলে</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, triggerType: "daily" })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        settings.triggerType === "daily"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 font-bold shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="font-bold text-xs">⚡ প্রতিদিন তাৎক্ষণিক</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">১ম দিন থেকেই প্রতিটি দিনে</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 1.2: Targeting & Exclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">হোয়াটসঅ্যাপ নোটিফিকেশন টার্গেটিং</div>
                    <div className="text-[11px] text-slate-500">শুধুমাত্র থ্রেশহোল্ড পূরণকারী ছাত্র নাকি সবাইকে?</div>
                  </div>
                  <select
                    value={settings.whatsappNotificationMode || "all"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappNotificationMode: e.target.value as any,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold text-xs bg-slate-50"
                  >
                    <option value="threshold_only">🚨 শুধুমাত্র থ্রেশহোল্ড পূরণকারী</option>
                    <option value="all">👥 সকল অনুপস্থিত শিক্ষার্থী</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">অনুমোদিত ছুটি বাদ রাখুন (Leave Exclusion)</div>
                    <div className="text-[11px] text-slate-500">ছুটি মঞ্জুর করা থাকলে টানা গণনা ভেঙে যাবে না</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.excludeExcusedLeaves ?? true}
                    onChange={(e) =>
                      setSettings({ ...settings, excludeExcusedLeaves: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: General Dispatch Timing & Delivery Channel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">স্বয়ংক্রিয় নোটিফিকেশন ইঞ্জিন</div>
                  <div className="text-[11px] text-slate-500">হাজিরা নেওয়া শেষে স্বয়ংক্রিয় লিঙ্ক তৈরি</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isAutoEnabled}
                  onChange={(e) => setSettings({ ...settings, isAutoEnabled: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">অ্যালার্ট প্রেরণের সময়</label>
                <input
                  type="time"
                  value={settings.scheduleTime}
                  onChange={(e) => setSettings({ ...settings, scheduleTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">পছন্দসই মাধ্যম (Channel)</label>
                <select
                  value={settings.preferredChannel}
                  onChange={(e) => setSettings({ ...settings, preferredChannel: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold"
                >
                  <option value="both">এসএমএস এবং হোয়াটসঅ্যাপ উভয়ই</option>
                  <option value="whatsapp">১-ক্লিক হোয়াটসঅ্যাপ প্রাধান্য</option>
                  <option value="sms">এসএমএস গেটওয়ে প্রাধান্য</option>
                </select>
              </div>
            </div>

            {/* Row 3: Message Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  সাধারণ দৈনিক বার্তা টেমপ্লেট
                </label>
                <textarea
                  rows={3}
                  value={settings.template}
                  onChange={(e) => setSettings({ ...settings, template: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium leading-relaxed text-xs"
                  placeholder="ভ্যারিয়েবল: [ছাত্রের নাম], [রোল], [জামাত], [মাদরাসা]"
                />
                <span className="text-[10px] text-slate-400">ভ্যারিয়েবল: [ছাত্রের নাম], [রোল], [জামাত], [মাদরাসা]</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  টানা / দীর্ঘমেয়াদী অনুপস্থিতির বিশেষ সতর্কবার্তা টেমপ্লেট
                </label>
                <textarea
                  rows={3}
                  value={settings.consecutiveTemplate || ""}
                  onChange={(e) => setSettings({ ...settings, consecutiveTemplate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium leading-relaxed text-xs"
                  placeholder="ভ্যারিয়েবল: [ছাত্রের নাম], [রোল], [জামাত], [মাদরাসা], [অনুপস্থিতির দিন]"
                />
                <span className="text-[10px] text-slate-400">ভ্যারিয়েবল: [অনুপস্থিতির দিন], [ছাত্রের নাম], [রোল], [জামাত], [মাদরাসা]</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingSettings ? "সংরক্ষণ হচ্ছে..." : "গ্র্যানুলার সেটিংস সংরক্ষণ করুন"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary KPI Cards with Granular Threshold Insight */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">মোট শিক্ষার্থী</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{toBanglaNumber(data.totalStudents)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">মাদরাসার সক্রিয় শিক্ষার্থী</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 flex items-center justify-between">
            <span>উপস্থিত</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{toBanglaNumber(data.presentCount)}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">সকালের ক্লাসে উপস্থিত</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 flex items-center justify-between">
            <span>মোট অনুপস্থিত</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{toBanglaNumber(data.absentCount)}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">আজকের তালিকায় অনুপস্থিত</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 to-amber-50 shadow-sm">
          <div className="text-xs font-semibold text-rose-800 flex items-center justify-between">
            <span>🚨 থ্রেশহোল্ড পূর্ণ</span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-900 mt-1">{toBanglaNumber(thresholdStudentsCount)}</div>
          <div className="text-[11px] text-rose-700 mt-0.5 font-medium">WhatsApp সতর্কবার্তা যোগ্য</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold text-indigo-600 flex items-center justify-between">
            <span>নির্বাচিত</span>
            <Check className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{toBanglaNumber(selectedStudentIds.length)}</div>
          <div className="text-[11px] text-indigo-600 mt-0.5">একসাথে এসএমএস যাবে</div>
        </div>
      </div>

      {/* Date, Class, Search & Granular Threshold Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  handleRefreshData(e.target.value, selectedClass);
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                handleRefreshData(selectedDate, e.target.value);
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">সকল জামাত</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleRefreshData()}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ছাত্রের নাম বা মোবাইল নম্বর খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filter Tabs for Granular Absence Control */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500 mr-1">ফিল্টার:</span>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterMode === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              সকল অনুপস্থিত ({toBanglaNumber(data.absentStudents.length)})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("threshold_only")}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                filterMode === "threshold_only"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              🚨 থ্রেশহোল্ড উত্তীর্ণ ({toBanglaNumber(thresholdStudentsCount)})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("non_threshold")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterMode === "non_threshold"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              সাধারণ অনুপস্থিত ({toBanglaNumber(data.absentStudents.length - thresholdStudentsCount)})
            </button>
          </div>

          {thresholdStudentsCount > 0 && (
            <button
              type="button"
              onClick={handleSelectThresholdOnly}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold hover:bg-rose-100 transition"
            >
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              থ্রেশহোল্ড পূরণকারীদের একসাথে নির্বাচন করুন
            </button>
          )}
        </div>
      </div>

      {/* Absentee Student List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">
            {selectedDate} তারিখে কোনো অনুপস্থিত শিক্ষার্থী পাওয়া যায়নি!
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            আলহামদুলিল্লাহ, সকল শিক্ষার্থী উপস্থিত রয়েছে অথবা ফিল্টারের শর্ত অনুযায়ী কোনো ছাত্র পাওয়া যায়নি।
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-700">
                সবগুলো নির্বাচন করুন ({toBanglaNumber(selectedStudentIds.length)} / {toBanglaNumber(filteredStudents.length)})
              </span>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              সরাসরি WhatsApp ১-ক্লিক অথবা এসএমএস গেটওয়ে ব্যবহার করুন
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredStudents.map((student) => {
              const isSelected = selectedStudentIds.includes(student.id);

              return (
                <div
                  key={student.id}
                  className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    student.isThresholdMet
                      ? "bg-rose-50/30 hover:bg-rose-50/50"
                      : isSelected
                      ? "bg-emerald-50/30"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleStudent(student.id)}
                      className="w-4 h-4 text-emerald-600 rounded mt-1"
                    />

                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                          {student.full_name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800">
                          অনুপস্থিত
                        </span>

                        {/* Granular Threshold Badges */}
                        {student.isThresholdMet && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-rose-600 text-white shadow-sm flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-200" />
                            {student.thresholdReason || "অ্যালার্ট থ্রেশহোল্ড সক্রিয়"}
                          </span>
                        )}

                        {student.consecutiveDays > 1 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            টানা {toBanglaNumber(student.consecutiveDays)} দিন
                          </span>
                        )}

                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                          মাসে মোট {toBanglaNumber(student.monthlyAbsenceCount)} বার
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                        <span>রোল: <b className="text-slate-700">{toBanglaNumber(student.roll_number || "১")}</b></span>
                        <span>•</span>
                        <span>জামাত: <b className="text-slate-700">{student.class_name}</b></span>
                        {student.father_name && (
                          <>
                            <span>•</span>
                            <span>পিতা: {student.father_name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono text-slate-700 font-semibold">{student.parent_phone}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200/80 leading-relaxed font-sans shadow-2xs">
                        &quot;{student.customMessage}&quot;
                      </div>
                    </div>
                  </div>

                  {/* Direct 1-Click WhatsApp & Individual Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {student.whatsappUrl ? (
                      <a
                        href={student.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white font-bold text-xs shadow-sm transition ${
                          student.isThresholdMet
                            ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400/50"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                        title="সরাসরি অভিভাবকের হোয়াটসঅ্যাপে পাঠান"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp পাঠান
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">হোয়াটসঅ্যাপ নেই</span>
                    )}

                    {student.parent_phone && (
                      <a
                        href={`tel:${student.parent_phone}`}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        title="সরাসরি কল করুন"
                      >
                        <Smartphone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
