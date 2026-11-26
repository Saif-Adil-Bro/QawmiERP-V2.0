import { describe, it, expect } from "vitest";
import {
  fetchCanonicalAuditLogsAndCount as read,
  type SystemAuditLogRecord,
} from "@/lib/audit-log";

// The mounted tests exercise real policies and both KPI screens. This fake
// transport additionally lets a read fail on the second page, not only page 1.
const row = (id: string): SystemAuditLogRecord => ({
  id,
  madrasa_id: "school",
  module: "fees",
  action: "GENERATED",
  severity: "INFO",
  created_at: "2026-01-01T01:00:00Z",
});
function source(rows: SystemAuditLogRecord[], errorAt = -1, code = "42501") {
  return {
    from() {
      const q = {
        select: () => q,
        eq: () => q,
        lte: () => q,
        order: () => q,
        range: (a: number, b: number) =>
          Promise.resolve(
            a === errorAt
              ? { error: { code, message: "unavailable" } }
              : { data: rows.slice(a, b + 1) },
          ),
      };
      return q;
    },
  } as any;
}
describe("FOLLOWUP6 canonical audit ledger", () => {
  it("counts beyond both display and transport pages; verified UUID and migrated legacy mirrors count once", async () => {
    const records = Array.from({ length: 1201 }, (_, i) =>
      row(`10000000-0000-4000-8000-${String(i).padStart(12, "0")}`),
    );
    records[750].metadata = { legacy_id: "from-legacy" };
    const fallback = [
      { ...records[999] },
      { ...row("from-legacy"), action: "OLD" },
      {
        ...row("20000000-0000-4000-8000-000000000001"),
        severity: "WARNING" as const,
      },
      { ...row("unrelated"), madrasa_id: "another-school" },
    ];
    for (const countOnly of [false, true]) {
      const r = await read(source(records), "school", {
        countOnly,
        fallbackLogs: fallback,
        limit: 10,
      });
      expect(r.totalCount).toBe(1202);
      expect(r.stats.warningCount).toBe(1);
      expect(r.stats.moduleCounts.fees).toBe(1202);
      expect(r.logs.length).toBe(countOnly ? 0 : 10);
    }
  });
  it("does not claim zero or a partial count on a denied/failed page; a missing SQL table alone can use the fallback", async () => {
    const fb = [row("fallback")],
      rows = Array.from({ length: 501 }, (_, i) => row(String(i)));
    await expect(
      read(source(rows, 0), "school", { fallbackLogs: fb }),
    ).rejects.toThrow();
    await expect(
      read(source(rows, 500), "school", { fallbackLogs: fb }),
    ).rejects.toThrow();
    await expect(
      read(source(rows, 0, "PGRST205"), "school", { fallbackLogs: fb }),
    ).resolves.toMatchObject({ storage: "fallback", totalCount: 1 });
  });
  it("applies the same Dhaka calendar day and search to SQL and fallback", async () => {
    const a = { ...row("a"), created_at: "2026-11-22T18:00:00Z" },
      b = {
        ...row("b"),
        action: "FALLBACK",
        created_at: "2026-11-23T17:59:59Z",
      },
      c = { ...b, id: "c", created_at: "2026-11-23T18:00:00Z" };
    const r = await read(source([a]), "school", {
      fallbackLogs: [b, c],
      dateFrom: "2026-11-23",
      dateTo: "2026-11-23",
      search: "fallback",
    });
    expect(r.logs.map((x) => x.id)).toEqual(["b"]);
    expect(r.totalCount).toBe(1);
  });
});
