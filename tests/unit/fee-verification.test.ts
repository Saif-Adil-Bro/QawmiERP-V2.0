import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { verifyInteractiveFee, verifySslFeeCallback } from "@/lib/fee-settlement";
import { DEFAULT_GATEWAY_CONFIG } from "@/lib/payment-gateway";
import { getFullPaymentGatewayConfig } from "@/lib/payment-gateway-config";
import { sslCommerzAccount } from "@/lib/payment-gateway-engine";
import { feeReturnNotice } from "@/lib/payment-return";

const h = vi.hoisted(() => ({
  identity: vi.fn(),
  linked: vi.fn(),
  guard: vi.fn(),
  read: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/portal/identity", () => ({
  webIdentity: h.identity,
  linkedStudents: h.linked,
  hasRole: (i: { role: string }, roles: string[]) => roles.includes(i.role),
}));
vi.mock("@/lib/action-authorization", () => ({ writeGuard: h.guard }));
vi.mock("@/lib/sessions", () => ({ getMadrasaMetadata: h.read }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: h.client }));
const tenant = "a0000000-0000-4000-8000-000000000001";
const config = {
  ...DEFAULT_GATEWAY_CONFIG,
  sandbox_test_mode: true,
  sslcommerz: { store_id: "test-store", store_passwd: "test-only", is_live: false },
};
const intent = {
  transaction_id: "ref",
  madrasa_id: tenant,
  student_id: "child",
  status: "PENDING",
  provider: "SSLCOMMERZ",
  amount: 10,
  total_payable: 11,
  convenience_fee: 1,
  sslcommerz_scope: sslCommerzAccount(config)!.scope,
};
const input = { transaction_id: "ref", madrasa_id: tenant, gateway_ref: "val" };
const setProvider = (provider: string) =>
  h.read.mockResolvedValue({
    online_transactions: [{ ...intent, provider }],
    payment_gateway_config: config,
  });
const validator = vi.fn(async () =>
  Response.json({
    status: "VALID",
    amount: "11.00",
    currency: "BDT",
    tran_id: "ref",
    val_id: "val",
    bank_tran_id: "provider-bank",
  }),
);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", validator);
  setProvider("SSLCOMMERZ");
  h.identity.mockResolvedValue({ tenant, role: "admin" });
  h.linked.mockResolvedValue({ child: { id: "child" } });
  h.guard.mockResolvedValue({ allowed: true, madrasaId: tenant });
  h.client.mockResolvedValue({ rpc: h.rpc });
  h.rpc.mockResolvedValue({ data: { receipt_no: "R", already_paid: true } });
});
afterEach(() => vi.unstubAllGlobals());

it("does not use a browser session to turn an SSL notification into manual approval", async () => {
  setProvider("DIRECT_ISLAMI_BANK");
  expect(await verifySslFeeCallback(tenant, "ref", "val")).toMatchObject({ success: false, httpStatus: 400 });
  expect(h.identity).not.toHaveBeenCalled();
  expect(h.guard).not.toHaveBeenCalled();
  expect(h.rpc).not.toHaveBeenCalled();
});
it("blocks an unlinked family, a teacher, the wrong tenant and simulation on a real checkout", async () => {
  h.identity.mockResolvedValue({ tenant, role: "parent" });
  h.linked.mockResolvedValue({ child: null });
  expect(await verifyInteractiveFee(input)).toMatchObject({ success: false, httpStatus: 403 });
  h.identity.mockResolvedValue({ tenant, role: "teacher" });
  expect(await verifyInteractiveFee(input)).toMatchObject({ success: false, httpStatus: 403 });
  h.identity.mockResolvedValue({ tenant, role: "admin" });
  expect(await verifyInteractiveFee({ ...input, madrasa_id: "b" + tenant.slice(1) })).toMatchObject({
    success: false,
    httpStatus: 403,
  });
  expect(await verifyInteractiveFee({ ...input, is_simulated: true })).toMatchObject({
    success: false,
    httpStatus: 403,
  });
  expect(validator).not.toHaveBeenCalled();
  expect(h.rpc).not.toHaveBeenCalled();
});
it("allows the linked family to verify a real proof; manual credit still needs same-tenant finance access", async () => {
  h.identity.mockResolvedValue({ tenant, role: "parent" });
  expect(await verifyInteractiveFee({ ...input, bank_tran_id: "form-bank" })).toMatchObject({
    success: true,
    receipt_no: "R",
  });
  expect(h.rpc).toHaveBeenCalledWith(
    "settle_portal_fee_intent",
    expect.objectContaining({ p_tenant: tenant, p_ref: "val", p_bank: "provider-bank" }),
  );
  setProvider("DIRECT_ISLAMI_BANK");
  expect(await verifyInteractiveFee(input)).toMatchObject({ success: false, httpStatus: 403 });
  h.identity.mockResolvedValue({ tenant, role: "accountant" });
  h.guard.mockResolvedValue({ allowed: false });
  expect(await verifyInteractiveFee(input)).toMatchObject({ success: false, httpStatus: 403 });
  h.guard.mockResolvedValue({ allowed: true, madrasaId: tenant });
  expect(await verifyInteractiveFee(input)).toMatchObject({ success: true, receipt_no: "R" });
  expect(validator).toHaveBeenCalledOnce();
  expect(h.rpc).toHaveBeenCalledTimes(2);
});
it("shows return confirmation only for the signed-in child’s actual completed receipt", () => {
  const p = { id: `online:${tenant}:ref`, student_id: "child", status: "COMPLETED", receipt_no: "R" };
  const q = { txn: "ref", receipt: "R", success: "true" };
  expect(feeReturnNotice({}, tenant, "child", [p])).toBeNull();
  expect(feeReturnNotice(q, tenant, "child", [p])?.confirmed).toBe(true);
  expect(feeReturnNotice(q, tenant, "sibling", [p])?.confirmed).toBe(false);
  expect(feeReturnNotice(q, tenant, "child", [{ ...p, status: "REVERSED" }])?.confirmed).toBe(false);
  expect(feeReturnNotice({ ...q, receipt: "URL-ONLY" }, tenant, "child", [p])?.message).not.toContain(
    "URL-ONLY",
  );
  expect(feeReturnNotice({ error: "URL-ONLY" }, tenant, "child", [])?.message).not.toContain("URL-ONLY");
});

it("never opens checkout on display defaults when the actual stored merchant mode is missing", async () => {
  h.read.mockResolvedValue({
    payment_gateway_config: { ...config, is_enabled: true, environment: undefined },
  });
  expect((await getFullPaymentGatewayConfig(tenant)).is_enabled).toBe(false);
  h.read.mockResolvedValue({ payment_gateway_config: { ...config, is_enabled: true } });
  expect((await getFullPaymentGatewayConfig(tenant)).is_enabled).toBe(true);
});
