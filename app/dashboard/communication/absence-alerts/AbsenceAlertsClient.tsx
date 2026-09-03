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
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import type {
  AbsentStudentInfo,
  AbsenceAlertSettings,
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
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialData.absentStudents.map((s) => s.id)
  );

  // Settings
  const [settings, setSettings] = useState<AbsenceAlertSettings>(
    initialData.settings || {
      isAutoEnabled: true,
      scheduleTime: "08:00",
      preferredChannel: "both",
      template:
        "আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আপনার সন্তান [ছাত্রের নাম] (রোল: [রোল], জামাত: [জামাত]) আজকের সকালের তালিম/ক্লাসে উপস্থিত হয়নি। বিষয়টি জরুরিভাবে অবগত হোন। - [মাদরাসা]",
      fajrTalimOnly: false,
    }
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

  // Filter students by search
  const filteredStudents = data.absentStudents.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.parent_phone.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q)
    );
  });

  // Select / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
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

      {/* Settings Panel (Collapsible) */}
      {isSettingsOpen && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600" />
              স্বয়ংক্রিয় সকাল ৮টার নোটিফিকেশন সেটিংস
            </h3>
            <span className="text-xs text-slate-400">প্রতিদিনের সকালের তালিমে কার্যকর</span>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">স্বয়ংক্রিয় অ্যালার্ট সিস্টেম</div>
                  <div className="text-[11px] text-slate-500">অনুপস্থিত হলে স্বয়ংক্রিয় বার্তা ড্রাফট</div>
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

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                মেসেজ টেমপ্লেট (ভ্যারিয়েবল: [ছাত্রের নাম], [রোল], [জামাত], [মাদরাসা])
              </label>
              <textarea
                rows={3}
                value={settings.template}
                onChange={(e) => setSettings({ ...settings, template: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition disabled:opacity-50"
              >
                {isSavingSettings ? "সংরক্ষণ হচ্ছে..." : "সেটিংস সংরক্ষণ করুন"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <span>অনুপস্থিত ছাত্র</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{toBanglaNumber(data.absentCount)}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">নোটিফিকেশন পাঠানো আবশ্যক</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 flex items-center justify-between">
            <span>নির্বাচিত</span>
            <Check className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{toBanglaNumber(selectedStudentIds.length)}</div>
          <div className="text-[11px] text-indigo-600 mt-0.5">একসাথে এসএমএস যাবে</div>
        </div>
      </div>

      {/* Date & Class Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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

      {/* Absentee Student List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">
            {selectedDate} তারিখে কোনো অনুপস্থিত শিক্ষার্থী নেই!
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            আলহামদুলিল্লাহ, সকল শিক্ষার্থী উপস্থিত রয়েছে অথবা আজকের দিনের হাজিরা এন্ট্রি সম্পন্ন হয়নি।
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
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
              সরাসরি WhatsApp বা এসএমএস গেটওয়ে ব্যবহার করুন
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredStudents.map((student) => {
              const isSelected = selectedStudentIds.includes(student.id);

              return (
                <div
                  key={student.id}
                  className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isSelected ? "bg-emerald-50/30" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleStudent(student.id)}
                      className="w-4 h-4 text-emerald-600 rounded mt-1"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                          {student.full_name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800">
                          অনুপস্থিত
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
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

                      <div className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
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
