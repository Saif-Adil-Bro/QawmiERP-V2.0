"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Puzzle,
  Upload,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Code2,
  CheckCircle2,
  AlertCircle,
  Columns2,
  Maximize2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  installCustomWidgetZipAction,
  toggleWidgetAction,
  uninstallCustomWidgetAction,
  updateWidgetLayoutAction,
} from "@/app/actions/widgets";
import { useStepUpAction } from "@/components/security/useStepUpAction";
import type { WidgetConfigItem } from "@/lib/widgets/types";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  initialWidgets: WidgetConfigItem[];
  canManage: boolean;
  initialError?: string;
}

export default function WidgetsManagerClient({
  initialWidgets,
  canManage,
  initialError,
}: Props) {
  const [widgets, setWidgets] = useState<WidgetConfigItem[]>(initialWidgets);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showDevGuide, setShowDevGuide] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    initialError ? { type: "err", text: initialError } : null
  );
  const [isPending, startTransition] = useTransition();
  const { runWithStepUp, stepUpModal } = useStepUpAction();

  const handleToggle = (widgetId: string, enabled: boolean) => {
    if (!canManage) return;
    setFeedback(null);
    startTransition(async () => {
      const res: any = await toggleWidgetAction(widgetId, enabled);
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.widgets) {
        setWidgets(res.widgets);
        setFeedback({
          type: "ok",
          text: enabled ? "উইজেটটি চালু করা হয়েছে।" : "উইজেটটি বন্ধ করা হয়েছে।",
        });
      }
    });
  };

  const handleLayout = (
    widgetId: string,
    updates: { size?: "half" | "full"; direction?: "up" | "down" }
  ) => {
    if (!canManage) return;
    setFeedback(null);
    startTransition(async () => {
      const res: any = await updateWidgetLayoutAction(widgetId, updates);
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.widgets) {
        setWidgets(res.widgets);
      }
    });
  };

  const handleInstallZip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !selectedFile) return;
    setFeedback(null);

    startTransition(async () => {
      const res: any = await runWithStepUp(
        () => {
          const fd = new FormData();
          fd.append("file", selectedFile);
          return installCustomWidgetZipAction(fd);
        },
        {
          actionLabel: "কাস্টম .zip উইজেট ইনস্টল",
          actionScope: "widget.install",
        }
      );

      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.widgets) {
        setWidgets(res.widgets);
        setSelectedFile(null);
        setFeedback({
          type: "ok",
          text: `কাস্টম উইজেট "${res.installedWidget?.title || ""}" সফলভাবে ইনস্টল ও সক্রিয় হয়েছে!`,
        });
      }
    });
  };

  const handleUninstall = (widget: WidgetConfigItem) => {
    if (!canManage) return;
    if (!confirm(`আপনি কি নিশ্চিতভাবে "${widget.title}" উইজেটটি আনইনস্টল করতে চান?`)) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res: any = await runWithStepUp(
        () => uninstallCustomWidgetAction(widget.id),
        {
          actionLabel: "কাস্টম উইজেট আনইনস্টল",
          actionScope: "widget.uninstall",
        }
      );
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.widgets) {
        setWidgets(res.widgets);
        setFeedback({
          type: "ok",
          text: `"${widget.title}" আনইনস্টল করা হয়েছে।`,
        });
      }
    });
  };

  const enabledCount = widgets.filter((w) => w.enabled).length;
  const customCount = widgets.filter((w) => w.type === "custom").length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              উইজেট ও প্লাগইন ম্যানেজার
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ডিফল্ট উইজেট Enable/Disable, লেআউট পরিবর্তন এবং কাস্টম .zip উইজেট ইনস্টলেশন
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            ড্যাশবোর্ডে ফিরুন
          </Link>
          <a
            href="/api/widgets/sample"
            download="qawmi-sample-widget.zip"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Sample Widget .zip ডাউনলোড
          </a>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2.5 ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">মোট উইজেট</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {toBanglaNumber(widgets.length)}টি
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">ড্যাশবোর্ডে সক্রিয় (Enabled)</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {toBanglaNumber(enabledCount)}টি
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">কাস্টম .zip প্লাগইন</div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {toBanglaNumber(customCount)}টি
          </div>
        </div>
      </div>

      {/* Custom ZIP Upload Section */}
      {canManage ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                নতুন কাস্টম উইজেট (.zip) ইনস্টল করুন
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                WordPress প্লাগইনের মতোই `manifest.json` ও `index.html` যুক্ত `.zip` ফাইল আপলোড করুন। ইনস্টলকৃত উইজেট নিরাপদ Sandboxed iframe-এ চলবে।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDevGuide((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer self-start sm:self-auto"
            >
              <Code2 className="w-4 h-4" />
              ডেভেলপার গাইড (manifest.json)
              {showDevGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showDevGuide && (
            <div className="rounded-xl bg-slate-950 text-slate-100 p-4 text-xs font-mono space-y-2 overflow-x-auto">
              <div className="text-emerald-400 font-sans font-semibold">
                প্যাকেজ স্ট্রাকচার: my-widget.zip → manifest.json, index.html, style.css, app.js
              </div>
              <pre className="leading-relaxed">{`{
  "id": "my-custom-widget",
  "name": "আমার কাস্টম উইজেট",
  "version": "1.0.0",
  "description": "উইজেটের সংক্ষিপ্ত বিবরণ",
  "author": "Madrasa Tech",
  "entry": "index.html",
  "size": "half",
  "permissions": ["madrasa.read", "students.read", "attendance.read", "finance.read"]
}`}</pre>
              <div className="text-slate-400 font-sans">
                HTML/JS-এর ভেতরে <code className="text-amber-300">window.QawmiERP.onData(fn)</code> ও{" "}
                <code className="text-amber-300">window.QawmiERP.requestData()</code> ব্যবহার করে অনুমোদিত Read-Only ডেটা নিতে পারবেন।
              </div>
            </div>
          )}

          <form onSubmit={handleInstallZip} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1 text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-800/60"
            />
            <button
              type="submit"
              disabled={!selectedFile || isPending}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {isPending ? "ইনস্টল হচ্ছে..." : "ইনস্টল ও সক্রিয় করুন"}
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          উইজেট ইনস্টল বা পরিবর্তন করার অনুমতি কেবল সুপার অ্যাডমিন, মুহতামিম ও অ্যাডমিনের রয়েছে।
        </div>
      )}

      {/* Widget List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            ইনস্টলকৃত ও ডিফল্ট উইজেট তালিকা
          </h2>
          <span className="text-xs text-slate-500">অর্ডার অনুযায়ী ড্যাশবোর্ডে দেখাবে</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {widgets.map((w, idx) => (
            <div
              key={w.id}
              className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">#{toBanglaNumber(idx + 1)}</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {w.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      w.type === "custom"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {w.type === "custom" ? "Custom ZIP" : "Built-in"}
                  </span>
                  {w.version && (
                    <span className="text-[10px] font-mono text-slate-400">v{w.version}</span>
                  )}
                </div>
                {w.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{w.description}</p>
                )}
                {w.type === "custom" && w.permissions && w.permissions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {w.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Size Switcher */}
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleLayout(w.id, { size: "half" })}
                      className={`px-2.5 py-1.5 inline-flex items-center gap-1 cursor-pointer ${
                        w.size === "half"
                          ? "bg-slate-900 text-white dark:bg-indigo-600"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      }`}
                      title="অর্ধেক প্রস্থ (Half Width)"
                    >
                      <Columns2 className="w-3.5 h-3.5" />
                      <span>Half</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleLayout(w.id, { size: "full" })}
                      className={`px-2.5 py-1.5 inline-flex items-center gap-1 cursor-pointer ${
                        w.size === "full"
                          ? "bg-slate-900 text-white dark:bg-indigo-600"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      }`}
                      title="পূর্ণ প্রস্থ (Full Width)"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full</span>
                    </button>
                  </div>

                  {/* Order Up / Down */}
                  <button
                    type="button"
                    disabled={isPending || idx === 0}
                    onClick={() => handleLayout(w.id, { direction: "up" })}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="উপরে নিন"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || idx === widgets.length - 1}
                    onClick={() => handleLayout(w.id, { direction: "down" })}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="নিচে নিন"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Enable / Disable Toggle */}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggle(w.id, !w.enabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      w.enabled
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {w.enabled ? "চালু (Enabled)" : "বন্ধ (Disabled)"}
                  </button>

                  {/* Uninstall custom widget */}
                  {w.type === "custom" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUninstall(w)}
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 cursor-pointer"
                      title="আনইনস্টল করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {stepUpModal}
    </div>
  );
}
