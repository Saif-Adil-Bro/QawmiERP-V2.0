import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { writeGuard, type ModuleKey } from "@/lib/action-authorization";
import { assertActiveAccount } from "@/lib/permissions-server";

/**
 * API route-গুলোর জন্য কেন্দ্রীয় authorization helper।
 *
 * ⛔ কেন দরকার? Server Action-এ `writeGuard()` বসানো হলেও `app/api/**` route handler
 * আলাদা এন্ট্রি-পয়েন্ট — middleware শুধু লগইন আছে কি না দেখে, মডিউল-পারমিশন বা
 * টেন্যান্ট (মাদ্রাসা) মেলায় না। ফলে আগে যেকোনো লগইন করা অ্যাকাউন্ট (এমনকি
 * অভিভাবক/শিক্ষার্থী পোর্টালের) admin client দিয়ে অন্য মাদ্রাসার ডেটা লিখতে পারত।
 */

export interface ApiAuthContext {
  userId: string;
  madrasaId: string;
}

export type ApiAuthResult =
  | { ok: true; ctx: ApiAuthContext }
  | { ok: false; response: NextResponse };

/**
 * নির্দিষ্ট মডিউলের write-permission যাচাই করে।
 * ব্যর্থ হলে রেডি-made NextResponse (401/403) ফেরত দেয়।
 *
 * ব্যবহার:
 * ```ts
 * const auth = await authorizeApi("attendance");
 * if (!auth.ok) return auth.response;
 * const { madrasaId, userId } = auth.ctx;
 * ```
 */
export async function authorizeApi(module: ModuleKey): Promise<ApiAuthResult> {
  const authz = await writeGuard(module);

  if (!authz.allowed) {
    const status = authz.errorCode === "UNAUTHENTICATED" ? 401 : 403;
    return {
      ok: false,
      response: NextResponse.json(
        { error: authz.error, code: authz.errorCode || "FORBIDDEN" },
        { status }
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      userId: String(authz.userId || ""),
      madrasaId: String(authz.madrasaId || ""),
    },
  };
}

/**
 * শুধু super_admin (অথবা সঠিক `CRON_SECRET` bearer) — সর্ব-মাদ্রাসা মাইগ্রেশন/ব্যাকফিলের জন্য।
 *
 * `CRON_SECRET` না থাকলে শুধু লগইন-করা super_admin পারবে। টোকেন তুলনা constant-time।
 */
export async function authorizeSuperAdminOrCron(
  req: Request
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const expected = (process.env.CRON_SECRET || "").trim();
  const header = req.headers.get("authorization") || "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();

  if (expected && provided) {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    // length আলাদা হলে timingSafeEqual throw করে — আগে সেটি যাচাই
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true };
    }
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const admin = await createAdminClient();
    const { data: row } = await admin
      .from("users")
      .select("role, madrasa_id")
      .eq("id", user.id)
      .maybeSingle();

    const role = String((row as any)?.role || "").toLowerCase();
    const madrasaId = String((row as any)?.madrasa_id || "");
    if (!madrasaId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "No madrasa linked" }, { status: 403 }),
      };
    }

    // অ্যাকাউন্ট স্ট্যাটাস (SUSPENDED/DISABLED) সহ পূর্ণ পারমিশন কনটেক্সট যাচাই
    const active = await assertActiveAccount(user.id, madrasaId);
    if (!active.allowed) {
      return {
        ok: false,
        response: NextResponse.json({ error: active.error, code: "FORBIDDEN" }, { status: 403 }),
      };
    }

    const effectiveRoles = [
      String(active.context?.role || "").toLowerCase(),
      ...(active.context?.roles || []).map((r) => String(r).toLowerCase()),
    ];

    if (role !== "super_admin" && !effectiveRoles.includes("super_admin")) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "শুধুমাত্র super_admin এই অপারেশন চালাতে পারবেন।", code: "FORBIDDEN" },
          { status: 403 }
        ),
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authorization failed" }, { status: 500 }),
    };
  }
}

/**
 * ক্লায়েন্টের পাঠানো `student_id` গুলোর মধ্যে কোনগুলো সত্যিই বর্তমান মাদ্রাসার —
 * সেটি যাচাই করে। ফেরত `Set`-এ না থাকা আইডি মানেই cross-tenant অনুরোধ।
 */
export async function getOwnedStudentIds(
  studentIds: string[],
  madrasaId: string
): Promise<Set<string>> {
  const unique = Array.from(new Set(studentIds.filter(Boolean)));
  if (unique.length === 0) return new Set();

  const admin = await createAdminClient();
  const { data } = await admin
    .from("students")
    .select("id")
    .eq("madrasa_id", madrasaId)
    .in("id", unique);

  return new Set((data || []).map((row: any) => String(row.id)));
}
