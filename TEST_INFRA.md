# Test Infrastructure & Opaque-Box E2E Specification — QawmiERP-V2.0

## 1. Test Philosophy
- **Requirement-Driven Opaque-Box Design**: Every test case in `tests/e2e/**` is derived directly from `.agents/teamwork/ORIGINAL_REQUEST.md` and `PROJECT.md § Feature Inventory & Interface Contracts`, validating observable behavior (HTTP responses, status codes, database/fallback persistence, immutable audit logs, HMAC signatures, watermarks, PII masking, risk/anomaly outputs, and notification/webhook side effects) without coupling to private implementation internals.
- **Zero Production-Logic Mocking**: Tests execute the **real** production modules (`lib/**`, `app/api/**`, `app/actions/**`, `lib/supabase/{server,admin}.ts`, `@supabase/supabase-js`, `@supabase/ssr`, `lib/api-auth.ts`, `lib/action-authorization.ts`, `lib/permissions-server.ts`, `lib/audit-log.ts`). ONLY external I/O boundaries are intercepted by the harness (`globalThis.fetch` for in-memory PostgREST/RPC/GoTrue + programmable external HTTP endpoints, `next/headers`, `next/cache`, `next/navigation`, and `process.env`).
- **Progressive Testability & Non-Vacuity**:
  - Every test is fully self-contained (`beforeEach` creates a fresh isolated harness; `afterEach` disposes it cleanly).
  - ZERO `test.skip`, ZERO conditional `if (!mod) return;`, ZERO vacuous/always-pass assertions.
  - Because Milestones M1–M6 execute in parallel, tests targeting not-yet-implemented modules fail loudly with `[E2E_MISSING_MODULE]` / `[E2E_MISSING_EXPORT]` assertion errors (genuine red-to-green verification) while **never** breaking `npm run lint` (`tsc --noEmit`) or `npm run build`.
- **Anti-Regression Verification**: Verified pre-existing defects discovered during codebase analysis (`app/actions/parent-communication.ts:890` fake `totalDue: 1200`, and `BUG-AI-1` through `BUG-AI-5` in `lib/ai/erp-tools.ts` & `app/api/ai/confirm/route.ts`) are codified as explicit Tier 2 assertions with strict schema column validation.

---

## 2. Feature Inventory (All 10 User Features, N = 10)

| # | Feature | Milestone | Primary Contracts / Endpoints | Tier 1 File | Tier 2 File |
|---|---|---|---|---|---|
| 1.1 | **Multi-Level Approval Workflow Engine** | M2 | `lib/approval-workflow.ts`, `app/actions/approvals.ts`, `app/actions/permissions.ts`, `/api/approvals`, `/api/approvals/[id]/decision`, `supabase_phase_1_enterprise_migration.sql` | `tests/e2e/tier1/f1_1_approvals.test.ts` (6) | `tests/e2e/tier2/f1_1_approvals_edge.test.ts` (6) |
| 1.2 | **Active Session Management & Step-Up 2FA** | M1 | `lib/session-manager.ts`, `lib/step-up-auth.ts`, `lib/permissions-server.ts`, `app/actions/security.ts`, `/api/auth/{sessions,mfa/setup,step-up/challenge,step-up/verify}` | `tests/e2e/tier1/f1_2_sessions_2fa.test.ts` (6) | `tests/e2e/tier2/f1_2_sessions_2fa_edge.test.ts` (6) |
| 1.3 | **Sensitive Data Masking & Export Audit Watermarking** | M1 | `lib/data-access-guards.ts`, `lib/export-watermark.ts`, `lib/printUtils.ts`, `/api/exports`, `/api/mobile/{students,donors}` | `tests/e2e/tier1/f1_3_masking_watermark.test.ts` (6) | `tests/e2e/tier2/f1_3_masking_watermark_edge.test.ts` (6) |
| 2.1 | **Scheduled Cron & Automation Engine** | M3 | `lib/automation/{cron-auth,fee-cron-service,attendance-cron-service}.ts`, `app/actions/automation.ts`, `/api/cron/{monthly-fees,overdue-reminders,absence-alerts,process-queues}`, `vercel.json` | `tests/e2e/tier1/f2_1_cron_automation.test.ts` (6) | `tests/e2e/tier2/f2_1_cron_automation_edge.test.ts` (6) |
| 2.2 | **Unified Multi-Channel Notification & Template Orchestrator** | M3 | `lib/notifications/{template-renderer,channels,orchestrator}.ts`, `app/actions/notification-orchestrator.ts`, `/api/notifications/dispatch`, `/api/mobile/push-tokens` | `tests/e2e/tier1/f2_2_notifications.test.ts` (6) | `tests/e2e/tier2/f2_2_notifications_edge.test.ts` (6) |
| 2.3 | **Cross-Module Executive BI Dashboard & Scheduled Digest Reports** | M4 | `lib/bi/{executive-bi-service,digest-generator}.ts`, `app/actions/bi.ts`, `/api/bi/{overview,custom-report,digest/[id]}`, `/api/cron/digest-reports` | `tests/e2e/tier1/f2_3_executive_bi.test.ts` (6) | `tests/e2e/tier2/f2_3_executive_bi_edge.test.ts` (6) |
| 2.4 | **Webhook & External Integration Hub** | M3 | `lib/webhooks/{signer,dispatcher}.ts`, `app/actions/webhooks.ts`, `/api/webhooks/endpoints/**`, `/api/webhooks/deliveries/**` | `tests/e2e/tier1/f2_4_webhooks.test.ts` (6) | `tests/e2e/tier2/f2_4_webhooks_edge.test.ts` (6) |
| 3.1 | **AI Early Warning System (Dropout & Fee Default Prediction)** | M5 | `lib/early-warning.ts`, `lib/early-warning-engine.ts`, `lib/early-warning-service.ts`, `app/actions/early-warning.ts`, `/api/early-warning`, `/api/cron/early-warning` | `tests/e2e/tier1/f3_1_early_warning.test.ts` (6) | `tests/e2e/tier2/f3_1_early_warning_edge.test.ts` (7) |
| 3.2 | **Financial & Boarding Anomaly Detection** | M5 | `lib/anomaly-detection.ts`, `lib/anomaly-detection-service.ts`, `app/actions/anomalies.ts`, `/api/anomalies`, `/api/cron/anomalies` | `tests/e2e/tier1/f3_2_anomaly_detection.test.ts` (6) | `tests/e2e/tier2/f3_2_anomaly_detection_edge.test.ts` (7) |
| 3.3 | **Voice-First Bangla AI Assistant & Action Copilot** | M6 | `lib/ai/{erp-tools,erp-knowledge-base}.ts`, `/api/ai/{chat,confirm}` | `tests/e2e/tier1/f3_3_ai_copilot.test.ts` (6) | `tests/e2e/tier2/f3_3_ai_copilot_edge.test.ts` (8) |

---

## 3. Test Architecture

### 3.1 Directory Structure
```text
tests/e2e/
├── helpers/
│   ├── runner.ts            # Dual Vitest / Node v24 node:test adapter (zero static vitest import)
│   ├── module-loader.ts     # Runtime dynamic import + node:module registerHooks + loud missing-module assertions
│   ├── test-harness.ts      # Stateful in-memory PostgREST/RPC/GoTrue + external HTTP recorder + Next.js shims
│   ├── fixtures.ts          # Realistic Qawmi madrasa fixtures (Bangla entities, roles, funds, SQL schema rules)
│   └── sql-verifier.ts      # Reusable idempotency/RLS/multi-tenant SQL migration structural verifier
├── tier1/                   # 60 feature happy-path E2E tests (6 per feature × 10 features)
├── tier2/                   # 64 boundary, corner, negative, security & bug-regression E2E tests
├── tier3/                   # 18 pairwise cross-feature combination E2E tests
└── tier4/                   # 7 realistic end-to-end Qawmi madrasa operational scenarios
```

### 3.2 TypeScript & Dual-Runner Guardrails (`tsconfig.json` Compliance)
Because `tsconfig.json` includes `"**/*.ts"` with `strict: true`, `isolatedModules: true`, `moduleResolution: "bundler"`, and **no** `allowImportingTsExtensions`:
1. **Zero static imports of M1–M6 target modules or `"vitest"`**: All target production modules are loaded at runtime via `loadModule<T>(specifier, requiredExports)` in `tests/e2e/helpers/module-loader.ts` using non-literal dynamic `import(urlVar)`.
2. **Extensionless helper imports**: Test files import helpers without `.ts` suffixes (`from "../helpers/runner"`, `from "../helpers/test-harness"`).
3. **Standard assertions**: All tests use `node:assert/strict` (typed by `@types/node@^20`, identical in both Vitest and Node v24 `node:test`).
4. **Erasable TypeScript syntax only**: No TS `enum` or constructor parameter properties in `tests/e2e/**`, ensuring full compatibility with Node v24 native type-stripping AND Vitest/esbuild.

### 3.3 Stateful In-Memory Harness Capabilities (`tests/e2e/helpers/test-harness.ts`)
- **In-Memory PostgREST Engine (`/rest/v1/<table>`)**: Supports `GET` (`select`, embedded foreign-key joins, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `is`, `ilike`, `like`, `not.*`, `or=(...)`, `order`, `limit`, `offset`, `Range`, `Prefer: count=exact`, `HEAD`, `single`/`maybeSingle`), `POST` (insert & `on_conflict` upsert), `PATCH`, `DELETE`, auto-UUID/timestamps.
- **Strict Schema Validation Mode**: Enforces real verified SQL column sets for `fee_payments` (`total_amount_received`, NO `amount_paid`), `student_fees` (`fee_type_name`, `billing_period`, `payable_amount`, `due_amount`, NO `title`/`total_amount`), `exams` (`title`, NO `name`/`class_id`), and `subjects` (`name`, `code`, NO `class_id`) so schema-mismatch regressions fail immediately with PostgreSQL error `42703`.
- **Audit Log Immutability Enforcement**: Rejects any `UPDATE` or `DELETE` on `system_audit_logs` mirroring the production trigger `trg_prevent_system_audit_log_update`.
- **Missing-Table & Missing-RPC Fault Injection**: `harness.db.markTableMissing(table, "42P01" | "PGRST205")` and `harness.db.markRpcMissing(fn)` verify mandatory graceful fallbacks to `madrasa_settings` / `madrasas.metadata` / `madrasas.security_metadata` / JS aggregation **where supported**. The portal-parity session registry is deliberately SQL-only: a missing table, RPC, or issuer binding must not grant an app session.
- **Stateful GoTrue Auth & Next.js Boundary Shims**: `harness.auth.asUser(...)` seeds `madrasas`/`users` and a simulated `current_app_session` binding, then injects `@supabase/ssr`-compatible cookies so real `createClient()` + `getAuthUser()` + `writeGuard()` + `authorizeApi()` execute end-to-end. `next/headers`, `next/cache`, and `next/navigation` shims read per-test state from `globalThis.__QAWMI_E2E_STATE__`.
- **Mounted session check (separate from the harness)**: [`tests/sql/session/portal-sessions-http.mjs`](tests/sql/session/portal-sessions-http.mjs) starts a built Next app, PostgreSQL, and Supabase Lite on loopback, signs in through password-grant endpoints, rotates SSR cookies/Bearer credentials, and checks pupil-specific receipts and revocation. No fixed credentials, external URL, or deployed database. See the [staging guide](docs/portal-staging-checks.bn.md) for the isolated install and command; this is not upstream GoTrue/PostgREST or Android evidence.
- **Teacher profile on both transports**: [`tests/sql/session/teacher-links-http.mjs`](tests/sql/session/teacher-links-http.mjs) checks a real SQL `teachers.auth_user_id` link with two independent app logins. The same-subject unclaimed slot and another teacher’s slot stay out of both snapshots. Removing the link leaves an empty schedule, even for a matching display name.
- **Shared-profile browser check**: [`tests/browser/shared-guardian-ui.mjs`](tests/browser/shared-guardian-ui.mjs) uses that same disposable stack but builds the browser chunks against its local public API. In one Chromium tab it submits both guardians’ login forms, chooses receipts, logs out, revisits real history entries, and reloads offline. A loopback-only proxy can cut transport for the service worker as well as the tab. Reconnect must show a receipt posted while B was offline. No injected browser sessions or snapshots. This complements the [synthetic offline/queue tests](tests/browser/portal-offline.mjs); neither is an Android device test.
- **Exam freeze tab**: With the [shared-browser fixture prerequisites](docs/portal-staging-checks.bn.md), run `node tests/browser/exam-freeze.mjs`. It opens a previously empty tab after exam reads recover, distinguishes permission errors from empty results, retries in place, and checks the tenant boundary and locked count. The same command runs [`teacher-marks-freeze.mjs`](tests/browser/teacher-marks-freeze.mjs): desktop/mobile saved values, lock changes on an open form, stale-save refusal, legacy storage, and alternate exam write paths. `portal-cache-behavior.test.ts` covers rejected offline drafts and subsequent replay.
- **Programmable External HTTP Stub & Recorder (`harness.http`)**: Intercepts all non-Supabase outbound `fetch` requests (SMS, WhatsApp, Email, FCM Push, Webhooks, AI), records exact URL/method/headers/body, and allows per-route fault injection (HTTP 500, 429, network timeout) to test fallback chains and exponential backoff retries deterministically without live network calls.

---

## 4. Tier 3 Cross-Feature Combination Matrix (18 Tests, Threshold ≥ 15)

| Test ID | Feature Pair | Verified Interaction |
|---|---|---|
| `T3-01` | 1.1 Approvals × 1.2 Step-Up 2FA | `CRITICAL` approval step blocked with `STEP_UP_REQUIRED` until valid TOTP/OTP Step-Up token is verified. |
| `T3-02` | 1.1 Approvals × 2.2 Notifications | Submitting/deciding a multi-level `FEE_WAIVER` dispatches Bangla notifications to next approver / requester. |
| `T3-03` | 1.1 Approvals × 2.4 Webhooks | Final approval of `RESULT_PUBLISH` dispatches HMAC-SHA256 signed `exam.result_published` webhook; rejection emits none. |
| `T3-04` | 1.1 Approvals × 3.2 Anomaly Detection | Rapid bulk fee waivers by one actor flagged by `runFinancialAnomalyScan` + immutable `system_audit_logs`. |
| `T3-05` | 1.1 Approvals × 3.3 AI Copilot | Copilot lists pending approvals, proposes & confirms `submit_approval_decision`, enforces non-self-approval + audit log. |
| `T3-06` | 1.2 Sessions/2FA × 1.3 Masking/Exports | Sensitive unmasked export enforces permissions/Step-Up, embeds watermark metadata, logs `SENSITIVE_DATA_EXPORTED`. |
| `T3-07` | 1.2 Sessions/2FA × 3.3 AI Copilot | Remotely terminated session or `SUSPENDED` account replaying `/api/ai/confirm` is rejected (`401`/`403`). |
| `T3-08` | 1.3 Masking/Watermark × 2.3 Executive BI | BI Scheduled Digest HTML/XLSX download embeds exporter watermark + writes `SENSITIVE_DATA_EXPORTED`. |
| `T3-09` | 1.3 Masking × 3.1 Early Warning | Staff without `data.unmask` see masked guardian phones (`017****890`) in Early Warning alerts; Muhtamim with `data.unmask` sees unmasked. |
| `T3-10` | 2.1 Cron × 2.2 Notifications | Overdue & absence crons dispatch through Notification Orchestrator with Push/WhatsApp → SMS fallback, skipping Friday & paid students. |
| `T3-11` | 2.1 Cron × 2.3 Executive BI | `/api/cron/digest-reports` builds digest from live `getExecutiveBiSnapshot`, dispatches report, logs `job_execution_logs`. |
| `T3-12` | 2.1 Cron × 2.4 Webhooks | `/api/cron/process-queues` drains pending notification queue items AND due exponential-backoff webhook retries. |
| `T3-13` | 2.1 Cron × 3.1 Early Warning | Monthly fee generation + aging overdue dues feed `/api/cron/early-warning`, elevating chronically overdue + absent students to `CRITICAL`. |
| `T3-14` | 2.2 Notifications × 3.1 Early Warning | `CRITICAL` dropout risk intervention dispatches Bangla-rendered guardian alert with automatic SMS fallback. |
| `T3-15` | 2.2 Notifications × 3.3 AI Copilot | Confirmed `send_absent_guardian_notices` / `send_due_fee_reminders` routes through Feature 2.2 orchestrator with zero fake-due sends. |
| `T3-16` | 2.3 Executive BI × 3.2 Anomaly Detection | Boarding bazar spike flagged by Anomaly Detection correlates with elevated per-capita boarding cost deficit in Executive BI. |
| `T3-17` | 2.4 Webhooks × 1.3 Data Security | Payment/admission webhooks omit/mask raw sensitive PII, reject SSRF targets, and log `WEBHOOK_DISPATCHED`. |
| `T3-18` | 3.2 Anomaly Detection × 3.3 AI Copilot | Copilot `trigger_anomaly_scan` → `/api/ai/confirm` → `getFinancialAnomalies` returns detected anomalies + immutable audit trail. |

---

## 5. Tier 4 Real-World Qawmi Madrasa End-to-End Scenarios (7 Scenarios, Threshold ≥ 6)

1. **`T4-01` — Monthly Cycle of Jamia Islamia**: Auto-invoicing (`2.1`) → strict real-due overdue reminders with WhatsApp→SMS fallback (`2.2`) → Early Warning `CRITICAL` scoring (`3.1`) → Ustad masked PII view (`1.3`) → Muhtamim Bangla AI Copilot overdue query & confirmed absent guardian notices (`3.3`).
2. **`T4-02` — Lillah Boarding Bazar Fraud Detection & Shura Audit**: Bazar Z-score spike + same-day duplicate electricity vouchers + excessive waivers (`3.2`) → Executive BI boarding deficit visibility (`2.3`) → AI Copilot anomaly review (`3.3`) → Step-Up 2FA gated accounting period unlock (`1.2`) → Watermarked Shura Audit XLSX export + `SENSITIVE_DATA_EXPORTED` (`1.3`).
3. **`T4-03` — Multi-Level Large Expense & Fee Waiver Approval with External Accounting Webhook**: Accountant submits ৳75,000 `LARGE_EXPENSE` (self-approval blocked) → Naib Muhtamim notification (`2.2`) & Step 1 approval → Muhtamim Step-Up 2FA (`1.2`) & final approval (`1.1`) → HMAC-SHA256 signed webhook with 500→retry→`DELIVERED` recovery (`2.4`, `2.1`).
4. **`T4-04` — Hifz & Noorani Academic Decline, Exam Publish & Executive Digest**: `exam_manager` → `muhtamim` `RESULT_PUBLISH` approval (`1.1`) → signed `exam.result_published` webhook (`2.4`) → Hifz sabak-pause & Noorani takhti-stall Early Warning (`3.1`) → Session-to-Session BI comparison & scheduled A4 Bangla HTML + watermarked XLSX digest (`2.3`, `2.1`).
5. **`T4-05` — Security Incident Response & Audit Forensics**: Suspicious IP login (`1.2`) → masked export + `SENSITIVE_DATA_EXPORTED` with suspicious IP (`1.3`) → blocked AI locked-period expense & cross-tenant write (`3.3`) → Muhtamim remote session termination (`SESSION_TERMINATED`) → replay rejection & immutable `system_audit_logs` integrity check.
6. **`T4-06` — Full Multi-Tenant Isolation Stress Scenario (Madrasa A vs Madrasa B)**: All 10 features (`1.1`–`3.3`) exercised concurrently across two tenants verifying zero read leakage and 100% cross-tenant write rejection.
7. **`T4-07` — Online Admission, Payment Confirmation, Multi-Channel Welcome & New-Student Risk Grace**: Confirmed `create_student` (`3.3`) → `student.admitted` & `payment.completed` signed webhooks (`2.4`) + guardian welcome notification (`2.2`) → Early Warning recalculation grants new student `LOW` grace score (`3.1`) → Teacher search returns masked guardian phone (`1.3`).

---

## 6. Coverage Thresholds & Test Execution

| Tier | Directory | Required Threshold (N = 10) | Planned Count | Scope |
|---|---|---|---|---|
| **Tier 1** | `tests/e2e/tier1/` | ≥ 50 (≥ 5 / feature) | **60** (6 / feature) | Isolated happy-path feature coverage across all 10 features |
| **Tier 2** | `tests/e2e/tier2/` | ≥ 50 (≥ 5 / feature) | **64** (6–8 / feature) | Boundary, corner, negative, RBAC, SSRF, fallback, SQL RLS & verified bug regressions |
| **Tier 3** | `tests/e2e/tier3/` | ≥ 15 | **18** | Pairwise cross-feature interactions spanning all 10 features |
| **Tier 4** | `tests/e2e/tier4/` | ≥ 6 | **7** | End-to-end realistic Qawmi madrasa operational workflows |
| **Total** | `tests/e2e/` | **≥ 121** | **149** | Complete opaque-box E2E verification suite |

### Canonical Commands
- Full E2E Suite (once M1 configures `package.json`): `npm run test:e2e`
- Per-Tier Execution: `npm run test:e2e -- tests/e2e/tier1` (or `tier2`, `tier3`, `tier4`)
- Direct Node v24 Execution (works independently even before M1 finishes `npm ci`):
  ```bash
  node --import ./tests/e2e/helpers/register-hooks.mjs --test "tests/e2e/tier1/*.test.ts" "tests/e2e/tier2/*.test.ts" "tests/e2e/tier3/*.test.ts" "tests/e2e/tier4/*.test.ts"
  ```
- Typecheck Guardrail (MUST remain 0 errors at all times): `npm run lint` (`tsc --noEmit`)
