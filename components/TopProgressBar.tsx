"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // DOM refs — state নয়, সরাসরি DOM control করব
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Ref দিয়ে active ট্র্যাক করব — state হলে Concurrent Mode-এ stale হয়
  const isActiveRef = useRef(false);

  // আগের URL track করার জন্য ref
  const prevPathnameRef = useRef(pathname);
  const prevSearchRef = useRef(searchParams?.toString() ?? "");

  /* ─── helpers ─── */

  const clearAllTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  }, []);

  const setBarWidth = useCallback((pct: number) => {
    if (barRef.current) barRef.current.style.width = `${pct}%`;
  }, []);

  /* ─── loader functions ─── */

  const finishLoader = useCallback(() => {
    clearAllTimeouts();

    if (barRef.current) {
      barRef.current.style.transition = "width 200ms ease-out";
    }
    setBarWidth(100);

    // 200ms পরে fade-out শুরু
    const tFade = setTimeout(() => {
      if (containerRef.current) containerRef.current.style.opacity = "0";

      // 400ms fade শেষে hide করুন
      const tHide = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.display = "none";
          containerRef.current.style.opacity = "1"; // reset for next time
        }
        setBarWidth(0);
        isActiveRef.current = false;
      }, 400);
      timeoutRefs.current.push(tHide);
    }, 200);

    timeoutRefs.current.push(tFade);
  }, [clearAllTimeouts, setBarWidth]);

  const startLoader = useCallback(() => {
    clearAllTimeouts();
    isActiveRef.current = true;

    // Bar দেখান
    if (containerRef.current) {
      containerRef.current.style.display = "block";
      containerRef.current.style.opacity = "1";
    }
    if (barRef.current) {
      barRef.current.style.transition = "width 300ms cubic-bezier(0.4, 0, 0.2, 1)";
    }

    setBarWidth(20);

    const t1 = setTimeout(() => setBarWidth(45), 100);
    const t2 = setTimeout(() => setBarWidth(70), 300);
    const t3 = setTimeout(() => setBarWidth(88), 700);
    timeoutRefs.current = [t1, t2, t3];
  }, [clearAllTimeouts, setBarWidth]);

  /* ─── URL change → finish loader ─── */
  // useEffect deps-এ pathname/searchParams রাখছি,
  // কিন্তু active check করব ref দিয়ে — stale closure এড়াতে
  useEffect(() => {
    const currentSearch = searchParams?.toString() ?? "";
    const urlChanged =
      pathname !== prevPathnameRef.current ||
      currentSearch !== prevSearchRef.current;

    if (isActiveRef.current && urlChanged) {
      finishLoader();
    }

    prevPathnameRef.current = pathname;
    prevSearchRef.current = currentSearch;
  }, [pathname, searchParams, finishLoader]);

  /* ─── click & popstate listeners ─── */
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      if (
        href &&
        href.startsWith("/") &&
        targetAttr !== "_blank" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        startLoader();
      }
    };

    const handlePopState = () => startLoader();

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      clearAllTimeouts();
    };
  }, [startLoader, clearAllTimeouts]);

  /* ─── render — সবসময় DOM-এ থাকবে, display:none দিয়ে লুকানো ─── */
  // "return null" করলে style/animation হারিয়ে যায়, তাই এড়ানো হয়েছে
  return (
    <div
      ref={containerRef}
      style={{
        display: "none", // startLoader() এ block হবে
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "4px",
        zIndex: 2147483647,
        pointerEvents: "none",
      }}
    >
      {/* Progress bar */}
      <div
        ref={barRef}
        style={{
          width: "0%",
          height: "100%",
          background:
            "linear-gradient(90deg, #10b981 0%, #06b6d4 30%, #3b82f6 70%, #ec4899 100%)",
          backgroundSize: "200% 100%",
          animation: "neonShimmer 1.5s linear infinite",
          boxShadow:
            "0 0 10px #06b6d4, 0 0 20px #3b82f6, 0 0 35px #06b6d4, 0 1px 3px rgba(0,0,0,0.3)",
          transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          position: "relative",
        }}
      >
        {/* Glowing leading tip */}
        <div
          style={{
            position: "absolute",
            right: "-4px",
            top: "-3px",
            bottom: "-3px",
            width: "30px",
            background: "#ffffff",
            borderRadius: "50%",
            filter: "blur(2px)",
            boxShadow:
              "0 0 15px #ffffff, 0 0 25px #06b6d4, 0 0 45px #3b82f6",
          }}
        />
      </div>
    </div>
  );
}
