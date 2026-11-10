"use client";

import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  Filter,
  Printer,
  Heart,
  Info,
} from "lucide-react";
import {
  MAKHRAJ_LIST,
  NOORANI_TAKHTIS,
  MakhrajItem,
  NooraniTakhti,
} from "@/lib/noorani-utils";

export default function MakhrajAudioGuide() {
  const [activeTab, setActiveTab] = useState<"makharij" | "takhtis">("makharij");
  const [selectedOrgan, setSelectedOrgan] = useState<string>("ALL");
  const [activePlayingId, setActivePlayingId] = useState<number | null>(null);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      setSpeechSupported(false);
    }
  }, []);

  // Play pronunciation via Web Speech API with Arabic locale fallback to Web Audio Tone
  const playPronunciation = (lettersArabic: string, id: number) => {
    setActivePlayingId(id);

    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel(); // Stop any previous speech

        // Split letters or play clean Arabic text
        const cleanText = lettersArabic.replace(/[،,]/g, " ").trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "ar-SA"; // Arabic Saudi Arabia
        utterance.rate = 0.75; // Slower rate for clear Makhraj
        utterance.pitch = 1.0;

        utterance.onend = () => {
          setActivePlayingId(null);
        };

        utterance.onerror = () => {
          // Fallback to pleasant synthetic audio chime
          playSyntheticTone();
          setActivePlayingId(null);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        playSyntheticTone();
        setTimeout(() => setActivePlayingId(null), 800);
      }
    } catch {
      playSyntheticTone();
      setTimeout(() => setActivePlayingId(null), 800);
    }
  };

  const playSyntheticTone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // AudioContext not supported
    }
  };

  // Unique organs for filter
  const organs = [
    { key: "ALL", label: "সকল মাখরাজ (১৭টি)" },
    { key: "হালক (কণ্ঠনালী)", label: "الحلق (কণ্ঠনালী - ৩টি)" },
    { key: "লেসান (জিহ্বা)", label: "اللسان (জিহ্বা - ১০টি)" },
    { key: "শাফাতান (দুই ঠোঁট)", label: "الشفتان (দুই ঠোঁট - ২টি)" },
    { key: "জওফ (মুখের খালি জায়গা)", label: "الجوف (মুখের খালি জায়গা - ১টি)" },
    { key: "খাইশুম (নাকের বাঁশি)", label: "الخيشوم (নাকের বাঁশি - ১টি)" },
  ];

  const filteredMakharij =
    selectedOrgan === "ALL"
      ? MAKHRAJ_LIST
      : MAKHRAJ_LIST.filter((m) => m.organ.includes(selectedOrgan.replace(/ \(.*/, "")));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 text-white shadow-xl relative overflow-hidden print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>অভিভাবক ও শিশুদের তাজবীদ ল্যাব</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              নূরানী কায়দা ও ১৭ মাখরাজ ইন্টারেক্টিভ অডিও গাইড
            </h1>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 max-w-2xl">
              ঘরে বসে শিশুকে সহীহ উচ্চারণে কুরআন ও নূরানী কায়দা অনুশীলনের জন্য প্রতিটি হরফের মাখরাজ, উচ্চারণ কৌশল ও অডিও শুনুন।
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium backdrop-blur transition-all border border-white/20"
            >
              <Printer className="w-4 h-4" />
              <span>মাখরাজ শিট প্রিন্ট</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3 print:hidden">
        <button
          onClick={() => setActiveTab("makharij")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "makharij"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          ১৭ মাখরাজ ও উচ্চারণ অডিও ({MAKHRAJ_LIST.length})
        </button>
        <button
          onClick={() => setActiveTab("takhtis")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "takhtis"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          নূরানী কায়দার ২৭ তখতি নির্দেশিকা ({NOORANI_TAKHTIS.length})
        </button>
      </div>

      {/* Tab 1: 17 Makharij */}
      {activeTab === "makharij" && (
        <div className="space-y-4">
          {/* Organ Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none print:hidden">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
            {organs.map((org) => (
              <button
                key={org.key}
                onClick={() => setSelectedOrgan(org.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedOrgan === org.key
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {org.label}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMakharij.map((makhraj) => {
              const isPlaying = activePlayingId === makhraj.id;

              return (
                <div
                  key={makhraj.id}
                  className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group"
                >
                  {/* Top Bar */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                          {makhraj.numberBangla}
                        </span>
                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            {makhraj.organ} ({makhraj.organArabic})
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-foreground leading-tight">
                            {makhraj.name}
                          </h3>
                        </div>
                      </div>

                      <button
                        onClick={() => playPronunciation(makhraj.lettersArabic, makhraj.id)}
                        className={`p-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center ${
                          isPlaying
                            ? "bg-emerald-600 text-white animate-pulse"
                            : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                        }`}
                        title="উচ্চারণ অডিও শুনুন"
                      >
                        {isPlaying ? (
                          <Volume2 className="w-5 h-5 text-white animate-bounce" />
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                      </button>
                    </div>

                    {/* Arabic Letter Showcase Box */}
                    <div className="bg-gradient-to-b from-muted/50 to-muted/20 border border-border/60 rounded-xl p-4 text-center my-3">
                      <div
                        className="text-4xl font-serif text-emerald-700 dark:text-emerald-400 font-bold tracking-widest my-1 select-all"
                        dir="rtl"
                      >
                        {makhraj.lettersArabic}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                        {makhraj.letters.map((ltr, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-background border border-border/60 text-[11px] font-medium text-foreground"
                          >
                            {ltr}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      {makhraj.description}
                    </p>
                  </div>

                  {/* Parent Practice Tip Footer */}
                  <div className="pt-3 border-t border-border/50 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 -mx-5 -mb-5 p-3 rounded-b-2xl border-emerald-500/10">
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <strong>অভিভাবকের মশক পরামর্শ:</strong>{" "}
                        {makhraj.id <= 3
                          ? "গলায় হাত দিয়ে কম্পন ও বাতাসের তারতম্য শিশুকে বুঝিয়ে উচ্চারণ করান।"
                          : makhraj.id === 7
                          ? "দ্বদ (ض) হরফটি জিহ্বার কিনারা মাড়ির দাঁতের গোড়ায় চেপে ধীরে উচ্চারণ করান, যেন ড বা য না হয়ে যায়।"
                          : makhraj.id === 17
                          ? "নাকের বাঁশিতে বাতাস আটকে গুন্নাহর রেশ ১ আলিফ ধরে রাখুন।"
                          : "হরফের মাখরাজে জিহ্বা ঠিকমতো স্পর্শ করছে কিনা শিশুকে আয়নার সামনে রেখে দেখান।"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: 27 Takhtis Guide */}
      {activeTab === "takhtis" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm">
                নূরানী কায়দার ২৭ তখতির পর্যায়ক্রমিক পাঠক্রম
              </p>
              <p>
                প্রতিটি তখতি শিশুকে ভালোভাবে আয়ত্ত করিয়ে তবেই পরবর্তী তখতিতে নিয়ে যান। নিয়মিত হোম প্র্যাকটিসের মাধ্যমে শিশুর ভিত মজবুত হবে।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {NOORANI_TAKHTIS.map((takhti: NooraniTakhti) => (
              <div
                key={takhti.id}
                className="bg-card border border-border/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                      {takhti.numberBangla}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {takhti.totalSubLessons} টি উপ-পাঠ
                    </span>
                  </div>

                  <h3 className="font-bold text-foreground text-sm leading-tight mb-1">
                    তখতি নং {takhti.numberBangla}: {takhti.title}
                  </h3>

                  <div className="p-3 bg-muted/30 rounded-xl my-2.5 text-center">
                    <span
                      className="text-2xl font-serif text-emerald-700 dark:text-emerald-400 font-bold"
                      dir="rtl"
                    >
                      {takhti.arabicExample}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {takhti.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground block mb-1">শিক্ষণ লক্ষ্য:</span>
                  <div className="flex flex-wrap gap-1">
                    {takhti.learningObjectives.map((obj: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px]"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
