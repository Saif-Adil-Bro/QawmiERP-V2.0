import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeStudentRiskScore } from "@/lib/early-warning-engine";
import {
  normalizeBengaliTeacherName,
  resolveTeacherIdentity,
} from "@/lib/teacher-identity";
import { buildMonthlyFeeDedupKey } from "@/lib/automation/fee-cron-service";
import { DEFAULT_AUTOMATION_RULES } from "@/lib/automation/master-dispatcher";

const readWorkspaceFile = (relPath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");

describe("FOLLOWUP 5 Regressions", () => {
  describe("Priority 1 & S2: In-app confirmation modal (no window.confirm/alert) & save-guard", () => {
    it("RemoveTeacherSubjectButton and ClassSubjectsManager avoid native confirm()/alert()", () => {
      const removeBtn = readWorkspaceFile(
        "app/dashboard/teachers/[id]/subjects/RemoveTeacherSubjectButton.tsx"
      );
      const classMgr = readWorkspaceFile(
        "app/dashboard/classes/[id]/subjects/ClassSubjectsManager.tsx"
      );
      const assignForm = readWorkspaceFile(
        "app/dashboard/teachers/[id]/subjects/AssignTeacherSubjectForm.tsx"
      );

      expect(removeBtn).not.toMatch(/\bconfirm\s*\(/);
      expect(removeBtn).not.toMatch(/\balert\s*\(/);
      expect(removeBtn).toContain("বিষয় বরাদ্দ বাতিল করুন");
      expect(removeBtn).toContain("acquireSaveGuard");

      expect(classMgr).not.toMatch(/\bconfirm\s*\(/);
      expect(classMgr).not.toMatch(/\balert\s*\(/);
      expect(classMgr).toContain("pendingDeleteItem");

      expect(assignForm).toContain("acquireSaveGuard");
      expect(assignForm).toContain("beforeunload");
    });
  });

  describe("Priority 2 (N6): Absence Alerts date fallback & URL searchParams", () => {
    it("absence-alerts page reads searchParams and parent-communication falls back to latest recorded date", () => {
      const pageSrc = readWorkspaceFile(
        "app/dashboard/communication/absence-alerts/page.tsx"
      );
      const actionSrc = readWorkspaceFile("app/actions/parent-communication.ts");

      expect(pageSrc).toContain("searchParams");
      expect(pageSrc).toContain("getAbsenceAlertData(requestedDate, requestedClass)");
      expect(actionSrc).toContain("usedFallbackLatestDate");
      expect(actionSrc).toContain('.order("date", { ascending: false })');
    });
  });

  describe("Priority 3 (N9): Audit Logs count parity & write-action logging", () => {
    it("backup.ts aligns auditLogsCount with system-audit.ts and login/fee actions emit audit logs", () => {
      const backupSrc = readWorkspaceFile("app/actions/backup.ts");
      const auditSrc = readWorkspaceFile("app/actions/system-audit.ts");
      const loginSrc = readWorkspaceFile("app/api/auth/login/route.ts");
      const feeSrc = readWorkspaceFile("app/actions/fee-management.ts");

      expect(auditSrc).toContain("fetchCanonicalAuditLogsAndCount");
      expect(backupSrc).toContain("fetchCanonicalAuditLogsAndCount");
      expect(backupSrc).not.toContain(
        "countCollectionItems(meta.audit_logs) +\n      countCollectionItems(meta.backup_history)"
      );
      expect(loginSrc).toContain("await recordFailedLogin(");
      expect(readWorkspaceFile("lib/failed-login-audit.ts")).toContain("LOGIN_FAILED");
      expect(feeSrc).toContain('action: "MONTHLY_FEES_GENERATED"');
    });
  });

  describe("Priority 4 (N11): Early Warning fee overdue scoring overrides grace period", () => {
    it("scores Salman (৳8,600 due) with high fee risk and bypasses new-student grace", () => {
      const salman = computeStudentRiskScore({
        studentId: "salman-1",
        daysSinceAdmission: 2,
        attendanceRecordsCount: 0,
        examRecordsCount: 0,
        overdueInvoiceCount: 1,
        overdueAmount: 8600,
        totalPayableAmount: 8600,
      });

      expect(salman.feeScore).toBe(30);
      expect(salman.compositeScore).toBeGreaterThanOrEqual(30);
      expect(salman.riskLevel).not.toBe("LOW");
      expect(salman.factors.join(" ")).not.toContain("প্রাথমিক গ্রেস পিরিয়ড");
    });

    it("scores Tahmid (৳4,300 due) as elevated risk (MEDIUM+) for Teacher Portal banner", () => {
      const tahmid = computeStudentRiskScore({
        studentId: "tahmid-1",
        daysSinceAdmission: 4,
        attendanceRecordsCount: 0,
        examRecordsCount: 0,
        overdueInvoiceCount: 1,
        overdueAmount: 4300,
        totalPayableAmount: 4300,
      });

      expect(tahmid.feeScore).toBeGreaterThanOrEqual(25);
      expect(tahmid.compositeScore).toBeGreaterThanOrEqual(25);
      expect(["MEDIUM", "HIGH", "CRITICAL"]).toContain(tahmid.riskLevel);
    });

    it("early-warning page prefers fresh summary.risk_scores over stale persisted rows", () => {
      const pageSrc = readWorkspaceFile(
        "app/dashboard/analytics/early-warning/page.tsx"
      );
      expect(pageSrc).toContain(
        "summary.risk_scores && summary.risk_scores.length > 0"
      );
    });
  });

  describe("Priority 5 (PB-06): Bengali vowel normalization & Admin Staff Profile parity", () => {
    it("matches Bengali vowel-length variants like নূরুল ইসলাম and নুরুল ইসলাম", () => {
      expect(normalizeBengaliTeacherName("হাফেজ নূরুল ইসলাম")).toBe(
        normalizeBengaliTeacherName("হাফেজ নুরুল ইসলাম")
      );
      expect(normalizeBengaliTeacherName("মুফতী আব্দুর রহীম")).toBe(
        normalizeBengaliTeacherName("মুফতি আব্দুর রহিম")
      );

      const resolved = resolveTeacherIdentity(
        [{ id: "t-uuid-1", first_name: "হাফেজ নূরুল", last_name: "ইসলাম" }],
        [
          {
            id: "staff-1",
            personal: { full_name_bn: "হাফেজ নুরুল ইসলাম" },
            contact: {},
          },
        ],
        { linkedId: "staff-1" }
      );

      expect(resolved.teacher?.id).toBe("t-uuid-1");
      expect(resolved.keys).toContain("t-uuid-1");
      expect(resolved.keys).toContain("staff-1");
    });
  });

  describe("Priority 6 + Teacher Portal Pre-Marking + DEC-1 Automation", () => {
    it("N5: inventory notification monitor defaults low-stock threshold to 3", () => {
      const notifSrc = readWorkspaceFile("app/actions/notifications.ts");
      expect(notifSrc).toContain("item.min_stock_alert ?? item.min_stock ?? item.reorder_level");
      expect(notifSrc).toContain(": 3;");
    });

    it("N8: BackupClient top Zakat KPI matches zakat_donations count; only a verified snapshot is recorded as a backup", () => {
      const clientSrc = readWorkspaceFile(
        "app/dashboard/settings/backup/BackupClient.tsx"
      );
      const backupSrc = readWorkspaceFile("app/actions/backup.ts");
      expect(clientSrc).toContain('(stats.counts?.zakat_donations || 0).toLocaleString("bn-BD")');
      expect(backupSrc).not.toContain('bak_init_');
      expect(backupSrc).toContain("type:'AUTO_SNAPSHOT'");
      expect(backupSrc).toContain('storage_path:upload.storagePath,checksum:snapshot.backupPayload.manifest.checksum');
    });

    it("PB-07 & Pre-Marking: Teacher AttendanceForm leaves unsaved working days unmarked and shows floating toast", () => {
      const attSrc = readWorkspaceFile(
        "app/teacher-portal/attendance/AttendanceForm.tsx"
      );
      expect(attSrc).toContain('const defaultStatus = isOffDay ? "Leave" : "";');
      expect(attSrc).toContain("হাজিরা বাকি");
      expect(attSrc).toContain("সংরক্ষণের জন্য অন্তত একজন শিক্ষার্থীর হাজিরা চিহ্নিত করুন।");
      expect(attSrc).toContain("Floating Save Toast");
    });

    it("DEC-1: buildMonthlyFeeDedupKey produces identical canonical keys and rule has dedup_enabled", () => {
      const k1 = buildMonthlyFeeDedupKey("stu-1", "ft_monthly", "2026-11");
      const k2 = buildMonthlyFeeDedupKey("stu-1", "ft_monthly", "2026-11-01");
      const k3 = buildMonthlyFeeDedupKey("stu-1", "ft_monthly", "2026-12");

      expect(k1).toBe(k2);
      expect(k1).not.toBe(k3);

      const monthlyRule = DEFAULT_AUTOMATION_RULES.find(
        (r) => r.rule_key === "monthly_fee_generation"
      );
      expect(monthlyRule?.is_enabled).toBe(true);
      expect(monthlyRule?.config?.dedup_enabled).toBe(true);
    });
  });
});
