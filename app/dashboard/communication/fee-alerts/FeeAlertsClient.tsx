"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Send,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Check,
  MessageCircle,
  Sparkles,
  Smartphone,
  ExternalLink,
  DollarSign,
  Copy,
  Receipt,
  Layers,
  Globe,
  RefreshCw,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import type { FeeAlertStudentInfo } from "@/app/actions/parent-communication-types";
import { DEFAULT_FEE_ALERT_TEMPLATE } from "@/app/actions/parent-communication-types";
import {
  getFeeAlertStudentsData,
  sendAbsenceAlertSMS,
} from "@/app/actions/parent-communication";

interface Props {
  initialData: {
    feeStudents: FeeAlertStudentInfo[];
    totalDueOverall: number;
    madrasaName: string;
    detectedBaseUrl?: string;
  };
  classes: any[];
}

function applyBaseUrlToStudents(
  baseUrl: string,
  studentList: FeeAlertStudentInfo[],
  madrasaName: string
): FeeAlertStudentInfo[] {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  return studentList.map((s) => {
    const paymentLink = cleanBase
      ? `${cleanBase}/portal/fees?student_id=${s.id}`
      : `/portal/fees?student_id=${s.id}`;

    const fullName =
      s.full_name ||
      `${s.first_name || ""} ${s.last_name || ""}`.trim() ||
      "শিক্ষার্থী";
    const rollStr = toBanglaNumber(s.roll_number ?? "১");
    const dueStr = toBanglaNumber((s.total_due || 0).toLocaleString());

    const msg = DEFAULT_FEE_ALERT_TEMPLATE
      .replace(/\[ছাত্রের নাম\]/g, fullName)
      .replace(/\[রোল\]/g, rollStr)
      .replace(/\[বকেয়া টাকা\]/g, dueStr)
      .replace(/\[পেমেন্ট লিংক\]/g, paymentLink)
      .replace(/\[মাদরাসা\]/g, madrasaName);

    const intlPhone = s.parent_phone
      ? s.parent_phone.startsWith("88")
        ? s.parent_phone
        : `88${s.parent_phone.replace(/^0/, "")}`
      : "";
    const whatsappUrl =
      intlPhone.length >= 11
        ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`
        : "";

    return {
      ...s,
      payment_url: paymentLink,
      custom_message: msg,
      whatsapp_url: whatsappUrl,
    };
  });
}

export default function FeeAlertsClient({ initialData, classes }: Props) {
  const [data, setData] = useState(initialData);
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialData.feeStudents.map((s) => s.id)
  );

  const [activeHost, setActiveHost] = useState<string>(
    initialData.detectedBaseUrl || ""
  );
  const [isEditingHost, setIsEditingHost] = useState(false);
  const [customHostInput, setCustomHostInput] = useState("");

  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [alertStatus, setAlertStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync with current running website on browser mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      const runningOrigin = window.location.origin.replace(/\/+$/, "");
      setActiveHost(runningOrigin);
      setCustomHostInput(runningOrigin);
      setData((prev) => ({
        ...prev,
        detectedBaseUrl: runningOrigin,
        feeStudents: applyBaseUrlToStudents(
          runningOrigin,
          prev.feeStudents,
          prev.madrasaName
        ),
      }));
    }
  }, []);

  const handleApplyCustomHost = () => {
    let target = customHostInput.trim().replace(/\/+$/, "");
    if (target && !target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
    }
    setActiveHost(target);
    setIsEditingHost(false);
    setData((prev) => ({
      ...prev,
      detectedBaseUrl: target,
      feeStudents: applyBaseUrlToStudents(
        target,
        prev.feeStudents,
        prev.madrasaName
      ),
    }));
    setAlertStatus({
      type: "success",
      text: `পেমেন্ট লিংক সফলভাবে আপডেট করা হয়েছে (${target || "আপেক্ষিক লিংক"})`,
    });
  };

  const handleResetToCurrentHost = () => {
    if (typeof window !== "undefined") {
      const runningOrigin = window.location.origin.replace(/\/+$/, "");
      setActiveHost(runningOrigin);
      setCustomHostInput(runningOrigin);
      setIsEditingHost(false);
      setData((prev) => ({
        ...prev,
        detectedBaseUrl: runningOrigin,
        feeStudents: applyBaseUrlToStudents(
          runningOrigin,
          prev.feeStudents,
          prev.madrasaName
        ),
      }));
      setAlertStatus({
        type: "success",
        text: `বর্তমান রানিং ওয়েবসাইট ডোমেইনে (${runningOrigin}) লিংক রিসেট করা হয়েছে।`,
      });
    }
  };

  // Filter students
  const filteredStudents = data.feeStudents.filter((s) => {
    if (selectedClass !== "ALL" && s.class_id && s.class_id !== selectedClass)
      return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.parent_phone.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q)
    );
  });

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

  const handleSendBulkSMS = async () => {
    const selectedList = filteredStudents.filter((s) =>
      selectedStudentIds.includes(s.id)
    );
    if (selectedList.length === 0) {
      setAlertStatus({ type: "error", text: "কোনো ছাত্র নির্বাচিত করা হয়নি" });
      return;
    }

    setIsSendingSMS(true);
    setAlertStatus(null);

    const payload = selectedList.map((s) => ({
      id: s.id,
      name: s.full_name,
      phone: s.parent_phone,
      message: s.custom_message,
    }));

    const res = await sendAbsenceAlertSMS(payload);
    setIsSendingSMS(false);

    if (res.error) {
      setAlertStatus({ type: "error", text: res.error });
    } else {
      const count = (res as any).successCount || selectedList.length;
      setAlertStatus({
        type: "success",
        text: `মোট ${toBanglaNumber(
          count
        )} জন শিক্ষার্থীর অভিভাবককে সফলভাবে ফি বকেয়া ও পেমেন্ট লিংকের এসএমএস পাঠানো হয়েছে!`,
      });
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              স্মার্ট ফি নোটিফিকেশন ও সরাসরি পেমেন্ট লিংক
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              মাসিক ফি তৈরি ও সরাসরি পেমেন্ট লিংক নোটিফিকেশন
            </h1>
            <p className="text-sm sm:text-base text-blue-100/90 mt-1 max-w-2xl">
              যে ওয়েবসাইটে প্রজেক্ট হোস্ট হবে সেই ওয়েবসাইটের লাইভ ডোমেইন দিয়ে স্বয়ংক্রিয়ভাবে সরাসরি অনলাইন পেমেন্ট লিংক তৈরি হয়। ১-ক্লিক হোয়াটসঅ্যাপ এবং এসএমএস গেটওয়ে সংযুক্ত।
            </p>
          </div>

          <button
            id="btn-send-fee-sms"
            onClick={handleSendBulkSMS}
            disabled={isSendingSMS || selectedStudentIds.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer self-start md:self-auto shrink-0 disabled:opacity-50"
          >
            {isSendingSMS ? (
              "এসএমএস যাচ্ছে..."
            ) : (
              <>
                <Send className="w-4 h-4" />
                নির্বাচিতদের নোটিফিকেশন পাঠান ({toBanglaNumber(selectedStudentIds.length)})
              </>
            )}
          </button>
        </div>

        {/* Dynamic Running Website Host Info Bar */}
        <div className="relative z-10 bg-slate-950/40 border border-blue-400/20 rounded-xl p-3 sm:p-4 mt-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-blue-200">
                    হোস্টেড ওয়েবসাইট ডোমেইন:
                  </span>
                  <code className="px-2 py-0.5 rounded bg-black/60 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/30">
                    {activeHost || "স্বয়ংক্রিয় সনাক্তকরণ"}
                  </code>
                  <span className="text-[11px] text-emerald-200 bg-emerald-900/40 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                    ● লাইভ হোস্ট সক্রিয়
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  পেমেন্ট লিংক ফরম্যাট:{" "}
                  <span className="font-mono text-cyan-200 bg-cyan-950/40 px-1 py-0.5 rounded">
                    {activeHost ? `${activeHost}/portal/fees?student_id=...` : "runningwebsite.com/portal/fees?student_id=..."}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {isEditingHost ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customHostInput}
                    onChange={(e) => setCustomHostInput(e.target.value)}
                    placeholder="https://yourdomain.com"
                    className="px-2.5 py-1 text-xs rounded bg-slate-900 border border-blue-400/40 text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={handleApplyCustomHost}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                  >
                    সেভ
                  </button>
                  <button
                    onClick={() => setIsEditingHost(false)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs"
                  >
                    বাতিল
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditingHost(true)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white rounded-lg transition text-xs font-semibold"
                  >
                    ডোমেইন পরিবর্তন / কাস্টমাইজ
                  </button>
                  <button
                    onClick={handleResetToCurrentHost}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white rounded-lg transition"
                    title="বর্তমান ব্রাউজার হোস্টে রিসেট করুন"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alert status */}
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
          <button
            onClick={() => setAlertStatus(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">
            বকেয়াযুক্ত শিক্ষার্থী
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {toBanglaNumber(data.feeStudents.length)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            চলতি মাসের ফি অপরিশোধিত
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 flex items-center justify-between">
            <span>মোট অপরিশোধিত বকেয়া</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-800 mt-1">
            ৳ {toBanglaNumber(data.totalDueOverall.toLocaleString())}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">
            তাগাদা নোটিফিকেশন পাঠানো আবশ্যক
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 flex items-center justify-between">
            <span>নির্বাচিত শিক্ষার্থী</span>
            <Check className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-800 mt-1">
            {toBanglaNumber(selectedStudentIds.length)}
          </div>
          <div className="text-[11px] text-indigo-600 mt-0.5">
            একসাথে মেসেজ পাঠানো হবে
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 flex items-center justify-between">
            <span>অনলাইন পেমেন্ট গেটওয়ে</span>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base font-bold text-emerald-700 mt-2">
            সক্রিয় ও প্রস্তুত
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">
            বিকাশ/নগদ পেমেন্ট লিঙ্ক অন্তর্ভুক্ত
          </div>
        </div>
      </div>

      {/* Class & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">সকল জামাত</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500 hidden sm:inline">
            মোট বকেয়া ছাত্র: <b>{toBanglaNumber(filteredStudents.length)}</b>
          </span>
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ছাত্রের নাম বা ফোন দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Student Fees Alert Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={
                selectedStudentIds.length === filteredStudents.length &&
                filteredStudents.length > 0
              }
              onChange={handleToggleSelectAll}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-xs font-bold text-slate-700">
              সবগুলো নির্বাচন করুন ({toBanglaNumber(selectedStudentIds.length)} /{" "}
              {toBanglaNumber(filteredStudents.length)})
            </span>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            ১-ক্লিক WhatsApp ও সরাসরি পেমেন্ট লিঙ্ক
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredStudents.map((student) => {
            const isSelected = selectedStudentIds.includes(student.id);

            return (
              <div
                key={student.id}
                className={`p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected ? "bg-blue-50/30" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleStudent(student.id)}
                    className="w-4 h-4 text-blue-600 rounded mt-1"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900">
                        {student.full_name}
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800">
                        বকেয়া ৳ {toBanglaNumber(student.total_due.toLocaleString())}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                      <span>
                        রোল:{" "}
                        <b className="text-slate-700">
                          {toBanglaNumber(student.roll_number || "১")}
                        </b>
                      </span>
                      <span>•</span>
                      <span>
                        জামাত:{" "}
                        <b className="text-slate-700">{student.class_name}</b>
                      </span>
                      {student.father_name && (
                        <>
                          <span>•</span>
                          <span>পিতা: {student.father_name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-mono text-slate-700 font-semibold">
                        {student.parent_phone}
                      </span>
                    </div>

                    {/* Pre-formatted message snippet */}
                    <div className="text-[11px] text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="truncate max-w-xl font-medium">
                        &quot;{student.custom_message}&quot;
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={student.payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-blue-700 hover:bg-blue-50 flex items-center gap-1 font-bold text-xs"
                          title="পেমেন্ট পোর্টাল নতুন ট্যাবে টেস্ট করুন"
                        >
                          <ExternalLink className="w-3 h-3" />
                          পোর্টাল টেস্ট
                        </a>
                        <button
                          onClick={() =>
                            handleCopyLink(student.payment_url, student.id)
                          }
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 flex items-center gap-1 font-bold text-xs"
                          title="পেমেন্ট লিংক কপি করুন"
                        >
                          {copiedId === student.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copiedId === student.id ? "কপি হয়েছে" : "লিংক কপি"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side 1-Click WhatsApp & Quick Send */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {student.whatsapp_url ? (
                    <a
                      href={student.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                      title="সরাসরি অভিভাবকের হোয়াটসঅ্যাপে পাঠান"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp এ ফি নোটিফিকেশন
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">হোয়াটসঅ্যাপ নেই</span>
                  )}

                  {student.parent_phone && (
                    <a
                      href={`tel:${student.parent_phone}`}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="কল করুন"
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
    </div>
  );
}
