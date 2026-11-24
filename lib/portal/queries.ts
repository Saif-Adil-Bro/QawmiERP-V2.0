import { parseRoutineItem } from "../routine-helper";

// A complete snapshot must not silently stop at PostgREST's max_rows, or turn an error into [].
export async function rows(
  query: () => any,
  optionalTable = false,
  orderKey = "id",
): Promise<any[]> {
  const out: any[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await query()
      .order(orderKey)
      .range(start, start + 499);
    if (optionalTable && ["42P01", "PGRST205"].includes(error?.code) && !start)
      return [];
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 500) return out;
  }
}
export async function notices(
  db: any,
  tenant: string,
  audience: "Students" | "Teachers",
  classIds: string[],
  holidays: { id: string }[],
) {
  const visible = new Set(holidays.map((h) => h.id));
  const list = await rows(() => {
    const q = db
      .from("notices")
      .select("*")
      .eq("madrasa_id", tenant)
      .eq("is_active", true)
      .in("target_audience", ["All", audience])
      .order("created_at", { ascending: false });
    return classIds.length
      ? q.or(`class_id.is.null,class_id.in.(${classIds.join(",")})`)
      : q.is("class_id", null);
  });
  return list.filter((n) => {
    const ref = n.content?.match(/\[HOLIDAY_REF:([^\]]+)\]/)?.[1];
    return !ref || visible.has(ref);
  });
}
export async function routines(
  db: any,
  tenant: string,
  classIds: string[],
  teacherId?: string,
) {
  if (!classIds.length) return [];
  const data = await rows(() => {
    const q = db
      .from("routines")
      .select(
        "*, classes(id,name), subjects(id,name), teachers(id,first_name,last_name)",
      )
      .eq("madrasa_id", tenant)
      .in("class_id", classIds)
      .order("start_time");
    return teacherId ? q.eq("teacher_id", teacherId) : q;
  });
  return data.map((r) => {
    const item = parseRoutineItem(r);
    return {
      ...item,
      class_name: r.classes?.name,
      subject_name: r.subjects?.name || item.display_title,
    };
  });
}
export async function childLogs(
  db: any,
  tenant: string,
  table: "attendance" | "hifz_logs" | "kitab_logs",
  ids: string[],
  date?: string,
) {
  if (!ids.length) return Promise.resolve([] as any[]);
  const key = table === "attendance" ? "date" : "log_date";
  const logs: any[] = [];
  for (let pos = 0; pos < ids.length; pos += 80)
    logs.push(
      ...(await rows(() => {
        const q = db
          .from(table)
          .select(
            table === "attendance" ? "*" : "*, teachers(first_name,last_name)",
          )
          .eq("madrasa_id", tenant)
          .in("student_id", ids.slice(pos, pos + 80))
          .order(key, { ascending: false });
        return date ? q.eq(key, date) : q;
      })),
    );
  return logs.sort(
    (a, b) =>
      String(b[key]).localeCompare(String(a[key])) ||
      String(a.id).localeCompare(String(b.id)),
  );
}
