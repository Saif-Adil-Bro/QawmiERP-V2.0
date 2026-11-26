import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
  createAdminClient: vi.fn(),
  getAuthUser: vi.fn(async () => null),
}));
vi.mock("@/lib/permissions-server", () => ({ assertActiveAccount: vi.fn() }));
vi.mock("@/lib/action-authorization", () => ({ writeGuard: vi.fn() }));

import { authorizeSuperAdminOrCron } from "@/lib/api-auth";

const ROOT = process.cwd();
const req = (headers: Record<string, string> = {}) =>
  new Request("https://app.example/api/cron/process-queues", { headers });

const CRON_ROUTE_PATHS = [
  "/api/cron/dispatch",
  "/api/cron/monthly-fees",
  "/api/cron/overdue-reminders",
  "/api/cron/absence-alerts",
  "/api/cron/process-queues",
  "/api/cron/digest-reports",
  "/api/cron/early-warning",
  "/api/cron/anomalies",
];

describe("cron auth — Vercel & Railway/GitHub Actions use the same Bearer contract", () => {
  it("accepts Authorization: Bearer <CRON_SECRET> (Vercel Cron and GitHub Actions)", async () => {
    process.env.CRON_SECRET = "s3cret-token";
    const r = await authorizeSuperAdminOrCron(req({ authorization: "Bearer s3cret-token" }));
    expect(r.ok).toBe(true);
  });

  it("rejects a wrong token, and never trusts a spoofed x-vercel-cron header alone", async () => {
    process.env.CRON_SECRET = "s3cret-token";
    const bad = await authorizeSuperAdminOrCron(req({ authorization: "Bearer nope" }));
    expect(bad.ok).toBe(false);
    const spoof = await authorizeSuperAdminOrCron(req({ "x-vercel-cron": "1" }));
    expect(spoof.ok).toBe(false);
  });

  it("rejects when CRON_SECRET is unset even if a Bearer header is sent", async () => {
    delete process.env.CRON_SECRET;
    const r = await authorizeSuperAdminOrCron(req({ authorization: "Bearer anything" }));
    expect(r.ok).toBe(false);
  });
});

describe("cron config consistency", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/cron-jobs.yml"), "utf8");

  it("keeps the 15-minute Actions dispatcher and a daily Vercel fallback at 07:00 Dhaka", () => {
    expect(workflow).toContain('cron: "*/15 * * * *"');
    expect(workflow).toContain("/api/cron/dispatch");
    const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
    expect(vercel.crons).toEqual([{ path: "/api/cron/dispatch", schedule: "0 1 * * *" }]);
  });

  it("every cron route file exists and exports force-dynamic", () => {
    for (const routePath of CRON_ROUTE_PATHS) {
      const file = path.join(ROOT, "app", routePath, "route.ts");
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, "utf8")).toMatch(/export const dynamic = "force-dynamic"/);
    }
  });
});
