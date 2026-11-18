import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  DONOR_A,
  STUDENTS_A,
  USERS,
  WATERMARK_CTX_A,
} from "../helpers/fixtures";

describe("Tier 1 — Feature 1.3: Sensitive Data Masking & Export Audit Watermarking (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-1.3-01: maskPhoneNumber masks BD local, +880 international, and Bangla-digit numbers accurately", async () => {
    const mod = await loadModule<{
      maskPhoneNumber: (phone: string | null | undefined) => string;
    }>("@/lib/data-access-guards", ["maskPhoneNumber"]);

    const maskedLocal = mod.maskPhoneNumber("01712345890");
    assert.equal(maskedLocal, "017****890");

    const maskedIntl = mod.maskPhoneNumber("+8801712345890");
    assert.ok(maskedIntl.includes("*"), "+880 phone must contain mask characters");
    assert.ok(
      !maskedIntl.includes("12345"),
      "+880 phone must not expose middle digits"
    );
    assert.ok(maskedIntl.endsWith("890"), "+880 phone should preserve trailing 3 digits");

    const maskedBn = mod.maskPhoneNumber("০১৭১২৩৪৫৮৯০");
    assert.ok(maskedBn.includes("*"), "Bangla phone must be masked");
    assert.ok(
      !maskedBn.includes("১২৩৪৫"),
      "Bangla phone must not expose raw middle digits"
    );
  });

  it("T1-1.3-02: maskNidNumber, maskEmailAddress, and maskBankAccount hide middle sensitive characters", async () => {
    const mod = await loadModule<{
      maskNidNumber: (nid: string | null | undefined) => string;
      maskEmailAddress: (email: string | null | undefined) => string;
      maskBankAccount: (account: string | null | undefined) => string;
    }>("@/lib/data-access-guards", [
      "maskNidNumber",
      "maskEmailAddress",
      "maskBankAccount",
    ]);

    const maskedNid = mod.maskNidNumber("1995123456789");
    assert.ok(maskedNid.includes("*"), "NID must contain mask asterisks");
    assert.notEqual(maskedNid, "1995123456789");
    assert.ok(!maskedNid.includes("12345"), "Middle NID digits must be masked");

    const maskedEmail = mod.maskEmailAddress("rahim.guardian@example.com");
    assert.ok(maskedEmail.endsWith("@example.com"), "Email domain must be preserved");
    assert.ok(maskedEmail.includes("*"), "Email local part must be masked");
    assert.ok(
      !maskedEmail.includes("rahim.guardian"),
      "Full email local part must not be exposed"
    );

    const maskedBank = mod.maskBankAccount("2050123456789012");
    assert.ok(maskedBank.includes("*"), "Bank account must be masked");
    assert.ok(maskedBank.endsWith("9012"), "Bank account should preserve last 4 digits");
    assert.ok(
      !maskedBank.includes("12345678"),
      "Middle bank account digits must not be exposed"
    );
  });

  it("T1-1.3-03: canViewUnmaskedField & record maskers enforce RBAC unmasked override", async () => {
    const mod = await loadModule<{
      canViewUnmaskedField: (
        summary: Record<string, unknown>,
        module: string,
        field: string
      ) => boolean;
      maskStudentSensitiveFields: <T extends Record<string, unknown>>(
        student: T,
        allowUnmasked: boolean
      ) => T;
      maskDonorSensitiveFields: <T extends Record<string, unknown>>(
        donor: T,
        allowUnmasked: boolean
      ) => T;
    }>("@/lib/data-access-guards", [
      "canViewUnmaskedField",
      "maskStudentSensitiveFields",
      "maskDonorSensitiveFields",
    ]);

    const muhtamimSummary = {
      roles: ["muhtamim"],
      effectivePermissions: ["student.view", "data.unmask"],
    };
    const teacherSummary = {
      roles: ["teacher"],
      effectivePermissions: ["student.view"],
    };

    assert.equal(
      mod.canViewUnmaskedField(muhtamimSummary, "students", "parent_phone"),
      true
    );
    assert.equal(
      mod.canViewUnmaskedField(teacherSummary, "students", "parent_phone"),
      false
    );

    const maskedStudent = mod.maskStudentSensitiveFields(STUDENTS_A.abdullah, false);
    assert.equal(maskedStudent.first_name, STUDENTS_A.abdullah.first_name);
    assert.equal(maskedStudent.roll_number, STUDENTS_A.abdullah.roll_number);
    assert.notEqual(maskedStudent.parent_phone, STUDENTS_A.abdullah.parent_phone);
    assert.ok(String(maskedStudent.parent_phone).includes("*"));

    const unmaskedStudent = mod.maskStudentSensitiveFields(STUDENTS_A.abdullah, true);
    assert.equal(unmaskedStudent.parent_phone, STUDENTS_A.abdullah.parent_phone);

    const maskedDonor = mod.maskDonorSensitiveFields(DONOR_A, false);
    assert.equal(maskedDonor.name, DONOR_A.name);
    assert.notEqual(maskedDonor.phone, DONOR_A.phone);
    assert.ok(String(maskedDonor.phone).includes("*"));
  });

  it("T1-1.3-04: buildWatermarkedCsv and buildPrintWatermarkHtml embed exporter, role, IP, and timestamp", async () => {
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

    const wm = mod.buildExportWatermark(WATERMARK_CTX_A);
    assert.equal(wm.exportedBy, WATERMARK_CTX_A.exportedBy);
    assert.equal(wm.ipAddress, WATERMARK_CTX_A.ipAddress);

    const csv = mod.buildWatermarkedCsv(
      ["রোল", "নাম", "ফোন"],
      [["101", "আব্দুল্লাহ আল মামুন", "017****890"]],
      wm
    );
    assert.ok(csv.includes(WATERMARK_CTX_A.exportedBy), "CSV must embed exporter name");
    assert.ok(csv.includes(WATERMARK_CTX_A.ipAddress), "CSV must embed IP address");
    assert.ok(csv.includes("আব্দুল্লাহ আল মামুন"), "CSV must include data rows");

    const html = mod.buildPrintWatermarkHtml(wm);
    assert.ok(html.includes(WATERMARK_CTX_A.exportedBy), "Print HTML must include exporter name");
    assert.ok(html.includes(WATERMARK_CTX_A.ipAddress), "Print HTML must include IP address");
  });

  it("T1-1.3-05: buildWatermarkedWorkbook generates a valid XLSX Buffer containing data and watermark metadata", async () => {
    const mod = await loadModule<{
      buildExportWatermark: (ctx: Record<string, unknown>) => Record<string, unknown>;
      buildWatermarkedWorkbook: (
        sheetName: string,
        headers: string[],
        rows: (string | number | null | undefined)[][],
        watermark: Record<string, unknown>
      ) => Buffer | Uint8Array;
    }>("@/lib/export-watermark", [
      "buildExportWatermark",
      "buildWatermarkedWorkbook",
    ]);

    const wm = mod.buildExportWatermark(WATERMARK_CTX_A);
    const buf = mod.buildWatermarkedWorkbook(
      "Students",
      ["Roll", "Name", "Phone"],
      [["101", "Abdullah", "017****890"]],
      wm
    );
    const bytes = Buffer.from(buf);
    assert.ok(bytes.length > 100, "XLSX workbook buffer must be non-trivial");
    // PK zip magic signature (0x50 0x4B)
    assert.equal(bytes[0], 0x50, "XLSX must be a valid ZIP container (PK header)");
    assert.equal(bytes[1], 0x4b, "XLSX must be a valid ZIP container (PK header)");

    const xlsxPkg = "xlsx";
    const XLSX = (await import(xlsxPkg)) as {
      read: (b: Buffer, o: { type: string }) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: { sheet_to_csv: (s: unknown) => string };
    };
    const wb = XLSX.read(bytes, { type: "buffer" });
    assert.ok(wb.SheetNames.length >= 1, "Workbook must have at least one sheet");
    const combinedText = wb.SheetNames.map((n) =>
      XLSX.utils.sheet_to_csv(wb.Sheets[n])
    ).join("\n");
    assert.ok(combinedText.includes("Abdullah"), "Workbook must contain data rows");
    assert.ok(
      combinedText.includes(WATERMARK_CTX_A.ipAddress) ||
        combinedText.includes(WATERMARK_CTX_A.exportedBy),
      "Workbook sheets must embed watermark metadata"
    );
  });

  it("T1-1.3-06: /api/exports returns watermarked export and logs mandatory SENSITIVE_DATA_EXPORTED audit event", async () => {
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const handler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof handler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.auth.asUser(USERS.muhtamimA);
    harness.setIp("103.112.54.22");
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);

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
    assert.ok(text.includes("103.112.54.22"), "Exported CSV must contain exporter IP watermark");

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "SENSITIVE_DATA_EXPORTED"
    );
    assert.ok(
      audits.length >= 1,
      "Export API MUST log SENSITIVE_DATA_EXPORTED to system_audit_logs"
    );
  });
});
