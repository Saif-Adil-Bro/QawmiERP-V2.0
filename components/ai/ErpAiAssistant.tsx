"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import {
  Bot,
  X,
  Send,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ShieldAlert,
  Mic,
  Square,
  Volume2,
  VolumeX,
  AlertTriangle,
} from "lucide-react";

const ACTION_LABELS_BN: Record<string, string> = {
  create_expense: "খরচ এন্ট্রি",
  add_expense: "খরচ এন্ট্রি",
  collect_fee: "ফি আদায়",
  create_student_fee: "বকেয়া ফি তৈরি",
  send_due_fee_reminders: "বকেয়া তাগাদা",
  send_absent_guardian_notices: "অনুপস্থিতি নোটিশ",
  trigger_risk_recalculation: "ঝুঁকি গণনা",
  trigger_anomaly_scan: "অসঙ্গতি স্ক্যান",
  submit_approval_decision: "অনুমোদন সিদ্ধান্ত",
  create_notice: "নোটিশ প্রকাশ",
  mark_attendance: "হাজিরা মার্ক",
  create_student: "নতুন ভর্তি",
  enter_exam_mark: "নম্বর এন্ট্রি",
  create_question: "প্রশ্ন সংরক্ষণ",
};

const PAYLOAD_KEY_LABELS_BN: Record<string, string> = {
  category: "খাত",
  amount: "পরিমাণ (৳)",
  description: "বিবরণ",
  expenseDate: "তারিখ",
  date: "তারিখ",
  className: "জামাত",
  feeTypeName: "ফি-র ধরন",
  billingPeriod: "বিলিং মাস",
  paymentMethod: "মাধ্যম",
  studentName: "শিক্ষার্থী",
  attendanceStatus: "অবস্থা",
  noticeTitle: "শিরোনাম",
  decision: "সিদ্ধান্ত",
  notes: "মন্তব্য",
  lookbackDays: "সময়সীমা (দিন)",
};

const QUICK_SUGGESTIONS = [
  "আজকের হাজিরা ও হিসাবের সামারি দাও",
  "বকেয়া ফি-র তালিকা দেখাও",
  "৫০০ টাকা বিদ্যুৎ বিল খরচ এন্ট্রি করো",
  "আমাকে শিক্ষার্থী তালিকায় নিয়ে যাও",
];

interface ActionState {
  status: "pending" | "loading" | "confirmed" | "cancelled" | "error";
  message?: string;
}

const CHAT_STORAGE_KEY = "qawmi_ai_chat_history";
const ACTION_STORAGE_KEY = "qawmi_ai_action_states";

export function ErpAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceAutoSend, setVoiceAutoSend] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigatedIdsRef = useRef<Set<string>>(new Set());
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>("");
  const latestTranscriptRef = useRef<string>("");
  const voiceAutoSendRef = useRef<boolean>(true);
  const isLoadingRef = useRef<boolean>(false);
  const lastAutoSpokenIdRef = useRef<string | null>(null);
  const router = useRouter();

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  voiceAutoSendRef.current = voiceAutoSend;
  isLoadingRef.current = isLoading;

  // Restore saved chat history & action states on mount
  useEffect(() => {
    try {
      const savedMsgs = localStorage.getItem(CHAT_STORAGE_KEY);
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Mark historical navigate tool calls as already handled so refresh won't redirect
          for (const m of parsed) {
            for (const part of (m.parts || []) as any[]) {
              if (
                part.type?.startsWith("tool-") &&
                part.state === "output-available" &&
                part.output?.type === "navigate" &&
                part.output?.path
              ) {
                const key = part.toolCallId || `${m.id}-${part.output.path}`;
                navigatedIdsRef.current.add(key);
              }
            }
          }
          setMessages(parsed);
        }
      }

      const savedActions = localStorage.getItem(ACTION_STORAGE_KEY);
      if (savedActions) {
        const parsedActions = JSON.parse(savedActions);
        if (parsedActions && typeof parsedActions === "object") {
          setActionStates(parsedActions);
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      setHydrated(true);
    }
  }, [setMessages]);

  // Save chat history whenever messages update
  useEffect(() => {
    if (!hydrated) return;
    try {
      const trimmed = messages.slice(-40);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore quota errors
    }
  }, [messages, hydrated]);

  // Save action states whenever they update
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ACTION_STORAGE_KEY, JSON.stringify(actionStates));
    } catch {
      // Ignore quota errors
    }
  }, [actionStates, hydrated]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Auto-navigate when AI agent invokes navigateToPage
  useEffect(() => {
    for (const msg of messages) {
      for (const part of (msg.parts || []) as any[]) {
        if (
          part.type?.startsWith("tool-") &&
          part.state === "output-available" &&
          part.output?.type === "navigate" &&
          part.output?.path
        ) {
          const key = part.toolCallId || `${msg.id}-${part.output.path}`;
          if (!navigatedIdsRef.current.has(key)) {
            navigatedIdsRef.current.add(key);
            router.push(part.output.path);
          }
        }
      }
    }
  }, [messages, router]);

  const stopSpeech = () => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    setSpeakingMsgId(null);
  };

  const speakBangla = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    if (speakingMsgId === msgId) {
      stopSpeech();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "bn-BD";
      const voices = window.speechSynthesis.getVoices();
      const bnVoice =
        voices.find((v) => v.lang.toLowerCase() === "bn-bd") ||
        voices.find((v) => v.lang.toLowerCase().startsWith("bn"));
      if (bnVoice) {
        utterance.voice = bnVoice;
      }
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      setSpeakingMsgId(msgId);
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeakingMsgId(null);
    }
  };

  // Auto-speak assistant response when streaming finishes if TTS is enabled
  useEffect(() => {
    if (!ttsEnabled || isLoading || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant" || lastAutoSpokenIdRef.current === last.id) {
      return;
    }
    const text = (last.parts || [])
      .filter((p: any) => p.type === "text" && p.text)
      .map((p: any) => p.text)
      .join(" ")
      .trim();
    if (text) {
      lastAutoSpokenIdRef.current = last.id;
      speakBangla(text, last.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, ttsEnabled]);

  const stopVoice = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      stopSpeech();
    };
  }, []);

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (isListening) {
      stopVoice();
      return;
    }

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setVoiceError("আপনার ব্রাউজার ভয়েস ইনপুট সাপোর্ট করে না (Chrome ব্যবহার করুন)।");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "bn-BD";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseInputRef.current = input.trim() ? `${input.trim()} ` : "";
      latestTranscriptRef.current = "";

      recognition.onresult = (event: any) => {
        const result = event.results?.[0];
        const transcript = result?.[0]?.transcript || "";
        const combined = `${baseInputRef.current}${transcript}`.trimStart();
        latestTranscriptRef.current = combined;
        setInput(combined);
      };

      recognition.onerror = (event: any) => {
        if (event?.error === "not-allowed") {
          setVoiceError("মাইক্রোফোন ব্যবহারের অনুমতি দিন।");
        } else if (event?.error !== "aborted") {
          setVoiceError("ভয়েস বুঝতে সমস্যা হয়েছে, আবার চেষ্টা করুন।");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        const finalText = latestTranscriptRef.current.trim();
        if (
          voiceAutoSendRef.current &&
          finalText &&
          !isLoadingRef.current
        ) {
          latestTranscriptRef.current = "";
          setInput("");
          void sendMessage({ text: finalText });
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError("ভয়েস চালু করা যায়নি।");
      setIsListening(false);
    }
  };

  const handleSend = async (text?: string) => {
    if (isListening) stopVoice();
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    if (!text) setInput("");
    await sendMessage({ text: content });
  };

  const handleConfirmAction = async (actionId: string, actionType: string, payload: any) => {
    setActionStates((prev) => ({ ...prev, [actionId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/ai/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionStates((prev) => ({
          ...prev,
          [actionId]: { status: "error", message: data?.error || "ব্যর্থ হয়েছে।" },
        }));
        return;
      }
      setActionStates((prev) => ({
        ...prev,
        [actionId]: { status: "confirmed", message: data?.message || "সফলভাবে সম্পন্ন হয়েছে!" },
      }));
    } catch {
      setActionStates((prev) => ({
        ...prev,
        [actionId]: { status: "error", message: "নেটওয়ার্ক সমস্যা হয়েছে।" },
      }));
    }
  };

  const handleCancelAction = (actionId: string) => {
    setActionStates((prev) => ({
      ...prev,
      [actionId]: { status: "cancelled", message: "কাজটি বাতিল করা হয়েছে।" },
    }));
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-900/25 border border-emerald-400/30 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer print:hidden"
          title="QawmiERP এআই সহায়ক খুলুন"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300" />
          </div>
          <span className="text-xs font-extrabold hidden sm:inline">এআই সহায়ক</span>
        </button>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-6 lg:bottom-6 z-50 sm:w-[410px] h-[72dvh] max-h-[600px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 print:hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold leading-tight">QawmiERP এআই সহায়ক</h3>
                <p className="text-[11px] text-emerald-200/80">তাৎক্ষণিক গাইড, সার্চ ও অ্যাকশন</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setVoiceAutoSend((v) => !v)}
                className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                  voiceAutoSend
                    ? "bg-emerald-500/30 border-emerald-300/50 text-white"
                    : "bg-white/10 border-white/20 text-emerald-100/70"
                }`}
                title="ভয়েস শেষ হলে স্বয়ংক্রিয়ভাবে পাঠান"
              >
                অটো-সেন্ড
              </button>
              <button
                type="button"
                onClick={() => {
                  if (ttsEnabled) stopSpeech();
                  setTtsEnabled((v) => !v);
                }}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  ttsEnabled
                    ? "bg-white/25 text-amber-200"
                    : "hover:bg-white/15 text-emerald-100"
                }`}
                title={ttsEnabled ? "বাংলা ভয়েস উত্তর বন্ধ করুন" : "বাংলা ভয়েস উত্তর চালু করুন"}
              >
                {ttsEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeech();
                    setMessages([]);
                    setActionStates({});
                    try {
                      localStorage.removeItem(CHAT_STORAGE_KEY);
                      localStorage.removeItem(ACTION_STORAGE_KEY);
                    } catch {}
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/15 text-emerald-100 transition cursor-pointer"
                  title="চ্যাট মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopSpeech();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-xl hover:bg-white/15 text-white transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Viewport */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/70 dark:bg-slate-950/50">
            {messages.length === 0 && (
              <div className="space-y-3 py-2">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-2xs">
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    আসসালামু আলাইকুম! আমি আপনার QawmiERP এআই সহায়ক।
                  </p>
                  ছাত্র-শিক্ষক খোঁজা, আজকের হাজিরা বা হিসাব দেখা, পেজে নেভিগেট করা—যেকোনো কাজে আমাকে প্রশ্ন করতে পারেন।
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    দ্রুত প্রশ্ন করুন
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSend(q)}
                        className="text-left text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1.5`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-br-sm shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-bl-sm shadow-2xs"
                    }`}
                  >
                    {msg.parts.map((part: any, idx: number) => {
                      if (part.type === "text") {
                        return <span key={idx}>{part.text}</span>;
                      }

                      // Navigation Tool Output
                      if (
                        part.type?.startsWith("tool-") &&
                        part.state === "output-available" &&
                        part.output?.type === "navigate"
                      ) {
                        return (
                          <div key={idx} className="mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                router.push(part.output.path);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                            >
                              <span>{part.output.label}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      // Write Action Confirmation Card (Rich Preview)
                      if (
                        part.type?.startsWith("tool-") &&
                        part.state === "output-available" &&
                        part.output?.requiresConfirmation
                      ) {
                        const {
                          actionId,
                          actionType,
                          title,
                          summary,
                          payload,
                          preview,
                          riskLevel,
                          warnings,
                        } = part.output;
                        const state = actionStates[actionId] || { status: "pending" };
                        const actionBadge = ACTION_LABELS_BN[actionType] || actionType;
                        const payloadEntries = Object.entries(payload || {}).filter(
                          ([, v]) => v !== undefined && v !== null && v !== ""
                        );
                        const previewItems = Array.isArray(preview?.items)
                          ? preview.items
                          : [];
                        const hasHighRisk =
                          riskLevel === "HIGH" ||
                          riskLevel === "CRITICAL" ||
                          (Array.isArray(warnings) && warnings.length > 0);

                        return (
                          <div
                            key={idx}
                            className="mt-2 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-extrabold text-amber-900 dark:text-amber-300 text-xs">
                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                <span>{title}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 shrink-0">
                                {actionBadge}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 dark:text-slate-300">
                              {summary}
                            </p>

                            {hasHighRisk && (
                              <div className="p-2 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                  {Array.isArray(warnings) && warnings.length > 0
                                    ? warnings.join(" • ")
                                    : "সতর্কতা: এটি একটি উচ্চ-ঝুঁকিপূর্ণ অ্যাকশন, অনুগ্রহ করে তথ্য যাচাই করুন।"}
                                </span>
                              </div>
                            )}

                            {payloadEntries.length > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/70 dark:border-amber-800/50 text-[10px]">
                                {payloadEntries.slice(0, 8).map(([k, v]) => (
                                  <div key={k} className="truncate">
                                    <span className="text-slate-500 dark:text-slate-400">
                                      {PAYLOAD_KEY_LABELS_BN[k] || k}:{" "}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {previewItems.length > 0 && (
                              <ul className="space-y-1 text-[10px] text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 rounded-xl p-2">
                                {previewItems.slice(0, 5).map((item: any, i: number) => (
                                  <li key={i} className="truncate">
                                    • {typeof item === "string" ? item : JSON.stringify(item)}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {state.status === "pending" && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAction(actionId, actionType, payload)}
                                  className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>নিশ্চিত করুন</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelAction(actionId)}
                                  className="py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>বাতিল</span>
                                </button>
                              </div>
                            )}

                            {state.status === "loading" && (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>সংরক্ষণ হচ্ছে...</span>
                              </div>
                            )}

                            {state.status === "confirmed" && (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{state.message}</span>
                              </div>
                            )}

                            {state.status === "cancelled" && (
                              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {state.message}
                              </div>
                            )}

                            {state.status === "error" && (
                              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                {state.message}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                  {!isUser && (() => {
                    const plainText = (msg.parts || [])
                      .filter((p: any) => p.type === "text" && p.text)
                      .map((p: any) => p.text)
                      .join(" ")
                      .trim();
                    if (!plainText) return null;
                    const isSpeaking = speakingMsgId === msg.id;
                    return (
                      <button
                        type="button"
                        onClick={() => speakBangla(plainText, msg.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        {isSpeaking ? (
                          <>
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>থামান</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>শুনুন</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>এআই সহায়ক চিন্তা করছে...</span>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {error.message || "দুঃখিত, এই মুহূর্তে উত্তর আনা সম্ভব হয়নি।"}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Status / Error Strip */}
          {(isListening || voiceError) && (
            <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] shrink-0">
              {isListening ? (
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>শুনছি... বাংলায় কথা বলুন (থামাতে লাল বাটনে চাপুন)</span>
                </div>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-medium">{voiceError}</span>
              )}
              {voiceError && (
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading}
              className={`p-2.5 rounded-2xl transition cursor-pointer shrink-0 ${
                isListening
                  ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-md shadow-rose-600/30"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
              title={isListening ? "ভয়েস থামান" : "ভয়েস দিয়ে লিখুন (বাংলা)"}
            >
              {isListening ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "কথা বলুন, টেক্সট লেখা হচ্ছে..." : "লিখুন বা মাইকে বলুন..."}
              className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition cursor-pointer shrink-0"
              title="পাঠান"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
