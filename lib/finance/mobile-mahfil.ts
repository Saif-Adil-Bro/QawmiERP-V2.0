import type { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
  parsePagination,
} from "@/lib/mobile-api";
import { getMadrasaMetadata } from "@/lib/sessions";
import { collectionSnapshot, replaceSources } from "./funds";

// The generic metadata CRUD uses a different precedence for the two legacy stores and
// replaces entire documents. Only edit event headings here; accounting has its own RPC.
export async function mobileMahfil(req: NextRequest, id?: string) {
  const method = req.method;
  const auth = await authenticateMobileRequest(req, {
    module: "fundraising",
    requireWrite: method !== "GET",
    allowPortalRoles: false,
  });
  if (!auth.ok) return auth.response;
  try {
    const tenant = auth.ctx.madrasaId,
      meta = await getMadrasaMetadata(tenant, true);
    const events: any[] = meta.mahfils || [];
    const target = id ? events.find((m) => m.id === id) : undefined;
    if (id && !target) return mobileError("Event not found", 404, "NOT_FOUND");
    if (method === "GET") {
      if (target) return mobileSuccess(target, "Success", undefined, 200, req);
      const { page, limit, from, to, search } = parsePagination(req);
      const list = events.filter((m) =>
        `${m.title} ${m.venue} ${m.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
      return mobileSuccess(
        list.slice(from, to + 1),
        "Success",
        {
          page,
          limit,
          total: list.length,
          totalPages: Math.ceil(list.length / limit),
        },
        200,
        req,
      );
    }
    const before = collectionSnapshot(meta, "mahfils");
    if (method === "DELETE") {
      if (
        target.settlement ||
        target.settlements?.length ||
        target.transactions?.length ||
        target.receipt_books?.length
      )
        return mobileError(
          "An event with books cannot be deleted here",
          409,
          "EVENT_HAS_BOOKS",
        );
      meta.mahfils = events.filter((m) => m !== target);
      await replaceSources(tenant, before, meta);
      return mobileSuccess(
        { id, deleted: true },
        "Deleted successfully",
        undefined,
        200,
        req,
      );
    }
    const body = await req.json();
    const allowed = [
      "title",
      "year",
      "hijri_year",
      "start_date",
      "end_date",
      "venue",
      "president",
      "host",
      "target_budget",
      "status",
      "notes",
    ];
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).some((k) => !allowed.includes(k))
    )
      return mobileError(
        "Send event header fields only; use the settlement workflow for vouchers",
        400,
        "INVALID_EVENT_FIELDS",
      );
    if (!id && (typeof body.title !== "string" || !body.title.trim()))
      return mobileError("Title required", 400, "INVALID_TITLE");
    const now = new Date().toISOString();
    const event = {
      ...(target || {
        id: `mah_${crypto.randomUUID()}`,
        madrasa_id: tenant,
        created_at: now,
        receipt_books: [],
        transactions: [],
        speakers: [],
      }),
      ...body,
      updated_at: now,
    };
    meta.mahfils = target
      ? events.map((m) => (m === target ? event : m))
      : [event, ...events];
    await replaceSources(tenant, before, meta);
    return mobileSuccess(event, "Saved", undefined, target ? 200 : 201, req);
  } catch (e: any) {
    return mobileError(e.message, 400, "EVENT_ERROR");
  }
}
