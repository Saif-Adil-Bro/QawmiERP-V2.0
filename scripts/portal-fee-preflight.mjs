import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const usage =
  "Usage: npm run --silent preflight:fees (or preflight:finance / preflight:cashbooks after their migrations) -- <staging-tenant-A-uuid> <staging-tenant-B-uuid>\nSet QAWMI_STAGING_DATABASE_URL via your secret manager. No default database.";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
class PreflightError extends Error {}

function validateTenants(tenants) {
  if (
    tenants.length !== 2 ||
    !tenants.every((id) => uuid.test(id)) ||
    tenants[0].toLowerCase() === tenants[1].toLowerCase()
  ) {
    throw new PreflightError(usage);
  }
}

// Call immediately inside a fresh transaction, on its pinned connection. A partial or
// RLS-filtered report is not a clean result. IDs, financial records and raw errors are
// not safe for shared CI logs (a cast error can quote an entire metadata document).
export async function readFeePreflight(
  query,
  tenants,
  { finance = false, cashbooks = false } = {},
) {
  validateTenants(tenants);
  await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
  await query("SET LOCAL row_security = off"); // fail rather than silently apply row filters
  await query("SET LOCAL search_path TO pg_catalog");
  await query("SET LOCAL statement_timeout = '30s'");
  await query("SET LOCAL lock_timeout = '3s'");
  const select = await readFile(
    new URL("./sql/portal-fee-preflight.sql", import.meta.url),
    "utf8",
  );
  const reports = [];
  if (finance || cashbooks) reports.push("finance-integrity-review.sql");
  if (cashbooks) reports.push("finance-cashbooks-review.sql");
  const extra = await Promise.all(
    reports.map((name) =>
      readFile(new URL(`./sql/${name}`, import.meta.url), "utf8"),
    ),
  );
  const institutions = [];
  for (const [i, tenant] of tenants.entries()) {
    const label = i === 0 ? "A" : "B";
    let rows;
    try {
      rows = await query(select, [tenant]);
      for (const check of extra) {
        if (rows.length !== 1) break;
        const [report] = await query(check, [tenant]);
        for (const key of ["inventory", "blockers", "review"])
          rows[0][key] = { ...rows[0][key], ...report[key] };
      }
    } catch (err) {
      const state = /^[0-9A-Z]{5}$/.test(err?.code)
        ? ` (SQLSTATE ${err.code})`
        : "";
      throw new PreflightError(
        `Institution ${label}: could not read the complete ledger${state}. Check schema, data types, permissions and timeouts.`,
      );
    }
    if (rows.length !== 1)
      throw new PreflightError(
        `Institution ${label}: not found. No complete report.`,
      );
    const { inventory, blockers, review } = rows[0];
    institutions.push({ institution: label, inventory, blockers, review });
  }
  const hold = institutions.some(
    (r) => Object.keys(r.blockers).length || Object.keys(r.review).length,
  );
  return { status: hold ? "HOLD" : "CHECKS_CLEAR", institutions };
}

async function main(tenants) {
  const finance = tenants[0] === "--finance";
  const cashbooks = tenants[0] === "--cashbooks";
  if (finance || cashbooks) tenants = tenants.slice(1);
  if (tenants.length === 1 && tenants[0] === "--help")
    return console.log(usage);
  validateTenants(tenants);
  let target;
  try {
    target = new URL(process.env.QAWMI_STAGING_DATABASE_URL);
  } catch {
    /* no implicit .env/production fallback */
  }
  if (
    !target ||
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !target.hostname ||
    !target.username ||
    target.pathname.length < 2
  ) {
    throw new PreflightError(
      "Set QAWMI_STAGING_DATABASE_URL to the authorized staging PostgreSQL database (including user, host and database name).",
    );
  }
  const db = postgres(target.href, {
    max: 1,
    prepare: false,
    fetch_types: false,
    ssl: { rejectUnauthorized: true },
    connect_timeout: 10,
    debug: false,
    onnotice: () => {},
  });
  try {
    const report = await db.begin((tx) =>
      readFeePreflight((text, args = []) => tx.unsafe(text, args), tenants, {
        finance,
        cashbooks,
      }),
    );
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === "CHECKS_CLEAR" ? 0 : 1;
  } finally {
    await db.end({ timeout: 3 });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(
      "INCOMPLETE:",
      err instanceof PreflightError
        ? err.message
        : "Staging connection or read-only transaction failed. Check the target, TLS and read permissions.",
    );
    process.exitCode = 2;
  });
}
