"use client";

import { useState, useTransition } from "react";
import {
  TARBIYAH_BADGES,
  TarbiyahBadge,
  StudentBadgeAward,
} from "@/lib/tarbiyah-badges";
import { awardStudentBadge } from "@/app/actions/tarbiyah-badges";
import { Award, Sparkles, X, Star, CheckCircle2, Printer } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  students: { id: string; name: string; className: string }[];
  onSuccess?: () => void;
}

export default function TarbiyahBadgeModal({
  isOpen,
  onClose,
  students,
  onSuccess,
}: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const [selectedBadgeId, setSelectedBadgeId] = useState(TARBIYAH_BADGES[0].id);
  const [teacherName, setTeacherName] = useState("উস্তাদ");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [awardedItem, setAwardedItem] = useState<StudentBadgeAward | null>(null);

  if (!isOpen) return null;

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];
  const selectedBadge =
    TARBIYAH_BADGES.find((b) => b.id === selectedBadgeId) || TARBIYAH_BADGES[0];

  const handleAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    startTransition(async () => {
      const res = await awardStudentBadge({
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        className: selectedStudent.className,
        badgeId: selectedBadgeId,
        teacherName,
        notes,
      });

      if (res.success && res.data) {
        setAwardedItem(res.data);
        if (onSuccess) onSuccess();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ছোটদের তারবিয়াহ ও সুন্নাহ ব্যাজ প্রদান</h2>
              <p className="text-xs text-amber-100 mt-0.5">আখলাক ও সুন্দর অভ্যাসের জন্য স্টার ও সম্মাননা</p>
            </div>
          </div>
          <button
            onClick={() => {
              setAwardedItem(null);
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-white/20 transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {awardedItem ? (
          /* SUCCESS / CERTIFICATE READY STATE */
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner animate-bounce">
              {awardedItem.badgeIcon}
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                মাশাআল্লাহ! সফলভাবে ব্যাজ প্রদান সম্পন্ন হয়েছে
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                {awardedItem.studentName}
              </h3>
              <p className="text-xs text-slate-500">জামাত: {awardedItem.className}</p>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1">
              <div className="text-sm font-bold text-amber-950 flex items-center justify-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{awardedItem.badgeName}</span>
                <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                  +{toBanglaNumber(awardedItem.starPoints)} স্টার
                </span>
              </div>
              {awardedItem.notes && (
                <p className="text-xs text-slate-600 italic mt-1">"{awardedItem.notes}"</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setAwardedItem(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              >
                আরেকজনকে দিন
              </button>
              <button
                onClick={() => {
                  setAwardedItem(null);
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-xs"
              >
                সম্পন্ন করুন
              </button>
            </div>
          </div>
        ) : (
          /* FORM BODY */
          <form onSubmit={handleAward} className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Student Selector */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">শিক্ষার্থী নির্বাচন করুন:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className})
                  </option>
                ))}
              </select>
            </div>

            {/* Badge Grid */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                তারবিয়াহ / সুন্নাহ ব্যাজ নির্বাচন করুন:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {TARBIYAH_BADGES.map((b) => {
                  const isSelected = selectedBadgeId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBadgeId(b.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      <span className="text-2xl shrink-0">{b.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-xs truncate">{b.name}</h4>
                          <span className="text-[10px] bg-amber-200/80 text-amber-900 font-black px-1.5 py-0.2 rounded shrink-0">
                            +{toBanglaNumber(b.starPoints)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {b.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teacher Remarks */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                শিক্ষকের উৎসাহমূলক বার্তা বা কারণ (ঐচ্ছিক):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: 'আজকে সবাইকে হাসিমুখে আগে সালাম দেওয়ার জন্য মাশাআল্লাহ'..."
                className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end items-center space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-700 hover:to-emerald-700 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>{isPending ? "প্রদান হচ্ছে..." : "ব্যাজ ও স্টার প্রদান করুন"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
