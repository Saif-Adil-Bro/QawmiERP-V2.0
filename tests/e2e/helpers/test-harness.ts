import crypto from "node:crypto";
import { MADRASA_A, MADRASA_B, type FixtureUser } from "./fixtures";

export type DbRow = Record<string, unknown>;

export interface RecordedHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: string;
}

export type HttpMatcher =
  | string
  | RegExp
  | ((req: RecordedHttpRequest) => boolean);

export type HttpResponder = (
  req: RecordedHttpRequest
) => Response | Promise<Response>;

export type RpcHandler = (
  params: Record<string, unknown>,
  ctx: { authHeader: string | null; apiKey: string | null }
) => unknown | Promise<unknown>;

export interface AuthUserInput {
  id: string;
  madrasaId: string;
  role: string;
  email: string;
  fullName?: string;
  phone?: string;
  status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
  roles?: string[];
  directPermissions?: string[];
  deniedPermissions?: string[];
  sessionId?: string;
}

export interface CreateRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

interface E2eGlobalState {
  headers: Headers;
  cookies: Map<string, string>;
  revalidatedPaths: string[];
  revalidatedTags: string[];
}

interface ActiveSessionToken {
  token: string;
  userId: string;
  email: string;
  role: string;
  madrasaId: string;
  fullName: string;
  phone: string;
  sessionId: string;
  revoked: boolean;
}

const SUPABASE_TEST_URL = "http://supabase.test.local";
const SUPABASE_TEST_ANON_KEY = "e2e-test-anon-key";
const SUPABASE_TEST_SERVICE_KEY = "e2e-test-service-role-key";
const DEFAULT_CRON_SECRET = "e2e-test-cron-secret-32chars-minimum";
const DEFAULT_MOBILE_API_KEY = "e2e-test-mobile-api-key-32chars-min";

const STRICT_TABLE_COLUMNS: Record<string, ReadonlySet<string>> = {
  fee_payments: new Set([
    "id",
    "receipt_no",
    "madrasa_id",
    "session_id",
    "student_id",
    "student_name",
    "student_roll",
    "class_name",
    "total_amount_received",
    "payment_date",
    "payment_method",
    "transaction_ref",
    "discount_total",
    "fine_total",
    "advance_amount",
    "collector_name",
    "notes",
    "status",
    "reversal_reason",
    "reversed_at",
    "reversed_by",
    "idempotency_key",
    "created_at",
    "updated_at",
  ]),
  student_fees: new Set([
    "id",
    "madrasa_id",
    "session_id",
    "student_id",
    "student_name",
    "student_roll",
    "class_id",
    "class_name",
    "fee_type_id",
    "fee_type_name",
    "billing_period",
    "month_name",
    "year",
    "due_date",
    "base_amount",
    "discount_amount",
    "discount_reason",
    "fine_amount",
    "fine_reason",
    "payable_amount",
    "paid_amount",
    "due_amount",
    "status",
    "created_at",
    "updated_at",
  ]),
  exams: new Set([
    "id",
    "madrasa_id",
    "title",
    "year",
    "start_date",
    "status",
    "is_locked",
    "locked_by",
    "locked_by_name",
    "locked_at",
    "lock_reason",
    "session_id",
    "is_published",
    "published_at",
    "created_at",
    "updated_at",
  ]),
  subjects: new Set([
    "id",
    "madrasa_id",
    "name",
    "code",
    "description",
    "created_at",
    "updated_at",
  ]),
};

function cloneRow<T>(val: T): T {
  return structuredClone(val);
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", "e2e-jwt-secret")
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  const hdrs = new Headers({
    "content-type": "application/json",
    ...(extraHeaders || {}),
  });
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: hdrs,
  });
}

function splitTopLevel(input: string, delimiter = ","): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== "\\") {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes) {
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") depth = Math.max(0, depth - 1);
      else if (ch === delimiter && depth === 0) {
        if (current.trim().length > 0) parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function parseScalar(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  const na = Number(a);
  const nb = Number(b);
  if (
    typeof a === "number" ||
    typeof b === "number" ||
    (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "")
  ) {
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return na < nb ? -1 : na > nb ? 1 : 0;
    }
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function wildcardToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  const normalized = pattern.replace(/\*/g, "%");
  let re = "^";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  re += "$";
  return new RegExp(re, caseInsensitive ? "i" : "");
}

function matchCondition(rowValue: unknown, expr: string): boolean {
  if (expr.startsWith("not.")) {
    return !matchCondition(rowValue, expr.slice(4));
  }
  const dotIdx = expr.indexOf(".");
  if (dotIdx === -1) return false;
  const op = expr.slice(0, dotIdx);
  const rawVal = expr.slice(dotIdx + 1);

  switch (op) {
    case "eq": {
      const target = parseScalar(rawVal);
      if (rowValue === target) return true;
      return String(rowValue ?? "") === String(target ?? "");
    }
    case "neq": {
      const target = parseScalar(rawVal);
      if (rowValue === target) return false;
      return String(rowValue ?? "") !== String(target ?? "");
    }
    case "gt":
      return rowValue !== null && rowValue !== undefined && compareValues(rowValue, rawVal) > 0;
    case "gte":
      return rowValue !== null && rowValue !== undefined && compareValues(rowValue, rawVal) >= 0;
    case "lt":
      return rowValue !== null && rowValue !== undefined && compareValues(rowValue, rawVal) < 0;
    case "lte":
      return rowValue !== null && rowValue !== undefined && compareValues(rowValue, rawVal) <= 0;
    case "is": {
      if (rawVal === "null") return rowValue === null || rowValue === undefined;
      if (rawVal === "true") return rowValue === true;
      if (rawVal === "false") return rowValue === false;
      return false;
    }
    case "in": {
      const inner = rawVal.startsWith("(") && rawVal.endsWith(")")
        ? rawVal.slice(1, -1)
        : rawVal;
      if (!inner) return false;
      const items = splitTopLevel(inner, ",").map((s) => {
        const trimmed = s.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      });
      return items.some((item) => String(rowValue ?? "") === item);
    }
    case "ilike": {
      if (rowValue === null || rowValue === undefined) return false;
      return wildcardToRegex(rawVal, true).test(String(rowValue));
    }
    case "like": {
      if (rowValue === null || rowValue === undefined) return false;
      return wildcardToRegex(rawVal, false).test(String(rowValue));
    }
    case "cs": {
      const arr = Array.isArray(rowValue) ? rowValue.map(String) : [];
      const inner = rawVal.replace(/^\{|\}$/g, "");
      const targets = inner ? splitTopLevel(inner, ",").map((s) => s.replace(/^"|"$/g, "")) : [];
      return targets.every((t) => arr.includes(t));
    }
    case "cd": {
      const arr = Array.isArray(rowValue) ? rowValue.map(String) : [];
      const inner = rawVal.replace(/^\{|\}$/g, "");
      const targets = inner ? splitTopLevel(inner, ",").map((s) => s.replace(/^"|"$/g, "")) : [];
      return arr.every((t) => targets.includes(t));
    }
    case "ov": {
      const arr = Array.isArray(rowValue) ? rowValue.map(String) : [];
      const inner = rawVal.replace(/^\{|\}$/g, "");
      const targets = inner ? splitTopLevel(inner, ",").map((s) => s.replace(/^"|"$/g, "")) : [];
      return targets.some((t) => arr.includes(t));
    }
    default:
      return false;
  }
}

function matchOrGroup(row: DbRow, orExpr: string): boolean {
  const inner =
    orExpr.startsWith("(") && orExpr.endsWith(")") ? orExpr.slice(1, -1) : orExpr;
  const clauses = splitTopLevel(inner, ",");
  return clauses.some((clause) => {
    const trimmed = clause.trim();
    if (trimmed.startsWith("and(") && trimmed.endsWith(")")) {
      const subClauses = splitTopLevel(trimmed.slice(4, -1), ",");
      return subClauses.every((sc) => matchClause(row, sc));
    }
    if (trimmed.startsWith("or(") && trimmed.endsWith(")")) {
      return matchOrGroup(row, trimmed.slice(2));
    }
    return matchClause(row, trimmed);
  });
}

function matchClause(row: DbRow, clause: string): boolean {
  const firstDot = clause.indexOf(".");
  if (firstDot === -1) return false;
  const col = clause.slice(0, firstDot).trim();
  const rest = clause.slice(firstDot + 1).trim();
  return matchCondition(row[col], rest);
}

function singularize(tableName: string): string {
  if (tableName.endsWith("ies")) return tableName.slice(0, -3) + "y";
  if (tableName.endsWith("ses")) return tableName.slice(0, -2);
  if (tableName.endsWith("s")) return tableName.slice(0, -1);
  return tableName;
}

export interface E2eTestHarness {
  readonly supabaseUrl: string;
  readonly cronSecret: string;
  readonly mobileApiKey: string;
  readonly db: {
    seed: (table: string, rows: DbRow | DbRow[]) => void;
    getRows: (table: string, filter?: (row: DbRow) => boolean) => DbRow[];
    clearTable: (table: string) => void;
    markTableMissing: (table: string, code?: "42P01" | "PGRST205" | false) => void;
    registerRpc: (name: string, handler: RpcHandler) => void;
    markRpcMissing: (name: string, code?: "42883" | "PGRST202" | false) => void;
    setStrictSchema: (enabled: boolean) => void;
  };
  readonly auth: {
    asUser: (user: AuthUserInput | FixtureUser) => { accessToken: string; sessionId: string };
    asAnonymous: () => void;
    revokeToken: (token: string) => void;
    revokeUserSessions: (userId: string) => void;
    getCurrentToken: () => string | null;
  };
  readonly http: {
    readonly requests: RecordedHttpRequest[];
    onRequest: (matcher: HttpMatcher, responder: HttpResponder) => void;
    reset: () => void;
  };
  readonly revalidatedPaths: string[];
  readonly revalidatedTags: string[];
  setHeader: (name: string, value: string) => void;
  setCookie: (name: string, value: string) => void;
  setIp: (ip: string) => void;
  setUserAgent: (ua: string) => void;
  setStepUpToken: (token: string, via?: "header" | "cookie") => void;
  setEnv: (key: string, value: string | undefined) => void;
  createRequest: (pathOrUrl: string, opts?: CreateRequestOptions) => Request;
  flushAsync: () => Promise<void>;
  dispose: () => void;
}

export function createTestHarness(): E2eTestHarness {
  const originalFetch = globalThis.fetch;
  const originalEnv: Record<string, string | undefined> = { ...process.env };
  const prevState = (globalThis as Record<string, unknown>).__QAWMI_E2E_STATE__;

  const state: E2eGlobalState = {
    headers: new Headers({
      "x-forwarded-for": "103.112.54.22",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0.0.0",
    }),
    cookies: new Map<string, string>(),
    revalidatedPaths: [],
    revalidatedTags: [],
  };
  (globalThis as Record<string, unknown>).__QAWMI_E2E_STATE__ = state;

  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_TEST_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_TEST_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_TEST_SERVICE_KEY;
  process.env.CRON_SECRET = DEFAULT_CRON_SECRET;
  process.env.MOBILE_API_KEY = DEFAULT_MOBILE_API_KEY;

  const tables = new Map<string, DbRow[]>();
  const missingTables = new Map<string, "42P01" | "PGRST205">();
  const rpcs = new Map<string, RpcHandler>();
  const missingRpcs = new Map<string, "42883" | "PGRST202">();
  let strictSchemaEnabled = true;

  const activeTokens = new Map<string, ActiveSessionToken>();
  let currentAccessToken: string | null = null;

  const httpRequests: RecordedHttpRequest[] = [];
  const httpStubs: Array<{ matcher: HttpMatcher; responder: HttpResponder }> = [];

  function ensureTable(table: string): DbRow[] {
    let rows = tables.get(table);
    if (!rows) {
      rows = [];
      tables.set(table, rows);
    }
    return rows;
  }

  function seed(table: string, rows: DbRow | DbRow[]): void {
    const arr = Array.isArray(rows) ? rows : [rows];
    const target = ensureTable(table);
    for (const row of arr) {
      const copy = cloneRow(row);
      if (copy.id === undefined) copy.id = crypto.randomUUID();
      if (copy.created_at === undefined) copy.created_at = new Date().toISOString();
      const idx = target.findIndex((r) => r.id === copy.id);
      if (idx >= 0) target[idx] = copy;
      else target.push(copy);
    }
  }

  // Always seed default Madrasa A & B so tenant lookups work smoothly
  seed("madrasas", [MADRASA_A, MADRASA_B]);

  function validateStrictColumns(
    table: string,
    selectParam: string | null,
    filterCols: string[],
    writeCols?: string[]
  ): Response | null {
    if (!strictSchemaEnabled) return null;
    const allowed = STRICT_TABLE_COLUMNS[table];
    if (!allowed) return null;

    for (const col of filterCols) {
      if (!allowed.has(col)) {
        return jsonResponse(
          {
            code: "42703",
            details: null,
            hint: null,
            message: `column ${table}.${col} does not exist`,
          },
          400
        );
      }
    }

    if (writeCols) {
      for (const col of writeCols) {
        if (!allowed.has(col)) {
          return jsonResponse(
            {
              code: "42703",
              details: null,
              hint: null,
              message: `column ${table}.${col} does not exist`,
            },
            400
          );
        }
      }
    }

    if (selectParam && selectParam.trim() !== "*") {
      const items = splitTopLevel(selectParam, ",");
      for (const item of items) {
        const trimmed = item.trim();
        if (!trimmed || trimmed === "*") continue;
        // Skip embedded relation projections like students(id,first_name) or student:students(...)
        if (trimmed.includes("(")) continue;
        const colonIdx = trimmed.indexOf(":");
        const colName = (colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : trimmed)
          .replace(/->.*$/, "")
          .trim();
        if (colName === "*" || !colName) continue;
        if (!allowed.has(colName)) {
          return jsonResponse(
            {
              code: "42703",
              details: null,
              hint: null,
              message: `column ${table}.${colName} does not exist`,
            },
            400
          );
        }
      }
    }
    return null;
  }

  function applyFilters(rows: DbRow[], searchParams: URLSearchParams): DbRow[] {
    const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
    return rows.filter((row) => {
      for (const [key, val] of searchParams.entries()) {
        if (reserved.has(key)) continue;
        if (key === "or") {
          if (!matchOrGroup(row, val)) return false;
          continue;
        }
        if (key === "and") {
          const inner = val.startsWith("(") && val.endsWith(")") ? val.slice(1, -1) : val;
          const clauses = splitTopLevel(inner, ",");
          if (!clauses.every((c) => matchClause(row, c))) return false;
          continue;
        }
        if (!matchCondition(row[key], val)) {
          return false;
        }
      }
      return true;
    });
  }

  function projectRow(
    table: string,
    row: DbRow,
    selectParam: string | null
  ): { projected: DbRow | null; innerMatched: boolean } {
    if (!selectParam || selectParam.trim() === "*") {
      return { projected: cloneRow(row), innerMatched: true };
    }
    const items = splitTopLevel(selectParam, ",");
    const out: DbRow = {};
    let includeAllBase = false;

    for (const rawItem of items) {
      const item = rawItem.trim();
      if (item === "*") {
        includeAllBase = true;
        continue;
      }

      const parenIdx = item.indexOf("(");
      if (parenIdx >= 0 && item.endsWith(")")) {
        const prefix = item.slice(0, parenIdx).trim();
        const subSelect = item.slice(parenIdx + 1, -1).trim();
        const isInner = prefix.includes("!inner");
        const cleanPrefix = prefix.replace(/![a-zA-Z0-9_]+/g, "");
        const colonIdx = cleanPrefix.indexOf(":");
        const alias = colonIdx >= 0 ? cleanPrefix.slice(0, colonIdx).trim() : cleanPrefix;
        const relTable = colonIdx >= 0 ? cleanPrefix.slice(colonIdx + 1).trim() : cleanPrefix;

        const relRows = ensureTable(relTable);
        const fkGuess1 = `${singularize(relTable)}_id`;
        const fkGuess2 = `${alias}_id`;
        const fkVal = row[fkGuess1] ?? row[fkGuess2];

        if (fkVal !== undefined && fkVal !== null) {
          const match = relRows.find((r) => String(r.id) === String(fkVal));
          if (!match && isInner) return { projected: null, innerMatched: false };
          out[alias] = match ? projectRow(relTable, match, subSelect).projected : null;
        } else {
          const parentFk1 = `${singularize(table)}_id`;
          const parentFk2 = table === "approval_workflows" ? "workflow_id" : parentFk1;
          const children = relRows
            .filter(
              (r) =>
                (r[parentFk1] !== undefined && String(r[parentFk1]) === String(row.id)) ||
                (r[parentFk2] !== undefined && String(r[parentFk2]) === String(row.id))
            )
            .map((r) => projectRow(relTable, r, subSelect).projected)
            .filter((r): r is DbRow => r !== null);
          if (children.length === 0 && isInner) {
            return { projected: null, innerMatched: false };
          }
          out[alias] = children;
        }
        continue;
      }

      const colonIdx = item.indexOf(":");
      const outKey = colonIdx >= 0 ? item.slice(0, colonIdx).trim() : item;
      const srcCol = colonIdx >= 0 ? item.slice(colonIdx + 1).trim() : item;
      out[outKey] = cloneRow(row[srcCol]);
    }

    if (includeAllBase) {
      return { projected: { ...cloneRow(row), ...out }, innerMatched: true };
    }
    return { projected: out, innerMatched: true };
  }

  function handleRestRequest(url: URL, init?: RequestInit): Response {
    const method = (init?.method || "GET").toUpperCase();
    const reqHeaders = new Headers(init?.headers || {});
    const pathParts = url.pathname.replace(/^\/rest\/v1\//, "").split("/");

    if (pathParts[0] === "rpc" && pathParts[1]) {
      const fnName = decodeURIComponent(pathParts[1]);
      const missingCode = missingRpcs.get(fnName);
      if (missingCode) {
        return jsonResponse(
          {
            code: missingCode,
            message: `Could not find the function public.${fnName} in the schema cache`,
          },
          404
        );
      }
      const handler = rpcs.get(fnName);
      if (!handler) {
        return jsonResponse(
          {
            code: "PGRST202",
            message: `Could not find the function public.${fnName} in the schema cache`,
          },
          404
        );
      }
      const bodyStr = typeof init?.body === "string" ? init.body : "{}";
      const params = bodyStr ? (JSON.parse(bodyStr) as Record<string, unknown>) : {};
      // Sync wrapper — async RPCs handled in outer async fetch
      void params;
      return jsonResponse({ error: "RPC handled asynchronously" }, 500);
    }

    const table = decodeURIComponent(pathParts[0] || "");
    const missingCode = missingTables.get(table);
    if (missingCode) {
      return jsonResponse(
        {
          code: missingCode,
          message:
            missingCode === "42P01"
              ? `relation "public.${table}" does not exist`
              : `Could not find the table 'public.${table}' in the schema cache`,
        },
        404
      );
    }

    // Enforce immutability trigger on system_audit_logs
    if (table === "system_audit_logs" && (method === "PATCH" || method === "DELETE")) {
      return jsonResponse(
        {
          code: "P0001",
          details: null,
          hint: null,
          message:
            "system_audit_logs is immutable: UPDATE/DELETE operation is forbidden",
        },
        400
      );
    }

    const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"]);
    const filterCols: string[] = [];
    for (const key of url.searchParams.keys()) {
      if (!reserved.has(key)) filterCols.push(key);
    }

    const selectParam = url.searchParams.get("select");
    const strictErr = validateStrictColumns(table, selectParam, filterCols);
    if (strictErr) return strictErr;

    const prefer = reqHeaders.get("prefer") || "";
    const accept = reqHeaders.get("accept") || "";
    const wantsSingleObject = accept.includes("application/vnd.pgrst.object+json");
    const wantsCount = prefer.includes("count=exact");

    if (method === "GET" || method === "HEAD") {
      let rows = applyFilters(ensureTable(table), url.searchParams);

      // Sort
      const orderParam = url.searchParams.get("order");
      if (orderParam) {
        const orderSpecs = splitTopLevel(orderParam, ",").map((s) => {
          const parts = s.split(".");
          return {
            col: parts[0],
            desc: parts.includes("desc"),
            nullsFirst: parts.includes("nullsfirst"),
          };
        });
        rows = [...rows].sort((a, b) => {
          for (const spec of orderSpecs) {
            const va = a[spec.col];
            const vb = b[spec.col];
            if (va === vb) continue;
            if (va === null || va === undefined) return spec.nullsFirst ? -1 : 1;
            if (vb === null || vb === undefined) return spec.nullsFirst ? 1 : -1;
            const cmp = compareValues(va, vb);
            if (cmp !== 0) return spec.desc ? -cmp : cmp;
          }
          return 0;
        });
      }

      const projectedAll = rows
        .map((r) => projectRow(table, r, selectParam))
        .filter((res) => res.innerMatched && res.projected !== null)
        .map((res) => res.projected as DbRow);

      const totalCount = projectedAll.length;

      let start = Number(url.searchParams.get("offset") || "0");
      let limitVal = url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined;

      const rangeHeader = reqHeaders.get("range");
      if (rangeHeader && /^\d+-\d+$/.test(rangeHeader)) {
        const [rStart, rEnd] = rangeHeader.split("-").map(Number);
        start = rStart;
        limitVal = rEnd - rStart + 1;
      }

      const sliced =
        limitVal !== undefined
          ? projectedAll.slice(start, start + limitVal)
          : projectedAll.slice(start);

      const extraHeaders: Record<string, string> = {};
      if (wantsCount) {
        extraHeaders["content-range"] =
          sliced.length > 0
            ? `${start}-${start + sliced.length - 1}/${totalCount}`
            : `*/${totalCount}`;
      }

      if (method === "HEAD") {
        return new Response(null, { status: 200, headers: extraHeaders });
      }

      if (wantsSingleObject) {
        if (sliced.length === 0) {
          return jsonResponse(
            {
              code: "PGRST116",
              details: "The result contains 0 rows",
              hint: null,
              message: "JSON object requested, multiple (or no) rows returned",
            },
            406,
            extraHeaders
          );
        }
        if (sliced.length > 1) {
          return jsonResponse(
            {
              code: "PGRST116",
              details: `The result contains ${sliced.length} rows`,
              hint: null,
              message: "JSON object requested, multiple (or no) rows returned",
            },
            406,
            extraHeaders
          );
        }
        return jsonResponse(sliced[0], 200, extraHeaders);
      }

      return jsonResponse(sliced, 200, extraHeaders);
    }

    if (method === "POST") {
      const bodyStr = typeof init?.body === "string" ? init.body : "[]";
      const parsed = JSON.parse(bodyStr) as DbRow | DbRow[];
      const incoming = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of incoming) {
        const writeErr = validateStrictColumns(
          table,
          null,
          [],
          Object.keys(item)
        );
        if (writeErr) return writeErr;
      }
      const target = ensureTable(table);
      const isUpsertMerge = prefer.includes("resolution=merge-duplicates");
      const isUpsertIgnore = prefer.includes("resolution=ignore-duplicates");
      const onConflictCols = (url.searchParams.get("on_conflict") || "id")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const inserted: DbRow[] = [];
      for (const item of incoming) {
        const nowIso = new Date().toISOString();
        const row: DbRow = {
          ...cloneRow(item),
          id: item.id ?? crypto.randomUUID(),
          created_at: item.created_at ?? nowIso,
          updated_at: item.updated_at ?? nowIso,
        };

        const conflictIdx =
          isUpsertMerge || isUpsertIgnore
            ? target.findIndex((existing) =>
                onConflictCols.every(
                  (col) =>
                    row[col] !== undefined &&
                    String(existing[col] ?? "") === String(row[col] ?? "")
                )
              )
            : -1;

        if (conflictIdx >= 0) {
          if (isUpsertMerge) {
            const merged = {
              ...target[conflictIdx],
              ...cloneRow(item),
              updated_at: nowIso,
            };
            target[conflictIdx] = merged;
            inserted.push(cloneRow(merged));
          } else if (isUpsertIgnore) {
            // skipped
          }
        } else {
          target.push(row);
          inserted.push(cloneRow(row));
        }
      }

      const projected = inserted
        .map((r) => projectRow(table, r, selectParam).projected)
        .filter((r): r is DbRow => r !== null);

      if (wantsSingleObject) {
        if (projected.length === 1) return jsonResponse(projected[0], 201);
        return jsonResponse(
          {
            code: "PGRST116",
            details: `The result contains ${projected.length} rows`,
            message: "JSON object requested, multiple (or no) rows returned",
          },
          406
        );
      }

      return jsonResponse(projected, 201);
    }

    if (method === "PATCH") {
      const bodyStr = typeof init?.body === "string" ? init.body : "{}";
      const patch = JSON.parse(bodyStr) as DbRow;
      const writeErr = validateStrictColumns(
        table,
        null,
        [],
        Object.keys(patch)
      );
      if (writeErr) return writeErr;
      const target = ensureTable(table);
      const matched = applyFilters(target, url.searchParams);
      const updated: DbRow[] = [];
      const nowIso = new Date().toISOString();
      for (const row of matched) {
        Object.assign(row, cloneRow(patch), { updated_at: nowIso });
        updated.push(cloneRow(row));
      }

      const projected = updated
        .map((r) => projectRow(table, r, selectParam).projected)
        .filter((r): r is DbRow => r !== null);

      if (wantsSingleObject) {
        if (projected.length === 1) return jsonResponse(projected[0], 200);
        return jsonResponse(
          {
            code: "PGRST116",
            details: `The result contains ${projected.length} rows`,
            message: "JSON object requested, multiple (or no) rows returned",
          },
          406
        );
      }
      return jsonResponse(projected, 200);
    }

    if (method === "DELETE") {
      const target = ensureTable(table);
      const matched = new Set(applyFilters(target, url.searchParams));
      const deleted: DbRow[] = [];
      for (let i = target.length - 1; i >= 0; i--) {
        if (matched.has(target[i])) {
          deleted.push(cloneRow(target[i]));
          target.splice(i, 1);
        }
      }
      deleted.reverse();
      const projected = deleted
        .map((r) => projectRow(table, r, selectParam).projected)
        .filter((r): r is DbRow => r !== null);
      if (wantsSingleObject) {
        if (projected.length === 1) return jsonResponse(projected[0], 200);
        return jsonResponse(
          {
            code: "PGRST116",
            details: `The result contains ${projected.length} rows`,
            message: "JSON object requested, multiple (or no) rows returned",
          },
          406
        );
      }
      return jsonResponse(projected, 200);
    }

    return jsonResponse({ message: `Unsupported method ${method}` }, 405);
  }

  function handleAuthRequest(url: URL, init?: RequestInit): Response {
    const method = (init?.method || "GET").toUpperCase();
    const reqHeaders = new Headers(init?.headers || {});
    const authHeader = reqHeaders.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (url.pathname.endsWith("/auth/v1/user") && method === "GET") {
      const sess = activeTokens.get(bearer);
      if (!sess || sess.revoked) {
        return jsonResponse(
          { code: 401, error_code: "bad_jwt", msg: "Invalid or expired JWT" },
          401
        );
      }
      return jsonResponse(
        {
          id: sess.userId,
          aud: "authenticated",
          role: "authenticated",
          email: sess.email,
          phone: sess.phone,
          user_metadata: {
            full_name: sess.fullName,
            role: sess.role,
            madrasa_id: sess.madrasaId,
            session_id: sess.sessionId,
          },
          app_metadata: { provider: "email", providers: ["email"] },
          created_at: new Date().toISOString(),
        },
        200
      );
    }

    if (url.pathname.endsWith("/auth/v1/logout") && method === "POST") {
      const sess = activeTokens.get(bearer);
      if (sess) sess.revoked = true;
      return new Response(null, { status: 204 });
    }

    if (url.pathname.includes("/auth/v1/token") && method === "POST") {
      const sess = Array.from(activeTokens.values()).find((s) => !s.revoked);
      if (!sess) {
        return jsonResponse({ error: "invalid_grant", error_description: "Session revoked" }, 400);
      }
      return jsonResponse({
        access_token: sess.token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh_${sess.sessionId}`,
        user: {
          id: sess.userId,
          aud: "authenticated",
          role: "authenticated",
          email: sess.email,
          phone: sess.phone,
          user_metadata: { full_name: sess.fullName, role: sess.role, madrasa_id: sess.madrasaId },
        },
      });
    }

    return jsonResponse({ message: "Not found" }, 404);
  }

  async function interceptedFetch(
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl);
    const mergedInit: RequestInit =
      input instanceof Request
        ? {
            method: init?.method || input.method,
            headers: init?.headers || input.headers,
            body: init?.body ?? (input.body ? await input.clone().text() : undefined),
          }
        : init || {};

    if (url.origin === SUPABASE_TEST_URL) {
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fnName = decodeURIComponent(url.pathname.slice("/rest/v1/rpc/".length));
        const missingCode = missingRpcs.get(fnName);
        if (missingCode) {
          return jsonResponse(
            {
              code: missingCode,
              message: `Could not find the function public.${fnName} in the schema cache`,
            },
            404
          );
        }
        const handler = rpcs.get(fnName);
        if (!handler) {
          return jsonResponse(
            {
              code: "PGRST202",
              message: `Could not find the function public.${fnName} in the schema cache`,
            },
            404
          );
        }
        const hdrs = new Headers(mergedInit.headers || {});
        const bodyStr = typeof mergedInit.body === "string" ? mergedInit.body : "{}";
        const params = bodyStr ? (JSON.parse(bodyStr) as Record<string, unknown>) : {};
        const result = await handler(params, {
          authHeader: hdrs.get("authorization"),
          apiKey: hdrs.get("apikey"),
        });
        return jsonResponse(result, 200);
      }

      if (url.pathname.startsWith("/rest/v1/")) {
        return handleRestRequest(url, mergedInit);
      }
      if (url.pathname.startsWith("/auth/v1/")) {
        return handleAuthRequest(url, mergedInit);
      }
      return jsonResponse({ message: "Unknown Supabase path" }, 404);
    }

    // External HTTP interception (NEVER hits live network!)
    const hdrObj: Record<string, string> = {};
    const hdrs = new Headers(mergedInit.headers || {});
    hdrs.forEach((v, k) => {
      hdrObj[k.toLowerCase()] = v;
    });
    const bodyText =
      typeof mergedInit.body === "string"
        ? mergedInit.body
        : mergedInit.body
          ? String(mergedInit.body)
          : null;

    const record: RecordedHttpRequest = {
      url: rawUrl,
      method: (mergedInit.method || "GET").toUpperCase(),
      headers: hdrObj,
      body: bodyText,
      timestamp: new Date().toISOString(),
    };
    httpRequests.push(record);

    for (let i = httpStubs.length - 1; i >= 0; i--) {
      const stub = httpStubs[i];
      const matched =
        typeof stub.matcher === "string"
          ? rawUrl.includes(stub.matcher)
          : stub.matcher instanceof RegExp
            ? stub.matcher.test(rawUrl)
            : stub.matcher(record);
      if (matched) {
        return await stub.responder(record);
      }
    }

    return jsonResponse({ ok: true, stubbed: true }, 200);
  }

  globalThis.fetch = interceptedFetch as typeof globalThis.fetch;

  function asUser(user: AuthUserInput | FixtureUser): {
    accessToken: string;
    sessionId: string;
  } {
    const sessionId =
      ("sessionId" in user && user.sessionId) || crypto.randomUUID();
    const fullName = user.fullName || user.email;
    const phone = user.phone || "";

    // Ensure madrasa exists
    const madrasas = ensureTable("madrasas");
    let madrasaRow = madrasas.find((m) => m.id === user.madrasaId);
    if (!madrasaRow) {
      madrasaRow = {
        id: user.madrasaId,
        name: "Test Madrasa",
        currency: "BDT",
        weekend_days: ["Friday"],
        metadata: {},
        security_metadata: {},
      };
      madrasas.push(madrasaRow);
    }

    // Seed users row
    seed("users", {
      id: user.id,
      madrasa_id: user.madrasaId,
      role: user.role,
      full_name: fullName,
      email: user.email,
      phone,
    });

    // If user specifies status / custom roles / directPermissions / deniedPermissions, merge into security_metadata
    if (
      user.status ||
      user.roles ||
      user.directPermissions ||
      user.deniedPermissions
    ) {
      const secMeta =
        (madrasaRow.security_metadata as Record<string, unknown> | undefined) || {};
      const profiles =
        (secMeta.user_security_profiles as Record<string, unknown> | undefined) || {};
      profiles[user.id] = {
        userId: user.id,
        madrasaId: user.madrasaId,
        fullName,
        email: user.email,
        phone,
        primaryRole: user.role,
        roles: user.roles && user.roles.length > 0 ? user.roles : [user.role],
        status: user.status || "ACTIVE",
        directPermissions: user.directPermissions || [],
        deniedPermissions: user.deniedPermissions || [],
      };
      madrasaRow.security_metadata = {
        ...secMeta,
        user_security_profiles: profiles,
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const accessToken = makeFakeJwt({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      session_id: sessionId,
      iat: nowSec,
      exp: nowSec + 3600,
    });

    activeTokens.set(accessToken, {
      token: accessToken,
      userId: user.id,
      email: user.email,
      role: user.role,
      madrasaId: user.madrasaId,
      fullName,
      phone,
      sessionId,
      revoked: false,
    });
    currentAccessToken = accessToken;

    const sessionPayload = {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: nowSec + 3600,
      refresh_token: `refresh_${sessionId}`,
      user: {
        id: user.id,
        aud: "authenticated",
        role: "authenticated",
        email: user.email,
        phone,
        user_metadata: {
          full_name: fullName,
          role: user.role,
          madrasa_id: user.madrasaId,
          session_id: sessionId,
        },
      },
    };

    const encodedCookie =
      "base64-" +
      Buffer.from(JSON.stringify(sessionPayload), "utf8").toString("base64url");
    state.cookies.set("sb-supabase-auth-token", encodedCookie);

    return { accessToken, sessionId };
  }

  function asAnonymous(): void {
    currentAccessToken = null;
    state.cookies.delete("sb-supabase-auth-token");
    state.cookies.delete("qawmi_step_up_token");
    state.headers.delete("x-step-up-token");
    state.headers.delete("authorization");
  }

  function revokeToken(token: string): void {
    const sess = activeTokens.get(token);
    if (sess) sess.revoked = true;
  }

  function revokeUserSessions(userId: string): void {
    for (const sess of activeTokens.values()) {
      if (sess.userId === userId) sess.revoked = true;
    }
    const sessionRows = ensureTable("user_sessions");
    const nowIso = new Date().toISOString();
    for (const row of sessionRows) {
      if (row.user_id === userId) {
        row.is_active = false;
        row.revoked_at = nowIso;
      }
    }
  }

  function createRequest(
    pathOrUrl: string,
    opts?: CreateRequestOptions
  ): Request {
    const fullUrl = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `http://localhost:3000${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
    const method = (opts?.method || "GET").toUpperCase();
    const hdrs = new Headers();

    // Copy active state headers into request
    state.headers.forEach((v, k) => hdrs.set(k, v));

    if (opts?.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        hdrs.set(k, v);
        state.headers.set(k, v);
      }
    }

    if (opts?.cookies) {
      for (const [k, v] of Object.entries(opts.cookies)) {
        state.cookies.set(k, v);
      }
    }

    if (state.cookies.size > 0 && !hdrs.has("cookie")) {
      const cookieStr = Array.from(state.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      hdrs.set("cookie", cookieStr);
    }

    let body: string | undefined;
    if (opts?.body !== undefined && method !== "GET" && method !== "HEAD") {
      if (typeof opts.body === "string") {
        body = opts.body;
      } else {
        body = JSON.stringify(opts.body);
        if (!hdrs.has("content-type")) {
          hdrs.set("content-type", "application/json");
        }
      }
    }

    const req = new Request(fullUrl, { method, headers: hdrs, body });
    const parsedUrl = new URL(fullUrl);
    Object.defineProperty(req, "nextUrl", {
      value: parsedUrl,
      configurable: true,
    });
    Object.defineProperty(req, "cookies", {
      value: {
        get: (name: string) =>
          state.cookies.has(name)
            ? { name, value: state.cookies.get(name) as string }
            : undefined,
        getAll: () =>
          Array.from(state.cookies.entries()).map(([name, value]) => ({
            name,
            value,
          })),
        has: (name: string) => state.cookies.has(name),
      },
      configurable: true,
    });

    return req;
  }

  return {
    supabaseUrl: SUPABASE_TEST_URL,
    cronSecret: DEFAULT_CRON_SECRET,
    mobileApiKey: DEFAULT_MOBILE_API_KEY,
    db: {
      seed,
      getRows: (table: string, filter?: (row: DbRow) => boolean) => {
        const rows = ensureTable(table).map((r) => cloneRow(r));
        return filter ? rows.filter(filter) : rows;
      },
      clearTable: (table: string) => {
        tables.set(table, []);
      },
      markTableMissing: (table: string, code: "42P01" | "PGRST205" | false = "PGRST205") => {
        if (code === false) missingTables.delete(table);
        else missingTables.set(table, code);
      },
      registerRpc: (name: string, handler: RpcHandler) => {
        rpcs.set(name, handler);
      },
      markRpcMissing: (name: string, code: "42883" | "PGRST202" | false = "PGRST202") => {
        if (code === false) missingRpcs.delete(name);
        else missingRpcs.set(name, code);
      },
      setStrictSchema: (enabled: boolean) => {
        strictSchemaEnabled = enabled;
      },
    },
    auth: {
      asUser,
      asAnonymous,
      revokeToken,
      revokeUserSessions,
      getCurrentToken: () => currentAccessToken,
    },
    http: {
      requests: httpRequests,
      onRequest: (matcher: HttpMatcher, responder: HttpResponder) => {
        httpStubs.push({ matcher, responder });
      },
      reset: () => {
        httpRequests.length = 0;
        httpStubs.length = 0;
      },
    },
    revalidatedPaths: state.revalidatedPaths,
    revalidatedTags: state.revalidatedTags,
    setHeader: (name: string, value: string) => {
      state.headers.set(name, value);
    },
    setCookie: (name: string, value: string) => {
      state.cookies.set(name, value);
    },
    setIp: (ip: string) => {
      state.headers.set("x-forwarded-for", ip);
      state.headers.set("x-real-ip", ip);
    },
    setUserAgent: (ua: string) => {
      state.headers.set("user-agent", ua);
    },
    setStepUpToken: (token: string, via: "header" | "cookie" = "header") => {
      if (via === "cookie") {
        state.cookies.set("qawmi_step_up_token", token);
      } else {
        state.headers.set("x-step-up-token", token);
      }
    },
    setEnv: (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    },
    createRequest,
    flushAsync: async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    },
    dispose: () => {
      globalThis.fetch = originalFetch;
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete process.env[key];
      }
      for (const [key, val] of Object.entries(originalEnv)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
      (globalThis as Record<string, unknown>).__QAWMI_E2E_STATE__ = prevState;
    },
  };
}
