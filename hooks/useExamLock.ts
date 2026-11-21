"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readExamLocked } from "@/app/actions/exams";

/** Check the lock bit, not the gradebook. Refresh marks/settings on a transition, not on
 * every poll (normal freshness checks must not discard in-progress edits). null = unverified. */
export function useExamLock(examId: string, serverLocked: boolean | null) {
  const router = useRouter();
  const [observed, setObserved] = useState(serverLocked);
  const version = useRef(0);
  const observe = useCallback(
    (locked: boolean | null) => {
      version.current++;
      setObserved(locked);
      if (locked !== null && locked !== serverLocked) router.refresh();
    },
    [router, serverLocked],
  );

  useEffect(() => {
    let active = true,
      busy = false;
    setObserved(serverLocked);
    const check = async () => {
      if (!examId || busy || !navigator.onLine || document.visibilityState !== "visible") return;
      const atStart = version.current;
      busy = true;
      try {
        const locked = await readExamLocked(examId);
        if (active && version.current === atStart) observe(locked);
      } catch {
        if (active && version.current === atStart && navigator.onLine) observe(null);
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [examId, serverLocked, observe]);

  // An observed unlock must wait for the new server snapshot (and its saved marks).
  return {
    readOnly: serverLocked !== false || observed !== false,
    unavailable: observed === null,
    observe,
    observeFailure(code: unknown) {
      if (code === "EXAM_LOCKED") observe(true);
      if (code === "EXAM_LOCK_UNAVAILABLE") observe(null);
    },
  };
}
