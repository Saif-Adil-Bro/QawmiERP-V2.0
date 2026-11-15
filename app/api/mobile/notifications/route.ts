import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess, parsePagination } from "@/lib/mobile-api";
import { readJsonStore, writeJsonStore } from "@/lib/madrasa-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  const { page, limit } = parsePagination(req);
  const store = await readJsonStore(auth.ctx.madrasaId, "meta");
  const allNotifs: any[] = Array.isArray(store.system_notifications)
    ? store.system_notifications
    : [];
  const readIds = new Set<string>(
    Array.isArray(store.notification_read_ids?.[auth.ctx.userId])
      ? store.notification_read_ids[auth.ctx.userId]
      : []
  );

  const enriched = allNotifs.map((n) => ({
    ...n,
    is_read: readIds.has(String(n.id)) || Boolean(n.is_read),
  }));

  const total = enriched.length;
  const start = (page - 1) * limit;
  const paged = enriched.slice(start, start + limit);
  const unreadCount = enriched.filter((n) => !n.is_read).length;

  return mobileSuccess(
    paged,
    "Success",
    { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), unread_count: unreadCount },
    200,
    req
  );
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const store = await readJsonStore(auth.ctx.madrasaId, "meta");
    if (!store.notification_read_ids) store.notification_read_ids = {};
    const current: string[] = Array.isArray(store.notification_read_ids[auth.ctx.userId])
      ? store.notification_read_ids[auth.ctx.userId]
      : [];

    if (body.mark_all) {
      const allIds = (store.system_notifications || []).map((n: any) => String(n.id));
      store.notification_read_ids[auth.ctx.userId] = Array.from(new Set([...current, ...allIds]));
    } else if (body.notification_id) {
      store.notification_read_ids[auth.ctx.userId] = Array.from(
        new Set([...current, String(body.notification_id)])
      );
    } else {
      return mobileError("notification_id বা mark_all: true আবশ্যক।", 400, "VALIDATION_ERROR");
    }

    await writeJsonStore(auth.ctx.madrasaId, "meta", store);
    return mobileSuccess({ updated: true }, "নোটিফিকেশন আপডেট হয়েছে।");
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
