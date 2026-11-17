"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  getSystemAuditLogs,
  type SystemAuditStats,
} from "@/app/actions/system-audit";
import type { SystemAuditLogRecord, AuditSeverity } from "@/lib/audit-log";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Database,
  AlertTriangle,
  Clock,
  Activity,
  Globe,
  User,
  FileCode2,
  Filter,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

const MODULE_LABELS_BN: Record<string, string> = {
  exams: "পরীক্ষা ও ফলাফল",
  finance: "অর্থ ও খরচ",
  fees: "ফি ও কালেকশন",
  students: "শিক্ষার্থী",
  staff: "শিক্ষক ও স্টাফ",
  users: "ইউজার ও অ্যাকাউন্ট",
  roles: "রোল ও পারমিশন",
  sessions: "শিক্ষাবর্ষ (Session)",
  settings: "সেটিংস ও কনফিগ",
  security: "নিরাপত্তা (Security)",
  locks: "ডাটা লক ও ফ্রিজ",
  migration: "ডাটা মাইগ্রেশন",
  generic: "সিস্টেম",
};

interface InitialResult {
  success: boolean;
  storage: "sql" | "fallback";
  logs: SystemAuditLogRecord[];
  stats: SystemAuditStats;
  error?: string;
}

function formatDhakaDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("bn-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getChangedKeys(oldVal: any, newVal: any): string[] {
  if (!oldVal && !newVal) return [];
  if (
    typeof oldVal !== "object" ||
    typeof newVal !== "object" ||
    Array.isArray(oldVal) ||
    Array.isArray(newVal)
  ) {
    return [];
  }
  const keys = new Set<string>([
    ...Object.keys(oldVal || {}),
    ...Object.keys(newVal || {}),
  ]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(oldVal?.[k]) !== JSON.stringify(newVal?.[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function formatScalar(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export default function SystemAuditLogsClient({
  initialResult,
}: {
  initialResult: InitialResult;
}) {
  const [logs, setLogs] = useState<SystemAuditLogRecord[]>(
    initialResult.logs || []
  );
  const [stats, setStats] = useState<SystemAuditStats>(initialResult.stats);
  const [storage, setStorage] = useState<"sql" | "fallback">(
    initialResult.storage
  );
  const [error, setError] = useState<string | null>(
    initialResult.error || null
  );

  // Filters
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "ALL">(
    "ALL"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSystemAuditLogs({
        module: moduleFilter,
        severity: severityFilter,
        search: searchQuery.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 250,
      });
      if (!res.success && res.error) {
        setError(res.error);
      } else {
        setLogs(res.logs);
        setStats(res.stats);
        setStorage(res.storage);
      }
    } catch (err: any) {
      setError(err?.message || "অডিট লগ রিফ্রেশ করতে ত্রুটি হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // Instant client-side search filter for snappy typing
  const visibleLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((l) => {
      if (moduleFilter !== "ALL" && l.module !== moduleFilter) return false;
      if (severityFilter !== "ALL" && l.severity !== severityFilter) return false;
      if (!q) return true;
      return [
        l.summary,
        l.action,
        l.module,
        MODULE_LABELS_BN[l.module],
        l.actor_name,
        l.actor_email,
        l.actor_role,
        l.entity_label,
        l.entity_id,
        l.ip_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [logs, moduleFilter, severityFilter, searchQuery]);

  const handleExportCsv = () => {
    const headers = [
      "Time (Asia/Dhaka)",
      "Severity",
      "Module",
      "Action",
      "Summary",
      "Actor Name",
      "Actor Email",
      "Actor Role",
      "Entity Type",
      "Entity Label",
      "IP Address",
    ];
    const escapeCell = (val: any) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };
    const rows = visibleLogs.map((l) =>
      [
        formatDhakaDateTime(l.created_at),
        l.severity,
        MODULE_LABELS_BN[l.module] || l.module,
        l.action,
        l.summary || "",
        l.actor_name || "",
        l.actor_email || "",
        l.actor_role || "",
        l.entity_type || "",
        l.entity_label || l.entity_id || "",
        l.ip_address || "",
      ]
        .map(escapeCell)
        .join(",")
    );

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error && logs.length === 0) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-base">অডিট লগ অ্যাক্সেস করা যায়নি</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Storage Mode Notice */}
      {storage === "fallback" ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold">
                অস্থায়ী JSON ফলব্যাক মোড চালু আছে (`system_audit_logs` SQL টেবিল এখনো তৈরি হয়নি)
              </p>
              <p className="mt-0.5 text-amber-800">
                পূর্ণ Immutable PostgreSQL অডিট লগ চালু করতে Supabase SQL Editor-এ{" "}
                <code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono">
                  supabase_phase_c_core_erp_migration.sql
                </code>{" "}
                চালিয়ে এরপর ডাটা মাইগ্রেশন কনসোল থেকে ব্যাকফিল করুন।
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/settings/data-governance?tab=migration"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 transition"
          >
            <span>মাইগ্রেশন দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>PostgreSQL Immutable Audit Table সক্রিয়:</strong>{" "}
              `system_audit_logs` টেবিলে ট্রিগার দ্বারা UPDATE/DELETE সম্পূর্ণ ব্লক করা আছে।
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] shrink-0">
            SQL Active
          </span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">মোট রেকর্ড</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5">
            {toBanglaNumber(stats.total)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">সর্বশেষ লোডকৃত লগ</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">আজকের অ্যাক্টিভিটি</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1.5">
            {toBanglaNumber(stats.todayCount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">ঢাকা সময় অনুযায়ী</p>
        </div>

        <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">ক্রিটিক্যাল ইভেন্ট</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-1.5">
            {toBanglaNumber(stats.criticalCount)}
          </p>
          <p className="text-[11px] text-rose-400 mt-0.5">ডিলিট, রোল, আনলক ও সিকিউরিটি</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">সতর্কতা (Warning)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1.5">
            {toBanglaNumber(stats.warningCount)}
          </p>
          <p className="text-[11px] text-amber-500 mt-0.5">নম্বর আপডেট, লক, ব্যতিক্রম</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ইউজার, অ্যাকশন, বিবরণ, এনটিটি বা IP দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">সকল মডিউল</option>
              {Object.entries(MODULE_LABELS_BN).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as AuditSeverity | "ALL")
              }
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">সকল গুরুত্ব (Severity)</option>
              <option value="CRITICAL">CRITICAL (অতি গুরুত্বপূর্ণ)</option>
              <option value="WARNING">WARNING (সতর্কতা)</option>
              <option value="INFO">INFO (সাধারণ)</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700"
              title="শুরুর তারিখ"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700"
              title="শেষ তারিখ"
            />

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Filter className="w-3.5 h-3.5" />
              )}
              <span>ফিল্টার / রিফ্রেশ</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={visibleLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV ডাউনলোড</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {visibleLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <RefreshCw className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">
              কোনো অডিট লগ পাওয়া যায়নি
            </p>
            <p className="text-xs text-slate-400">
              নতুন কোনো পরিবর্তন (মার্কস এন্ট্রি, খরচ, ফি, স্টুডেন্ট বা রোল আপডেট) হলে এখানে স্বয়ংক্রিয়ভাবে রেকর্ড হবে।
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              const hasDiff =
                log.old_value !== null && log.old_value !== undefined
                  ? true
                  : log.new_value !== null && log.new_value !== undefined;
              const changedKeys = getChangedKeys(log.old_value, log.new_value);

              return (
                <div
                  key={log.id}
                  className={`transition ${
                    isExpanded ? "bg-slate-50/80" : "hover:bg-slate-50/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : log.id)
                    }
                    className="w-full text-left px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Severity Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                            log.severity === "CRITICAL"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : log.severity === "WARNING"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          }`}
                        >
                          {log.severity}
                        </span>

                        {/* Module Badge */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {MODULE_LABELS_BN[log.module] || log.module}
                        </span>

                        {/* Action Code */}
                        <code className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {log.action}
                        </code>

                        {log.entity_label && (
                          <span className="text-xs font-medium text-slate-500 truncate max-w-xs">
                            • {log.entity_label}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-slate-800 leading-snug">
                        {log.summary || `${log.action} সম্পাদিত হয়েছে`}
                      </p>

                      <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <strong className="text-slate-700">
                            {log.actor_name || log.actor_email || "সিস্টেম"}
                          </strong>
                          {log.actor_role && (
                            <span className="px-1.5 py-0.2 bg-slate-100 rounded text-[10px] font-mono">
                              {log.actor_role}
                            </span>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDhakaDateTime(log.created_at)}
                        </span>

                        {log.ip_address && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Globe className="w-3 h-3 text-slate-400" />
                            {log.ip_address}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {hasDiff && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                          <FileCode2 className="w-3.5 h-3.5 text-indigo-500" />
                          <span>
                            {changedKeys.length > 0
                              ? `${toBanglaNumber(changedKeys.length)} ফিল্ড পরিবর্তিত`
                              : "ডিটেইলস / JSON"}
                          </span>
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 space-y-3 border-t border-slate-100 bg-slate-50/70">
                      {/* Changed Fields Highlight Table */}
                      {changedKeys.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-100/80 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                            পরিবর্তিত ফিল্ডসমূহ (Before → After Diff)
                          </div>
                          <div className="divide-y divide-slate-100 text-xs">
                            {changedKeys.map((key) => (
                              <div
                                key={key}
                                className="grid grid-cols-1 md:grid-cols-3 gap-2 px-3 py-2"
                              >
                                <div className="font-mono font-semibold text-slate-700">
                                  {key}
                                </div>
                                <div className="bg-rose-50 text-rose-800 px-2 py-1 rounded font-mono text-[11px] break-all">
                                  - {formatScalar(log.old_value?.[key])}
                                </div>
                                <div className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded font-mono text-[11px] break-all">
                                  + {formatScalar(log.new_value?.[key])}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Raw Before & After JSON */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="text-[11px] font-bold text-rose-700 mb-1.5">
                            পূর্বের মান (Old Value)
                          </div>
                          <pre className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2.5 rounded-lg overflow-x-auto max-h-56">
                            {log.old_value !== null &&
                            log.old_value !== undefined
                              ? JSON.stringify(log.old_value, null, 2)
                              : "— (নতুন রেকর্ড অথবা প্রযোজ্য নয়)"}
                          </pre>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="text-[11px] font-bold text-emerald-700 mb-1.5">
                            নতুন মান (New Value)
                          </div>
                          <pre className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2.5 rounded-lg overflow-x-auto max-h-56">
                            {log.new_value !== null &&
                            log.new_value !== undefined
                              ? JSON.stringify(log.new_value, null, 2)
                              : "— (ডিলিট/রিভোক অ্যাকশন)"}
                          </pre>
                        </div>
                      </div>

                      {/* Technical Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                        <span>
                          <strong>Log ID:</strong>{" "}
                          <code className="font-mono">{log.id}</code>
                        </span>
                        {log.entity_type && (
                          <span>
                            <strong>Entity:</strong> {log.entity_type} (
                            <code className="font-mono">{log.entity_id || "—"}</code>)
                          </span>
                        )}
                        {log.actor_email && (
                          <span>
                            <strong>Email:</strong> {log.actor_email}
                          </span>
                        )}
                        {log.user_agent && (
                          <span className="truncate max-w-md" title={log.user_agent}>
                            <strong>Client:</strong> {log.user_agent}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
