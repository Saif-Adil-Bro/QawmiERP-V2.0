import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_FUNDS } from "@/lib/fund-utils";
import { changeVoucherStatus } from "@/lib/finance/voucher-status";
import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import {
  readMobileFunds,
  validateFundChange,
} from "@/lib/finance/mobile-catalog";
import { mobileMahfil } from "@/lib/finance/mobile-mahfil";
import { addDonor, voidFundTransaction } from "@/app/actions/zakat";
import {
  getOnlineDonations,
  updateOnlineDonationStatus,
  trackDonationReceipt,
} from "@/app/actions/fundraising";
import { POST as boxPost } from "@/app/api/fundraising/collections/boxes/route";
import { POST as leatherPost } from "@/app/api/fundraising/collections/leather/route";
import { deleteStaffMember } from "@/app/actions/staff";

const tenant = "T",
  actor = "staff",
  id = "21000000-0000-4000-8000-000000000001";
const fields = {
  fund_id: "fund-dev",
  fund_name: DEFAULT_FUNDS.find((f) => f.id === "fund-dev")!.name,
};
const archived = {
  ...fields,
  id: "archived",
  name: "Archived",
  is_active: false,
  code: "ARC",
};
const catalog = [...DEFAULT_FUNDS, archived];
let meta: any,
  tables: Record<string, any[]>,
  signedIn: boolean,
  allowed: boolean,
  school: string,
  feeList: any[];
const voidFee = vi.fn(async () => ({ success: true }));
const db = {
  from: (table: string) => {
    const filters: any = {};
    const query: any = {
      select: () => query,
      eq: (k: string, v: any) => {
        filters[k] = v;
        return query;
      },
      maybeSingle: async () => {
        const hits = (tables[table] || []).filter((r) =>
          Object.entries(filters).every(([k, v]) => r[k] === v),
        );
        return hits.length > 1
          ? { error: { message: "multiple" } }
          : { data: structuredClone(hits[0] || null) };
      },
    };
    query.single = query.maybeSingle;
    return query;
  },
  rpc: vi.fn(async (name: string, p: any): Promise<any> => {
    if (name === "finance_save_member") return { error: null };
    if (name === "finance_fund_catalog") return { data: catalog };
    if (name === "finance_posting_fund") {
      const f = catalog.find((f) => f.id === p.p_id && f.is_active !== false);
      return f && !(f.id === "fund-zakat" && p.p_use !== "deposit")
        ? { data: f }
        : { error: { message: "Inactive or restricted" } };
    }
    if (
      name === "finance_change_voucher" ||
      name === "finance_replace_sources" ||
      name === "finance_post_collection"
    ) {
      Object.assign(meta, structuredClone(p.p_after));
      return { error: null };
    }
    throw Error("Unexpected write " + name);
  }),
};
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: async () => db }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db,
  createAdminClient: async () => db,
  getAuthUser: async () => (signedIn ? { id: actor } : null),
}));
vi.mock("@/lib/sessions", () => ({
  getMadrasaMetadata: async (t: string) =>
    structuredClone(t === "default" ? meta.public : meta),
}));
vi.mock("@/lib/madrasa-default", () => ({
  getDefaultMadrasaId: async () => "default",
}));
vi.mock("@/lib/action-authorization", () => ({
  writeGuard: async () => ({
    allowed: allowed && signedIn,
    userId: actor,
    madrasaId: school,
    fallback: { error: "denied" },
  }),
}));
vi.mock("@/app/actions/students", () => ({
  getAuthMadrasaId: async () => school,
}));
vi.mock("@/app/actions/fee-management", () => ({
  getFeeMetadata: async () => ({ payments: feeList }),
  voidFeePayment: async (...args: any[]) => voidFee.apply(null, args as []),
  unvoidFeePayment: async () => ({ success: true }),
}));
vi.mock("@/lib/finance/funds", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  financeRows: async (_: any, t: string, k: string) =>
    structuredClone(tables[k] || []),
}));
vi.mock("@/lib/mobile-api", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  authenticateMobileRequest: async () => ({
    ok: true,
    ctx: { madrasaId: tenant, userId: actor },
    adminClient: db,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const req = (method: string, body?: any) =>
  new NextRequest("https://school.invalid/api", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const change = (rid: string, income = true, voiding = true) =>
  changeVoucherStatus(tenant, actor, rid, income, "reported error", voiding);
const latest = (name: string) =>
  db.rpc.mock.calls.filter(([n]) => n === name).at(-1)?.[1];
beforeEach(() => {
  meta = {};
  tables = {};
  school = tenant;
  signedIn = true;
  allowed = true;
  feeList = [];
  db.rpc.mockClear();
  voidFee.mockClear();
});

describe("voucher mutations select stored identity", () => {
  it.each(["VERIFIED", "SUCCESS", "COMPLETED"])(
    "voids and restores source-only online status %s without fabricating a SQL voucher",
    async (status) => {
      meta.online_donations = [{ id: "online", ...fields, status, amount: 8 }];
      await change("online");
      expect(latest("finance_change_voucher")).toMatchObject({
        p_table: "source",
        p_record: "online",
        p_actor: actor,
        p_tenant: tenant,
      });
      expect(meta.online_donations[0]).toMatchObject({
        status: "VOID",
        previous_status: status,
      });
      await expect(change("online")).rejects.toThrow();
      await change("online", true, false);
      expect(meta.online_donations[0].status).toBe(status);
    },
  );
  it("requires both owners of a mirrored receipt to agree, never mutates by the caller’s display number", async () => {
    meta.donation_box_logs = [
      { id: "boxlog", receipt_no: "R", amount: 9, ...fields },
    ];
    tables.donations = [
      {
        id,
        madrasa_id: tenant,
        amount: 9,
        ...fields,
        receipt_no: "R",
        notes: "other",
      },
    ];
    await expect(change("boxlog")).rejects.toThrow();
    await expect(change(id)).rejects.toThrow();
    expect(await change("R")).toBe(false);
    expect(latest("finance_change_voucher")).toBeUndefined();
    tables.donations[0].notes = "[দানবাক্স কালেকশন]";
    await change(id);
    expect(latest("finance_change_voucher")).toMatchObject({
      p_table: "donations",
      p_expected: { id },
      p_after: {
        donation_box_logs: [expect.objectContaining({ status: "VOID" })],
      },
    });
    await expect(change(id, true, false)).rejects.toThrow(); // fake SQL row deliberately remains COMPLETED
    tables.donations[0].status = "VOID";
    await change(id, true, false);
    meta.donation_box_logs.push({ ...meta.donation_box_logs[0] });
    await expect(change("boxlog")).rejects.toThrow();
  });
  it("keeps both leather aliases in sync without cancelling transport together with income", async () => {
    const r = {
      id: "skin",
      ...fields,
      received_amount: 20,
      transport_labour_cost: 4,
    };
    meta.leather_batches = [{ ...r }];
    meta.qurbani_leather_records = [{ ...r }];
    await change("leather_exp_skin", false);
    expect(meta.leather_batches[0]).toMatchObject({ expense_status: "VOID" });
    expect(meta.qurbani_leather_records[0].income_status).toBeUndefined();
    await change("leather_inc_skin");
    await change("leather_exp_skin", false, false);
    expect(meta.leather_batches[0]).toMatchObject({
      expense_status: "COMPLETED",
      income_status: "VOID",
    });
    meta.leather_batches[0].received_amount = 1;
    await expect(change("leather_inc_skin", true, false)).rejects.toThrow();
  });
  it("refuses archived restorations, restricted transport, dangling links and metadata-only bazar IDs", async () => {
    meta.donation_box_logs = [
      { id: "gone", ...fields, accounting_record_id: id, amount: 1 },
      {
        id: "arch",
        fund_id: "archived",
        fund_name: "Archived",
        amount: 1,
        status: "VOID",
      },
    ];
    await expect(change("gone")).rejects.toThrow();
    await expect(change("arch", true, false)).rejects.toThrow();
    meta.leather_batches = [
      {
        id: "skin",
        fund_id: "fund-zakat",
        fund_name: DEFAULT_FUNDS[2].name,
        expense_status: "VOID",
        transport_labour_cost: 5,
      },
    ];
    await expect(change("leather_exp_skin", false, false)).rejects.toThrow();
    expect(await change("legacy_bazar_" + id, false)).toBe(false);
    tables.bazar_expenses = [{ id, madrasa_id: tenant, amount: 4, ...fields }];
    await change("bazar_" + id, false);
    expect(latest("finance_change_voucher")).toMatchObject({
      p_table: "bazar_expenses",
      p_expected: { id },
    });
  });
  it("resolves only existing fee receipt/portion IDs, not a number, a zero allocation or a made-up remainder", async () => {
    feeList = [
      {
        id: "fee",
        receipt_no: "R",
        total_amount_received: 10,
        allocations: [
          { allocated_amount: 0 },
          { allocated_amount: 10, ...fields },
        ],
      },
    ];
    for (const invalid of [
      "no-match",
      "R",
      "fee_fee_0",
      "fee_extra",
      "fee_fee_2",
    ])
      expect(
        (await voidFundTransaction(invalid, "INCOME", "reason", "R")).error,
      ).toBeTruthy();
    expect(voidFee).not.toHaveBeenCalled();
    expect(
      (await voidFundTransaction("fee_fee_1", "INCOME", "reason", "another"))
        .success,
    ).toBe(true);
    expect(voidFee).toHaveBeenCalledWith("fee", "reason");
    meta.donation_box_logs = [{ id: "fee", amount: 2, ...fields }];
    expect(
      (await voidFundTransaction("fee", "INCOME", "ambiguous")).error,
    ).toBeTruthy();
  });
  it("blocks staff deletion with paid history before any dependent writes", async () => {
    meta.staff_members = [{ id: "S" }];
    meta.staff_salary_records = [{ staff_id: "S", status: "PAID" }];
    expect(await deleteStaffMember("S")).toHaveProperty("error");
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("mobile and public financial boundaries", () => {
  it("mobile validates explicit funds, intercepts DELETE, refuses balance writes and event book replacement", async () => {
    const ctx: any = { db, tenant, actor, payload: { amount: 4, ...fields } };
    expect(await validateMobilePosting("deposit")(ctx)).toBeUndefined();
    expect(ctx.payload.donation_type).toBe(fields.fund_name);
    expect(
      (await validateMobilePosting("expense")({ ...ctx, payload: {} }))?.status,
    ).toBe(400);
    expect(
      (
        await validateMobilePosting("bazar")({
          ...ctx,
          id,
          operation: "delete",
          payload: {},
        })
      )?.status,
    ).toBe(400);
    tables.bazar_expenses = [{ id, madrasa_id: tenant, amount: 4, ...fields }];
    expect(
      (
        await validateMobilePosting("bazar")({
          ...ctx,
          id,
          operation: "delete",
          payload: { reason: "duplicate" },
        })
      )?.status,
    ).toBe(200);
    expect(
      (
        await validateFundChange({
          ...ctx,
          id,
          payload: { current_balance: 999 },
        })
      )?.status,
    ).toBe(400);
    const choices = await (await readMobileFunds(req("GET"))).json();
    expect(choices.data.map((f: any) => f.id)).not.toContain("archived");
    expect(choices.data[0]).not.toHaveProperty("current_balance");
    meta.mahfils = [
      { id: "M", title: "before", transactions: [{ id: "cash" }] },
    ];
    expect(
      (await mobileMahfil(req("PATCH", { transactions: [] }), "M")).status,
    ).toBe(400);
    expect((await mobileMahfil(req("DELETE"), "M")).status).toBe(409);
    expect(
      (await mobileMahfil(req("PATCH", { title: "after" }), "M")).status,
    ).toBe(200);
    expect(meta.mahfils[0].transactions).toEqual([{ id: "cash" }]);
  });
  it("web box/leather endpoints return a rejected post rather than retrying it as untagged cash", async () => {
    meta.donation_boxes = [{ id: "B", status: "ACTIVE", box_code: "BOX" }];
    const log = {
      ...fields,
      box_id: "B",
      amount: 5,
      receipt_no: "BOX-REC-003",
    };
    expect(
      (
        await boxPost(
          req("POST", {
            action: "record_collection",
            log: { ...log, box_id: "other" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await boxPost(req("POST", { action: "record_collection", log }))).status,
    ).toBe(200);
    const payload = latest("finance_post_collection");
    expect(payload.p_after.donation_box_logs[0].accounting_record_id).toBe(
      payload.p_row.id,
    );
    expect(
      (
        await leatherPost(
          req("POST", {
            ...fields,
            received_amount: 0,
            quantity: 2,
            rate_per_piece: 10,
            total_sale_amount: 20,
            due_amount: 20,
            receipt_no: "LTH-REC-003",
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      latest("finance_replace_sources").p_after.leather_batches[0]
        .received_amount,
    ).toBe(0);
    expect(
      (
        await leatherPost(
          req("POST", { fund_id: "fund-zakat", transport_labour_cost: 5 }),
        )
      ).status,
    ).toBe(400);
    expect(
      db.rpc.mock.calls.filter(([n]) => n === "finance_post_collection"),
    ).toHaveLength(1);
  });
  it("will not re-fund a legacy source-only leather expense by supplying a new ID", async () => {
    const old = { id: 'legacy', receipt_no: 'LTH-REC-007', target_fund: 'Zakat', received_amount: 0, transport_labour_cost: 4 };
    meta.leather_batches = [old];
    const response = await leatherPost(req('POST', { id: old.id, receipt_no: old.receipt_no, ...fields, transport_labour_cost: 4 }));
    expect(response.status).toBe(400);
    expect(latest('finance_replace_sources')).toBeUndefined();
    expect(latest('finance_post_collection')).toBeUndefined();
    expect(meta.leather_batches).toEqual([old]);
  });
  it("requires a permitted donor action and preserves an explicit zero pledge", async () => {
    const form = new FormData();
    form.set("name", "A");
    form.set("pledge_amount", "0");
    form.set("donor_type", "Monthly");
    allowed = false;
    expect((await addDonor(form)).error).toBeTruthy();
    expect(db.rpc).not.toHaveBeenCalled();
    allowed = true;
    expect((await addDonor(form)).donor).toMatchObject({
      name: "A",
      pledge_amount: 0,
    });
    expect(latest("finance_save_member").p_member.pledge_amount).toBe(0);
  });
  it("posts a manually verified donation once; public or gateway status and caller-supplied verifier are not posting authority", async () => {
    const row = {
      id: "manual",
      status: "PENDING",
      amount: 4,
      donation_date: "2026-11-01",
      receipt_no: "ON-9",
      ...fields,
      fund_category: fields.fund_name,
    };
    meta.online_donations = [{ ...row, is_gateway: true }];
    expect(
      (await updateOnlineDonationStatus(row.id, "VERIFIED")).error,
    ).toBeTruthy();
    meta.online_donations = [row];
    expect(
      await updateOnlineDonationStatus(row.id, "VERIFIED", "not-the-actor"),
    ).toMatchObject({ success: true });
    const payload = latest("finance_post_collection");
    expect(payload.p_row.id).toBe(
      meta.online_donations[0].accounting_record_id,
    );
    expect(meta.online_donations[0].verified_by).toBe(actor);
    expect(
      (await updateOnlineDonationStatus(row.id, "PENDING")).error,
    ).toBeTruthy();
    expect(
      db.rpc.mock.calls.filter(([n]) => n === "finance_post_collection"),
    ).toHaveLength(1);
  });
  it("public lookup is a unique, redacted, tenant-bound result; not a fundraising directory", async () => {
    const r = {
      id: "one",
      receipt_no: "R-1",
      trx_id: "private-ref",
      amount: 2,
      status: "VERIFIED",
      phone: "sensitive",
      donor_name: "person",
    };
    meta = {
      public: { online_donations: [{ ...r, madrasa_id: "default" }] },
      online_donations: [
        { ...r, receipt_no: "R-2", madrasa_id: tenant },
        { ...r, receipt_no: "R-X", madrasa_id: "other" },
      ],
    };
    signedIn = false;
    expect((await trackDonationReceipt("private-ref"))?.receipt_no).toBe("R-1");
    expect(await getOnlineDonations()).toEqual([]);
    signedIn = true;
    expect(await trackDonationReceipt("R-1")).toBeNull();
    expect(await trackDonationReceipt("R-X")).toBeNull();
    expect(await trackDonationReceipt("  r-2 ")).not.toHaveProperty("phone");
    expect((await getOnlineDonations()).map((d) => d.receipt_no)).toEqual([
      "R-2",
    ]);
    allowed = false;
    expect(await getOnlineDonations()).toEqual([]);
    meta.online_donations.push({ ...r, receipt_no: "R-2", madrasa_id: tenant });
    expect(await trackDonationReceipt("R-2")).toBeNull();
    meta.online_donations = [{ ...r, receipt_no: null }];
    expect(await trackDonationReceipt(r.trx_id)).toBeNull();
    school = "";
    expect(await trackDonationReceipt("R-1")).toBeNull();
  });
});
