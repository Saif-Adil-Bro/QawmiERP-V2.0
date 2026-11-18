# Project: QawmiERP-V2.0 Enterprise Feature Roadmap (Phases 1–3)

## Architecture
- **Stack**: Next.js 16 (App Router, React 19, TypeScript 5.9 strict), Tailwind CSS v4, Supabase (`@supabase/supabase-js` + `@supabase/ssr` with `createClient` / `createAdminClient`), Recharts `^2.15.0`, `xlsx ^0.18.5`, `qrcode ^1.5.4`, `zod ^4.6.7`, Vercel AI SDK v7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`), Capacitor 8 (`@capacitor/local-notifications`), Node v24.22.2.
- **Database & Persistence Convention**:
  - Operational tables live in idempotent root SQL migrations (`supabase_schema.sql`, `supabase_phase_b_migration.sql`, `supabase_phase_c_core_erp_migration.sql`) — `lib/db/schema.ts` is an unused 36-line starter file.
  - Every multi-tenant table MUST include `madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE`, `ENABLE ROW LEVEL SECURITY`, and idempotent `DROP POLICY IF EXISTS ... CREATE POLICY ... USING (madrasa_id = public.get_auth_madrasa_id())`.
  - **Mandatory Graceful Fallback**: Every new relational service MUST handle `isMissingTableError(error)` (`42P01` / `PGRST205`, from `lib/audit-log.ts`) by falling back cleanly to `madrasa_settings` or `madrasas.metadata` / `madrasas.security_metadata` (`lib/madrasa-store.ts`), matching Phase C conventions.
- **Timezone & Localization**:
  - All date/month logic MUST use `Asia/Dhaka` helpers from `lib/date-utils.ts` (`toDhakaDateString`, `toDhakaMonthString`, `getDhakaYear`, `startOfDhakaDay`).
  - All user-facing UI labels are Bangla-first with `toBanglaNumber` / `formatBanglaCurrency` (`lib/numberToBangla.ts`) and Light/Dark/Sepia Tailwind v4 styling (no `components/ui/*`; use direct Tailwind utility classes + Lucide icons + Radix primitives where appropriate).
- **Security & Authorization**:
  - Server Actions use `writeGuard(module)` (`lib/action-authorization.ts`) and/or `requirePermission()` (`lib/permissions-server.ts`).
  - Web API Routes use `authorizeApi(module)` or `authorizeSuperAdminOrCron(req)` (`lib/api-auth.ts`, constant-time `CRON_SECRET` Bearer auth). Note: `middleware.ts` bypasses `/api/*`, so every new `/api/*` route MUST authenticate and authorize explicitly.
  - Mobile API routes (`app/api/mobile/**`) MUST preserve the `mobileSuccess`/`mobileError` JSON envelope and field types.
  - All sensitive writes, exports, anomalies, and AI write actions log to immutable `system_audit_logs` via `logAuditEvent()` (`lib/audit-log.ts`).
- **Verification & Test Tooling**:
  - `npm run lint` (`tsc --noEmit`) — strict TypeScript check (must pass with 0 errors).
  - `npm run build` (`next build`) — full production build (must pass with 0 errors).
  - Unit & Integration tests (`npm test`) and E2E tests (`npm run test:e2e`): Bootstrapped in M1 (Vitest if installable via `npm`, otherwise Node v24 native `node --test` with TypeScript & `@/*` path-alias loader; see `## Test Tooling Contract`).

## Code Layout
```
/home/antigravity/Saif-Adil-Bro/QawmiERP-V2.0/
├── supabase_phase_1_enterprise_migration.sql     # M1: Phase 1 tables (1.1 approvals, 1.2 sessions/mfa/step_up)
├── supabase_phase_2_automation_bi_migration.sql  # M3: Phase 2 tables (2.1 cron, 2.2 notifications, 2.3 BI MVs/RPCs/digests, 2.4 webhooks)
├── supabase_phase_3_ai_migration.sql             # M5: Phase 3 tables (3.1 student_risk_scores, 3.2 financial_anomalies)
├── supabase_schema.sql                           # M6 ONLY: Final consolidated append of Phase 1–3 migrations
├── vercel.json                                   # M3 creates; M6 adds Phase 3 cron entries
├── .env.example                                  # M3 updates with CRON_SECRET, WHATSAPP_*, RESEND_*, FCM_*
├── package.json / vitest.config.ts               # M1 ONLY: npm ci + test scripts/config
├── lib/
│   ├── permissions.ts                            # M1 ONLY: Pre-registers ALL Phase 1–3 permissions, ApprovalRequestType (incl. LARGE_EXPENSE), AuditActionType
│   ├── permissions-server.ts                     # M1 ONLY: Step-Up 2FA riskLevel === "CRITICAL" enforcement in requirePermission()
│   ├── audit-log.ts                              # M1 ONLY: Extended AuditModuleKey + AUDIT_MODULE_LABELS_BN for all Phases 1–3
│   ├── action-authorization.ts                   # M1 ONLY: Extended ModuleKey + MODULE_POLICIES for all Phases 1–3
│   ├── data-access-guards.ts                     # M1 ONLY: Field-level PII masking helpers (1.3)
│   ├── session-manager.ts                        # M1: Active session tracking & remote revocation (1.2)
│   ├── step-up-auth.ts                           # M1: RFC 6238 TOTP, SMS/Email OTP, short-lived verification token (1.2)
│   ├── export-watermark.ts                       # M1: Watermarked CSV/XLSX & audit receipt builder (1.3)
│   ├── printUtils.ts                             # M1: Print/PDF watermark overlay support (1.3)
│   ├── approval-workflow.ts                      # M2: Multi-level approval chain engine, thresholds, SLA (1.1)
│   ├── notifications/{template-renderer,channels,orchestrator}.ts  # M3: Unified Notification Orchestrator (2.2)
│   ├── webhooks/{signer,dispatcher}.ts           # M3: HMAC-SHA256 signer, SSRF guard, retry dispatcher (2.4)
│   ├── automation/{cron-auth,fee-cron-service,attendance-cron-service}.ts # M3: Headless cron services (2.1)
│   ├── bi/{executive-bi-service,digest-generator}.ts # M4: Executive BI RPC/fallback, Custom Report Builder, Digest HTML/XLSX (2.3)
│   ├── early-warning.ts                          # M5: Extended Early Warning types (3.1)
│   ├── early-warning-engine.ts                   # M5: Pure composite 0–100 dropout/fee-default scorer (3.1)
│   ├── early-warning-service.ts                  # M5: Persistence + recalculation service (3.1)
│   ├── anomaly-detection.ts                      # M5: Pure Moving Average, Z-Score & rule-based anomaly detectors (3.2)
│   ├── anomaly-detection-service.ts              # M5: Scan, dedup, financial_anomalies + system_audit_logs writer (3.2)
│   └── ai/{erp-tools,erp-knowledge-base}.ts      # M6: Bug fixes + new Read/Write tools + route knowledge (3.3)
├── app/actions/
│   ├── approvals.ts                              # M2: Workflow/request CRUD & multi-step execution (1.1)
│   ├── permissions.ts                            # M2: Bridge legacy approval functions to relational engine (1.1)
│   ├── security.ts                               # M1: Session management, MFA setup, Step-Up actions (1.2)
│   ├── notification-orchestrator.ts              # M3: Template/channel config & dispatch actions (2.2)
│   ├── automation.ts                             # M3: Automation rules & job log actions (2.1)
│   ├── webhooks.ts                               # M3: Webhook endpoint & delivery actions (2.4)
│   ├── bi.ts                                     # M4: Executive BI, custom report & digest actions (2.3)
│   ├── early-warning.ts                          # M5: Upgraded Early Warning server actions (3.1)
│   ├── anomalies.ts                              # M5: Financial/boarding anomaly scan & resolution actions (3.2)
│   └── (existing action integrations strictly sequenced: M1 → M2 → M3)
├── app/api/
│   ├── auth/{sessions,step-up/challenge,step-up/verify,mfa/setup}/route.ts # M1 (1.2)
│   ├── exports/route.ts                          # M1 (1.3)
│   ├── approvals/route.ts & [id]/decision/route.ts # M2 (1.1)
│   ├── notifications/dispatch/route.ts & mobile/push-tokens/route.ts # M3 (2.2)
│   ├── webhooks/endpoints/** & deliveries/**     # M3 (2.4)
│   ├── cron/{monthly-fees,overdue-reminders,absence-alerts,process-queues}/route.ts # M3 (2.1)
│   ├── bi/{overview,custom-report,digest/[id]}/route.ts & cron/digest-reports/route.ts # M4 (2.3)
│   ├── early-warning/route.ts & cron/early-warning/route.ts # M5 (3.1)
│   ├── anomalies/route.ts & cron/anomalies/route.ts # M5 (3.2)
│   └── ai/{chat,confirm}/route.ts                # M6 (3.3)
├── app/dashboard/
│   ├── settings/security/                        # M1: Active Sessions, 2FA/MFA, Masking/Export Policy UI (1.2 & 1.3)
│   ├── approvals/                                # M2: Dedicated Multi-Level Approvals & Workflow Builder UI (1.1)
│   ├── communication/orchestrator/               # M3: Multi-Channel Notification Templates, Channels & Queue UI (2.2)
│   ├── settings/automation/                      # M3: Cron & Automation Rules + Job Execution Logs UI (2.1)
│   ├── settings/webhooks/                        # M3: Webhook Endpoints, Secret Rotation, Test Ping & Logs UI (2.4)
│   ├── analytics/executive-bi/                   # M4: Cross-Module Executive BI, Custom Report Builder & Digests UI (2.3)
│   ├── analytics/early-warning/                  # M5: AI Early Warning Full Dashboard & Intervention Tracker (3.1)
│   ├── accounting/anomalies/                     # M5: Financial & Boarding Anomaly Monitor UI (3.2)
│   └── page.tsx, DashboardNav.tsx, components/PremiumDashboardClient.tsx # M6 ONLY: Final nav & dashboard wiring
├── components/
│   ├── security/{StepUpVerificationModal,ActiveSessionsView,MfaSettingsView}.tsx # M1 (1.2)
│   ├── permissions/ApprovalsCenterView.tsx       # M2 (1.1)
│   ├── EarlyWarningWidget.tsx                    # M5 (3.1)
│   ├── anomalies/FinancialAnomalyBanner.tsx      # M5 (3.2)
│   ├── ai/ErpAiAssistant.tsx                     # M6 (3.3)
│   └── mode/{defaultNavData,iconRegistry,menuCatalog}.ts & common/UniversalCommandPalette.tsx # M6 ONLY
└── tests/
    ├── unit/                                     # Implementation milestones (M1–M6) unit tests
    └── e2e/                                      # E2E Testing Track ONLY (Tiers 1–4; Tier 5 added in M7 Phase 2)
```

## Feature Inventory
Every Survey & Roadmap feature assigned a milestone (zero unassigned):
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F0 | Project Bootstrap & Cross-Cutting Governance | `npm ci`, test runner setup (`vitest` / Node `node:test`), pre-registered Phase 1–3 permissions (`lib/permissions.ts`), `AuditModuleKey` (`lib/audit-log.ts`), `ModuleKey` (`lib/action-authorization.ts`), Phase 1 SQL migration | M1 | survey_1, survey_3 |
| F1 | 1.1 Multi-Level Approval Workflow Engine | Relational `approval_workflows`, `approval_workflow_steps`, `approval_requests`, `approval_step_decisions`; threshold_amount, current_step_order, SLA timers, two-person check; integrated with Fee Waivers, Large Expenses, Staff Salary Changes, Exam Result Publish, Certificate Issue; Workflow Builder & Approvals UI | M2 | ORIGINAL_REQUEST §1.1, survey_1 |
| F2 | 1.2 Active Session Management & Step-Up 2FA | `user_sessions`, `user_mfa_settings`, `step_up_verifications`; device/IP/UA tracking, remote termination, middleware/auth enforcement; SMS/Email/RFC-6238 TOTP OTP; `requirePermission()` `riskLevel === "CRITICAL"` short-lived verification token gate on accounting period unlock, bulk deletes, fee structure edits; Security UI & StepUpModal | M1 | ORIGINAL_REQUEST §1.2, survey_1 |
| F3 | 1.3 Sensitive Data Masking & Export Audit Watermarking | Field-level PII masking (`017****890`, NID, Email, Bank) in `lib/data-access-guards.ts` with RBAC unmasked override; server-side watermarked CSV/XLSX/Print-PDF embedding exporter name, time, IP; mandatory `SENSITIVE_DATA_EXPORTED` log in `system_audit_logs`; applied to students/donors/staff/mobile & all export sites | M1 | ORIGINAL_REQUEST §1.3, survey_1 |
| F4 | 2.1 Scheduled Cron & Automation Engine | `automation_rules`, `job_execution_logs`; `/api/cron/{monthly-fees,overdue-reminders,absence-alerts,process-queues}` guarded by constant-time `CRON_SECRET`; headless monthly fee generator; strict real-due overdue reminders (avoiding `totalDue: 1200` bug); weekend/holiday-aware daily absence alerts; `vercel.json`, `pg_cron` docs, Automation UI | M3 | ORIGINAL_REQUEST §2.1, survey_2 |
| F5 | 2.2 Unified Multi-Channel Notification & Template Orchestrator | `notification_templates`, `notification_queue`, `notification_device_tokens`; `dispatchNotification(event, payload)` with Push/WhatsApp → SMS/Email + In-App fallback chain; unified `{Var}` & `[বাংলা]` template renderer; `/api/notifications/dispatch`, `/api/mobile/push-tokens`; Orchestrator UI | M3 | ORIGINAL_REQUEST §2.2, survey_2 |
| F6 | 2.3 Cross-Module Executive BI Dashboard & Scheduled Digest Reports | 4 PostgreSQL Materialized Views + 2 RPCs (with JS fallback): Boarding per-capita bazar vs boarding fee income, Zakat/Fund health, Class/Jamat due ratio, Session-to-Session exam results; Recharts BI Dashboard; Custom Report Builder; Weekly/Monthly Scheduled Digest A4 Bangla HTML/Print-PDF + watermarked XLSX; `/api/bi/*`, `/api/cron/digest-reports` | M4 | ORIGINAL_REQUEST §2.3, survey_2 |
| F7 | 2.4 Webhook & External Integration Hub | `webhook_endpoints`, `webhook_deliveries`; HMAC-SHA256 payload signing, SSRF URL validator, exponential backoff retry queue; domain event hooks on payment confirmation, new admission/student creation, exam result publish; endpoint CRUD, secret rotation, test ping, delivery logs UI | M3 | ORIGINAL_REQUEST §2.4, survey_2 |
| F8 | 3.1 AI Early Warning System | `student_risk_scores`; deterministic composite 0–100 risk algorithm (Attendance trend 40% + Exam/Hifz/Kitab/Noorani drop 30% + Fee overdue/default 30%); `/api/early-warning`, `/api/cron/early-warning`; upgraded `EarlyWarningWidget` + `/dashboard/analytics/early-warning` full view with intervention tracking | M5 | ORIGINAL_REQUEST §3.1, survey_3 |
| F9 | 3.2 Financial & Boarding Anomaly Detection | `financial_anomalies` + immutable `WARNING`/`CRITICAL` events in `system_audit_logs`; Moving Average & Z-Score for daily/per-meal bazar & expense spikes; rule-based same-day duplicate vouchers, excessive user fee waivers, payment void spikes; `/api/anomalies`, `/api/cron/anomalies`; `/dashboard/accounting/anomalies` + `FinancialAnomalyBanner` | M5 | ORIGINAL_REQUEST §3.2, survey_3 |
| F10 | 3.3 Voice-First Bangla AI Assistant & Action Copilot | Fix 5 verified bugs in `lib/ai/erp-tools.ts` & `/api/ai/confirm`; new RBAC Read tools (`getClassOverdueFees`, `getTodayAbsentStudents`, `getEarlyWarningRisks`, `getFinancialAnomalies`, `getPendingApprovals`, `getExecutiveBiSummary`); new confirmed Write actions (`send_absent_guardian_notices`, `send_due_fee_reminders`, `trigger_risk_recalculation`, `trigger_anomaly_scan`, `submit_approval_decision`) with mandatory RBAC + Preview Confirmation + Audit Log; Bangla Voice Auto-Send, Bangla TTS, rich preview card in `ErpAiAssistant.tsx` | M6 | ORIGINAL_REQUEST §3.3, survey_3 |
| F11 | Global Navigation, Dashboard Wiring & Schema Consolidation | Synchronize all 6 nav touchpoints (`DashboardNav.tsx`, `defaultNavData.ts` + `sanitizeNavGroups` auto-merge fix, `iconRegistry.ts`, `menuCatalog.ts`, `UniversalCommandPalette.tsx`, `erp-knowledge-base.ts`), wire widgets into `app/dashboard/page.tsx` & `PremiumDashboardClient.tsx`, consolidate Phase 1–3 SQL into `supabase_schema.sql`, update `vercel.json` with Phase 3 crons, dedup `AUDIT_MODULE_LABELS_BN` | M6 | survey_3 |
| F12 | Opaque-Box E2E Test Suite (Tiers 1–4) & Tier 5 Adversarial Hardening | Requirement-driven E2E suite covering all 10 features (≥50 Tier 1, ≥50 Tier 2, ≥10 Tier 3, ≥5 Tier 4 → ≥115+ tests), `TEST_INFRA.md`, `TEST_READY.md`, 100% E2E pass (M7 Phase 1), white-box Tier 5 adversarial hardening (M7 Phase 2) | E2E Track + M7 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status | Sub-Orch Conv ID |
|---|------|-------|-------------|--------|------------------|
| M1 | Enterprise Foundation & Phase 1 Security Core (F0, 1.2, 1.3) | Bootstrap tooling (`npm ci` + test runner), pre-register all Phase 1–3 permissions/audit/auth keys, Phase 1 SQL migration, Active Sessions & Step-Up 2FA (1.2), Sensitive Data Masking & Export Audit Watermarking (1.3) | none | DONE (Iter 3 Gate PASS; 18/18 unit, lint/build 0) | 779d027b841a1a17dbf90fe928daeb2e |
| M2 | Multi-Level Approval Workflow Engine (1.1) | Relational approval engine (`lib/approval-workflow.ts`, `app/actions/approvals.ts`, `/api/approvals/*`), 5 business workflow hooks, upgraded `ApprovalsCenterView` & `/dashboard/approvals` | M1 | DONE (Iter 2 Gate PASS; 24/24 unit, 12/12 E2E) | 2c15c0b8f475caed541b964a4ee136f6 |
| M3 | Automation, Multi-Channel Notifications & Webhooks (2.1, 2.2, 2.4) | Phase 2 SQL migration (incl. BI MVs/RPCs), Notification Orchestrator (2.2), Webhook Hub + domain hooks (2.4), Scheduled Cron & Automation Engine + `vercel.json` (2.1) | M1, M2 | DONE (Iter 2 Gate PASS; 33/33 unit, 36/36 T1-T2 E2E, 4/4 T3 E2E) | 9d0eb9b983b28bca909aef4b0b57cdfd |
| M4 | Executive BI Dashboard & Scheduled Digests (2.3) | `lib/bi/*`, `/api/bi/*`, `/api/cron/digest-reports`, `/dashboard/analytics/executive-bi` Recharts dashboard, Custom Report Builder & A4 Bangla Digest + watermarked XLSX | M3 | DONE (Iter 1 Gate PASS; 8/8 unit, 12/12 E2E, lint/build 0) | 8bbef79d80513cb628cb9bbf46652946 |
| M5 | AI Early Warning & Financial/Boarding Anomaly Detection (3.1, 3.2) | Phase 3 SQL migration, composite Early Warning scorer + API/cron/widget/page (3.1), Z-Score & rule-based Anomaly Detection + immutable audit log + API/cron/page/banner (3.2) | M3 | DONE (Iter 2 Gate PASS; 9/9 unit, 26/26 E2E, lint/build 0) | 8623346cb9347a2b85afb27249f2fb2b |
| M6 | Voice-First Bangla AI Copilot & Global Integration (3.3 + F11) | Fix 5 AI bugs + new Read/Write tools + Bangla voice auto-send/TTS/preview UI (3.3), sync all 6 nav files + dashboard slots + `supabase_schema.sql` consolidation + `vercel.json` update | M4, M5 | DONE (Iter 1 Gate PASS; 4/4 unit, 14/14 E2E, lint/build 0) | 9f054f4bf08cc66484d4314b10eaa579 |
| M7 | Final Milestone: E2E Pass (Tiers 1–4) & Tier 5 Hardening | Phase 1: Sequential Tier 1→2→3→4 E2E pass (100%) after `TEST_READY.md`; Phase 2: White-box Tier 5 Challenger-led adversarial hardening | M6, E2E Track | IN_PROGRESS (Phase 1: Tier 1–3 DONE 142/142, Tier 4 IN_PROGRESS) | — |
| E2E | E2E Testing Track (Opaque-Box Suite Tiers 1–4) | `TEST_INFRA.md`, requirement-driven E2E harness & ≥115+ test cases across Tiers 1–4 in `tests/e2e/**`, publish `TEST_READY.md` | parallel (uses M1 test runner once ready) | DONE (149 tests, TEST_READY.md published) | 002c6f72d1b857800e7ec529ed1aabc7 |

## Interface Contracts

### Shared Permissions, Audit & Action Auth (Owned by M1; Consumed by M2–M6)
- `lib/permissions.ts`:
  - Pre-registered Permission IDs:
    - `approval.view`, `approval.manage`, `approval.approve`
    - `security.sessions.manage`, `security.2fa.manage`, `data.unmask`
    - `automation.view`, `automation.manage`
    - `webhook.view`, `webhook.manage`
    - `analytics.early_warning`, `analytics.early_warning.manage`
    - `anomaly.view`, `anomaly.manage`
  - `ApprovalRequestType` includes `"FEE_DISCOUNT" | "FEE_WAIVER" | "LARGE_EXPENSE" | "SALARY_CHANGE" | "RESULT_PUBLISH" | "CERTIFICATE_ISSUE" | "CERTIFICATE_REVOKE" | "STUDENT_ARCHIVE" | "STAFF_TERMINATION"`.
  - `AuditActionType` includes `"SENSITIVE_DATA_EXPORTED"`, `"SENSITIVE_FIELD_REVEALED"`, `"STEP_UP_VERIFIED"`, `"STEP_UP_FAILED"`, `"SESSION_TERMINATED"`, `"APPROVAL_REQUESTED"`, `"APPROVAL_STEP_DECIDED"`, `"CRON_EXECUTED"`, `"WEBHOOK_DISPATCHED"`, `"WEBHOOK_SECRET_ROTATED"`, `"ANOMALY_DETECTED"`, `"ANOMALY_RESOLVED"`, `"AI_ACTION_EXECUTED"`.
- `lib/audit-log.ts`:
  - `AuditModuleKey` includes `"boarding" | "anomaly" | "ai" | "approvals" | "automation" | "notifications" | "webhooks" | "analytics" | "security"` alongside all existing keys, with matching `AUDIT_MODULE_LABELS_BN`.
- `lib/action-authorization.ts`:
  - `ModuleKey` & `MODULE_POLICIES` include `"approvals" | "security" | "automation" | "webhooks" | "analytics" | "anomaly" | "bi"`.

### M1 ↔ M2–M6: Step-Up 2FA, Masking & Export Watermarking
- `lib/permissions-server.ts`:
  - `requirePermission(params: { userId, madrasaId, permissions?, roles?, denyRoles?, errorMessage?, riskLevel?, requireStepUp?, stepUpToken?, actionScope? })`:
    - When `requireStepUp === true` (or `riskLevel === "CRITICAL"` and tenant step-up policy is active), checks valid short-lived token (from `stepUpToken`, `x-step-up-token` header, or `qawmi_step_up_token` HTTP-only cookie) via `verifyStepUpToken()`.
    - On missing/expired step-up token, returns `{ allowed: false, stepUpRequired: true, errorCode: "STEP_UP_REQUIRED", error: string }`.
- `lib/data-access-guards.ts`:
  - `maskPhoneNumber(phone: string | null | undefined): string` (e.g., `"01712345890"` → `"017****890"`, preserving `+880` / Bangla digits gracefully)
  - `maskNidNumber(nid: string | null | undefined): string` (e.g., `"1995123456789"` → `"1995*****6789"` or `"19******789"`)
  - `maskEmailAddress(email: string | null | undefined): string`
  - `maskBankAccount(account: string | null | undefined): string`
  - `canViewUnmaskedField(summary, module, field): boolean`
  - `maskStudentSensitiveFields<T>(student: T, allowUnmasked: boolean): T`
  - `maskDonorSensitiveFields<T>(donor: T, allowUnmasked: boolean): T`
- `lib/export-watermark.ts`:
  - `buildExportWatermark(ctx: { exportedBy: string; actorRole: string; ipAddress: string; madrasaName?: string; dataset: string; exportId?: string }): ExportWatermarkMetadata`
  - `buildWatermarkedCsv(headers: string[], rows: (string | number | null | undefined)[][], watermark: ExportWatermarkMetadata): string`
  - `buildWatermarkedWorkbook(sheetName: string, headers: string[], rows: (string | number | null | undefined)[][], watermark: ExportWatermarkMetadata): Buffer`
  - `buildPrintWatermarkHtml(watermark: ExportWatermarkMetadata): string`

### M2 ↔ M3/M5/M6: Multi-Level Approval Workflow Engine
- `lib/approval-workflow.ts`:
  - `matchApprovalWorkflow(workflows, requestType, amount): ApprovalWorkflowWithSteps | null`
  - `evaluateStepProgression(request, steps, decisions, decisionInput): StepEvaluationResult`
  - `calculateSlaDueAt(fromDate: Date, slaHours: number): string` & `isSlaBreached(slaDueAt: string | null, now?: Date): boolean`
  - `canActorDecideStep(actor, request, currentStep): { allowed: boolean; reason?: string }` (enforces role/permission + two-person non-self-approval rule)
- `app/actions/approvals.ts`:
  - `getApprovalWorkflows()`, `saveApprovalWorkflow(input)`, `deleteApprovalWorkflow(id)`
  - `submitApprovalRequest(input)`, `decideApprovalStep(requestId, decision, notes)`, `cancelApprovalRequest(requestId)`, `getApprovalRequests(filters?)`

### M3 ↔ M4/M5/M6: Notifications, Cron & Webhooks
- `lib/notifications/orchestrator.ts`:
  - `dispatchNotification(event: string, payload: NotificationDispatchPayload): Promise<NotificationDispatchResult>`
  - `processNotificationQueue(limit?: number): Promise<QueueProcessSummary>`
- `lib/notifications/template-renderer.ts`:
  - `renderNotificationTemplate(template: string, variables: Record<string, string | number | null | undefined>): string` (supports both `{VarName}` and `[বাংলা ট্যাগ]`)
- `lib/webhooks/signer.ts`:
  - `signWebhookPayload(secret: string, timestampSec: number, rawBody: string): { header: string; signature: string }` (`t=<ts>,v1=<hex>`)
  - `verifyWebhookSignature(secret: string, header: string, rawBody: string, toleranceSec?: number): boolean`
  - `validateWebhookUrl(url: string, opts?: { allowHttpInDev?: boolean }): { valid: boolean; reason?: string }` (blocks loopback/RFC1918/link-local/metadata SSRF)
- `lib/webhooks/dispatcher.ts`:
  - `dispatchWebhookEvent(madrasaId: string, eventType: string, data: Record<string, unknown>): Promise<WebhookDispatchSummary>`
  - `retryPendingWebhookDeliveries(limit?: number): Promise<WebhookRetrySummary>`
- `lib/automation/cron-auth.ts`:
  - `authorizeCronRequest(req: Request)` (wraps `authorizeSuperAdminOrCron`)
  - `runTrackedCronJob<T>(jobKey: string, madrasaId: string | null, triggerSource: "cron" | "manual" | "retry", fn: () => Promise<CronJobOutcome<T>>)`

### M4 & M5 ↔ M6: BI, Early Warning & Anomaly Services
- `lib/bi/executive-bi-service.ts`:
  - `getExecutiveBiSnapshot(madrasaId: string, opts?: { months?: number; sessionId?: string | null }): Promise<ExecutiveBiSnapshot>`
  - `executeCustomReport(madrasaId: string, definition: CustomReportQuery): Promise<CustomReportResult>`
- `lib/early-warning-engine.ts` & `lib/early-warning-service.ts`:
  - `computeStudentRiskScore(input: StudentRiskInput): ComputedStudentRisk` (pure, deterministic 0–100 score: Attendance 40%, Academic/Hifz/Kitab/Noorani 30%, Fee Default 30%)
  - `recalculateStudentRiskScores(madrasaId: string, opts?: { classId?: string }): Promise<EarlyWarningSummary>`
  - `getStudentRiskScores(madrasaId: string, filters?: { riskLevel?: string; classId?: string; limit?: number }): Promise<StudentRiskScoreRecord[]>`
- `lib/anomaly-detection.ts` & `lib/anomaly-detection-service.ts`:
  - `detectMovingAverageZScoreAnomalies(series, config): DetectedAnomaly[]`
  - `detectDuplicateVouchers(records): DetectedAnomaly[]`
  - `detectExcessiveWaivers(waivers, config): DetectedAnomaly[]`
  - `runFinancialAnomalyScan(madrasaId: string, opts?: { lookbackDays?: number }): Promise<AnomalyScanResult>`
  - `getFinancialAnomalies(madrasaId: string, filters?: { status?: string; severity?: string; limit?: number }): Promise<FinancialAnomalyRecord[]>`

### Test Tooling Contract (Owned by M1; Consumed by M1–M7 & E2E Track)
- `npm run lint` → `tsc --noEmit`
- `npm run build` → `next build`
- `npm test` → runs unit tests in `tests/unit/**/*.test.ts`
- `npm run test:e2e` → runs E2E tests in `tests/e2e/**/*.test.ts` (supports tier filtering e.g. `tests/e2e/tier1`, `tier2`, `tier3`, `tier4`, `tier5`)
- Implementation detail: M1 installs dependencies (`npm ci`) and sets up Vitest (`vitest.config.ts` with `@` alias -> `.`) if registry reachable, OR falls back to Node v24 native `node --test` with an `@/*` alias hook in `scripts/test-loader.mjs` so both unit and E2E tests execute cleanly with zero external network requirement.
