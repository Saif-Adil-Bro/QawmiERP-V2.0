import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyMobileApiKey } from "@/lib/mobile-api";
import {
  mayManageTenantSessions,
  registerUserSession,
} from "@/lib/session-manager";
import {
  currentAppSession,
  SessionUnavailableError,
} from "@/lib/current-app-session";
import { GET as snapshot } from "@/app/api/portal/snapshot/route";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), webIdentity: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/portal/identity", () => ({ webIdentity: mocks.webIdentity }));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("issuer-bound application sessions", () => {
  it("does not register an issuance without the matching subject and top-level provider session ID", async () => {
    const sid = crypto.randomUUID(),
      userId = crypto.randomUUID();
    for (const payload of [
      { sub: userId, user_metadata: { session_id: sid } },
      { sub: crypto.randomUUID(), session_id: sid },
      { sub: userId, session_id: "" },
    ]) {
      // This is just an issuance-parser fixture, not an authentication token.
      const accessToken = `fixture.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.fixture`;
      await expect(
        registerUserSession({
          userId,
          madrasaId: crypto.randomUUID(),
          accessToken,
        }),
      ).rejects.toThrow("binding");
    }
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("distinguishes an absent binding or expired JWT from a registry outage", async () => {
    const rpc = vi.fn(),
      client = { rpc } as any;
    rpc.mockResolvedValueOnce({ data: null, status: 200 });
    expect(await currentAppSession(client)).toBeNull();
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST303" },
      status: 401,
    });
    expect(await currentAppSession(client)).toBeNull();
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202" },
      status: 404,
    });
    await expect(currentAppSession(client)).rejects.toBeInstanceOf(
      SessionUnavailableError,
    );
    expect(rpc.mock.calls).toEqual(Array(3).fill(["current_app_session"])); // no request-supplied ID
  });
  it("returns private 503 rather than clearing offline copies on a temporary session lookup failure", async () => {
    mocks.webIdentity.mockRejectedValue(new SessionUnavailableError());
    const res = await snapshot(
      new Request("http://example.test/api/portal/snapshot?portal=student"),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
  it("limits a portal or inactive account to at most its own sessions even with a management role", () => {
    const ctx = {
      status: "ACTIVE",
      roles: ["admin"],
      summary: { effectivePermissions: ["security.sessions.manage"] },
    };
    expect(mayManageTenantSessions(ctx as any)).toBe(true);
    expect(
      mayManageTenantSessions({ ...ctx, roles: ["admin", "Guardian"] } as any),
    ).toBe(false);
    expect(
      mayManageTenantSessions({ ...ctx, status: "SUSPENDED" } as any),
    ).toBe(false);
  });
  it("requires a configured mobile API key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOBILE_API_KEY", "");
    expect(verifyMobileApiKey(new NextRequest("http://example.test/"))).toBe(
      false,
    );
  });
});
