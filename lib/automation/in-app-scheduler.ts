import { runMasterCronDispatch } from "@/lib/automation/master-dispatcher";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";

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

export interface PersistedSchedulerHeartbeat {
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDispatchedCount: number;
  lastTriggerSource: "in-app" | "cron" | "manual" | null;
  updatedAt: string;
}

const HEARTBEAT_NAMESPACE = "automation";
const HEARTBEAT_KEY = "scheduler_heartbeat";

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

export async function getPersistedSchedulerHeartbeat(madrasaId:string) {
  const res=await getStructuredMadrasaSetting<PersistedSchedulerHeartbeat>(madrasaId,HEARTBEAT_NAMESPACE,HEARTBEAT_KEY,true);
  return res.value || null;
}

export async function recordDispatchHeartbeat(result:Awaited<ReturnType<typeof runMasterCronDispatch>>,source:'cron'|'in-app') {
  const state=getRuntimeState(), now=new Date().toISOString();
  state.lastTickAt=now; state.lastTriggerSource=source; state.tickCount++;
  state.lastDispatchedCount=result.totalExecuted; state.lastTenantsChecked=result.tenantsChecked;
  state.lastError=result.ok?null:'এক বা একাধিক জব ব্যর্থ';
  // Runtime totals are process-local. Never publish another school's outcomes
  // (or its last successful run) in the tenant-facing operations page.
  const errors:string[]=[];
  for(const {madrasaId,executed} of result.results){
    try {
      const failures=executed.filter(r=>!r.ok);
      const heartbeat:PersistedSchedulerHeartbeat={lastTickAt:now,lastTriggerSource:source,
        lastSuccessAt:failures.length ? (await getPersistedSchedulerHeartbeat(madrasaId))?.lastSuccessAt || null : now,
        lastError:failures.length?'ব্যর্থ: '+failures.map(r=>r.ruleKey).join(', '):null,lastDispatchedCount:executed.length,updatedAt:now};
      const saved=await saveStructuredMadrasaSetting(madrasaId,HEARTBEAT_NAMESPACE,HEARTBEAT_KEY,heartbeat);
      if(!saved.ok)errors.push(madrasaId);
    }catch{errors.push(madrasaId);}
  }
  if(errors.length){state.lastError='শিডিউলার হার্টবিট সংরক্ষণ হয়নি।';throw Error(state.lastError);}
  if(result.ok)state.lastSuccessAt=now;
}

export async function runInAppSchedulerTick(): Promise<{
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
    const result = await runMasterCronDispatch({ triggerSource: "cron" });
    await recordDispatchHeartbeat(result,"in-app");
    return {ok:result.ok,totalExecuted:result.totalExecuted,tenantsChecked:result.tenantsChecked,...(state.lastError?{error:state.lastError}:{})};
  } catch (err: any) {
    const message = String(err?.message || "অটোমেশন শিডিউলার চালানো যায়নি").slice(0, 300);
    state.lastError = message;
    state.tickCount += 1;
    console.warn("[automation/in-app-scheduler] Tick failed:", message);
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

  const intervalMs = resolvePollIntervalMs();
  state.intervalMs = intervalMs;
  state.isActive = true;
  state.startedAt = new Date().toISOString();

  const initialDelayMs = Math.max(
    1_000,
    Number(process.env.AUTOMATION_STARTUP_DELAY_MS || DEFAULT_INITIAL_DELAY_MS)
  );

  state.startupTimer = setTimeout(() => {
    void runInAppSchedulerTick();
  }, initialDelayMs);
  state.startupTimer.unref?.();

  state.intervalTimer = setInterval(() => {
    void runInAppSchedulerTick();
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
