"use client";

declare global {
  interface Window {
    __qawmiActiveSaveTokens?: Set<string>;
  }
}

function getTokenSet(): Set<string> | null {
  if (typeof window === "undefined") return null;
  if (!window.__qawmiActiveSaveTokens) {
    window.__qawmiActiveSaveTokens = new Set<string>();
  }
  return window.__qawmiActiveSaveTokens;
}

export function hasActiveSaveGuards(): boolean {
  const set = getTokenSet();
  return Boolean(set && set.size > 0);
}

function beforeUnloadHandler(event: BeforeUnloadEvent): string | undefined {
  if (!hasActiveSaveGuards()) return undefined;
  event.preventDefault();
  // WHATWG HTML standard + legacy cross-browser trigger for native Leave/Stay prompt
  event.returnValue = "সেভ চলছে";
  return event.returnValue;
}

function syncWindowOnBeforeUnload() {
  if (typeof window === "undefined") return;
  if (hasActiveSaveGuards()) {
    window.onbeforeunload = beforeUnloadHandler;
  } else if (window.onbeforeunload === beforeUnloadHandler) {
    window.onbeforeunload = null;
  }
}

export function installGlobalSaveGuardListeners(): () => void {
  if (typeof window === "undefined") return () => {};
  getTokenSet();
  // Install only while an actual write is outstanding (also preserves bfcache).
  syncWindowOnBeforeUnload();
  return () => {
    // Keep global window listener registered for the lifetime of the SPA session
    syncWindowOnBeforeUnload();
  };
}

let autoSeq = 0;

export function acquireSaveGuard(label = "save"): () => void {
  if (typeof window === "undefined") return () => {};
  installGlobalSaveGuardListeners();
  const set = getTokenSet()!;
  autoSeq += 1;
  const token = `${label}:${Date.now()}:${autoSeq}`;
  set.add(token);
  syncWindowOnBeforeUnload();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    set.delete(token);
    syncWindowOnBeforeUnload();
  };
}
