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
} from "lucide-react";

const QUICK_SUGGESTIONS = [
  "আজকের হাজিরা ও হিসাবের সামারি দাও",
  "নতুন ছাত্র ভর্তি করার নিয়ম কী?",
  "বকেয়া ফি-র তালিকা দেখাও",
  "৫০০ টাকা বিদ্যুৎ বিল খরচ এন্ট্রি করো",
];

interface ActionState {
  status: "pending" | "loading" | "confirmed" | "cancelled" | "error";
  message?: string;
}

export function ErpAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (text?: string) => {
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
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setActionStates({});
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/15 text-emerald-100 transition cursor-pointer"
                  title="চ্যাট মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
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

                      // Write Action Confirmation Card
                      if (
                        part.type?.startsWith("tool-") &&
                        part.state === "output-available" &&
                        part.output?.requiresConfirmation
                      ) {
                        const { actionId, actionType, title, summary, payload } = part.output;
                        const state = actionStates[actionId] || { status: "pending" };
                        return (
                          <div
                            key={idx}
                            className="mt-2 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2"
                          >
                            <div className="flex items-center gap-1.5 font-extrabold text-amber-900 dark:text-amber-300 text-xs">
                              <ShieldAlert className="w-4 h-4 shrink-0" />
                              <span>{title}</span>
                            </div>
                            <p className="text-[11px] text-slate-700 dark:text-slate-300">{summary}</p>

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

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="আপনার প্রশ্ন লিখুন..."
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
