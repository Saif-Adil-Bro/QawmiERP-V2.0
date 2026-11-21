import { studentRoles, teacherRoles } from "./portal/rules";
import { Preferences } from "@capacitor/preferences";

export type PortalRole =
  "student" | "guardian" | "parent" | "teacher" | "hifz_teacher" | string;

export interface OfflineAuthSession {
  accessToken: string;
  refreshToken?: string;
  role: PortalRole;
  madrasaId: string;
  userId: string;
  fullName?: string;
  email?: string;
  redirectUrl: string;
  savedAt: number;
}

const AUTH_PREF_KEY = "qawmi_offline_auth_session";

export function ownerKey(
  s?: Pick<OfflineAuthSession, "madrasaId" | "userId" | "role"> | null,
) {
  return s?.userId && s.madrasaId
    ? `${s.madrasaId}:${s.userId}:${resolvePortalTypeFromRole(s.role)}`
    : "";
}
export function browserSession(): OfflineAuthSession | null {
  try {
    return JSON.parse(window.localStorage.getItem(AUTH_PREF_KEY) || "null");
  } catch {
    return null;
  }
}
export async function saveOfflineAuthSession(
  session: OfflineAuthSession,
): Promise<void> {
  if (typeof window === "undefined") return;
  const previous = browserSession();
  if (
    !session.accessToken &&
    previous &&
    ownerKey(previous) === ownerKey(session)
  )
    session = { ...previous, ...session, accessToken: previous.accessToken };
  const serialized = JSON.stringify(session);
  try {
    window.localStorage.setItem(AUTH_PREF_KEY, serialized);
    if (session.accessToken)
      window.localStorage.setItem("qawmi_access_token", session.accessToken);
    else window.localStorage.removeItem("qawmi_access_token");
  } catch {}
  try {
    await Preferences.set({ key: AUTH_PREF_KEY, value: serialized });
  } catch {}
}

export async function getOfflineAuthSession(): Promise<OfflineAuthSession | null> {
  if (typeof window === "undefined") return null;

  const current = browserSession();
  if (current) return current;
  try {
    const { value } = await Preferences.get({ key: AUTH_PREF_KEY });
    if (value) {
      const parsed = JSON.parse(value) as OfflineAuthSession;
      if (parsed && parsed.userId && parsed.role) return parsed;
    }
  } catch {
    // Ignore Preferences error and fallback to localStorage
  }

  try {
    const raw = window.localStorage.getItem(AUTH_PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OfflineAuthSession;
      if (parsed && parsed.userId && parsed.role) return parsed;
    }
  } catch {
    // Ignore JSON parse error
  }

  return null;
}

export async function clearOfflineAuthSession(): Promise<void> {
  if (typeof window === "undefined") return;

  const owner = ownerKey(browserSession());
  try {
    window.localStorage.removeItem(AUTH_PREF_KEY);
    window.localStorage.removeItem("qawmi_access_token");
  } catch {}
  try {
    await Preferences.remove({ key: AUTH_PREF_KEY });
  } catch {}
  // Pending writes stay quarantined in the owner's database for their next verified login.
  if (owner && typeof indexedDB !== "undefined") {
    const { getOfflineDb } = await import("./offlineDb");
    await getOfflineDb(owner).portalSnapshots.clear();
  }
}

export function resolvePortalTypeFromRole(
  role?: string | null,
): "teacher" | "student" | "admin" {
  const normalized = String(role || "").toLowerCase();
  if (teacherRoles.includes(normalized)) {
    return "teacher";
  }
  if (studentRoles.includes(normalized)) {
    return "student";
  }
  return "admin";
}
