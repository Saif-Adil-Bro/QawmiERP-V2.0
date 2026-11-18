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
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/cron-jobs.yml"), "utf8");

  it("every vercel.json cron schedule is present in the GitHub workflow", () => {
    for (const c of vercel.crons) {
      expect(workflow).toContain(`cron: "${c.schedule}"`);
    }
  });

  it("every vercel.json cron path has a route file with force-dynamic", () => {
    for (const c of vercel.crons) {
      const file = path.join(ROOT, "app", c.path, "route.ts");
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, "utf8")).toMatch(/export const dynamic = "force-dynamic"/);
    }
  });
});
