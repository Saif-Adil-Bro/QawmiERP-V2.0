# TEST_READY — Opaque-Box E2E Test Suite (Tiers 1–4)

**Status**: **READY** (Gate Passed — Iteration 2)  
**Specification**: [`TEST_INFRA.md`](./TEST_INFRA.md)  
**Suite Root**: `tests/e2e/`

---

## 1. Coverage Summary

| Tier | Directory | Files | Test Count | Required Threshold | Status |
|---|---|---|---|---|---|
| **Tier 1** | `tests/e2e/tier1/` | 10 | **60** (6 / feature × 10 features) | ≥ 50 | **PASS** |
| **Tier 2** | `tests/e2e/tier2/` | 10 | **64** (6–8 / feature × 10 features) | ≥ 50 | **PASS** |
| **Tier 3** | `tests/e2e/tier3/` | 3 | **18** (`T3-01`–`T3-18`) | ≥ 15 | **PASS** |
| **Tier 4** | `tests/e2e/tier4/` | 2 | **7** (`T4-01`–`T4-07`) | ≥ 6 | **PASS** |
| **Total** | `tests/e2e/` | **25** | **149** | **≥ 121** | **PASS** |

All 10 features from `.agents/teamwork/ORIGINAL_REQUEST.md` and `PROJECT.md` (1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3) are covered across all 4 tiers, including:
- Boundary, corner, negative, RBAC, SSRF, HMAC-SHA256, fallback-to-`madrasa_settings`/`madrasas.metadata`, and SQL RLS/idempotency verification.
- Explicit anti-regression assertions for `app/actions/parent-communication.ts` (`totalDue: 1200`) and `BUG-AI-1` through `BUG-AI-5` (`lib/ai/erp-tools.ts`, `/api/ai/confirm`).

---

## 2. Verification & Gate Evidence (Iteration 2)

- **TypeScript Guardrail (`npx tsc --noEmit`)**: **0 errors** in `tests/e2e/**`.
- **Full E2E Execution (`npm run test:e2e`)**: **25 files / 149 tests executed cleanly** (`132 failed | 17 passed (149)` in Vitest — expected red-to-green `[E2E_MISSING_MODULE]` / `[E2E_MISSING_EXPORT]` failures for unimplemented M2–M6 modules, plus genuine M1 findings).
- **Guardrail Scan**: Zero `test.skip` / `it.skip`, zero `if (!mod) return;`, zero static imports of M1–M6 target modules or `"vitest"`, zero mocked-out production logic.
- **Verification Wave**:
  - Forensic Auditor (`intermediate track audit`): **CLEAN**
  - Primary Reviewer: **APPROVE**
  - Secondary Reviewer: **APPROVE**
  - Challenger 1 (Harness & Tier 1–2): **CONFIRMED**
  - Challenger 2 (Tier 3–4 & Non-Vacuity): **CONFIRMED**

---

## 3. Canonical Execution Commands for M7 Phase 1

```bash
# Run full opaque-box E2E suite (Tiers 1–4)
npm run test:e2e

# Run sequentially by tier
npm run test:e2e -- tests/e2e/tier1
npm run test:e2e -- tests/e2e/tier2
npm run test:e2e -- tests/e2e/tier3
npm run test:e2e -- tests/e2e/tier4
```

> **Note for M1**: E2E tests `T2-1.3-02`, `T2-1.3-04`, and `T4-05` currently surface a real `ByteString` HTTP header defect in M1's `app/api/exports/route.ts:339` (`"X-Watermark-Line": watermark.watermarkLine` passes raw Bangla UTF-8 characters into `Headers`). M1/M7 should encode or sanitize `X-Watermark-Line` before HTTP header assignment.
