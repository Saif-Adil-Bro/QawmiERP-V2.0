import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isStepUpRequiredResponse } from "@/components/security/useStepUpAction";

const ROOT = path.resolve(__dirname, "../..");

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Pending Approval & Step-Up 2FA UX Contracts", () => {
  describe("isStepUpRequiredResponse", () => {
    it("detects STEP_UP_REQUIRED via errorCode or code", () => {
      expect(isStepUpRequiredResponse({ errorCode: "STEP_UP_REQUIRED" })).toBe(true);
      expect(isStepUpRequiredResponse({ code: "STEP_UP_REQUIRED" })).toBe(true);
      expect(
        isStepUpRequiredResponse({
          error: "২-ধাপ যাচাইকরণ প্রয়োজন",
          stepUpRequired: true,
          errorCode: "STEP_UP_REQUIRED",
        })
      ).toBe(true);
    });

    it("returns false for non-step-up responses", () => {
      expect(isStepUpRequiredResponse(null)).toBe(false);
      expect(isStepUpRequiredResponse(undefined)).toBe(false);
      expect(isStepUpRequiredResponse("STEP_UP_REQUIRED")).toBe(false);
      expect(isStepUpRequiredResponse({ error: "Permission denied" })).toBe(false);
      expect(isStepUpRequiredResponse({ success: true, pendingApproval: true })).toBe(false);
    });
  });

  describe("Pending Approval UX in Client Components", () => {
    it("CollectPaymentClient handles pendingApproval, studentProfile.pendingApprovals, and Step-Up", () => {
      const src = readRel("app/dashboard/accounting/fees/new/CollectPaymentClient.tsx");
      expect(src).toContain("PendingApprovalBanner");
      expect(src).toContain("res?.pendingApproval");
      expect(src).toContain("studentProfile?.pendingApprovals");
      expect(src).toContain("useStepUpAction");
      expect(src).toContain("runWithStepUp");
    });

    it("getStudentFeeProfile queries pending FEE_WAIVER / FEE_DISCOUNT approval_requests", () => {
      const src = readRel("app/actions/fee-management.ts");
      expect(src).toContain("pendingApprovals");
      expect(src).toContain("FEE_WAIVER");
      expect(src).toContain("FEE_DISCOUNT");
    });

    it("AddExpenseForm handles pendingApproval with PendingApprovalBanner", () => {
      const src = readRel("app/dashboard/accounting/expenses/new/AddExpenseForm.tsx");
      expect(src).toContain("PendingApprovalBanner");
      expect(src).toContain("pendingApproval");
    });

    it("ExamPublishToggle checks pendingApproval before toggling isPublished and uses Step-Up", () => {
      const src = readRel("app/dashboard/exams/ExamPublishToggle.tsx");
      expect(src).toContain("PendingApprovalBanner");
      expect(src).toContain("res?.pendingApproval");
      expect(src).toContain("useStepUpAction");
    });

    it("StaffFormModal handles pendingApproval and uses Step-Up", () => {
      const src = readRel("components/staff/StaffFormModal.tsx");
      expect(src).toContain("PendingApprovalBanner");
      expect(src).toContain("pendingApproval");
      expect(src).toContain("useStepUpAction");
    });

    it("CertificateClient and reissueCertificate handle/forward pendingApproval and use Step-Up", () => {
      const clientSrc = readRel("app/dashboard/academic/certificates/CertificateClient.tsx");
      expect(clientSrc).toContain("PendingApprovalBanner");
      expect(clientSrc).toContain("pendingApproval");
      expect(clientSrc).toContain("useStepUpAction");

      const actionSrc = readRel("app/actions/certificates.ts");
      expect(actionSrc).toContain("if ((issueRes as any)?.pendingApproval)");
    });
  });

  describe("Step-Up 2FA Auto-Modal & My Requests Filter", () => {
    it("wires useStepUpAction into CRITICAL action clients", () => {
      const files = [
        "app/dashboard/settings/data-governance/DataGovernanceClient.tsx",
        "app/dashboard/students/StudentsListClient.tsx",
        "components/students/student-actions.tsx",
        "app/dashboard/accounting/structure/StructureClient.tsx",
      ];
      for (const file of files) {
        const src = readRel(file);
        expect(src).toContain("useStepUpAction");
        expect(src).toContain("runWithStepUp");
        expect(src).toContain("{stepUpModal}");
      }
    });

    it("ApprovalsClient and page.tsx support MY_REQUESTS filter tab", () => {
      const pageSrc = readRel("app/dashboard/approvals/page.tsx");
      expect(pageSrc).toContain("currentUserId");

      const clientSrc = readRel("app/dashboard/approvals/ApprovalsClient.tsx");
      expect(clientSrc).toContain("MY_REQUESTS");
      expect(clientSrc).toContain("আমার পাঠানো আবেদন");
    });
  });
});
