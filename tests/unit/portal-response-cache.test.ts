import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as cookieSnapshot } from "@/app/api/portal/snapshot/route";
import { GET as mobileStudent } from "@/app/api/mobile/portal/student/route";
import { GET as mobileTeacher } from "@/app/api/mobile/portal/teacher/route";
import { mobileError } from "@/lib/mobile-api";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), mobile: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/portal/identity", () => ({ webIdentity: mocks.identity }));
vi.mock("@/lib/portal/snapshot", () => ({ portalSnapshot: mocks.snapshot }));
vi.mock("@/lib/mobile-api", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-api")>()),
  authenticateMobileRequest: mocks.mobile,
}));
beforeEach(() => vi.resetAllMocks());

function privateStatus(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
}

it("does not HTTP-cache cookie snapshots or denials on the same URL", async () => {
  const req = new Request("https://stage.example.test/api/portal/snapshot?portal=student&student_id=a");
  mocks.identity.mockResolvedValue(null);
  privateStatus(await cookieSnapshot(req), 401);
  mocks.identity.mockResolvedValue({ tenant: "A" });
  privateStatus(await cookieSnapshot(new Request("https://stage.example.test/api/portal/snapshot")), 400);
  mocks.snapshot.mockResolvedValue(null);
  privateStatus(await cookieSnapshot(req), 403);
  mocks.snapshot.mockRejectedValueOnce(new Error("fixture unavailable"));
  privateStatus(await cookieSnapshot(req), 500);
  mocks.snapshot.mockResolvedValue({ student_id: "a" });
  const ok = await cookieSnapshot(req);
  privateStatus(ok, 200);
  expect(await ok.json()).toEqual({ data: { student_id: "a" } });
});

it.each([
  ["student", mobileStudent],
  ["teacher", mobileTeacher],
] as const)(
  "does not HTTP-cache Bearer %s snapshots, including rejection before a snapshot read",
  async (portal, get) => {
    const req = new NextRequest(`https://stage.example.test/api/mobile/portal/${portal}`);
    mocks.mobile.mockResolvedValue({ ok: false, response: mobileError("Unauthorized", 401) });
    privateStatus(await get(req), 401);
    const ctx = { madrasaId: "A", userRow: { madrasa_id: "B" }, permCtx: { status: "ACTIVE" } };
    mocks.mobile.mockResolvedValue({ ok: true, ctx });
    privateStatus(await get(req), 403);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    ctx.userRow.madrasa_id = "A";
    mocks.snapshot.mockResolvedValue({ portal });
    const ok = await get(req);
    privateStatus(ok, 200);
    expect((await ok.json()).data).toEqual({ portal });
  },
);
