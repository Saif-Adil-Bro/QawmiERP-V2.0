"use client";

import { useState, useTransition } from "react";
import { Bell, Send, RefreshCw, Plus, Trash2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import {
  saveNotificationTemplateAction,
  deleteNotificationTemplateAction,
  processNotificationQueueAction,
  sendTestNotificationAction,
  getNotificationTemplatesAction,
  getNotificationQueueAction,
} from "@/app/actions/notification-orchestrator";
import type { NotificationChannel } from "@/lib/notifications/channels";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  initialTemplates: any[];
  initialQueue: any[];
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  push: "পুশ (FCM)",
  whatsapp: "হোয়াটসঅ্যাপ",
  sms: "এসএমএস (SMS)",
  email: "ইমেইল (Resend)",
  in_app: "ইন-অ্যাপ",
};

export default function NotificationOrchestratorClient({ initialTemplates, initialQueue }: Props) {
  const [templates, setTemplates] = useState<any[]>(initialTemplates);
  const [queue, setQueue] = useState<any[]>(initialQueue);
  const [activeTab, setActiveTab] = useState<"templates" | "queue" | "test">("templates");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Template form state
  const [templateKey, setTemplateKey] = useState("fee_overdue_reminder");
  const [eventName, setEventName] = useState("fee.overdue");
  const [title, setTitle] = useState("বকেয়া ফি রিমাইন্ডার");
  const [channel, setChannel] = useState<NotificationChannel>("whatsapp");
  const [subject, setSubject] = useState("মাদ্রাসা ফি বকেয়া বিজ্ঞপ্তি");
  const [body, setBody] = useState(
    "আসসালামু আলাইকুম, {StudentName} (রোল: [রোল]) এর {DueAmount} টাকা ফি বকেয়া রয়েছে। পরিশোধ করুন: [পেমেন্ট লিংক]"
  );

  // Test dispatch state
  const [testEvent, setTestEvent] = useState("fee.overdue");
  const [testPhone, setTestPhone] = useState("01712345678");
  const [testEmail, setTestEmail] = useState("");
  const [testBody, setTestBody] = useState("প্রিয় অভিভাবক, {StudentName} এর বকেয়া {DueAmount} টাকা।");
  const [testStudentName, setTestStudentName] = useState("মোঃ আব্দুল্লাহ");
  const [testDueAmount, setTestDueAmount] = useState("১,৫০০");

  const refreshData = () => {
    startTransition(async () => {
      const [t, q] = await Promise.all([
        getNotificationTemplatesAction(),
        getNotificationQueueAction(50),
      ]);
      setTemplates(t.templates || []);
      setQueue(q.items || []);
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await saveNotificationTemplateAction({
        template_key: templateKey,
        event_name: eventName,
        title,
        channel,
        subject,
        body,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({ type: "ok", text: "টেমপ্লেট সফলভাবে সংরক্ষিত হয়েছে।" });
        const t = await getNotificationTemplatesAction();
        setTemplates(t.templates || []);
      }
    });
  };

  const handleDeleteTemplate = (id: string) => {
    startTransition(async () => {
      const res = await deleteNotificationTemplateAction(id);
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setTemplates((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const handleProcessQueue = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await processNotificationQueueAction(50);
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res.summary) {
        setFeedback({
          type: "ok",
          text: `কিউ প্রসেস সম্পন্ন: মোট ${toBanglaNumber(res.summary.processed)}টি, পাঠানো হয়েছে ${toBanglaNumber(res.summary.sent)}টি, ব্যর্থ ${toBanglaNumber(res.summary.failed)}টি।`,
        });
        const q = await getNotificationQueueAction(50);
        setQueue(q.items || []);
      }
    });
  };

  const handleTestDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await sendTestNotificationAction({
        event: testEvent,
        recipientPhone: testPhone || undefined,
        recipientEmail: testEmail || undefined,
        body: testBody,
        variables: {
          StudentName: testStudentName,
          DueAmount: testDueAmount,
        },
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({
          type: res.result?.ok ? "ok" : "err",
          text: res.result?.ok
            ? `টেস্ট নোটিফিকেশন সফল (${res.result.deliveredChannel}): ${res.result.renderedBody}`
            : `সব চ্যানেলে ডেলিভারি ব্যর্থ (${res.result?.status}): ${res.result?.error || ""}`,
        });
        const q = await getNotificationQueueAction(50);
        setQueue(q.items || []);
      }
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Bell className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            মাল্টি-চ্যানেল নোটিফিকেশন অর্কেস্ট্রেটর
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            পুশ (FCM) → হোয়াটসঅ্যাপ → এসএমএস → ইমেইল → ইন-অ্যাপ ফলব্যাক চেইন ও টেমপ্লেট ব্যবস্থাপনা
          </p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          রিফ্রেশ করুন
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: "templates", label: `টেমপ্লেট (${toBanglaNumber(templates.length)})` },
          { id: "queue", label: `ডেলিভারি কিউ (${toBanglaNumber(queue.length)})` },
          { id: "test", label: "টেস্ট ডিসপ্যাচ" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleSaveTemplate}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Plus className="h-5 w-5 text-emerald-600" />
              নতুন বা আপডেট টেমপ্লেট
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  টেমপ্লেট কী
                </label>
                <input
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  ইভেন্ট নাম
                </label>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  শিরোনাম
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  প্রাথমিক চ্যানেল
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                বিষয় (Subject)
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                বার্তা ({`{StudentName}`}, [ছাত্রের নাম], {`{DueAmount}`}, [বকেয়া টাকা])
              </label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              টেমপ্লেট সংরক্ষণ করুন
            </button>
          </form>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              সংরক্ষিত টেমপ্লেটসমূহ
            </h2>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">কোনো টেমপ্লেট পাওয়া যায়নি।</p>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t.event_name} · {CHANNEL_LABELS[t.channel as NotificationChannel] || t.channel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{t.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "queue" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              সাম্প্রতিক নোটিফিকেশন ডেলিভারি কিউ
            </h2>
            <button
              type="button"
              onClick={handleProcessQueue}
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              পেন্ডিং কিউ প্রসেস করুন
            </button>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">কিউতে কোনো আইটেম নেই।</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">ইভেন্ট</th>
                    <th className="py-2 pr-3">চ্যানেল</th>
                    <th className="py-2 pr-3">প্রাপক</th>
                    <th className="py-2 pr-3">অবস্থা</th>
                    <th className="py-2">বার্তা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queue.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                        {item.event_name}
                      </td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                        {CHANNEL_LABELS[item.channel as NotificationChannel] || item.channel}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">
                        {item.recipient_phone || item.recipient_email || "ইন-অ্যাপ"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.status === "SENT"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : item.status === "FAILED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {item.status === "SENT" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : item.status === "FAILED" ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                        {String(item.body || "").slice(0, 80)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "test" && (
        <form
          onSubmit={handleTestDispatch}
          className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Send className="h-5 w-5 text-emerald-600" />
            টেস্ট নোটিফিকেশন পাঠান
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                ইভেন্ট
              </label>
              <input
                value={testEvent}
                onChange={(e) => setTestEvent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                মোবাইল নম্বর
              </label>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                StudentName
              </label>
              <input
                value={testStudentName}
                onChange={(e) => setTestStudentName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                DueAmount
              </label>
              <input
                value={testDueAmount}
                onChange={(e) => setTestDueAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              ইমেইল (ঐচ্ছিক)
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              বার্তা
            </label>
            <textarea
              rows={3}
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            পাঠান
          </button>
        </form>
      )}
    </div>
  );
}
