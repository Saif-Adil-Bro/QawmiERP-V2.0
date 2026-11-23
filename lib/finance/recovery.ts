import type { ResolvedBackupSelection } from "@/lib/backup-modules";

// A generic row/JSON importer cannot replay a posting, approval, or gateway
// callback. Reject the whole requested operation, before an automatic snapshot
// or the first write. Keep selective non-financial backups available.
const linked = new Set([
  "fees",
  "finance_transactions",
  "expenses",
  "zakat_donations",
  "donors_funds",
  "fundraising_special",
  "payment_gateway",
  "staff",
  "boarding",
  "inventory",
  "audit_logs",
]);
export function includesFinancialBooks(s: ResolvedBackupSelection) {
  return s.isFull || s.modules.some((m) => linked.has(m));
}
// Replacing a parent can cascade into receipts; profiles and session settings
// also determine what subsequent bills cost. Do not import them as loose JSON.
export function needsFinancialRecovery(s: ResolvedBackupSelection) {
  return (
    includesFinancialBooks(s) ||
    s.modules.some((m) =>
      ["students", "admissions", "academic", "settings"].includes(m),
    )
  );
}
export function safeWipeScope(scope: unknown, modules?: unknown) {
  return (
    scope === "custom" &&
    Array.isArray(modules) &&
    modules.length > 0 &&
    modules.every((m) => ["exams", "attendance", "hifz_kitab"].includes(m))
  );
}
export const financialRecoveryHold = {
  success: false,
  error: "FINANCIAL_RECOVERY_REQUIRED",
  message:
    "এই পরিবর্তনে আর্থিক নথি বা তার মূল রেকর্ড বদলে যেতে পারে। কোনো ডেটা পরিবর্তন করা হয়নি। বিচ্ছিন্ন কপিতে যাচাই করে হিসাব বিভাগের অনুমোদনে পুনরুদ্ধার করুন।",
};

export type RecoveryOperation = 'merge' | 'replace' | 'wipe';
type Data = Record<string, any>;

/** Build changes to the verified selection only. SQL checks this preimage under
 * lock and applies the whole plan in one transaction; no user input names a table. */
export function selectiveRecoveryPlan(
  selection: ResolvedBackupSelection, operation: RecoveryOperation, before: Data, incoming: Data,
) {
  if (needsFinancialRecovery(selection) || selection.tables === 'ALL' || selection.metadataKeys === 'ALL' ||
      (operation === 'wipe' && !safeWipeScope('custom', selection.modules)) || (operation === 'replace' && selection.tables.size)) {
    throw Error('Invalid recovery scope');
  }
  const tables: Record<string,{before: any[]; rows: any[]}> = {}, patch: Data = {}, stats: Record<string, number> = {};
  for (const table of selection.tables) {
    const rows = incoming[table] ?? [], prior = before[table] ?? [];
    if (!Array.isArray(rows) || !Array.isArray(prior)) throw Error('Invalid table data');
    tables[table] = {before: prior, rows};
    const n = operation === 'wipe' ? prior.length : rows.length;
    if (n) stats[table] = n;
  }
  const priorMeta = before.metadata || {};
  for (const key of selection.metadataKeys) {
    const old = priorMeta[key];
    // A SQL table and its old JSON book may have the same name. They are
    // independent stores; never materialise a metadata row in a SQL table.
    const val = Object.hasOwn(incoming.metadata || {},key) ? incoming.metadata[key] :
      !selection.tables.has(key) ? incoming[key] : undefined;
    const size = (v: unknown) => Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : v == null ? 0 : 1;
    const statKey = `meta_${key}`;
    if (operation === 'wipe') { if (old !== undefined) stats[statKey]=size(old); continue; }
    if (val === undefined) continue;
    if (operation === 'merge' && Array.isArray(val)) {
      if (old != null && !Array.isArray(old)) throw Error('Incompatible metadata');
      const id = (v: any) => v && typeof v === 'object' && v.id ? `id:${v.id}` : `value:${JSON.stringify(v)}`;
      const merged = [...(old || [])], seen = new Set(merged.map(id));
      for (const item of val) if (!seen.has(id(item))) { merged.push(item); seen.add(id(item)); }
      patch[key] = merged; stats[statKey] = merged.length - (old?.length || 0);
    } else if (operation === 'merge' && val && typeof val === 'object') {
      if (old != null && (Array.isArray(old) || typeof old !== 'object')) throw Error('Incompatible metadata');
      patch[key]={...old,...val}; stats[statKey]=size(val);
    } else { patch[key]=val; stats[statKey]=size(val); }
  }
  return {operation, tables, meta_keys:[...selection.metadataKeys], prior_meta:priorMeta, patch, stats, total:Object.values(stats).reduce((a,b)=>a+b,0)};
}
