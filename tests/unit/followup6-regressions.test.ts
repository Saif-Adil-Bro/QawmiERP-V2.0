import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  extractTeacherCandidateNames,
  normalizeBengaliTeacherName,
  resolveTeacherIdentity,
} from "@/lib/teacher-identity";
import { emptyAuditStats } from "@/lib/audit-log";
import {
  normalizeBengaliSearchText,
  normalizeStudentFeeFilterParam,
} from "@/lib/search-normalize";

const ROOT = process.cwd();
const readSource = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("FOLLOWUP 6 — Priority 1 (PB-06) Admin Staff Profile Responsibilities Link", () => {
  it("normalizes Bengali teacher names consistently across nukta & vowel variants", () => {
    expect(normalizeBengaliTeacherName("মাওলানা নূরুল ইসলাম (নাজিম)")).toBe(
      normalizeBengaliTeacherName("নুরুল ইসলাম")
    );
    expect(normalizeBengaliTeacherName("মোঃ রাফিউল ইসলাম")).toBe(
      normalizeBengaliTeacherName("রাফিউল ইসলাম")
    );
  });

  it("extracts both Bengali and English full names from staff records", () => {
    const names = extractTeacherCandidateNames({
      full_name_bn: "মাওলানা নূরুল ইসলাম",
      first_name: "Nurul",
      last_name: "Islam",
    });
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names).toContain(normalizeBengaliTeacherName("মাওলানা নূরুল ইসলাম"));
    expect(names).toContain(normalizeBengaliTeacherName("Nurul Islam"));
  });

  it("resolves teacher identity when linkedId hits duplicate email by falling through to name/phone", () => {
    const sqlTeachers = [
      {
        id: "teacher-uuid-1",
        email: "shared@madrasa.test",
        phone: "01711223344",
        first_name: "নূরুল",
        last_name: "ইসলাম",
        auth_user_id: null,
      },
      {
        id: "teacher-uuid-2",
        email: "shared@madrasa.test",
        phone: "01899887766",
        first_name: "আব্দুল্লাহ",
        last_name: "মাহমুদ",
        auth_user_id: null,
      },
    ];
    const staffMembers = [
      {
        id: "staff-uuid-nurul",
        email: "shared@madrasa.test",
        phone: "01711223344",
        full_name_bn: "মাওলানা নূরুল ইসলাম",
        auth_user_id: null,
      },
    ];

    const res = resolveTeacherIdentity(sqlTeachers, staffMembers, {
      linkedId: "staff-uuid-nurul",
    });

    expect(res.teacher?.id).toBe("teacher-uuid-1");
    expect(res.keys).toContain("teacher-uuid-1");
    expect(res.keys).toContain("staff-uuid-nurul");
  });

  it("loads academic schedule from StaffProfileView using server-side teacher identity", () => {
    const profileSrc = readSource("components/staff/StaffProfileView.tsx");
    const identitySrc = readSource("lib/portal/identity.ts");

    expect(profileSrc).toContain("getTeacherAcademicSchedule(staff.id");
    expect(identitySrc).toContain("madrasa_id.eq.");
    expect(identitySrc).toContain("madrasa_id.is.null");
  });
});

describe("FOLLOWUP 6 — Priority 2 Audit Count Parity & N9 Events", () => {
  it("provides canonical emptyAuditStats baseline", () => {
    const stats = emptyAuditStats();
    expect(stats.total).toBe(0);
    expect(stats.todayCount).toBe(0);
    expect(stats.moduleCounts).toEqual({});
  });

  it("uses shared canonical audit counter in both Audit Logs & Backup stats and logs N9 events", () => {
    const auditSrc = readSource("app/actions/system-audit.ts");
    const backupSrc = readSource("app/actions/backup.ts");
    const failedLoginSrc = readSource("lib/failed-login-audit.ts");
    const zakatSrc = readSource("app/actions/zakat.ts");
    const fundraisingSrc = readSource("app/actions/fundraising.ts");
    const boardingSrc = readSource("app/actions/boarding.ts");

    expect(auditSrc).toContain("fetchCanonicalAuditLogsAndCount");
    expect(backupSrc).toContain("fetchCanonicalAuditLogsAndCount");
    expect(failedLoginSrc).toContain("LOGIN_FAILED");
    expect(zakatSrc).toContain("DONATION_RECEIPT_CREATED");
    expect(fundraisingSrc).toContain("DONATION_RECEIPT_CREATED");
    expect(boardingSrc).toContain("BOARDING_FEES_GENERATED");
  });
});

describe("FOLLOWUP 6 — Priority 3 (S2) Save Protection & Keepalive API", () => {
  it("exposes secured /api/teachers/[id]/subjects route with writeGuard & same-origin check", () => {
    const apiSrc = readSource("app/api/teachers/[id]/subjects/route.ts");
    expect(apiSrc).toContain('writeGuard("staff")');
    expect(apiSrc).toContain("isSameOriginMutation");
    expect(apiSrc).toContain("assignSubjectToTeacher");
    expect(apiSrc).toContain("removeSubjectFromTeacher");
  });

  it("uses keepalive: true & acquireSaveGuard in teacher subject forms", () => {
    const assignSrc = readSource("app/dashboard/teachers/[id]/subjects/AssignTeacherSubjectForm.tsx");
    const removeSrc = readSource("app/dashboard/teachers/[id]/subjects/RemoveTeacherSubjectButton.tsx");

    expect(assignSrc).toContain("keepalive: true");
    expect(assignSrc).toContain("acquireSaveGuard");
    expect(removeSrc).toContain("keepalive: true");
    expect(removeSrc).toContain("বিষয় বরাদ্দ বাতিল করুন");
  });
});

describe("FOLLOWUP 6 — Priority 4 Small Remaining Items", () => {
  it("maps ?fee=WAIVED (and aliases) to DISCOUNTED and flags unknown values cleanly", () => {
    expect(normalizeStudentFeeFilterParam("WAIVED")).toEqual({
      value: "DISCOUNTED",
      isUnknown: false,
      rawValue: "WAIVED",
    });
    expect(normalizeStudentFeeFilterParam("waiver").value).toBe("DISCOUNTED");
    expect(normalizeStudentFeeFilterParam("LILLAH").value).toBe("FREE");
    expect(normalizeStudentFeeFilterParam("UNKNOWN_VALUE")).toEqual({
      value: "ALL",
      isUnknown: true,
      rawValue: "UNKNOWN_VALUE",
    });
  });

  it("normalizes Bengali nukta variants so 'বিষয়' matches 'কিতাব ও বিষয়সমূহ (Subjects)'", () => {
    const query = normalizeBengaliSearchText("বিষয়"); // U+09AF + U+09BC
    const label = normalizeBengaliSearchText("কিতাব ও বিষয়সমূহ (Subjects)"); // U+09DF
    expect(label.includes(query)).toBe(true);
  });

  it("includes date-wise status badge, 7-day strip & portal toast in Teacher AttendanceForm", () => {
    const formSrc = readSource("app/teacher-portal/attendance/AttendanceForm.tsx");
    const pageSrc = readSource("app/teacher-portal/attendance/page.tsx");
    const navSrc = readSource("app/dashboard/DashboardNav.tsx");
    const studentsSrc = readSource("app/dashboard/students/StudentsListClient.tsx");

    expect(formSrc).toContain("attendance-date-status-badge");
    expect(formSrc).toContain("createPortal");
    expect(formSrc).toContain("recentDateStatuses");
    expect(pageSrc).toContain("recentDateStatuses");
    expect(navSrc).toContain("normalizeBengaliSearchText");
    expect(studentsSrc).toContain("normalizeStudentFeeFilterParam");
    expect(studentsSrc).toContain("unknown-fee-filter-banner");
  });
});

describe("FOLLOWUP 6 — DEC-1 Hybrid Automation Scheduler (Vercel Hobby + GitHub Actions Safe)", () => {
  it("keeps vercel.json free of sub-daily crons while GitHub Actions handles */15 dispatch", () => {
    const vercelJson = JSON.parse(readSource("vercel.json"));
    const crons = Array.isArray(vercelJson.crons) ? vercelJson.crons : [];
    for (const c of crons) {
      expect(String(c.schedule || "")).not.toContain("*/");
    }

    const ghCron = readSource(".github/workflows/cron-jobs.yml");
    expect(ghCron).toContain("*/15 * * * *");
    expect(ghCron).toContain("/api/cron/dispatch");
  });

  it("registers in-app scheduler in instrumentation.ts and exposes manual trigger in UI", () => {
    const instSrc = readSource("instrumentation.ts");
    const schedSrc = readSource("lib/automation/in-app-scheduler.ts");
    const actionsSrc = readSource("app/actions/automation.ts");
    const uiSrc = readSource("app/dashboard/settings/automation/AutomationSettingsClient.tsx");

    expect(instSrc).toContain("startInAppAutomationScheduler");
    expect(schedSrc).toContain("runMasterCronDispatch");
    expect(actionsSrc).toContain("getSchedulerHealthAction");
    expect(actionsSrc).toContain("runMasterDispatcherNowAction");
    expect(uiSrc).toContain("শিডিউলার চেক চালান");
  });
});
