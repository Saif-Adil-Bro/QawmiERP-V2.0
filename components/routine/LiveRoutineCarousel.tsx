"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock,
  MapPin,
  Radio,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  CalendarOff,
  Sun,
  User,
  GraduationCap,
  Coffee,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  formatBanglaTime,
  getNextActiveAcademicDay,
  getRoutineLiveStatus,
  getRoutinePeriodState,
  parseRoutineItem,
  timeStringToMinutes,
  type HolidayRangeLike,
  type RoutinePeriodState,
} from "@/lib/routine-helper";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

export interface LiveRoutineCarouselProps {
  routines?: any[];
  holidays?: HolidayRangeLike[];
  variant: "student" | "teacher";
  studentClassId?: string | null;
  fullRoutineHref?: string;
  className?: string;
}

interface CarouselSlide {
  key: string;
  kind: "period" | "completed_summary" | "status_notice" | "next_day_preview";
  state?: RoutinePeriodState;
  periodNumber?: number | null;
  item?: any;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  dayBangla?: string;
  isTomorrow?: boolean;
  totalClasses?: number;
}

function formatDurationBangla(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) {
    return `${toBanglaNumber(mins)} মিনিট`;
  }
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) {
    return `${toBanglaNumber(hrs)} ঘণ্টা`;
  }
  return `${toBanglaNumber(hrs)} ঘণ্টা ${toBanglaNumber(rem)} মিনিট`;
}

function resolveTeacherDisplayName(r: any): string {
  if (r?.display_subtitle) return String(r.display_subtitle).trim();
  if (r?.teacher_name) return String(r.teacher_name).trim();
  const teacher = Array.isArray(r?.teachers) ? r.teachers[0] : r?.teachers;
  if (teacher) {
    return `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim();
  }
  return "";
}

function resolveClassSectionLabel(r: any): string {
  const clsName =
    r?.class_name ||
    (Array.isArray(r?.classes) ? r.classes[0]?.name : r?.classes?.name) ||
    "";
  const section =
    r?.section ||
    r?.section_name ||
    (Array.isArray(r?.classes) ? r.classes[0]?.section : r?.classes?.section) ||
    "";
  if (clsName && section) {
    return `${clsName} (${section})`;
  }
  return clsName || "";
}

export default function LiveRoutineCarousel({
  routines = [],
  holidays = [],
  variant,
  studentClassId,
  fullRoutineHref,
  className = "",
}: LiveRoutineCarouselProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Hydration-safe real-time clock strictly initialized on the client inside useEffect
  const [now, setNow] = useState<Date | null>(null);
  const [visibleIndex, setVisibleIndex] = useState<number>(0);
  const [canScrollPrev, setCanScrollPrev] = useState<boolean>(false);
  const [canScrollNext, setCanScrollNext] = useState<boolean>(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lastAutoFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Offline-first fallback: use props when populated, otherwise read reactively from Dexie IndexedDB
  const effectiveRoutines = useMemo(() => {
    const source =
      Array.isArray(routines) && routines.length > 0
        ? routines
        : Array.isArray(offlineSnapshot?.routines)
        ? variant === "student" && studentClassId
          ? offlineSnapshot.routines.filter(
              (r: any) => !r.class_id || r.class_id === studentClassId
            )
          : offlineSnapshot.routines
        : [];

    return source.map((r: any) => {
      if (r && r.display_title && r.item_type) return r;
      const parsed = parseRoutineItem(r);
      return {
        ...r,
        ...parsed,
        class_name: r?.class_name || (Array.isArray(r?.classes) ? r.classes[0]?.name : r?.classes?.name) || "",
      };
    });
  }, [routines, offlineSnapshot?.routines, variant, studentClassId]);

  const effectiveHolidays: HolidayRangeLike[] = useMemo(() => {
    if (Array.isArray(holidays) && holidays.length > 0) return holidays;
    return (offlineSnapshot?.academicCalendar || []) as HolidayRangeLike[];
  }, [holidays, offlineSnapshot?.academicCalendar]);

  const liveStatus = useMemo(
    () => (now ? getRoutineLiveStatus(effectiveRoutines, now, effectiveHolidays) : null),
    [effectiveRoutines, now, effectiveHolidays]
  );

  const nextAcademicDay = useMemo(
    () => (now ? getNextActiveAcademicDay(effectiveRoutines, now, effectiveHolidays) : null),
    [effectiveRoutines, now, effectiveHolidays]
  );

  // Build ordered slides + resolve smart auto-focus index (Case A / Case B / Case C)
  const { slides, defaultFocusIndex, autoFocusSignature, headerStatusText } = useMemo(() => {
    if (!liveStatus) {
      return {
        slides: [] as CarouselSlide[],
        defaultFocusIndex: 0,
        autoFocusSignature: "",
        headerStatusText: "",
      };
    }

    const {
      todayBangla,
      todayClasses,
      currentClass,
      nextClass,
      isHoliday,
      holidayTitle,
      isOffDay,
      offDayTitle,
    } = liveStatus;

    // Holiday or Weekly Off-Day
    if (isHoliday || isOffDay) {
      const built: CarouselSlide[] = [
        {
          key: isHoliday ? "holiday_today" : "offday_today",
          kind: "status_notice",
          badgeText: isHoliday ? "একাডেমিক ছুটি" : "সাপ্তাহিক ছুটি",
          title: isHoliday
            ? holidayTitle || "আজ মাদরাসার একাডেমিক ছুটি"
            : offDayTitle || `আজ ${todayBangla} — সাপ্তাহিক ছুটি`,
          subtitle: isHoliday
            ? "আজকের নির্ধারিত সকল ক্লাস ও পাঠদান বন্ধ রয়েছে।"
            : "আজ কোনো নিয়মিত ক্লাস পিরিয়ড নির্ধারিত নেই।",
          dayBangla: todayBangla,
        },
      ];

      if (nextAcademicDay) {
        built.push({
          key: `next_day_${nextAcademicDay.dateStr}`,
          kind: "next_day_preview",
          item: nextAcademicDay.firstClass,
          dayBangla: nextAcademicDay.dayBangla,
          isTomorrow: nextAcademicDay.isTomorrow,
          totalClasses: nextAcademicDay.totalClasses,
          badgeText: nextAcademicDay.isTomorrow
            ? `আগামীকাল (${nextAcademicDay.dayBangla})`
            : `পরবর্তী কার্যদিবস (${nextAcademicDay.dayBangla})`,
        });
      }

      return {
        slides: built,
        defaultFocusIndex: 0,
        autoFocusSignature: built[0].key,
        headerStatusText: isHoliday ? "একাডেমিক ছুটি" : "সাপ্তাহিক ছুটি",
      };
    }

    // No regular classes scheduled today
    if (todayClasses.length === 0) {
      const built: CarouselSlide[] = [
        {
          key: "no_classes_today",
          kind: "status_notice",
          badgeText: todayBangla,
          title:
            effectiveRoutines.length > 0
              ? `আজ (${todayBangla}) কোনো নিয়মিত ক্লাস নেই`
              : "এখনো ক্লাস রুটিন যুক্ত করা হয়নি",
          subtitle:
            effectiveRoutines.length > 0
              ? "সাপ্তাহিক রুটিন অনুযায়ী আজকে আপনার কোনো নির্ধারিত পিরিয়ড নেই।"
              : "মাদরাসা কর্তৃপক্ষ রুটিন প্রকাশ করলেই এখানে আজকের লাইভ ক্লাস সময়সূচি দেখা যাবে।",
          dayBangla: todayBangla,
        },
      ];

      if (nextAcademicDay) {
        built.push({
          key: `next_day_${nextAcademicDay.dateStr}`,
          kind: "next_day_preview",
          item: nextAcademicDay.firstClass,
          dayBangla: nextAcademicDay.dayBangla,
          isTomorrow: nextAcademicDay.isTomorrow,
          totalClasses: nextAcademicDay.totalClasses,
          badgeText: nextAcademicDay.isTomorrow
            ? `আগামীকাল (${nextAcademicDay.dayBangla})`
            : `পরবর্তী ক্লাস (${nextAcademicDay.dayBangla})`,
        });
      }

      return {
        slides: built,
        defaultFocusIndex: 0,
        autoFocusSignature: built[0].key,
        headerStatusText: "আজ ক্লাস নেই",
      };
    }

    // Regular active day with classes
    let periodCounter = 0;
    const periodSlides: CarouselSlide[] = todayClasses.map((item: any, idx: number) => {
      const state = getRoutinePeriodState(item, liveStatus);
      const isBreak = item.item_type === "BREAK";
      if (!isBreak) periodCounter += 1;
      return {
        key: String(item.id || `period_${idx}`),
        kind: "period",
        state,
        periodNumber: isBreak ? null : periodCounter,
        item,
      };
    });

    const liveIdx = periodSlides.findIndex((s) => s.state === "live");
    const nextIdx = periodSlides.findIndex((s) => s.state === "next");
    const allFinishedToday = !currentClass && !nextClass && todayClasses.length > 0;

    if (allFinishedToday) {
      // Case C: All classes finished today — append completion summary card + optional next day preview
      periodSlides.push({
        key: "all_done_today",
        kind: "completed_summary",
        badgeText: "আজকের ক্লাস সমাপ্ত",
        title: "আজকের সকল ক্লাস সম্পন্ন হয়েছে",
        subtitle: `আজ (${todayBangla}) মোট ${toBanglaNumber(todayClasses.length)}টি পিরিয়ড সফলভাবে সমাপ্ত হয়েছে।`,
        dayBangla: todayBangla,
        totalClasses: todayClasses.length,
      });

      if (nextAcademicDay) {
        periodSlides.push({
          key: `next_day_${nextAcademicDay.dateStr}`,
          kind: "next_day_preview",
          item: nextAcademicDay.firstClass,
          dayBangla: nextAcademicDay.dayBangla,
          isTomorrow: nextAcademicDay.isTomorrow,
          totalClasses: nextAcademicDay.totalClasses,
          badgeText: nextAcademicDay.isTomorrow
            ? `আগামীকালের প্রথম ক্লাস (${nextAcademicDay.dayBangla})`
            : `পরবর্তী কার্যদিবস (${nextAcademicDay.dayBangla})`,
        });
      }
    }

    // Case A -> liveIdx, Case B -> nextIdx, Case C -> completion summary card index
    const focusIndex =
      liveIdx >= 0
        ? liveIdx
        : nextIdx >= 0
        ? nextIdx
        : allFinishedToday
        ? periodSlides.findIndex((s) => s.kind === "completed_summary")
        : 0;

    const safeFocus = focusIndex >= 0 ? focusIndex : 0;
    const focusKey = periodSlides[safeFocus]?.key || "0";

    const statusSummary =
      liveIdx >= 0
        ? "চলমান ক্লাস"
        : nextIdx >= 0
        ? "পরবর্তী ক্লাস"
        : "আজকের ক্লাস সম্পন্ন";

    return {
      slides: periodSlides,
      defaultFocusIndex: safeFocus,
      autoFocusSignature: `${focusKey}:${statusSummary}`,
      headerStatusText: statusSummary,
    };
  }, [liveStatus, nextAcademicDay, effectiveRoutines.length]);

  const scrollToSlide = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = trackRef.current;
      const targetEl = slideRefs.current[index];
      if (!container || !targetEl) return;

      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      const targetLeft = isMobile
        ? Math.max(0, targetEl.offsetLeft - (container.clientWidth - targetEl.offsetWidth) / 2)
        : Math.max(0, targetEl.offsetLeft);

      container.scrollTo({ left: targetLeft, behavior });
      setVisibleIndex(index);
    },
    []
  );

  // Sync scroll arrows & active visible dot on user swipe/scroll
  const handleTrackScroll = useCallback(() => {
    const container = trackRef.current;
    if (!container) return;

    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    setCanScrollPrev(container.scrollLeft > 8);
    setCanScrollNext(container.scrollLeft < maxScroll - 8);

    // Find slide closest to left/center focal point
    const focalX =
      typeof window !== "undefined" && window.innerWidth < 640
        ? container.scrollLeft + container.clientWidth / 2
        : container.scrollLeft + 24;

    let closestIdx = 0;
    let closestDist = Infinity;

    slideRefs.current.forEach((el, idx) => {
      if (!el) return;
      const slideAnchor =
        typeof window !== "undefined" && window.innerWidth < 640
          ? el.offsetLeft + el.offsetWidth / 2
          : el.offsetLeft;
      const dist = Math.abs(slideAnchor - focalX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    setVisibleIndex(closestIdx);
  }, []);

  // Auto-focus the live / next / completed card once client clock resolves or active period transitions
  useEffect(() => {
    if (!now || slides.length === 0) return;
    if (lastAutoFocusKeyRef.current === autoFocusSignature) return;

    lastAutoFocusKeyRef.current = autoFocusSignature;
    const rafId = requestAnimationFrame(() => {
      scrollToSlide(defaultFocusIndex, "smooth");
      handleTrackScroll();
    });

    return () => cancelAnimationFrame(rafId);
  }, [now, slides.length, defaultFocusIndex, autoFocusSignature, scrollToSlide, handleTrackScroll]);

  useEffect(() => {
    handleTrackScroll();
  }, [slides.length, handleTrackScroll]);

  const resolvedRoutineHref =
    fullRoutineHref || (variant === "teacher" ? "/teacher-portal/routine" : "/portal/routine");

  // Hydration-safe initial skeleton while client clock initializes
  if (!now) {
    return (
      <section className={`w-full max-w-full ${className}`} aria-label="আজকের ক্লাস রুটিন">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="h-5 w-44 rounded-md bg-slate-200/80 animate-pulse" />
            <div className="h-4 w-24 rounded-md bg-slate-200/70 animate-pulse" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            <div className="h-36 w-[86%] sm:w-[330px] shrink-0 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-36 w-[86%] sm:w-[330px] shrink-0 rounded-2xl bg-slate-100/70 animate-pulse hidden sm:block" />
          </div>
        </div>
      </section>
    );
  }

  const todayPeriodCount = liveStatus?.todayClasses?.length || 0;
  const showRefocusButton =
    slides.length > 1 &&
    visibleIndex !== defaultFocusIndex &&
    (liveStatus?.currentClass || liveStatus?.nextClass);

  return (
    <section
      className={`w-full max-w-full overflow-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs ${className}`}
      aria-label="আজকের ক্লাস রুটিন স্লাইডার"
    >
      {/* Top Carousel Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              liveStatus?.currentClass
                ? "bg-rose-50 text-rose-600 border border-rose-200"
                : liveStatus?.nextClass
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {liveStatus?.currentClass ? (
              <Radio className="w-4 h-4" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                আজকের ক্লাস রুটিন ({liveStatus?.todayBangla || "আজ"})
              </h2>
              {todayPeriodCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums">
                  {toBanglaNumber(todayPeriodCount)} পিরিয়ড
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {headerStatusText} • ডানে-বামে সোয়াইপ করে পূর্ববর্তী ও পরবর্তী ক্লাস দেখুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showRefocusButton && (
            <button
              type="button"
              onClick={() => scrollToSlide(defaultFocusIndex, "smooth")}
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition cursor-pointer"
            >
              {liveStatus?.currentClass ? "চলমান ক্লাসে ফিরুন" : "পরবর্তী ক্লাসে ফিরুন"}
            </button>
          )}

          {/* Desktop subtle Prev / Next Arrow Buttons */}
          {slides.length > 1 && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToSlide(Math.max(0, visibleIndex - 1), "smooth")}
                disabled={!canScrollPrev && visibleIndex === 0}
                aria-label="পূর্ববর্তী ক্লাস"
                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  scrollToSlide(Math.min(slides.length - 1, visibleIndex + 1), "smooth")
                }
                disabled={!canScrollNext && visibleIndex >= slides.length - 1}
                aria-label="পরবর্তী ক্লাস"
                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <Link
            href={resolvedRoutineHref}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-200 text-xs font-bold inline-flex items-center gap-1 transition"
          >
            <span>সম্পূর্ণ রুটিন</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </div>
      </div>

      {/* Horizontal Swipeable Scroll-Snap Track */}
      <div className="p-3.5 sm:p-4">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, idx) => {
            if (slide.kind === "period" && slide.item) {
              const r = slide.item;
              const state = slide.state || "upcoming";
              const isLive = state === "live";
              const isNext = state === "next";
              const isCompleted = state === "completed";
              const isBreak = r.item_type === "BREAK";

              const startLabel = formatBanglaTime(r.start_time);
              const endLabel = formatBanglaTime(r.end_time);
              const teacherName = resolveTeacherDisplayName(r);
              const classSection = resolveClassSectionLabel(r);
              const startMins = timeStringToMinutes(r.start_time);
              const minsUntil =
                isNext && liveStatus && startMins > liveStatus.nowMinutes
                  ? startMins - liveStatus.nowMinutes
                  : 0;

              return (
                <div
                  key={slide.key}
                  ref={(el) => {
                    slideRefs.current[idx] = el;
                  }}
                  className={`w-[86%] sm:w-[330px] lg:w-[350px] shrink-0 snap-center sm:snap-start rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all ${
                    isLive
                      ? "bg-gradient-to-br from-rose-950 via-slate-900 to-rose-950 text-white border-2 border-rose-500 shadow-lg shadow-rose-950/15"
                      : isNext
                      ? "bg-gradient-to-br from-amber-50 via-orange-50/50 to-white text-slate-900 border-2 border-amber-400 shadow-xs"
                      : isCompleted
                      ? "bg-slate-50/90 text-slate-600 border border-slate-200/80"
                      : "bg-white text-slate-900 border border-slate-200 hover:border-emerald-300 shadow-2xs"
                  }`}
                >
                  {/* Top Row: Status Badge + Period / Break Tag */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <Radio className="w-3 h-3 shrink-0" />
                          <span>চলমান ক্লাস</span>
                        </span>
                      ) : isNext ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>পরবর্তী ক্লাস</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-600 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                          <span>সম্পন্ন</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>আসন্ন</span>
                        </span>
                      )}

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
                          isLive
                            ? "bg-white/15 text-rose-100 border border-white/15"
                            : isNext
                            ? "bg-amber-100 text-amber-950 border border-amber-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200/70"
                        }`}
                      >
                        {isBreak ? (
                          <span className="inline-flex items-center gap-1">
                            <Coffee className="w-3 h-3" />
                            বিরতি
                          </span>
                        ) : (
                          `পিরিয়ড ${toBanglaNumber(slide.periodNumber || idx + 1)}`
                        )}
                      </span>
                    </div>

                    {/* Subject Title & Contextual Countdown */}
                    <div className="min-w-0">
                      <h3
                        className={`text-base sm:text-lg font-extrabold leading-snug break-words ${
                          isLive
                            ? "text-white"
                            : isCompleted
                            ? "text-slate-700"
                            : "text-slate-900"
                        }`}
                      >
                        {r.display_title || r.subject_name || "নির্ধারিত পিরিয়ড"}
                      </h3>

                      {/* Time Range + Live / Upcoming Countdown */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${
                            isLive
                              ? "text-rose-100 bg-black/30 px-2 py-0.5 rounded-md"
                              : isNext
                              ? "text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded-md"
                              : "text-slate-600"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {startLabel} – {endLabel}
                          </span>
                        </span>

                        {isLive && liveStatus && liveStatus.minutesLeft > 0 && (
                          <span className="text-[11px] font-bold text-amber-300 tabular-nums">
                            আর {formatDurationBangla(liveStatus.minutesLeft)} বাকি
                          </span>
                        )}

                        {isNext && minsUntil > 0 && (
                          <span className="text-[11px] font-bold text-amber-800 tabular-nums">
                            {formatDurationBangla(minsUntil)} পর শুরু
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Metadata: Student (Teacher + Room) vs Teacher (Class/Section + Room + Action) */}
                  <div
                    className={`pt-2.5 border-t flex items-center justify-between gap-2 text-xs ${
                      isLive
                        ? "border-white/15 text-rose-100/90"
                        : isNext
                        ? "border-amber-200/80 text-slate-700"
                        : "border-slate-200/70 text-slate-600"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                      {variant === "teacher" ? (
                        classSection ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold truncate ${
                              isLive ? "text-emerald-300" : "text-emerald-800"
                            }`}
                          >
                            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{classSection}</span>
                          </span>
                        ) : null
                      ) : teacherName ? (
                        <span className="inline-flex items-center gap-1 font-semibold truncate">
                          <User className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{teacherName}</span>
                        </span>
                      ) : null}

                      {r.clean_room && (
                        <span className="inline-flex items-center gap-1 font-medium shrink-0">
                          <MapPin className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span>কক্ষ: {r.clean_room}</span>
                        </span>
                      )}

                      {!r.clean_room &&
                        ((variant === "teacher" && !classSection) ||
                          (variant === "student" && !teacherName)) && (
                          <span className="opacity-75">নিয়মিত ক্লাস পিরিয়ড</span>
                        )}
                    </div>

                    {variant === "teacher" && isLive && (
                      <Link
                        href="/teacher-portal/attendance"
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition"
                      >
                        <span>হাজিরা নিন</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            }

            if (slide.kind === "completed_summary") {
              return (
                <div
                  key={slide.key}
                  ref={(el) => {
                    slideRefs.current[idx] = el;
                  }}
                  className="w-[86%] sm:w-[340px] lg:w-[360px] shrink-0 snap-center sm:snap-start rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white border-2 border-emerald-300/90 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{slide.badgeText || "ক্লাস সমাপ্ত"}</span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {slide.dayBangla}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-emerald-950 leading-snug">
                      {slide.title}
                    </h3>
                    <p className="text-xs text-emerald-800/85 leading-relaxed">
                      {slide.subtitle}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-emerald-200/70 flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-800">
                    <span>বামে সোয়াইপ করে আজকের ক্লাস দেখুন</span>
                    {nextAcademicDay && (
                      <button
                        type="button"
                        onClick={() => scrollToSlide(idx + 1, "smooth")}
                        className="inline-flex items-center gap-0.5 text-emerald-700 hover:text-emerald-900 underline cursor-pointer shrink-0"
                      >
                        <span>পরবর্তী দিন</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (slide.kind === "next_day_preview" && slide.item) {
              const r = slide.item;
              const teacherName = resolveTeacherDisplayName(r);
              const classSection = resolveClassSectionLabel(r);

              return (
                <div
                  key={slide.key}
                  ref={(el) => {
                    slideRefs.current[idx] = el;
                  }}
                  className="w-[86%] sm:w-[340px] lg:w-[360px] shrink-0 snap-center sm:snap-start rounded-2xl p-4 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-white border border-indigo-200 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>{slide.badgeText}</span>
                      </span>
                      {slide.totalClasses && (
                        <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md tabular-nums">
                          {toBanglaNumber(slide.totalClasses)} পিরিয়ড
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-indigo-700">
                        প্রথম পিরিয়ড
                      </p>
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug break-words">
                        {r.display_title || r.subject_name || "নির্ধারিত ক্লাস"}
                      </h3>
                      <p className="text-xs font-bold text-slate-600 mt-1 inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          {formatBanglaTime(r.start_time)} – {formatBanglaTime(r.end_time)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-indigo-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    {variant === "teacher" && classSection && (
                      <span className="inline-flex items-center gap-1 font-bold text-indigo-800">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span>{classSection}</span>
                      </span>
                    )}
                    {variant === "student" && teacherName && (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <User className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                        <span>{teacherName}</span>
                      </span>
                    )}
                    {r.clean_room && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                        <span>কক্ষ: {r.clean_room}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // Status Notice (Holiday / Off-day / No Classes)
            const isHolidaySlide = slide.key === "holiday_today";
            const isOffDaySlide = slide.key === "offday_today";

            return (
              <div
                key={slide.key}
                ref={(el) => {
                  slideRefs.current[idx] = el;
                }}
                className={`w-[88%] sm:w-[360px] shrink-0 snap-center sm:snap-start rounded-2xl p-4 border flex flex-col justify-between gap-2.5 ${
                  isHolidaySlide
                    ? "bg-amber-50/90 border-amber-200 text-amber-950"
                    : isOffDaySlide
                    ? "bg-rose-50/80 border-rose-200 text-rose-950"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      isHolidaySlide
                        ? "bg-amber-100 text-amber-700"
                        : isOffDaySlide
                        ? "bg-rose-100 text-rose-600"
                        : "bg-slate-200/70 text-slate-600"
                    }`}
                  >
                    {isHolidaySlide ? (
                      <CalendarOff className="w-5 h-5" />
                    ) : isOffDaySlide ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <CalendarDays className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border border-black/5 mb-1">
                      {slide.badgeText}
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold leading-snug break-words">
                      {slide.title}
                    </h3>
                    <p className="text-xs opacity-85 mt-1 leading-relaxed">
                      {slide.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Slide Indicator Dots (Interactive) */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2.5">
            {slides.map((s, idx) => {
              const isActive = idx === visibleIndex;
              const isLiveDot = s.state === "live";
              return (
                <button
                  key={`dot_${s.key}`}
                  type="button"
                  onClick={() => scrollToSlide(idx, "smooth")}
                  aria-label={`স্লাইড ${toBanglaNumber(idx + 1)}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? isLiveDot
                        ? "w-6 bg-rose-600"
                        : "w-6 bg-emerald-600"
                      : isLiveDot
                      ? "w-2 bg-rose-300"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
