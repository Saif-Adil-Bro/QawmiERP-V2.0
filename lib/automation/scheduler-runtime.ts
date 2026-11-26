import crypto from "node:crypto";

export interface SchedulerHealthSnapshot {
  isActive: boolean;
  isTickRunning: boolean;
  startedAt: string | null;
  intervalMs: number;
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDispatchedCount: number;
  lastTenantsChecked: number;
  tickCount: number;
  lastTriggerSource: "in-app" | "cron" | "manual" | null;
}

const DEFAULT_INITIAL_DELAY_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_POLL_INTERVAL_MS = 60_000;
const MAX_POLL_INTERVAL_MS = 60 * 60 * 1000;

interface SchedulerRuntimeState extends SchedulerHealthSnapshot {
  startupTimer: ReturnType<typeof setTimeout> | null;
  intervalTimer: ReturnType<typeof setInterval> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __qawmiAutomationScheduler: SchedulerRuntimeState | undefined;
  // eslint-disable-next-line no-var
  var __qawmiInternalSchedulerToken: string | undefined;
}

function resolvePollIntervalMs(): number {
  const raw = Number(process.env.AUTOMATION_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.floor(raw)));
}

function getRuntimeState(): SchedulerRuntimeState {
  if (!globalThis.__qawmiAutomationScheduler) {
    globalThis.__qawmiAutomationScheduler = {
      isActive: false,
      isTickRunning: false,
      startedAt: null,
      intervalMs: resolvePollIntervalMs(),
      lastTickAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastDispatchedCount: 0,
      lastTenantsChecked: 0,
      tickCount: 0,
      lastTriggerSource: null,
      startupTimer: null,
      intervalTimer: null,
    };
  }
  return globalThis.__qawmiAutomationScheduler;
}

export function getOrCreateInternalSchedulerToken(): string {
  if (!globalThis.__qawmiInternalSchedulerToken) {
    globalThis.__qawmiInternalSchedulerToken = crypto.randomBytes(32).toString("hex");
  }
  return globalThis.__qawmiInternalSchedulerToken;
}

export function verifyInternalSchedulerToken(candidate: string | null | undefined): boolean {
  const expected = globalThis.__qawmiInternalSchedulerToken;
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getInAppSchedulerStatus(): SchedulerHealthSnapshot {
  const state = getRuntimeState();
  return {
    isActive: state.isActive,
    isTickRunning: state.isTickRunning,
    startedAt: state.startedAt,
    intervalMs: state.intervalMs,
    lastTickAt: state.lastTickAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
    lastDispatchedCount: state.lastDispatchedCount,
    lastTenantsChecked: state.lastTenantsChecked,
    tickCount: state.tickCount,
    lastTriggerSource: state.lastTriggerSource,
  };
}

export function updateInAppSchedulerRuntime(patch: {
  lastTickAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  lastDispatchedCount?: number;
  lastTenantsChecked?: number;
  lastTriggerSource?: "in-app" | "cron" | "manual" | null;
  incrementTick?: boolean;
}) {
  const state = getRuntimeState();
  if (patch.lastTickAt !== undefined) state.lastTickAt = patch.lastTickAt;
  if (patch.lastSuccessAt !== undefined) state.lastSuccessAt = patch.lastSuccessAt;
  if (patch.lastError !== undefined) state.lastError = patch.lastError;
  if (patch.lastDispatchedCount !== undefined) state.lastDispatchedCount = patch.lastDispatchedCount;
  if (patch.lastTenantsChecked !== undefined) state.lastTenantsChecked = patch.lastTenantsChecked;
  if (patch.lastTriggerSource !== undefined) state.lastTriggerSource = patch.lastTriggerSource;
  if (patch.incrementTick) state.tickCount += 1;
}

export async function triggerInAppLoopbackTick(): Promise<{
  skippedOverlap?: boolean;
  ok: boolean;
  totalExecuted: number;
  tenantsChecked: number;
  error?: string;
}> {
  const state = getRuntimeState();
  if (state.isTickRunning) {
    return {
      skippedOverlap: true,
      ok: true,
      totalExecuted: 0,
      tenantsChecked: 0,
    };
  }

  state.isTickRunning = true;
  const startedIso = new Date().toISOString();
  state.lastTickAt = startedIso;
  state.lastTriggerSource = "in-app";

  try {
    const port = process.env.PORT || "3000";
    const token = getOrCreateInternalSchedulerToken();
    const res = await fetch(`http://127.0.0.1:${port}/api/cron/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-scheduler-token": token,
        "x-scheduler-source": "in-app",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const msg = String(data?.error || `HTTP ${res.status}`).slice(0, 300);
      state.lastError = msg;
      state.tickCount += 1;
      return { ok: false, totalExecuted: 0, tenantsChecked: 0, error: msg };
    }

    state.lastSuccessAt = new Date().toISOString();
    state.lastError = null;
    state.lastDispatchedCount = Number(data?.totalExecuted || 0);
    state.lastTenantsChecked = Number(data?.tenantsChecked || 0);
    return {
      ok: true,
      totalExecuted: state.lastDispatchedCount,
      tenantsChecked: state.lastTenantsChecked,
    };
  } catch (err: any) {
    const message = String(err?.message || "অটোমেশন শিডিউলার চালানো যায়নি").slice(0, 300);
    state.lastError = message;
    state.tickCount += 1;
    return {
      ok: false,
      totalExecuted: 0,
      tenantsChecked: 0,
      error: message,
    };
  } finally {
    state.isTickRunning = false;
  }
}

export function startInAppAutomationScheduler(): SchedulerHealthSnapshot {
  const state = getRuntimeState();
  if (state.isActive) {
    return getInAppSchedulerStatus();
  }

  getOrCreateInternalSchedulerToken();

  const intervalMs = resolvePollIntervalMs();
  state.intervalMs = intervalMs;
  state.isActive = true;
  state.startedAt = new Date().toISOString();

  const initialDelayMs = Math.max(
    1_000,
    Number(process.env.AUTOMATION_STARTUP_DELAY_MS || DEFAULT_INITIAL_DELAY_MS)
  );

  state.startupTimer = setTimeout(() => {
    void triggerInAppLoopbackTick();
  }, initialDelayMs);
  state.startupTimer.unref?.();

  state.intervalTimer = setInterval(() => {
    void triggerInAppLoopbackTick();
  }, intervalMs);
  state.intervalTimer.unref?.();

  return getInAppSchedulerStatus();
}

export function stopInAppAutomationScheduler(): void {
  const state = getRuntimeState();
  if (state.startupTimer) {
    clearTimeout(state.startupTimer);
    state.startupTimer = null;
  }
  if (state.intervalTimer) {
    clearInterval(state.intervalTimer);
    state.intervalTimer = null;
  }
  state.isActive = false;
}
