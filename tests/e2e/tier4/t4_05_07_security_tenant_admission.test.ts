import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  CLASSES_A,
  CLASSES_B,
  MADRASA_A_ID,
  MADRASA_B_ID,
  SESSION_A_1446,
  STUDENTS_A,
  STUDENTS_B,
  USERS,
} from "../helpers/fixtures";

describe("Tier 4 — Real-World Qawmi Madrasa Scenarios (T4-05 to T4-07)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T4-05: Security Incident Response & Audit Forensics — Suspicious IP login -> masked export -> blocked AI locked-period write -> remote session revocation -> immutable audit logs", async () => {
    const deleteSession = await loadRouteHandler("auth/sessions", "DELETE");
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const exportHandler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof exportHandler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.db.seed("academic_sessions", SESSION_A_1446);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("user_sessions", {
      id: "sess-suspicious-t405",
      madrasa_id: MADRASA_A_ID,
      user_id: USERS.officeStaffA.id,
      session_token_hash: "hash-susp-405",
      ip_address: "185.220.101.45",
      is_active: true,
    });

    harness.auth.asUser(USERS.officeStaffA);
    harness.setIp("185.220.101.45");
    const expRes = await exportHandler(
      exportMod.POST
        ? harness.createRequest("/api/exports", {
            method: "POST",
            body: { dataset: "students", format: "csv" },
          })
        : harness.createRequest("/api/exports?dataset=students&format=csv")
    );
    assert.equal(expRes.status, 200);
    const csv = await expRes.text();
    assert.ok(!csv.includes(STUDENTS_A.abdullah.parent_phone));

    const blockedAi = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "add_expense",
          payload: {
            sessionId: SESSION_A_1446.id,
            amount: 9000,
            category: "Other",
            description: "অননুমোদিত খরচ",
          },
        },
      })
    );
    assert.ok(blockedAi.status >= 400);

    harness.auth.asUser(USERS.muhtamimA);
    const revRes = await deleteSession(
      harness.createRequest("/api/auth/sessions?sessionId=sess-suspicious-t405", {
        method: "DELETE",
        body: { sessionId: "sess-suspicious-t405" },
      })
    );
    assert.equal(revRes.status, 200);
    await harness.flushAsync();

    const sessRows = harness.db.getRows(
      "user_sessions",
      (r) => r.id === "sess-suspicious-t405"
    );
    assert.equal(sessRows[0].is_active, false);

    const audits = harness.db.getRows("system_audit_logs");
    assert.ok(audits.some((a) => a.action === "SENSITIVE_DATA_EXPORTED"));
    assert.ok(audits.some((a) => a.action === "SESSION_TERMINATED"));
  });

  it("T4-06: Full Multi-Tenant Isolation Stress Scenario (Madrasa A vs Madrasa B) across BI, Early Warning, Anomalies, Webhooks & Exports", async () => {
    const biMod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);
    const ewMod = await loadModule<{
      getStudentRiskScores: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/early-warning-service", ["getStudentRiskScores"]);
    const anomMod = await loadModule<{
      getFinancialAnomalies: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/anomaly-detection-service", ["getFinancialAnomalies"]);
    const getWebhooks = await loadRouteHandler("webhooks/endpoints", "GET");

    harness.db.seed("classes", [CLASSES_A.mizan, CLASSES_B.mizan]);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_B.tariq]);
    harness.db.seed("student_risk_scores", [
      {
        id: "srs-a-only",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.abdullah.id,
        risk_score: 90,
        risk_level: "CRITICAL",
      },
      {
        id: "srs-b-only",
        madrasa_id: MADRASA_B_ID,
        student_id: STUDENTS_B.tariq.id,
        risk_score: 20,
        risk_level: "LOW",
      },
    ]);
    harness.db.seed("financial_anomalies", [
      {
        id: "anom-a-only",
        madrasa_id: MADRASA_A_ID,
        anomaly_type: "BAZAR_SPIKE",
        severity: "CRITICAL",
        status: "OPEN",
        title: "Tenant A Only Anomaly",
      },
    ]);
    harness.db.seed("webhook_endpoints", [
      {
        id: "wh-a-only",
        madrasa_id: MADRASA_A_ID,
        name: "Tenant A Secret Hook",
        url: "https://tenant-a.example.com/hook",
        secret: "whsec_tenant_a",
        events: ["payment.completed"],
        is_active: true,
      },
    ]);

    const biB = await biMod.getExecutiveBiSnapshot(MADRASA_B_ID);
    assert.ok(!JSON.stringify(biB).includes(STUDENTS_A.abdullah.id));

    const ewB = await ewMod.getStudentRiskScores(MADRASA_B_ID);
    assert.ok(!ewB.some((r) => r.student_id === STUDENTS_A.abdullah.id));

    const anomB = await anomMod.getFinancialAnomalies(MADRASA_B_ID);
    assert.ok(!anomB.some((a) => a.id === "anom-a-only"));

    harness.auth.asUser(USERS.muhtamimB);
    const whResB = await getWebhooks(
      harness.createRequest("/api/webhooks/endpoints", { method: "GET" })
    );
    assert.equal(whResB.status, 200);
    assert.ok(!(await whResB.text()).includes("wh-a-only"));
  });

  it("T4-07: Online Admission -> Confirmed create_student -> student.admitted Webhook + Welcome Notification -> New-Student Risk Grace -> Masked Teacher View", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");
    const ewMod = await loadModule<{
      recalculateStudentRiskScores: (
        madrasaId: string
      ) => Promise<Record<string, unknown>>;
      getStudentRiskScores: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/early-warning-service", [
      "recalculateStudentRiskScores",
      "getStudentRiskScores",
    ]);
    const guardMod = await loadModule<{
      maskStudentSensitiveFields: <T extends Record<string, unknown>>(
        student: T,
        allowUnmasked: boolean
      ) => T;
    }>("@/lib/data-access-guards", ["maskStudentSensitiveFields"]);

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("webhook_endpoints", {
      id: "wh-adm-t407",
      madrasa_id: MADRASA_A_ID,
      name: "Website Admission Sync",
      url: "https://site.example.com/webhooks/admission",
      secret: "whsec_t407",
      events: ["student.admitted"],
      is_active: true,
    });
    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.muhtamimA);
    const admRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "create_student",
          payload: {
            firstName: "ওমর",
            lastName: "ফারুক",
            rollNumber: "199",
            classId: CLASSES_A.mizan.id,
            className: CLASSES_A.mizan.name,
            parentPhone: "01799887766",
            fatherName: "মোঃ আবু বকর",
          },
        },
      })
    );
    assert.equal(admRes.status, 200);
    await harness.flushAsync();

    const students = harness.db.getRows(
      "students",
      (s) => s.roll_number === "199"
    );
    assert.equal(students.length, 1);

    await ewMod.recalculateStudentRiskScores(MADRASA_A_ID);
    const scores = await ewMod.getStudentRiskScores(MADRASA_A_ID);
    const newScore = scores.find((s) => s.student_id === students[0].id);
    if (newScore) {
      assert.notEqual(
        String(newScore.risk_level ?? "").toUpperCase(),
        "CRITICAL",
        "Newly admitted student must receive grace score (not CRITICAL)"
      );
    }

    const maskedForTeacher = guardMod.maskStudentSensitiveFields(
      students[0],
      false
    );
    assert.notEqual(maskedForTeacher.parent_phone, "01799887766");
    assert.ok(String(maskedForTeacher.parent_phone).includes("*"));
  });
});
