import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  MADRASA_A_ID,
  STUDENTS_A,
  STUDENTS_B,
  USERS,
  WATERMARK_CTX_A,
} from "../helpers/fixtures";

describe("Tier 2 — Feature 1.3: Sensitive Data Masking & Export Audit Watermarking (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-1.3-01: Masking helpers handle null, undefined, empty, and short strings safely without throwing", async () => {
    const mod = await loadModule<{
      maskPhoneNumber: (phone: string | null | undefined) => string;
      maskNidNumber: (nid: string | null | undefined) => string;
      maskEmailAddress: (email: string | null | undefined) => string;
      maskBankAccount: (account: string | null | undefined) => string;
    }>("@/lib/data-access-guards", [
      "maskPhoneNumber",
      "maskNidNumber",
      "maskEmailAddress",
      "maskBankAccount",
    ]);

    for (const edge of [null, undefined, "", "   "]) {
      assert.equal(typeof mod.maskPhoneNumber(edge), "string");
      assert.equal(typeof mod.maskNidNumber(edge), "string");
      assert.equal(typeof mod.maskEmailAddress(edge), "string");
      assert.equal(typeof mod.maskBankAccount(edge), "string");
    }

    const shortPhone = mod.maskPhoneNumber("017");
    assert.ok(!shortPhone.includes("017") || shortPhone.includes("*"));
    const shortEmail = mod.maskEmailAddress("a@b.c");
    assert.ok(shortEmail.includes("@b.c") && shortEmail.includes("*"));
  });

  it("T2-1.3-02: /api/exports enforces RBAC and masks PII when actor lacks data.unmask", async () => {
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const handler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof handler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.auth.asUser(USERS.officeStaffA); // has student.export, NO data.unmask

    const req = exportMod.POST
      ? harness.createRequest("/api/exports", {
          method: "POST",
          body: { dataset: "students", format: "csv", includeUnmasked: true },
        })
      : harness.createRequest("/api/exports?dataset=students&format=csv", {
          method: "GET",
        });

    const res = await handler(req);
    if (res.status === 200) {
      const text = await res.text();
      assert.ok(
        !text.includes(STUDENTS_A.abdullah.parent_phone),
        "Export without data.unmask must NEVER expose raw parent_phone"
      );
      assert.ok(
        text.includes("*"),
        "Export without data.unmask must contain masked PII"
      );
    } else {
      assert.equal(res.status, 403);
    }
  });

  it("T2-1.3-03: Unauthenticated /api/exports returns 401 and SUSPENDED user returns 403", async () => {
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const handler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof handler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.auth.asAnonymous();
    const anonRes = await handler(
      harness.createRequest("/api/exports", {
        method: exportMod.POST ? "POST" : "GET",
        body: exportMod.POST ? { dataset: "students", format: "csv" } : undefined,
      })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.suspendedStaffA);
    const suspRes = await handler(
      harness.createRequest("/api/exports", {
        method: exportMod.POST ? "POST" : "GET",
        body: exportMod.POST ? { dataset: "students", format: "csv" } : undefined,
      })
    );
    assert.ok(suspRes.status === 401 || suspRes.status === 403);
  });

  it("T2-1.3-04: Cross-tenant export isolation ensures Madrasa B export never contains Madrasa A students", async () => {
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const handler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof handler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_B.tariq]);
    harness.auth.asUser(USERS.muhtamimB);

    const req = exportMod.POST
      ? harness.createRequest("/api/exports", {
          method: "POST",
          body: { dataset: "students", format: "csv" },
        })
      : harness.createRequest("/api/exports?dataset=students&format=csv", {
          method: "GET",
        });

    const res = await handler(req);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(
      !text.includes(STUDENTS_A.abdullah.parent_phone),
      "Madrasa B export must never contain Madrasa A phone numbers"
    );
    assert.ok(
      !text.includes(STUDENTS_A.abdullah.nid_or_birth_cert),
      "Madrasa B export must never contain Madrasa A NIDs"
    );
  });

  it("T2-1.3-05: buildWatermarkedCsv neutralizes CSV formula injection and buildPrintWatermarkHtml escapes XSS", async () => {
    const mod = await loadModule<{
      buildExportWatermark: (ctx: Record<string, unknown>) => Record<string, unknown>;
      buildWatermarkedCsv: (
        headers: string[],
        rows: (string | number | null | undefined)[][],
        watermark: Record<string, unknown>
      ) => string;
      buildPrintWatermarkHtml: (watermark: Record<string, unknown>) => string;
    }>("@/lib/export-watermark", [
      "buildExportWatermark",
      "buildWatermarkedCsv",
      "buildPrintWatermarkHtml",
    ]);

    const wm = mod.buildExportWatermark({
      ...WATERMARK_CTX_A,
      exportedBy: "<script>alert(1)</script>",
    });
    const html = mod.buildPrintWatermarkHtml(wm);
    assert.ok(
      !html.includes("<script>alert(1)</script>"),
      "Print watermark HTML must escape <script> tags"
    );

    const csv = mod.buildWatermarkedCsv(
      ["Name", "Formula"],
      [["Test, \"User\"", "=CMD|' /C calc'!A0"]],
      mod.buildExportWatermark(WATERMARK_CTX_A)
    );
    assert.ok(
      !csv.includes("\n=CMD|") && !csv.includes(",=CMD|"),
      "CSV must neutralize or quote formula-injection payloads starting with '='"
    );
  });

  it("T2-1.3-06: system_audit_logs immutability prevents tampering with SENSITIVE_DATA_EXPORTED records", async () => {
    harness.db.seed("system_audit_logs", {
      id: "audit-immutable-1",
      madrasa_id: MADRASA_A_ID,
      actor_id: USERS.muhtamimA.id,
      action: "SENSITIVE_DATA_EXPORTED",
      module: "security",
      details: { dataset: "students" },
    });

    const patchRes = await fetch(
      "http://supabase.test.local/rest/v1/system_audit_logs?id=eq.audit-immutable-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "TAMPERED" }),
      }
    );
    assert.ok(
      patchRes.status >= 400,
      "Updating immutable system_audit_logs must be rejected"
    );

    const delRes = await fetch(
      "http://supabase.test.local/rest/v1/system_audit_logs?id=eq.audit-immutable-1",
      { method: "DELETE" }
    );
    assert.ok(
      delRes.status >= 400,
      "Deleting immutable system_audit_logs must be rejected"
    );
  });
});
