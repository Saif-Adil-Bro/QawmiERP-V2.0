import { describe, expect, it } from "vitest";
import { resolveCronTenant } from "@/lib/automation/cron-auth";

describe("resolveCronTenant (cross-tenant isolation)", () => {
  it("session-based super_admin is pinned to own madrasa, ignoring requested id", () => {
    expect(resolveCronTenant({ ok: true, scopedMadrasaId: "m-own" }, "m-other")).toBe("m-own");
    expect(resolveCronTenant({ ok: true, scopedMadrasaId: "m-own" }, null)).toBe("m-own");
  });

  it("CRON_SECRET caller may target a specific tenant or all tenants", () => {
    expect(resolveCronTenant({ ok: true }, "m-any")).toBe("m-any");
    expect(resolveCronTenant({ ok: true }, null)).toBeNull();
    expect(resolveCronTenant({ ok: true }, undefined)).toBeNull();
  });
});
