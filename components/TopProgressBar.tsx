"use client";

import { useEffect, useRef, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function TopProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const isActiveRef = useRef(false);
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

      // 350ms fade শেষে hide করুন
      const tHide = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.display = "none";
          containerRef.current.style.opacity = "1";
        }
        setBarWidth(0);
        isActiveRef.current = false;
      }, 350);
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
      barRef.current.style.transition = "width 250ms cubic-bezier(0.4, 0, 0.2, 1)";
    }

    setBarWidth(25);

    const t1 = setTimeout(() => setBarWidth(60), 100);
    const t2 = setTimeout(() => setBarWidth(85), 300);
    // Auto-finish safety fallback after 2.5s so it never gets stuck
    const tSafety = setTimeout(() => {
      if (isActiveRef.current) {
        finishLoader();
      }
    }, 2500);
    timeoutRefs.current = [t1, t2, tSafety];
  }, [clearAllTimeouts, setBarWidth, finishLoader]);

  /* ─── URL change → finish loader ─── */
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
      // Ignore right clicks or clicks with modifier keys
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("/#") &&
        href !== "#" &&
        targetAttr !== "_blank" &&
        !anchor.hasAttribute("download")
      ) {
        // Only start if target is different from current path or has different search params
        const [targetPath, targetSearch] = href.split("?");
        const currentSearchStr = searchParams?.toString() ? `?${searchParams.toString()}` : "";
        const currentFull = `${pathname}${currentSearchStr}`;
        
        if (href !== currentFull && href !== pathname) {
          startLoader();
        }
      }
    };

    const handlePopState = () => startLoader();

    // Listen to custom navigation events if any code dispatches them
    const handleCustomStart = () => startLoader();
    const handleCustomFinish = () => finishLoader();

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("toploader:start", handleCustomStart);
    window.addEventListener("toploader:finish", handleCustomFinish);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("toploader:start", handleCustomStart);
      window.removeEventListener("toploader:finish", handleCustomFinish);
      clearAllTimeouts();
    };
  }, [startLoader, finishLoader, pathname, searchParams, clearAllTimeouts]);

  return (
    <div
      ref={containerRef}
      id="top-progress-bar-container"
      style={{
        display: "none",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "3.5px",
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

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarContent />
    </Suspense>
  );
}
