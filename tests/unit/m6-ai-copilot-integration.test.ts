import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createErpTools } from "@/lib/ai/erp-tools";
import {
  INITIAL_NAV_GROUPS,
  sanitizeNavGroups,
} from "@/components/mode/defaultNavData";
import {
  ERP_KNOWLEDGE_BASE,
  buildSystemPrompt,
} from "@/lib/ai/erp-knowledge-base";
import { AUDIT_MODULE_LABELS_BN } from "@/lib/audit-log";
import type { ServerPermissionContext } from "@/lib/permissions-server";

const PHASE_1_3_ROUTES = [
  "/dashboard/settings/security",
  "/dashboard/approvals",
  "/dashboard/communication/orchestrator",
  "/dashboard/settings/automation",
  "/dashboard/settings/webhooks",
  "/dashboard/analytics/executive-bi",
  "/dashboard/analytics/early-warning",
  "/dashboard/accounting/anomalies",
];

function makePermCtx(overrides: Partial<ServerPermissionContext> = {}): ServerPermissionContext {
  return {
    userId: "user-1",
    madrasaId: "madrasa-1",
    role: "muhtamim",
    roles: ["muhtamim"],
    status: "ACTIVE",
    profile: {
      fullName: "মুহতামিম সাহেব",
      email: "muhtamim@example.com",
    },
    summary: {
      effectivePermissions: [
        "student.view",
        "finance.view",
        "finance.create",
        "attendance.view",
        "exam.view",
        "analytics.early_warning",
        "analytics.early_warning.manage",
        "anomaly.view",
        "anomaly.manage",
        "approval.view",
        "approval.approve",
      ],
    },
    ...overrides,
  } as ServerPermissionContext;
}

describe("M6: AI Copilot & Global Integration", () => {
  it("createErpTools is synchronous and exposes all new Read tools + BUG-AI-4 getExamResultsSummary + proposeWriteAction", async () => {
    const ctx = makePermCtx();
    const tools = createErpTools(ctx);

    assert.equal(tools instanceof Promise, false, "createErpTools must be synchronous");

    for (const toolName of [
      "getClasses",
      "getExamsAndSubjects",
      "getExamResultsSummary",
      "searchStudents",
      "searchTeachers",
      "getDashboardSummary",
      "getFeeRecords",
      "getClassOverdueFees",
      "getTodayAbsentStudents",
      "getEarlyWarningRisks",
      "getFinancialAnomalies",
      "getPendingApprovals",
      "getExecutiveBiSummary",
      "navigateToPage",
      "proposeWriteAction",
    ]) {
      assert.ok((tools as Record<string, any>)[toolName], `Missing tool: ${toolName}`);
    }

    // RBAC denial for student portal role
    const studentTools = createErpTools(
      makePermCtx({
        role: "student",
        roles: ["student"],
        summary: { effectivePermissions: [] } as any,
      })
    );
    const denied = await (studentTools.getClassOverdueFees as any).execute({});
    assert.ok(denied.error, "Student role must be denied getClassOverdueFees");

    // proposeWriteAction returns confirmation preview without mutating DB
    const proposal = await (tools.proposeWriteAction as any).execute({
      actionType: "send_due_fee_reminders",
      title: "বকেয়া তাগাদা",
      summary: "মিজান জামাতের বকেয়া তাগাদা পাঠানো হবে",
      payload: { className: "মিজান জামাত" },
    });
    assert.equal(proposal.requiresConfirmation, true);
    assert.equal(proposal.actionType, "send_due_fee_reminders");
    assert.ok(proposal.preview);
  });

  it("sanitizeNavGroups auto-merges missing Phase 1-3 routes while preserving user order, renames, and hidden flags", () => {
    const legacySaved = [
      {
        id: "students",
        title: "আমার কাস্টম শিক্ষার্থী গ্রুপ",
        iconName: "Users",
        hidden: false,
        items: [
          {
            id: "student_list",
            name: "ছাত্র তালিকা (কাস্টম)",
            href: "/dashboard/students",
            iconName: "Users",
            hidden: true,
          },
        ],
      },
    ];

    const merged = sanitizeNavGroups(legacySaved);
    assert.equal(merged[0].title, "আমার কাস্টম শিক্ষার্থী গ্রুপ");
    assert.equal(merged[0].items[0].name, "ছাত্র তালিকা (কাস্টম)");
    assert.equal(merged[0].items[0].hidden, true);

    const allHrefs = new Set(
      merged.flatMap((g) => g.items.map((it) => it.href))
    );
    for (const route of PHASE_1_3_ROUTES) {
      assert.ok(allHrefs.has(route), `sanitizeNavGroups must auto-merge ${route}`);
    }
    assert.ok(allHrefs.has("/dashboard/settings/audit-logs"));
    assert.ok(allHrefs.has("/dashboard/settings/data-governance"));
    assert.ok(INITIAL_NAV_GROUPS.length >= 10);
  });

  it("erp-knowledge-base and buildSystemPrompt include all 8 Phase 1-3 routes and new tools", () => {
    const prompt = buildSystemPrompt({
      userName: "মুহতামিম",
      role: "muhtamim",
      madrasaName: "জামিয়া আরাবিয়া",
    });

    for (const route of PHASE_1_3_ROUTES) {
      assert.ok(
        ERP_KNOWLEDGE_BASE.includes(route),
        `ERP_KNOWLEDGE_BASE missing ${route}`
      );
      assert.ok(prompt.includes(route), `buildSystemPrompt missing ${route}`);
    }

    for (const toolName of [
      "getClassOverdueFees",
      "getTodayAbsentStudents",
      "getEarlyWarningRisks",
      "getFinancialAnomalies",
      "getPendingApprovals",
      "getExecutiveBiSummary",
      "send_absent_guardian_notices",
      "send_due_fee_reminders",
      "trigger_risk_recalculation",
      "trigger_anomaly_scan",
      "submit_approval_decision",
    ]) {
      assert.ok(prompt.includes(toolName), `System prompt missing tool ${toolName}`);
    }
  });

  it("AUDIT_MODULE_LABELS_BN includes all Phase 1-3 modules with non-empty Bangla labels", () => {
    for (const mod of [
      "ai",
      "anomaly",
      "approvals",
      "automation",
      "notifications",
      "webhooks",
      "analytics",
      "security",
      "boarding",
    ]) {
      assert.ok(
        typeof AUDIT_MODULE_LABELS_BN[mod] === "string" &&
          AUDIT_MODULE_LABELS_BN[mod].length > 0,
        `Missing Bangla label for audit module: ${mod}`
      );
    }
  });
});
