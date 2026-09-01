"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Calendar,
  User,
  Activity,
  FileDown,
  RefreshCw,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Key,
} from "lucide-react";
import { SecurityAuditLog, AuditActionType } from "@/lib/permissions";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  logs: SecurityAuditLog[];
  onRefresh?: () => void;
}

const ACTION_LABELS: Record<AuditActionType, { label: string; bg: string; text: string }> = {
  USER_LOGIN: { label: "লগইন", bg: "bg-slate-100", text: "text-slate-800" },
  USER_LOGOUT: { label: "লগআউট", bg: "bg-slate-100", text: "text-slate-700" },
  ROLE_CREATED: { label: "রোল তৈরি", bg: "bg-purple-100", text: "text-purple-800" },
  ROLE_UPDATED: { label: "রোল পরিবর্তন", bg: "bg-indigo-100", text: "text-indigo-800" },
  ROLE_DELETED: { label: "রোল ডিলিট", bg: "bg-rose-100", text: "text-rose-800" },
  ROLE_ASSIGNED: { label: "রোল বরাদ্দ", bg: "bg-amber-100", text: "text-amber-800" },
  PERMISSION_GRANTED: { label: "বিশেষ অধিকার প্রদান", bg: "bg-emerald-100", text: "text-emerald-800" },
  PERMISSION_REVOKED: { label: "অধিকার প্রত্যাহার", bg: "bg-rose-100", text: "text-rose-800" },
  USER_SUSPENDED: { label: "অ্যাকাউন্ট স্থগিত", bg: "bg-amber-100", text: "text-amber-800" },
  USER_ACTIVATED: { label: "অ্যাকাউন্ট সক্রিয়", bg: "bg-emerald-100", text: "text-emerald-800" },
  PASSWORD_RESET: { label: "পাসওয়ার্ড রিসেট", bg: "bg-blue-100", text: "text-blue-800" },
  APPROVAL_REQUESTED: { label: "অনুমোদন দাখিল", bg: "bg-amber-100", text: "text-amber-800" },
  APPROVAL_COMPLETED: { label: "অনুমোদন সম্পন্ন", bg: "bg-emerald-100", text: "text-emerald-800" },
  SENSITIVE_DATA_EXPORTED: { label: "তথ্য এক্সপোর্ট", bg: "bg-rose-100", text: "text-rose-800" },
  CERTIFICATE_REVOKED: { label: "সনদপত্র প্রত্যাহার", bg: "bg-rose-100", text: "text-rose-800" },
  RECORD_DELETED: { label: "রেকর্ড মোছা", bg: "bg-rose-100", text: "text-rose-800" },
};

export default function SecurityAuditView({ logs = [], onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchQuery =
        !search ||
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        log.actor_name.toLowerCase().includes(search.toLowerCase()) ||
        (log.target_user_name && log.target_user_name.toLowerCase().includes(search.toLowerCase())) ||
        log.module.toLowerCase().includes(search.toLowerCase());

      const matchAction = selectedAction === "ALL" || log.action === selectedAction;
      const matchModule = selectedModule === "ALL" || log.module === selectedModule;

      return matchQuery && matchAction && matchModule;
    });
  }, [logs, search, selectedAction, selectedModule]);

  const uniqueModules = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l) => {
      if (l.module) s.add(l.module);
    });
    return Array.from(s);
  }, [logs]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["ID", "Time", "Action", "Module", "Actor", "Actor Role", "Target User", "Details"];
    const rows = filteredLogs.map((l) => [
      l.id,
      new Date(l.created_at).toLocaleString("en-GB"),
      l.action,
      l.module,
      `"${l.actor_name}"`,
      `"${l.actor_role}"`,
      `"${l.target_user_name || ""}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">নিরাপত্তা অডিট লগ (Audit Trail)</h2>
              <p className="text-xs text-slate-500">
                ব্যবহারকারীর কার্যকলাপ, পদবী পরিবর্তন, অনুমোদন ও সংবেদনশীল কাজের সার্বিক ট্র্যাকিং
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <FileDown className="w-4 h-4" />
            CSV এক্সপোর্ট ({toBanglaNumber(filteredLogs.length)})
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="অডিট লগ সার্চ করুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs"
          />
        </div>

        <div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs cursor-pointer"
          >
            <option value="ALL">সকল অ্যাকশন (All Actions)</option>
            {Object.entries(ACTION_LABELS).map(([actionKey, val]) => (
              <option key={actionKey} value={actionKey}>
                {val.label} ({actionKey})
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs cursor-pointer"
          >
            <option value="ALL">সকল মডিউল (All Modules)</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Logs Table / Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            কোন অডিট রেকর্ড পাওয়া যায়নি।
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const actDef = ACTION_LABELS[log.action] || {
                label: log.action,
                bg: "bg-slate-100",
                text: "text-slate-800",
              };

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${actDef.bg} ${actDef.text}`}>
                        {actDef.label}
                      </span>
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {log.module}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString("bn-BD")}
                      </span>
                    </div>

                    <p className="text-slate-800 font-medium leading-relaxed">
                      {log.details}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                      <span>
                        কর্তা: <strong className="text-slate-700">{log.actor_name}</strong> ({log.actor_role})
                      </span>
                      {log.target_user_name && (
                        <span>
                          লক্ষ্য ইউজার: <strong className="text-slate-700">{log.target_user_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
