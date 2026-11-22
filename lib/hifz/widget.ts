import { type Identity, hasRole } from "../portal/identity";
import { studentRoles, teacherRoles } from "../portal/rules";
import { MODULE_POLICIES } from "../action-authorization";
import { rows } from "../portal/queries";
import { getMadrasaMetadata } from "../sessions";
import { toDhakaDateString } from "../date-utils";
import { emptyProfile, khatamCycles, participantIds } from "../hifz-utils";
import { schemaMissing, storedRows } from "./storage";
import { isHifzStudent, summarizeHifz } from "./read";
/** Dashboard already has a verified staff identity. Start independent reads at once;
 * don't fetch per-student reports, lesson notes or teacher joins for a KPI card. */
export async function dashboardHifzSummary(i: Identity) {
  const policy = MODULE_POLICIES.hifz;
  if (
    hasRole(i, [...studentRoles, ...teacherRoles]) ||
    !(
      hasRole(i, policy.roles || []) ||
      policy.permissions?.some((p) =>
        i.perms.summary.effectivePermissions.includes(p),
      )
    )
  )
    return null;
  const { db, tenant } = i,
    today = toDhakaDateString();
  async function facts() {
    const list: any[] = [];
    let legacy = false;
    for (let n = 0; ; n += 500) {
      const q = legacy
        ? db
            .from("hifz_logs")
            .select("student_id,log_date,notes")
            .eq("madrasa_id", tenant)
            .order("id")
        : db
            .rpc("hifz_log_activity", { p_tenant: tenant, p_date: today })
            .order("student_id");
      const { data, error } = await q.range(n, n + 499);
      if (
        !n &&
        !legacy &&
        (schemaMissing(error) || ["PGRST202", "42883"].includes(error?.code))
      ) {
        legacy = true;
        n = -500;
        continue;
      }
      if (error) throw error;
      list.push(
        ...(legacy
          ? data
          : data.map((r: any) => ({
              student_id: r.student_id,
              log_date: r.entered_today ? today : null,
            }))),
      );
      if (data.length < 500) return { list, legacy };
    }
  }
  const [students, profiles, weekly, special, meta, { list, legacy }] =
    await Promise.all([
      rows(() =>
        db
          .from("students")
          .select("id,class_name,classes(name)")
          .eq("madrasa_id", tenant),
      ),
      storedRows(db, tenant, "profile"),
      storedRows(
        db,
        tenant,
        "weekly",
        undefined,
        "id,student_id,sabina_date,para_breakdown,status",
      ),
      storedRows(
        db,
        tenant,
        "special",
        undefined,
        "id,title,status,participants",
      ),
      getMadrasaMetadata(tenant, true),
      facts(),
    ]);
  const enrolled = new Set([
    ...list.map((l) => l.student_id),
    ...weekly.map((w) => w.student_id),
    ...special.flatMap((e) => participantIds(e.participants)),
  ]);
  const byId = new Map(profiles.map((p) => [p.student_id, p]));
  const fallback = new Map<string, any[]>();
  if (legacy)
    for (const l of list) {
      const a = fallback.get(l.student_id) || [];
      a.push(l);
      fallback.set(l.student_id, a);
    }
  return summarizeHifz(
    {
      hifz_logs: list,
      hifz_profiles: students.map((s) => ({
        ...emptyProfile(s.id, tenant),
        ...byId.get(s.id),
        tracked:
          byId.has(s.id) ||
          enrolled.has(s.id) ||
          isHifzStudent(s, meta.student_profiles?.[s.id]),
        ...(legacy ? khatamCycles(fallback.get(s.id) || []) : {}),
      })),
      hifz_weekly_sabina: weekly,
      hifz_special_sabina: special,
    },
    today,
  );
}
