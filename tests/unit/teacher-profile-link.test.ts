import { describe, expect, it, vi } from "vitest";
import { resolveTeacherIdentity } from "@/lib/teacher-identity";
import {
  linkCreatedTeacherAccount,
  resolveTeacherUuid,
} from "@/lib/teacher-profile-write";

const io = vi.hoisted(() => ({ admin: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: io.admin }));
vi.mock("@/lib/sessions", () => ({
  getMadrasaMetadata: io.read,
  saveMadrasaMetadata: io.save,
}));

const id = "11111111-1111-4111-8111-111111111111";
const sql = { id, email: "teacher_one@example.test", auth_user_id: "a" };
const staff = { id, legacy_id: "stf_1", auth_user_id: "a" };

describe("Canonical teacher profile", () => {
  it("resolves a server-owned legacy staff link and the provider subject to the same SQL teacher", () => {
    for (const target of [{ linkedId: "stf_1" }, { authUserId: "a" }]) {
      expect(resolveTeacherIdentity([sql], [staff], target)).toMatchObject({
        teacher: sql,
        staff,
        keys: [id, "stf_1"],
      });
    }
  });
  it("bridges a bound legacy staff row to a unique tenant-maintained SQL email without guessing by name", () => {
    const legacy = {
      id: "stf_01",
      auth_user_id: "a",
      contact: { email: sql.email.toUpperCase() },
    };
    const row = { ...sql, auth_user_id: null };
    expect(
      resolveTeacherIdentity([row], [legacy], { authUserId: "a" }).keys,
    ).toEqual([id, "stf_01"]);
    expect(
      resolveTeacherIdentity([row, { ...row, id: "duplicate" }], [legacy], {
        authUserId: "a",
      }).keys,
    ).toEqual([]);
  });
  it("canonicalizes a tenant-owned legacy staff ID for writes, never upserts a colliding foreign SQL row", async () => {
    const records: any[] = [{ id, madrasa_id: "B" }];
    const meta = {
      staff_members: [{ id: "stf_initial", personal: { first_name: "Ustad" } }],
    };
    io.read.mockResolvedValue(meta);
    io.save.mockResolvedValue(true);
    io.admin.mockResolvedValue({
      from: () => {
        const filters = new Map<string, string>();
        const q = {
          select: () => q,
          eq: (key: string, v: string) => {
            filters.set(key, v);
            return q;
          },
          maybeSingle: async () => ({
            data:
              records.find((r) => [...filters].every(([k, v]) => r[k] === v)) ??
              null,
          }),
          insert: async (row: any) => {
            if (records.some((r) => r.id === row.id))
              return { error: { code: "23505" } };
            records.push(row);
            return { error: null };
          },
        };
        return q;
      },
    });
    const canonical = await resolveTeacherUuid("stf_initial", "A");
    expect(canonical).toBeTruthy();
    expect(await resolveTeacherUuid("stf_initial", "A")).toBe(canonical);
    expect(meta.staff_members[0]).toMatchObject({
      id: canonical,
      legacy_id: "stf_initial",
    });
    io.read.mockResolvedValue({ staff_members: [{ id, legacy_id: "stale" }] });
    expect(await resolveTeacherUuid("stale", "A")).toBeNull();
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ id, madrasa_id: "B" });
  });
  it("does not guess past a stale explicit link, duplicate email or a conflicting account", () => {
    const unclaimed = { ...sql, auth_user_id: null };
    const target = { authUserId: "b", verifiedEmail: sql.email.toUpperCase() };
    expect(resolveTeacherIdentity([unclaimed], [], target).teacher).toEqual(
      unclaimed,
    );
    for (const result of [
      resolveTeacherIdentity([sql], [], target),
      resolveTeacherIdentity(
        [unclaimed, { ...unclaimed, id: "other" }],
        [],
        target,
      ),
      resolveTeacherIdentity([unclaimed], [], { ...target, linkedId: "stale" }),
      resolveTeacherIdentity([sql], [{ ...staff, auth_user_id: "b" }], {
        linkedId: id,
      }),
    ])
      expect(result.keys).toEqual([]);
  });
  it("only claims a single exact email inside the tenant and conditionally updates an unbound row", async () => {
    const q: any = {
      select: () => q,
      eq: vi.fn(() => q),
      ilike: vi.fn(() => q),
      limit: vi.fn(async () => ({ data: [sql] })),
      maybeSingle: async () => ({ data: { email: sql.email } }),
      update: vi.fn(() => q),
      is: vi.fn(async () => ({ error: null })),
    };
    const db = { from: () => q } as any;
    await linkCreatedTeacherAccount(db, "tenant", "new", null, sql.email);
    expect(q.ilike).toHaveBeenCalledWith("email", "teacher\\_one@example.test");
    expect(q.eq).toHaveBeenCalledWith("madrasa_id", "tenant");
    expect(q.eq).toHaveBeenCalledWith("id", id);
    expect(q.update).toHaveBeenCalledWith({ auth_user_id: "new" });
    expect(q.is).toHaveBeenCalledWith("auth_user_id", null);
    q.update.mockClear();
    q.limit.mockResolvedValue({ data: [sql, sql] });
    await linkCreatedTeacherAccount(db, "tenant", "new", null, sql.email);
    expect(q.update).not.toHaveBeenCalled();
  });
});
