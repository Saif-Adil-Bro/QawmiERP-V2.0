import { Preferences } from "@capacitor/preferences";

export type PortalRole = "student" | "guardian" | "parent" | "teacher" | "hifz_teacher" | string;

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

export async function saveOfflineAuthSession(session: OfflineAuthSession): Promise<void> {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(session);

  try {
    await Preferences.set({ key: AUTH_PREF_KEY, value: serialized });
  } catch {
    // Fallback on web / unsupported environments
  }

  try {
    window.localStorage.setItem(AUTH_PREF_KEY, serialized);
    if (session.accessToken) {
      window.localStorage.setItem("qawmi_access_token", session.accessToken);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function getOfflineAuthSession(): Promise<OfflineAuthSession | null> {
  if (typeof window === "undefined") return null;

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

  try {
    await Preferences.remove({ key: AUTH_PREF_KEY });
  } catch {
    // Ignore
  }

  try {
    window.localStorage.removeItem(AUTH_PREF_KEY);
    window.localStorage.removeItem("qawmi_access_token");
  } catch {
    // Ignore
  }
}

export function resolvePortalTypeFromRole(role?: string | null): "teacher" | "student" | "admin" {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "teacher" || normalized === "hifz_teacher") {
    return "teacher";
  }
  if (normalized === "student" || normalized === "parent" || normalized === "guardian") {
    return "student";
  }
  return "admin";
}
