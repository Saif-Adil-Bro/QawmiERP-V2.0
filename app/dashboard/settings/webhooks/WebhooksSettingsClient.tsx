"use client";

import { useState, useTransition } from "react";
import { Webhook, Plus, RotateCw, Send, Trash2, RefreshCw } from "lucide-react";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  getWebhookDeliveriesAction,
  getWebhookEndpointsAction,
  retryWebhookDeliveriesAction,
  rotateWebhookSecretAction,
  testWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "@/app/actions/webhooks";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  initialEndpoints: any[];
  initialDeliveries: any[];
}

const AVAILABLE_EVENTS = [
  "payment.confirmed",
  "student.admitted",
  "exam.result_published",
  "*",
];

export default function WebhooksSettingsClient({ initialEndpoints, initialDeliveries }: Props) {
  const [endpoints, setEndpoints] = useState<any[]>(initialEndpoints);
  const [deliveries, setDeliveries] = useState<any[]>(initialDeliveries);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "payment.confirmed",
    "student.admitted",
    "exam.result_published",
  ]);

  const reload = () => {
    startTransition(async () => {
      const [e, d] = await Promise.all([
        getWebhookEndpointsAction(),
        getWebhookDeliveriesAction(50),
      ]);
      setEndpoints(e.endpoints || []);
      setDeliveries(d.deliveries || []);
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setRevealedSecret(null);
    startTransition(async () => {
      const res = await createWebhookEndpointAction({
        name: name || "বাইরের ইন্টিগ্রেশন",
        url,
        subscribed_events: selectedEvents,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({ type: "ok", text: "নতুন ওয়েবহুক এন্ডপয়েন্ট যুক্ত হয়েছে।" });
        if (res.signingSecret) setRevealedSecret(res.signingSecret);
        setName("");
        setUrl("");
        reload();
      }
    });
  };

  const handleRotate = (id: string) => {
    setRevealedSecret(null);
    startTransition(async () => {
      const res = await rotateWebhookSecretAction(id);
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({ type: "ok", text: "নতুন সাইনিং সিক্রেট তৈরি হয়েছে।" });
        if (res.signingSecret) setRevealedSecret(res.signingSecret);
      }
    });
  };

  const handleTest = (id: string) => {
    startTransition(async () => {
      const res = await testWebhookEndpointAction(id);
      setFeedback({
        type: res.ok ? "ok" : "err",
        text: res.ok
          ? `টেস্ট পিং সফল হয়েছে (HTTP ${res.responseStatus || 200})`
          : `টেস্ট পিং ব্যর্থ: ${res.error || "অজানা ত্রুটি"}`,
      });
      const d = await getWebhookDeliveriesAction(50);
      setDeliveries(d.deliveries || []);
    });
  };

  const handleRetryQueue = () => {
    startTransition(async () => {
      const res = await retryWebhookDeliveriesAction();
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res.summary) {
        setFeedback({
          type: "ok",
          text: `রিট্রাই সম্পন্ন: প্রসেসড ${toBanglaNumber(res.summary.processed)}টি, সফল ${toBanglaNumber(res.summary.delivered)}টি।`,
        });
        const d = await getWebhookDeliveriesAction(50);
        setDeliveries(d.deliveries || []);
      }
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Webhook className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            ওয়েবহুক ও এক্সটার্নাল ইন্টিগ্রেশন হাব
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            HMAC-SHA256 স্বাক্ষরিত রিয়েল-টাইম ইভেন্ট ডেলিভারি, SSRF সুরক্ষা ও রিট্রাই কিউ
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRetryQueue}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            পেন্ডিং রিট্রাই চালান
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </button>
        </div>
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

      {revealedSecret && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">নতুন সাইনিং সিক্রেট (শুধু একবার দেখানো হচ্ছে — নিরাপদে সংরক্ষণ করুন):</p>
          <code className="mt-1 block break-all rounded bg-white/80 px-2 py-1 font-mono text-xs dark:bg-slate-900">
            {revealedSecret}
          </code>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Plus className="h-5 w-5 text-indigo-600" />
            নতুন ওয়েবহুক এন্ডপয়েন্ট
          </h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              নাম
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: ওয়েবসাইট পোর্টাল"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              HTTPS Endpoint URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/qawmi"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              সাবস্ক্রাইবড ইভেন্টসমূহ
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((ev) => {
                const active = selectedEvents.includes(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() =>
                      setSelectedEvents((prev) =>
                        active ? prev.filter((x) => x !== ev) : [...prev, ev]
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            এন্ডপয়েন্ট যুক্ত করুন
          </button>
        </form>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            নিবন্ধিত এন্ডপয়েন্ট ({toBanglaNumber(endpoints.length)})
          </h2>
          {endpoints.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">কোনো এন্ডপয়েন্ট নেই।</p>
          ) : (
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{ep.name}</p>
                      <p className="break-all text-xs text-slate-500 dark:text-slate-400">{ep.url}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        সিক্রেট: {ep.signing_secret_masked || "****"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleTest(ep.id)}
                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="টেস্ট পিং"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotate(ep.id)}
                        className="rounded p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        title="সিক্রেট রোটেশন"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await deleteWebhookEndpointAction(ep.id);
                            reload();
                          })
                        }
                        className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      ইভেন্ট: {(ep.subscribed_events || []).join(", ")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await toggleWebhookEndpointAction(ep.id, !ep.is_active);
                          reload();
                        })
                      }
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        ep.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {ep.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          সাম্প্রতিক ডেলিভারি লগ ({toBanglaNumber(deliveries.length)})
        </h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">কোনো ডেলিভারি লগ নেই।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">ইভেন্ট</th>
                  <th className="py-2 pr-3">অবস্থা</th>
                  <th className="py-2 pr-3">চেষ্টা</th>
                  <th className="py-2 pr-3">HTTP স্ট্যাটাস</th>
                  <th className="py-2">ত্রুটি</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                      {d.event_type}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : d.status === "FAILED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                      {toBanglaNumber(d.attempt_count)} / {toBanglaNumber(d.max_attempts)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                      {d.response_status || "—"}
                    </td>
                    <td className="py-2 text-xs text-rose-600 dark:text-rose-400">
                      {d.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
