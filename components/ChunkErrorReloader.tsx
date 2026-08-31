"use client";

import { useEffect } from "react";

/**
 * On Render/Railway (unlike Vercel) a new deploy deletes the previous
 * build's JS chunk files. If a user already has the app open in a browser
 * tab from before a deploy, any click that needs to fetch a chunk tied to
 * the OLD build (a lazy-loaded route segment, a Server Action reference,
 * etc.) gets a 404 and throws a ChunkLoadError / "Failed to fetch
 * dynamically imported module" error.
 *
 * This happens outside React's render cycle (inside a click handler /
 * router transition), so normal try/catch in our own code and React error
 * boundaries do NOT catch it — the button just silently does nothing,
 * which matches "click theke kaj hoy na, kintu link copy kore khule dile
 * hoy" (a fresh page load always gets the current build, so it works).
 *
 * Fix: detect this specific error class globally and force a real page
 * reload, which fetches the current build's HTML + JS and resolves it.
 * We guard with sessionStorage so a genuinely broken deploy can't cause an
 * infinite reload loop.
 */
export default function ChunkErrorReloader() {
  useEffect(() => {
    const RELOAD_GUARD_KEY = "chunk-error-reload-attempted";

    const isChunkLoadError = (err: unknown): boolean => {
      if (!err) return false;
      const name = (err as any)?.name || "";
      const message = (err as any)?.message || String(err) || "";
      return (
        name === "ChunkLoadError" ||
        /Loading chunk [\d\w-]+ failed/i.test(message) ||
        /Failed to fetch dynamically imported module/i.test(message) ||
        /Importing a module script failed/i.test(message)
      );
    };

    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
          // Already tried once this session — avoid a reload loop if the
          // deploy itself is broken (e.g. static assets missing entirely).
          return;
        }
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        // sessionStorage unavailable (rare) — reload once anyway.
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) {
        reloadOnce();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Clear the guard once the app has been open a while without issue, so
    // a genuine future chunk error (after another deploy) can still trigger
    // a reload instead of being permanently suppressed for the tab's life.
    const clearGuardTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {}
    }, 60_000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(clearGuardTimer);
    };
  }, []);

  return null;
}
