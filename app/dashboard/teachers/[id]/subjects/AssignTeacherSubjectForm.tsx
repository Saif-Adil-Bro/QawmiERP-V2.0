"use client";

import { useEffect, useRef, useState } from "react";
import {
  acquireSaveGuard,
  hasActiveSaveGuards,
  installGlobalSaveGuardListeners,
} from "@/lib/save-guard";
import { BookOpen, Check, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AssignTeacherSubjectForm({
  teacherId,
  unassignedClassSubjects,
}: {
  teacherId: string;
  unassignedClassSubjects: any[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [navBlockedNotice, setNavBlockedNotice] = useState(false);
  const pendingRef = useRef(false);
  const preArmReleaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    installGlobalSaveGuardListeners();
    // The shared beforeunload handler owns the native browser prompt.
    const handleAnchorClickCapture = (e: MouseEvent) => {
      if (!pendingRef.current && !hasActiveSaveGuards()) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (anchor && anchor.href && !anchor.href.startsWith("javascript:")) {
        e.preventDefault();
        e.stopPropagation();
        setNavBlockedNotice(true);
      }
    };
    document.addEventListener("click", handleAnchorClickCapture, true);
    return () => {
      document.removeEventListener("click", handleAnchorClickCapture, true);
      if (preArmReleaseRef.current) {
        preArmReleaseRef.current();
        preArmReleaseRef.current = null;
      }
    };
  }, []);

  const preArmBeforeSubmit = () => {
    if (!selectedValue || isPending) return;
    if (!preArmReleaseRef.current) {
      preArmReleaseRef.current = acquireSaveGuard("teacher-subject-prearm");
      // Auto-release if pointerdown never completes a form submit
      window.setTimeout(() => {
        if (!pendingRef.current && preArmReleaseRef.current) {
          preArmReleaseRef.current();
          preArmReleaseRef.current = null;
        }
      }, 1500);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    setSuccessMsg("");
    setNavBlockedNotice(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const classSubjectStr = (formData.get("class_subject") as string) || selectedValue;

    if (!classSubjectStr) {
      if (preArmReleaseRef.current) {
        preArmReleaseRef.current();
        preArmReleaseRef.current = null;
      }
      setError("অনুগ্রহ করে একটি বিষয় নির্বাচন করুন।");
      setIsPending(false);
      return;
    }

    const [classId, subjectId] = classSubjectStr.split("|");
    pendingRef.current = true;
    const releaseGuard = acquireSaveGuard("teacher-subject-assign");
    if (preArmReleaseRef.current) {
      preArmReleaseRef.current();
      preArmReleaseRef.current = null;
    }

    try {
      const response = await fetch(
        `/api/teachers/${encodeURIComponent(teacherId)}/subjects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          keepalive: true,
          body: JSON.stringify({ classId, subjectId }),
        },
      );
      const res = await response.json().catch(() => ({}));
      if (!response.ok || !res?.success || res?.error) {
        setError(res?.error || "বিষয় এসাইন করতে সমস্যা হয়েছে।");
      } else {
        setSuccessMsg("বিষয় সফলভাবে এসাইন করা হয়েছে!");
        setSelectedValue("");
        form.reset();
        router.refresh();
      }
    } catch (err) {
      console.error("assignSubjectToTeacher failed:", err);
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      pendingRef.current = false;
      setNavBlockedNotice(false);
      releaseGuard();
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isPending && (
        <div
          role="status"
          aria-live="assertive"
          className="p-3 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold border border-amber-200 flex items-center gap-2"
        >
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span>বিষয় বরাদ্দ নিরাপদে সেভ হচ্ছে — অনুগ্রহ করে পেজ রিলোড বা বন্ধ করবেন না।</span>
        </div>
      )}

      {navBlockedNotice && isPending && (
        <div
          role="alert"
          className="p-2.5 bg-amber-100 text-amber-950 rounded-xl text-xs font-bold border border-amber-300 flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>সেভ শেষ না হওয়া পর্যন্ত অন্য পেজে যাওয়া সাময়িকভাবে বন্ধ রাখা হয়েছে।</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs sm:text-sm border border-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs sm:text-sm border border-emerald-200 flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {unassignedClassSubjects.length === 0 ? (
        <div className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-center">
          <BookOpen className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="font-semibold text-slate-700">এসাইন করার মতো কোনো বিষয় অবশিষ্ট নেই।</p>
          <p className="text-[11px] text-slate-400 mt-1">সব জামাত-বিষয় ইতিমধ্যে বণ্টন করা আছে অথবা জামাত তালিকায় বিষয় যুক্ত নেই।</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              জামাত ও বিষয় নির্বাচন করুন <span className="text-rose-500">*</span>
            </label>
            <select
              name="class_subject"
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900 font-medium"
              required
            >
              <option value="" disabled>
                -- বিষয় ও জামাত নির্বাচন করুন --
              </option>
              {unassignedClassSubjects.map((cs) => (
                <option key={cs.id} value={`${cs.class_id}|${cs.subject_id}`}>
                  {cs.classes?.name || "জামাত"} — {cs.subjects?.name || "বিষয়"} {cs.subjects?.code ? `(${cs.subjects.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            onPointerDown={preArmBeforeSubmit}
            className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>এসাইন করা হচ্ছে...</span>
              </>
            ) : (
              <span>বিষয় এসাইন করুন</span>
            )}
          </button>
        </>
      )}
    </form>
  );
}
