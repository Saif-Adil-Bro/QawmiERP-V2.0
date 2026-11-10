"use client";

import { useState, useTransition } from "react";
import { saveAssignment } from "@/app/actions/assignments";
import { X, Heart, Smile, Moon, Utensils, BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { toDhakaDateString } from "@/lib/date-utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classes: { id: string; name: string }[];
  teachers: any[];
  defaultTeacherName?: string;
  onSuccess?: () => void;
}

export default function KidsDailyDiaryModal({
  isOpen,
  onClose,
  classes,
  teachers,
  defaultTeacherName = "উস্তাদ",
  onSuccess,
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [date, setDate] = useState(toDhakaDateString());
  const [mealStatus, setMealStatus] = useState<"FULL" | "PARTIAL" | "MINIMAL" | "SKIPPED">("FULL");
  const [napStatus, setNapStatus] = useState<"SLEPT_WELL" | "RESTLESS" | "NO_NAP">("SLEPT_WELL");
  const [moodStatus, setMoodStatus] = useState<"HAPPY" | "CALM" | "CRYING" | "PLAYFUL">("HAPPY");
  const [handwriting, setHandwriting] = useState<"EXCELLENT" | "GOOD" | "NEEDS_PRACTICE">("EXCELLENT");
  const [qaidaPage, setQaidaPage] = useState("");
  const [homeworkText, setHomeworkText] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const title = `${selectedClass?.name || "শিশু বিভাগ"} - দৈনিক শিশু কেয়ার ও ডায়েরি`;
    const description = `পড়া/কাজ: ${homeworkText || "স্বাভাবিক পাঠ"}. কায়দা/কুরআন: ${qaidaPage || "নিয়মিত মশক"}. শিক্ষক মন্তব্য: ${remarks || "আজকের দিনটি চমৎকার কেটেছে।"}`;

    startTransition(async () => {
      const res = await saveAssignment({
        title,
        type: "KIDS_DIARY",
        target_type: "CLASS",
        class_id: selectedClassId,
        class_name: selectedClass?.name || "শিশু শ্রেণি",
        subject_name: "নূরানী দ্বীনিয়াত ও শিশু কেয়ার",
        description,
        assigned_date: date,
        teacher_name: defaultTeacherName,
        kids_care: {
          meal_status: mealStatus,
          nap_status: napStatus,
          mood_status: moodStatus,
          handwriting_rating: handwriting,
          quran_qaida_page: qaidaPage,
          teacher_remarks: remarks,
        },
      });

      if ((res as any)?.error) {
        setErrorMsg((res as any).error);
      } else {
        if (onSuccess) onSuccess();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ছোটদের দৈনিক কেয়ার ও ডায়েরি এন্ট্রি</h2>
              <p className="text-xs text-rose-100 mt-0.5">খাবার, ঘুম, পড়া ও আচরণগত আপডেট সরাসরি অভিভাবকদের পোর্টালে যাবে</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-bold border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Class & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">শ্রেণি / জামাত</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">তারিখ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
          </div>

          {/* Meal Status */}
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-amber-600" />
              <span>দুপুরের খাবার / টিফিন অবস্থা</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "FULL", label: "সম্পূর্ণ খেয়েছে 🍛", bg: "hover:bg-emerald-50 border-emerald-300" },
                { id: "PARTIAL", label: "অর্ধেক খেয়েছে 🍲", bg: "hover:bg-amber-50 border-amber-300" },
                { id: "MINIMAL", label: "খুব সামান্য 🥣", bg: "hover:bg-orange-50 border-orange-300" },
                { id: "SKIPPED", label: "খেতে চায়নি ❌", bg: "hover:bg-rose-50 border-rose-300" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setMealStatus(item.id as any)}
                  className={`p-2 rounded-xl text-xs font-bold border transition text-center select-none ${
                    mealStatus === item.id
                      ? "bg-amber-100/90 text-amber-900 border-amber-500 shadow-xs ring-1 ring-amber-400"
                      : `bg-white text-slate-700 ${item.bg}`
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mood & Nap Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Smile className="w-4 h-4 text-pink-600" />
                <span>আজকের মেজাজ / মুড</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "HAPPY", label: "হাসিখুশি 😊" },
                  { id: "PLAYFUL", label: "চঞ্চল ও খেলা 🤸" },
                  { id: "CALM", label: "শান্ত 😌" },
                  { id: "CRYING", label: "কান্নাকাটি 😢" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setMoodStatus(item.id as any)}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-center select-none ${
                      moodStatus === item.id
                        ? "bg-pink-100 text-pink-900 border-pink-500 shadow-xs ring-1 ring-pink-400"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>দুপুরের বিশ্রাম / ঘুম</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "SLEPT_WELL", label: "শান্তিমতো ঘুমিয়েছে 😴" },
                  { id: "RESTLESS", label: "সামান্য বিশ্রাম নিয়েছে 🥱" },
                  { id: "NO_NAP", label: "ঘুমায়নি, খেলাধুলা করেছে ⚡" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setNapStatus(item.id as any)}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-center select-none ${
                      napStatus === item.id
                        ? "bg-indigo-100 text-indigo-900 border-indigo-500 shadow-xs ring-1 ring-indigo-400"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lessons & Homework */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">
                নূরানী কায়দা / কুরআন সবক
              </label>
              <input
                type="text"
                value={qaidaPage}
                onChange={(e) => setQaidaPage(e.target.value)}
                placeholder="যেমন: তখতি ৩ হরকত বা পৃষ্ঠা ৭"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">
                হাতের লেখা ও হোমওয়ার্ক
              </label>
              <input
                type="text"
                value={homeworkText}
                onChange={(e) => setHomeworkText(e.target.value)}
                placeholder="যেমন: ১ পৃষ্ঠা আলিফ-বা লেখা"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">
              অভিভাবকের উদ্দেশ্যে শিক্ষকের বার্তা / দোয়া
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="যেমন: মাশাআল্লাহ বাচ্চা আজ খুব সুন্দর সালাম দিয়েছে এবং ক্লাসে মনোযোগ ছিল..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-md cursor-pointer flex items-center gap-2"
            >
              {isPending ? "পোস্ট হচ্ছে..." : "ডায়েরি পোস্ট করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
