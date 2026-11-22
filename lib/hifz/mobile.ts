import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
  parsePagination,
} from "../mobile-api";
import { staffScope } from "./access";
import { readHifz } from "./read";
import { EntryError } from "./entries";
import { writeHifz, removeDaily, findDaily } from "./write";
import { hasRole } from "../portal/identity";
import { teacherRoles, studentRoles } from "../portal/rules";
import { dailyFields, participantIds } from "../hifz-utils";
import { toDhakaDateString } from "../date-utils";
/** Generic staff mobile CRUD, not the personal portal endpoints. Preserve the
 * daily list/item envelope; optional kind uses the same validators as teachers. */
export async function mobileHifz(req: NextRequest, id?: string) {
  const auth = await authenticateMobileRequest(req, {
    module: "hifz",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;
  try {
    const a = auth.ctx;
    if (
      !a.permCtx ||
      a.permCtx.status !== "ACTIVE" ||
      a.userRow.madrasa_id !== a.madrasaId
    )
      throw new EntryError("অনুমতি নেই।", 403);
    const identity = {
      db: auth.adminClient,
      tenant: a.madrasaId,
      user: a.user,
      userRow: a.userRow,
      perms: a.permCtx,
    };
    if (hasRole(identity, [...teacherRoles, ...studentRoles]))
      throw new EntryError("পোর্টালের নির্দিষ্ট API ব্যবহার করুন।", 403);
    const kind = req.nextUrl.searchParams.get("kind") || "daily";
    if (req.method === "GET") {
      const { page, limit, from, to, searchParams } = parsePagination(req);
      const child = searchParams.get("student_id");
      if (kind === "daily") {
        let q = identity.db
          .from("hifz_logs")
          .select("*, students(id,first_name,last_name,roll_number)", {
            count: "exact",
          })
          .eq("madrasa_id", identity.tenant);
        if (id) q = q.eq("id", id);
        if (child) q = q.eq("student_id", child);
        const date = searchParams.get("log_date") || searchParams.get("date");
        if (date) q = q.eq("log_date", date);
        const { data, error, count } = await q
          .order("log_date", { ascending: false })
          .order("id")
          .range(from, to);
        if (error) throw error;
        const list = data.map((l: any) => ({ ...l, ...dailyFields(l) }));
        if (id && !list.length) throw new EntryError("লগ পাওয়া যায়নি।", 404);
        return mobileSuccess(
          id ? list[0] : list,
          "Success",
          { page, limit, total: count, totalPages: Math.ceil(count / limit) },
          200,
          req,
        );
      }
      const c = await staffScope(identity);
      const bundle = await readHifz(c.db, c.tenant, c.roster, c.legacy);
      const list =
        kind === "profile"
          ? bundle.hifz_profiles
          : kind === "weekly"
            ? bundle.hifz_weekly_sabina
            : kind === "special"
              ? bundle.hifz_special_sabina
              : null;
      if (!list) throw new EntryError("অজানা ধরন।");
      const filtered = list.filter(
        (r: any) =>
          (!child ||
            r.student_id === child ||
            (kind === "special" &&
              participantIds(r.participants).includes(child))) &&
          (!id || (r.id || r.student_id) === id),
      );
      if (id && !filtered.length) throw new EntryError("নথি পাওয়া যায়নি।", 404);
      return mobileSuccess(
        id ? filtered[0] : filtered.slice(from, to + 1),
        "Success",
        {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
        200,
        req,
      );
    }
    const c = await staffScope(identity);
    if (id && kind !== "daily")
      throw new EntryError("সবিনা পরিবর্তনে সংশ্লিষ্ট এন্ট্রি পাঠান।");
    if (req.method === "DELETE" && id) {
      await removeDaily(c, id);
      return mobileSuccess({ id });
    }
    const input = await req.json();
    const old = id ? await findDaily(c, id) : null;
    const mutation = id ? "daily" : input.kind || kind;
    if (id && input.student_id && input.student_id !== old.student_id)
      throw new EntryError("শিক্ষার্থীর পরিচয় পরিবর্তন করা যাবে না।");
    const data = await writeHifz(
      c,
      mutation === "daily"
        ? {
            current_date:
              input.log_date || old?.log_date || toDhakaDateString(),
            records: [
              { ...input, student_id: old?.student_id || input.student_id },
            ],
          }
        : { ...input, kind: mutation },
      { editId: id, insertOnly: !id },
    );
    return mobileSuccess(
      Array.isArray(data) ? data[0] : data,
      "সংরক্ষিত",
      undefined,
      id ? 200 : 201,
      req,
    );
  } catch (e) {
    return mobileError(
      e instanceof EntryError ? e.message : "হিফজ নথি সংরক্ষণ বা পড়া যায়নি।",
      e instanceof EntryError ? e.status : 500,
      "HIFZ_ERROR",
    );
  }
}
