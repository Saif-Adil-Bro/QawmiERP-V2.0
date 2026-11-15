import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertActiveAccount, type ServerPermissionContext } from "@/lib/permissions-server";
import { MODULE_POLICIES, type ModuleKey } from "@/lib/action-authorization";
import { readJsonStore, writeJsonStore } from "@/lib/madrasa-store";

export interface MobileMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface MobileAuthContext {
  userId: string;
  email: string;
  madrasaId: string;
  role: string;
  roles: string[];
  permissions: string[];
  isPortalUser: boolean;
  user: any;
  userRow: any;
  permCtx: ServerPermissionContext | null;
}

const PORTAL_ROLES = new Set(["student", "parent", "guardian"]);

const MEDIA_KEYS = new Set([
  "avatar",
  "avatar_url",
  "photo",
  "photo_url",
  "image",
  "image_url",
  "logo",
  "logo_url",
  "signature",
  "signature_url",
  "attachment",
  "attachment_url",
  "file_url",
  "thumbnail",
  "thumbnail_url",
  "cover_url",
  "qr_url",
  "url",
]);

/**
 * Resolves the public base URL for converting relative paths into full absolute URLs.
 */
export function getBaseUrl(req?: NextRequest | Request): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl;
  }
  if (req) {
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (req.headers.get("host")?.includes("localhost") ? "http" : "https");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return "http://localhost:3000";
}

/**
 * Converts a relative URL (e.g., `/uploads/pic.jpg`) into an absolute URL.
 * Leaves already-absolute URLs (`http://`, `https://`, `data:`) untouched.
 */
export function resolveAbsoluteUrl(
  value: string | null | undefined,
  req?: NextRequest | Request
): string | null {
  if (!value || typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  const base = getBaseUrl(req);
  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }
  return `${base}/${trimmed}`;
}

/**
 * Recursively resolves relative media URLs in objects and arrays.
 */
export function deepResolveMediaUrls<T>(input: T, req?: NextRequest | Request): T {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((item) => deepResolveMediaUrls(item, req)) as unknown as T;
  }
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(input as Record<string, any>)) {
    if (typeof val === "string" && MEDIA_KEYS.has(key.toLowerCase())) {
      out[key] = resolveAbsoluteUrl(val, req);
    } else if (val && typeof val === "object") {
      out[key] = deepResolveMediaUrls(val, req);
    } else {
      out[key] = val;
    }
  }
  return out as T;
}

/**
 * Standardized success JSON envelope for Android Retrofit clients.
 */
export function mobileSuccess<T>(
  data: T,
  message = "Success",
  meta?: MobileMeta,
  status = 200,
  req?: NextRequest | Request
): NextResponse {
  const resolvedData = req ? deepResolveMediaUrls(data, req) : data;
  const payload: Record<string, any> = {
    success: true,
    data: resolvedData,
    message,
  };
  if (meta) {
    payload.meta = meta;
  }
  return NextResponse.json(payload, { status });
}

/**
 * Standardized error JSON envelope for Android Retrofit clients.
 */
export function mobileError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: unknown
): NextResponse {
  const payload: Record<string, any> = {
    success: false,
    data: null,
    message,
    code,
  };
  if (details !== undefined) {
    payload.details = details;
  }
  return NextResponse.json(payload, { status });
}

/**
 * Validates `x-api-key` header against `process.env.MOBILE_API_KEY`.
 * Uses constant-time comparison. If `MOBILE_API_KEY` is not configured in env,
 * allows local development while still enforcing when configured.
 */
export function verifyMobileApiKey(req: NextRequest | Request): boolean {
  const expected = (process.env.MOBILE_API_KEY || "").trim();
  if (!expected) {
    return true;
  }
  const provided = (req.headers.get("x-api-key") || "").trim();
  if (!provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Creates a stateless Supabase client using the anon key for verifying/signing Bearer tokens.
 */
export function createStatelessSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL or Anon Key is not configured.");
  }
  return createSupabaseJsClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Extracts `Authorization: Bearer <token>` from request headers.
 */
export function extractBearerToken(req: NextRequest | Request): string | null {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export interface MobileAuthOptions {
  module?: ModuleKey;
  requireWrite?: boolean;
  allowPortalRoles?: boolean;
}

/**
 * Authenticates a mobile API request via `x-api-key` + `Authorization: Bearer <jwt>`.
 * Resolves tenant `madrasaId`, role, permissions, and account status.
 */
export async function authenticateMobileRequest(
  req: NextRequest | Request,
  options: MobileAuthOptions = {}
): Promise<
  | { ok: true; ctx: MobileAuthContext; adminClient: any }
  | { ok: false; response: NextResponse }
> {
  if (!verifyMobileApiKey(req)) {
    return {
      ok: false,
      response: mobileError(
        "অবৈধ বা অনুপস্থিত API Key (x-api-key)।",
        401,
        "INVALID_API_KEY"
      ),
    };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: mobileError(
        "অননুমোদিত অ্যাক্সেস। Authorization: Bearer <token> আবশ্যক।",
        401,
        "MISSING_BEARER_TOKEN"
      ),
    };
  }

  try {
    const supabase = createStatelessSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return {
        ok: false,
        response: mobileError(
          "টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ হয়েছে। পুনরায় লগইন করুন।",
          401,
          "INVALID_TOKEN"
        ),
      };
    }

    const user = userData.user;
    const adminClient = await createAdminClient();

    const { data: userRow } = await adminClient
      .from("users")
      .select("*, madrasas(id, name, address, contact_phone, contact_email, logo_url)")
      .eq("id", user.id)
      .maybeSingle();

    const madrasaId = String(
      (userRow as any)?.madrasa_id || user.user_metadata?.madrasa_id || ""
    );

    if (!madrasaId) {
      return {
        ok: false,
        response: mobileError(
          "আপনার অ্যাকাউন্টের সাথে কোনো মাদ্রাসা সংযুক্ত নেই।",
          403,
          "NO_MADRASA_LINKED"
        ),
      };
    }

    const activeCheck = await assertActiveAccount(user.id, madrasaId);
    if (!activeCheck.allowed) {
      return {
        ok: false,
        response: mobileError(
          activeCheck.error || "অ্যাকাউন্ট সক্রিয় নয়।",
          403,
          "ACCOUNT_INACTIVE"
        ),
      };
    }

    const permCtx = activeCheck.context || null;
    const primaryRole = String(
      permCtx?.role || (userRow as any)?.role || user.user_metadata?.role || "staff"
    ).toLowerCase();
    const roles = (
      permCtx?.roles && permCtx.roles.length > 0 ? permCtx.roles : [primaryRole]
    ).map((r) => String(r).toLowerCase());

    const isPortalUser =
      PORTAL_ROLES.has(primaryRole) &&
      !roles.some((r) => !PORTAL_ROLES.has(r));

    const permissions = permCtx?.summary?.effectivePermissions || [];

    // If write operation is requested, enforce portal block & module policy
    if (options.requireWrite) {
      if (isPortalUser && !options.allowPortalRoles) {
        return {
          ok: false,
          response: mobileError(
            "শিক্ষার্থী/অভিভাবক পোর্টাল থেকে এই পরিবর্তন করার অনুমতি নেই।",
            403,
            "PORTAL_WRITE_FORBIDDEN"
          ),
        };
      }

      if (options.module) {
        const policy = MODULE_POLICIES[options.module];
        const isSuperAdmin =
          primaryRole === "super_admin" || roles.includes("super_admin");
        if (policy && !isSuperAdmin) {
          const hasRole =
            policy.roles?.some((r) => roles.includes(r.toLowerCase())) ?? false;
          const hasPerm =
            policy.permissions?.some((p) => permissions.includes(p)) ?? false;
          if (!hasRole && !hasPerm) {
            return {
              ok: false,
              response: mobileError(
                policy.errorMessage || "এই মডিউলে আপনার প্রয়োজনীয় অনুমতি নেই।",
                403,
                "PERMISSION_DENIED"
              ),
            };
          }
        }
      }
    }

    return {
      ok: true,
      adminClient,
      ctx: {
        userId: user.id,
        email: user.email || (userRow as any)?.email || "",
        madrasaId,
        role: primaryRole,
        roles,
        permissions,
        isPortalUser,
        user,
        userRow,
        permCtx,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      response: mobileError(
        err?.message || "অথেনটিকেশন যাচাই করতে সার্ভার ত্রুটি হয়েছে।",
        500,
        "AUTH_ERROR"
      ),
    };
  }
}

/**
 * Parses standard pagination, search, and sorting query parameters.
 */
export function parsePagination(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
  );
  const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
  const sortBy = (searchParams.get("sortBy") || "created_at").trim();
  const sortOrder =
    (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc"
      ? true
      : false;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, search, sortBy, ascending: sortOrder, from, to, searchParams };
}

export interface TableCrudConfig {
  table: string;
  module: ModuleKey;
  select?: string;
  detailSelect?: string;
  searchColumns?: string[];
  filterColumns?: string[];
  defaultSort?: string;
  tenantColumn?: string;
  requiredFields?: string[];
  allowPortalRead?: boolean;
}

/**
 * Generates standardized GET (list) and POST (create) handlers for any Supabase table.
 */
export function createMobileTableHandlers(config: TableCrudConfig) {
  const tenantCol = config.tenantColumn ?? "madrasa_id";

  async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: false,
      allowPortalRoles: config.allowPortalRead ?? true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { page, limit, search, sortBy, ascending, from, to, searchParams } =
        parsePagination(req);

      let query = auth.adminClient
        .from(config.table)
        .select(config.select || "*", { count: "exact" });

      if (tenantCol) {
        query = query.eq(tenantCol, auth.ctx.madrasaId);
      }

      if (search && config.searchColumns && config.searchColumns.length > 0) {
        const orExpr = config.searchColumns
          .map((col) => `${col}.ilike.%${search}%`)
          .join(",");
        query = query.or(orExpr);
      }

      if (config.filterColumns) {
        for (const col of config.filterColumns) {
          const val = searchParams.get(col);
          if (val !== null && val !== "") {
            query = query.eq(col, val);
          }
        }
      }

      const orderCol = sortBy || config.defaultSort || "created_at";
      query = query.order(orderCol, { ascending }).range(from, to);

      const { data, count, error } = await query;
      if (error) {
        return mobileError(error.message, 400, "DB_QUERY_ERROR");
      }

      const total = count ?? (data?.length || 0);
      return mobileSuccess(
        data || [],
        "Success",
        {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        200,
        req
      );
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const body = await req.json();
      if (!body || typeof body !== "object") {
        return mobileError("Invalid JSON request body", 400, "INVALID_BODY");
      }

      if (config.requiredFields) {
        for (const field of config.requiredFields) {
          if (
            body[field] === undefined ||
            body[field] === null ||
            String(body[field]).trim() === ""
          ) {
            return mobileError(
              `প্রয়োজনীয় ফিল্ড অনুপস্থিত: ${field}`,
              400,
              "VALIDATION_ERROR"
            );
          }
        }
      }

      const insertPayload: Record<string, any> = { ...body };
      delete insertPayload.id;
      if (tenantCol) {
        insertPayload[tenantCol] = auth.ctx.madrasaId;
      }

      const { data, error } = await auth.adminClient
        .from(config.table)
        .insert(insertPayload)
        .select(config.detailSelect || config.select || "*")
        .single();

      if (error) {
        return mobileError(error.message, 400, "DB_INSERT_ERROR");
      }

      return mobileSuccess(data, "Created successfully", undefined, 201, req);
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  return { GET, POST };
}

/**
 * Generates standardized GET, PATCH, PUT, DELETE handlers for `/api/mobile/<entity>/[id]`.
 */
export function createMobileTableItemHandlers(config: TableCrudConfig) {
  const tenantCol = config.tenantColumn ?? "madrasa_id";

  async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: false,
      allowPortalRoles: config.allowPortalRead ?? true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { id } = await context.params;
      let query = auth.adminClient
        .from(config.table)
        .select(config.detailSelect || config.select || "*")
        .eq("id", id);

      if (tenantCol) {
        query = query.eq(tenantCol, auth.ctx.madrasaId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) return mobileError(error.message, 400, "DB_QUERY_ERROR");
      if (!data) return mobileError("রেকর্ড খুঁজে পাওয়া যায়নি।", 404, "NOT_FOUND");

      return mobileSuccess(data, "Success", undefined, 200, req);
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  async function updateHandler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { id } = await context.params;
      const body = await req.json();
      if (!body || typeof body !== "object") {
        return mobileError("Invalid JSON request body", 400, "INVALID_BODY");
      }

      const updatePayload: Record<string, any> = { ...body };
      delete updatePayload.id;
      if (tenantCol) delete updatePayload[tenantCol];

      let query = auth.adminClient
        .from(config.table)
        .update(updatePayload)
        .eq("id", id);

      if (tenantCol) {
        query = query.eq(tenantCol, auth.ctx.madrasaId);
      }

      const { data, error } = await query
        .select(config.detailSelect || config.select || "*")
        .maybeSingle();

      if (error) return mobileError(error.message, 400, "DB_UPDATE_ERROR");
      if (!data) return mobileError("রেকর্ড খুঁজে পাওয়া যায়নি।", 404, "NOT_FOUND");

      return mobileSuccess(data, "Updated successfully", undefined, 200, req);
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { id } = await context.params;
      let query = auth.adminClient.from(config.table).delete().eq("id", id);

      if (tenantCol) {
        query = query.eq(tenantCol, auth.ctx.madrasaId);
      }

      const { data, error } = await query.select("id").maybeSingle();
      if (error) return mobileError(error.message, 400, "DB_DELETE_ERROR");
      if (!data) return mobileError("রেকর্ড খুঁজে পাওয়া যায়নি।", 404, "NOT_FOUND");

      return mobileSuccess({ id: data.id, deleted: true }, "Deleted successfully");
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  return { GET, PATCH: updateHandler, PUT: updateHandler, DELETE };
}

export interface MetadataListConfig {
  storeKey: string;
  storeKind?: "meta" | "security";
  module: ModuleKey;
  idPrefix?: string;
  searchFields?: string[];
  requiredFields?: string[];
}

/**
 * Generates GET (paginated) and POST handlers for array-based modules stored in madrasas.metadata.
 */
export function createMobileMetadataHandlers(config: MetadataListConfig) {
  const kind = config.storeKind || "meta";

  async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: false,
      allowPortalRoles: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { page, limit, search } = parsePagination(req);
      const store = await readJsonStore(auth.ctx.madrasaId, kind);
      let items: any[] = Array.isArray(store[config.storeKey])
        ? store[config.storeKey]
        : [];

      if (search && config.searchFields && config.searchFields.length > 0) {
        const lower = search.toLowerCase();
        items = items.filter((item) =>
          config.searchFields!.some((field) =>
            String(item?.[field] || "").toLowerCase().includes(lower)
          )
        );
      }

      const total = items.length;
      const start = (page - 1) * limit;
      const paged = items.slice(start, start + limit);

      return mobileSuccess(
        paged,
        "Success",
        {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        200,
        req
      );
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const body = await req.json();
      if (!body || typeof body !== "object") {
        return mobileError("Invalid JSON request body", 400, "INVALID_BODY");
      }

      if (config.requiredFields) {
        for (const field of config.requiredFields) {
          if (!body[field] || String(body[field]).trim() === "") {
            return mobileError(
              `প্রয়োজনীয় ফিল্ড অনুপস্থিত: ${field}`,
              400,
              "VALIDATION_ERROR"
            );
          }
        }
      }

      const store = await readJsonStore(auth.ctx.madrasaId, kind);
      const items: any[] = Array.isArray(store[config.storeKey])
        ? store[config.storeKey]
        : [];

      const newItem = {
        id:
          body.id ||
          `${config.idPrefix || config.storeKey}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`,
        ...body,
        madrasa_id: auth.ctx.madrasaId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      store[config.storeKey] = [newItem, ...items];
      await writeJsonStore(auth.ctx.madrasaId, kind, store);

      return mobileSuccess(newItem, "Created successfully", undefined, 201, req);
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  return { GET, POST };
}

/**
 * Generates GET, PATCH, PUT, DELETE handlers for a single item in a madrasas.metadata array.
 */
export function createMobileMetadataItemHandlers(config: MetadataListConfig) {
  const kind = config.storeKind || "meta";

  async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: false,
      allowPortalRoles: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { id } = await context.params;
      const store = await readJsonStore(auth.ctx.madrasaId, kind);
      const items: any[] = Array.isArray(store[config.storeKey])
        ? store[config.storeKey]
        : [];
      const found = items.find((i) => String(i?.id) === String(id));
      if (!found) return mobileError("রেকর্ড খুঁজে পাওয়া যায়নি।", 404, "NOT_FOUND");
      return mobileSuccess(found, "Success", undefined, 200, req);
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  async function updateHandler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { id } = await context.params;
      const body = await req.json();
      const store = await readJsonStore(auth.ctx.madrasaId, kind);
      const items: any[] = Array.isArray(store[config.storeKey])
        ? store[config.storeKey]
        : [];
      const idx = items.findIndex((i) => String(i?.id) === String(id));
      if (idx === -1) return mobileError("রেকর্ড খুঁজে পাওয়া যায়নি।", 404, "NOT_FOUND");

      const updated = {
        ...items[idx],
        ...body,
        id: items[idx].id,
        updated_at: new Date().toISOString(),
      };
      items[idx] = updated;
      store[config.storeKey] = items;
      await writeJsonStore(auth.ctx.madrasaId, kind, store);

      return mobileSuccess(updated, "Updated successfully", undefined, 200, req);
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const auth = await authenticateMobileRequest(req, {
      module: config.module,
      requireWrite: true,
    });
    if (!auth.ok) return auth.response;

    try {
      const { id } = await context.params;
      const store = await readJsonStore(auth.ctx.madrasaId, kind);
      const items: any[] = Array.isArray(store[config.storeKey])
        ? store[config.storeKey]
        : [];
      const idx = items.findIndex((i) => String(i?.id) === String(id));
      if (idx === -1) return mobileError("রেকর্ড খুঁজে পাওয়া যায়নি।", 404, "NOT_FOUND");

      items.splice(idx, 1);
      store[config.storeKey] = items;
      await writeJsonStore(auth.ctx.madrasaId, kind, store);

      return mobileSuccess({ id, deleted: true }, "Deleted successfully");
    } catch (err: any) {
      return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
    }
  }

  return { GET, PATCH: updateHandler, PUT: updateHandler, DELETE };
}
