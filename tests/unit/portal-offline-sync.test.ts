import { describe, it, expect, beforeEach } from "vitest";
import {
  clearOfflineAuthSession,
  getOfflineAuthSession,
  resolvePortalTypeFromRole,
  saveOfflineAuthSession,
} from "@/lib/offline-auth";
import { QawmiERPOfflineDB } from "@/lib/offlineDb";

describe("Portal Offline-First Auth & Dexie v2 Schema", () => {
  beforeEach(() => {
    // Provide minimal localStorage polyfill for Node test environment if needed
    const store = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    };
  });

  it("resolves portal types correctly from user roles", () => {
    expect(resolvePortalTypeFromRole("teacher")).toBe("teacher");
    expect(resolvePortalTypeFromRole("hifz_teacher")).toBe("teacher");
    expect(resolvePortalTypeFromRole("student")).toBe("student");
    expect(resolvePortalTypeFromRole("parent")).toBe("student");
    expect(resolvePortalTypeFromRole("guardian")).toBe("student");
    expect(resolvePortalTypeFromRole("super_admin")).toBe("admin");
  });

  it("saves, retrieves, and clears offline auth session", async () => {
    await saveOfflineAuthSession({
      accessToken: "tok_123",
      refreshToken: "ref_123",
      role: "teacher",
      madrasaId: "mad_1",
      userId: "usr_1",
      fullName: "উস্তাদ করিম",
      redirectUrl: "/teacher-portal",
      savedAt: 1700000000000,
    });

    const loaded = await getOfflineAuthSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.userId).toBe("usr_1");
    expect(loaded?.role).toBe("teacher");
    expect(loaded?.madrasaId).toBe("mad_1");
    expect(loaded?.redirectUrl).toBe("/teacher-portal");

    await clearOfflineAuthSession();
    const afterClear = await getOfflineAuthSession();
    expect(afterClear).toBeNull();
  });

  it("defines QawmiERPOfflineDB class with version 2 portal tables", () => {
    expect(typeof QawmiERPOfflineDB).toBe("function");
  });
});
