import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  send: vi.fn(),
  legacy: vi.fn(),
  stamp: vi.fn(),
  audit: vi.fn(),
  find: vi.fn(),
  roster: vi.fn(),
  meta: vi.fn(),
}));
vi.mock("@/lib/notifications/orchestrator", () => ({
  dispatchNotification: m.send,
}));
vi.mock("@/lib/student-health/staff", () => ({ roster: m.roster }));
vi.mock("@/lib/student-health/store", () => ({
  HealthError: class extends Error {},
  findCase: m.find,
  stamp: m.stamp,
}));
vi.mock("@/lib/sms-gateway", async (original) => ({
  ...(await original<typeof import("@/lib/sms-gateway")>()),
  dispatchSMSGatewayRequest: m.legacy,
}));
vi.mock("@/lib/sessions", () => ({ getMadrasaMetadata: m.meta }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: m.audit }));
import { alertFamily } from "@/lib/student-health/alerts";
const c = { db: {} as any, tenant: "verified-tenant", actor: "staff" },
  at = "2026-11-18T09:00:00Z";
beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue({
    row: {
      student_id: "child",
      status: "hospitalized",
      severity: "critical",
      illness_type: "জ্বর",
      updated_at: at,
    },
  });
  m.roster.mockResolvedValue([
    { id: "child", name: "করিম", parent_phone: "০১৭১২৩৪৫৬৭৮" },
  ]);
  m.meta.mockResolvedValue({
    sms_gateway: { provider: "mram", isEnabled: true, apiKey: "fixture" },
  });
});
describe("Guardian health delivery receipts", () => {
  it("binds an edited message to the stored guardian destination and writes only a non-clinical audit", async () => {
    m.send.mockResolvedValue({
      ok: true,
      status: "SENT",
      deliveredChannel: "sms",
      attemptedChannels: [],
    });
    expect(await alertFamily(c, "record", ["sms"], "Private update")).toBe(
      "sms",
    );
    expect(m.send).toHaveBeenCalledWith(
      "STUDENT_HEALTH_ALERT",
      expect.objectContaining({
        body: "Private update",
        recipientPhone: "01712345678",
        madrasaId: c.tenant,
        channels: ["sms"],
        confidential: true,
        maxAttempts: 1,
      }),
    );
    expect(m.legacy).not.toHaveBeenCalled();
    expect(m.stamp).toHaveBeenCalledWith(
      c.db,
      expect.anything(),
      "guardian_notified_at",
      c.actor,
    );
    expect(m.audit.mock.calls[0][0]).toMatchObject({
      action: "GUARDIAN_HEALTH_ALERT_SENT",
      entityId: "record",
    });
    expect(JSON.stringify(m.audit.mock.calls)).not.toMatch(
      /Private update|01712345678/,
    );
  });
  it("never stamps or resends ambiguous/queued failures; prevents a stale editor from announcing a newer clinical state", async () => {
    m.send.mockResolvedValue({
      ok: false,
      status: "RETRYING",
      attemptedChannels: [{ channel: "sms", error: "timeout" }],
    });
    await expect(alertFamily(c, "record", ["sms"])).rejects.toThrow();
    await expect(
      alertFamily(c, "record", ["sms"], "Old message", "2026-11-17T00:00:00Z"),
    ).rejects.toThrow();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.stamp).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.legacy).not.toHaveBeenCalled();
  });
  it("uses the legacy gateway only if no SMS was attempted by a configured provider; requires a positive receipt", async () => {
    m.send.mockResolvedValue({
      ok: false,
      status: "FAILED",
      attemptedChannels: [
        { channel: "sms", ok: false, error: "SMS gateway is not configured" },
      ],
    });
    m.legacy
      .mockResolvedValueOnce({ success: true, rawResponse: "1007" })
      .mockResolvedValueOnce({
        success: true,
        rawResponse: "SMS Submitted 54321987",
      });
    await expect(alertFamily(c, "record", ["sms"])).rejects.toThrow();
    expect(m.stamp).not.toHaveBeenCalled();
    expect(await alertFamily(c, "record", ["sms"])).toBe("sms");
    expect(m.legacy).toHaveBeenCalledTimes(2);
    expect(m.stamp).toHaveBeenCalledTimes(1);
  });
});
