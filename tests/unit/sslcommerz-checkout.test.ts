import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DEFAULT_GATEWAY_CONFIG } from "@/lib/payment-gateway";
import {
  bdtPoisha,
  paymentCallbackOrigin,
  sslCommerzAccount,
  validateSSLCommerzTransaction,
} from "@/lib/payment-gateway-engine";
import { initiateOnlinePayment } from "@/app/actions/payment-gateway";

const h = vi.hoisted(() => ({
  config: vi.fn(),
  identity: vi.fn(),
  linked: vi.fn(),
  client: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("@/lib/payment-gateway-config", () => ({ getFullPaymentGatewayConfig: h.config }));
vi.mock("@/lib/portal/identity", () => ({
  webIdentity: h.identity,
  linkedStudents: h.linked,
  hasRole: (_: unknown, roles: string[]) => roles.includes("parent"),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: h.client }));
vi.mock("@/app/actions/fee-management", () => ({ getStudentFeeProfile: h.profile }));
const config = {
  ...DEFAULT_GATEWAY_CONFIG,
  is_enabled: true,
  convenience_fee_percent: 3,
  sslcommerz: { store_id: "fixture-merchant", store_passwd: "fixture-only", is_live: false },
};
const tenant = "a0000000-0000-4000-8000-000000000001";
const params = { student_id: "pupil", amount: 75.25, payment_channel: "bKash" as const };
const rpc = vi.fn();
function setup() {
  const student = {
    id: params.student_id,
    madrasa_id: tenant,
    first_name: "Private",
    parent_phone: "01700000000",
  };
  h.identity.mockResolvedValue({ tenant });
  h.linked.mockResolvedValue({ child: student });
  const builder = { select: () => builder, eq: () => builder, single: async () => ({ data: student }) };
  h.client.mockResolvedValue({ from: () => builder, rpc });
  rpc.mockResolvedValue({ error: null });
  h.profile.mockResolvedValue({ fees: [{ id: "posted-bill", due_amount: 85.25 }] });
  h.config.mockResolvedValue(config);
}
beforeEach(() => {
  vi.clearAllMocks();
  setup();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("reserves a bound intent before checkout and sends tenant-qualified callbacks to this environment only", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stage.example.test/");
  const http = vi.fn(async (url, init) => {
    expect(rpc).toHaveBeenCalledOnce();
    const [, { p_tenant, p_txn }] = rpc.mock.calls[0];
    expect(p_tenant).toBe(tenant);
    expect(p_txn).toMatchObject({
      madrasa_id: tenant,
      provider: "SSLCOMMERZ",
      status: "PENDING",
      amount: 75.25,
      convenience_fee: 2,
      total_payable: 77.25,
      allocations: [{ student_fee_id: "posted-bill", allocated_amount: 75.25 }],
    });
    expect(p_txn.sslcommerz_scope).toBe(sslCommerzAccount(config)?.scope);
    expect(JSON.stringify(p_txn)).not.toMatch(/fixture-merchant|fixture-only/);
    expect(url).toBe("https://sandbox.sslcommerz.com/gwprocess/v4/api.php");
    const body = new URLSearchParams(init.body);
    expect(body.get("tran_id")).toBe(p_txn.transaction_id);
    expect(body.get("total_amount")).toBe("77.25");
    for (const key of ["success", "ipn"])
      expect(body.get(`${key}_url`)).toBe(
        `https://stage.example.test/api/payments/sslcommerz/${key}?tenant=${tenant}`,
      );
    return Response.json({ status: "SUCCESS", GatewayPageURL: "https://checkout.example.test/session" });
  });
  vi.stubGlobal("fetch", http);
  expect((await initiateOnlinePayment(params)).success).toBe(true);
  expect(http).toHaveBeenCalledOnce();
});
it("does not open checkout or write pending data on bad amounts, missing callback origin or mixed-mode credentials", async () => {
  const http = vi.fn();
  vi.stubGlobal("fetch", http);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  expect((await initiateOnlinePayment(params)).error).toBeTruthy();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stage.example.test");
  expect((await initiateOnlinePayment({ ...params, amount: 75.251 })).error).toBeTruthy();
  h.config.mockResolvedValue({ ...config, environment: "LIVE" });
  expect((await initiateOnlinePayment(params)).error).toBeTruthy();
  expect(rpc).not.toHaveBeenCalled();
  expect(http).not.toHaveBeenCalled();
});
it("will not send a shopper to the PSP if the intent could not be reserved", async () => {
  const http = vi.fn();
  vi.stubGlobal("fetch", http);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stage.example.test");
  rpc.mockResolvedValue({ error: { code: "23505" } });
  expect((await initiateOnlinePayment(params)).error).toBeTruthy();
  expect(http).not.toHaveBeenCalled();
});
it("uses exact poisha and only an explicit HTTPS origin", () => {
  for (const v of ["75.251", "75.25 BDT", "7.525e1", NaN, Infinity, true, -1, "", null])
    expect(bdtPoisha(v)).toBeNull();
  expect(bdtPoisha(0.01)).toBe(1);
  expect(bdtPoisha("75.20")).toBe(7520);
  for (const url of [
    "https://your-domain.com",
    "http://stage.example.test",
    "https://u:p@stage.example.test",
    "https://stage.example.test/pay?txn=a",
  ])
    expect(paymentCallbackOrigin(url)).toBeNull();
});
it("binds mode and merchant, not password; a gateway outage is not an approval", async () => {
  expect(DEFAULT_GATEWAY_CONFIG.is_enabled).toBe(false);
  expect(sslCommerzAccount(DEFAULT_GATEWAY_CONFIG)).toBeNull();
  const scope = sslCommerzAccount(config)?.scope;
  expect(scope).toMatch(/^SANDBOX:[0-9a-f]{64}$/);
  expect(
    sslCommerzAccount({ ...config, sslcommerz: { ...config.sslcommerz, store_passwd: "rotated" } })?.scope,
  ).toBe(scope);
  const live = {
    ...config,
    environment: "LIVE" as const,
    sslcommerz: { ...config.sslcommerz, is_live: true },
  };
  expect(sslCommerzAccount(live)?.scope).not.toBe(scope);
  const http = vi.fn(async (url: string, opts: RequestInit) => {
    expect(new URL(url).origin).toBe("https://securepay.sslcommerz.com");
    expect(opts.redirect).toBe("error");
    expect(opts.signal).toBeTruthy();
    throw new Error("unavailable, private detail");
  });
  vi.stubGlobal("fetch", http);
  const proof = await validateSSLCommerzTransaction("val", live);
  expect(proof).toMatchObject({ is_valid: false, unavailable: true });
  expect(JSON.stringify(proof)).not.toContain("private detail");
  expect(http).toHaveBeenCalledOnce();
});
