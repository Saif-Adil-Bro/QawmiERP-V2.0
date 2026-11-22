// A pending write is an overlay on the owner's last authoritative snapshot.
// It is never copied into another child's cache or treated as a server receipt.
import { khatamCycles, participantIds, type HifzBundle } from "../hifz-utils";
import {
  dailyRecord,
  parseInput,
  profileInput,
  results,
  sittingInput,
  specialInput,
  weeklyInput,
} from "./entries";
export function snapshotBundle(d: any): HifzBundle {
  return {
    hifz_logs: d.hifzLogs || [],
    hifz_profiles: d.hifzProfiles || [],
    hifz_weekly_sabina: d.hifzWeeklySabina || [],
    hifz_special_sabina: d.hifzSpecialSabina || [],
  };
}
export function projectDraft(
  b: HifzBundle,
  d: any,
  names: Record<string, string>,
): HifzBundle {
  const p = b.hifz_profiles.find((p) => p.student_id === d.student_id),
    t = b.hifz_profiles[0]?.madrasa_id || "";
  if (d.kind === "profile") {
    const v = parseInput(profileInput, d);
    if (!p) return b;
    return {
      ...b,
      hifz_profiles: b.hifz_profiles.map((r) => (r === p ? { ...p, ...v } : r)),
    };
  }
  if (d.kind === "weekly") {
    const v = parseInput(weeklyInput, d);
    if (!p) return b;
    const { detail, total } = results(v);
    const old = b.hifz_weekly_sabina.find(
      (r) => r.student_id === v.student_id && r.sabina_date === v.sabina_date,
    );
    return {
      ...b,
      hifz_weekly_sabina: [
        {
          ...v,
          id: old?.id || v.student_id + v.sabina_date,
          madrasa_id: t,
          listener_name: names[v.listener_student_id || ""],
          verified_by_teacher_id: null,
          assigned_para_from: v.para_from,
          assigned_para_to: v.para_to,
          para_breakdown: v.status === "completed" ? detail : [],
          total_mistakes: v.status === "completed" ? total : 0,
          total_paras_recited: v.status === "completed" ? detail.length : 0,
        },
        ...b.hifz_weekly_sabina.filter((r) => r !== old),
      ],
    };
  }
  if (d.kind === "special") {
    const v = parseInput(specialInput, d);
    if (
      b.hifz_special_sabina.some((e) => e.id === v.id) ||
      participantIds(v.participants).some((id) => !names[id])
    )
      return b;
    return {
      ...b,
      hifz_special_sabina: [
        {
          ...v,
          madrasa_id: t,
          revision: v.id,
          participants: {
            ...v.participants,
            names: Object.fromEntries(
              [
                ...participantIds(v.participants),
                ...v.participants.teacher_listener_ids,
              ].map((id) => [id, names[id]]),
            ),
          },
          session_logs: [],
          status: "ongoing",
        },
        ...b.hifz_special_sabina,
      ],
    };
  }
  if (d.kind === "finish" || d.kind === "sitting")
    return {
      ...b,
      hifz_special_sabina: b.hifz_special_sabina.map((e) => {
        if (e.id !== d.event_id) return e;
        if (d.kind === "finish") return { ...e, status: "completed" };
        const v = parseInput(sittingInput, d);
        if (e.session_logs.some((l) => l.id === v.id)) return e;
        const { detail, total } = results(v);
        return {
          ...e,
          session_logs: [
            ...e.session_logs,
            { ...v, para_wise_mistakes: detail, total_mistakes: total },
          ],
        };
      }),
    };
  let logs = b.hifz_logs;
  for (const r of d.records || []) {
    if (!names[r.student_id]) continue;
    const old = logs.find(
      (l) => l.student_id === r.student_id && l.log_date === d.current_date,
    );
    logs = [
      {
        ...old,
        ...dailyRecord(r, old || {}),
        madrasa_id: t,
        student_id: r.student_id,
        log_date: d.current_date,
      },
      ...logs.filter((l) => l !== old),
    ];
  }
  return {
    ...b,
    hifz_logs: logs,
    hifz_profiles: b.hifz_profiles.map((p) => ({
      ...p,
      ...khatamCycles(logs.filter((l) => l.student_id === p.student_id)),
    })),
  };
}
