import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getOfflineDb } from "@/lib/offlineDb";
import {
  ownerKey,
  browserSession,
  clearOfflineAuthSession,
} from "@/lib/offline-auth";
import {
  initialFullSync,
  backgroundSync,
  postTeacherEntry,
  processOfflineOutbox,
} from "@/lib/portal-sync";
import { processSyncQueue } from "@/lib/syncManager";
const network = vi.hoisted(() => ({ connected: true }));
vi.mock("@capacitor/network", () => ({
  Network: { getStatus: async () => network },
}));
vi.mock("@capacitor/preferences", () => ({ Preferences: { remove: vi.fn() } }));
let n = 0;
function login(user = "parent", role = "parent") {
  const s = {
    madrasaId: `m${n}`,
    userId: user,
    role,
    accessToken: user + "token",
  };
  window.localStorage.setItem("qawmi_offline_auth_session", JSON.stringify(s));
  return ownerKey(s);
}
function wire(child = "a", ids = ["a", "b"]) {
  return {
    version: 1,
    portal: "student",
    profile: { id: "parent", madrasa_id: `m${n}` },
    students: ids.map((id) => ({ id })),
    classes: [],
    active_student: child ? { id: child } : null,
    attendance: [],
    fee_invoices: [],
    fee_payments: [],
    fee_discounts: [],
    exams: [],
    exam_summaries: [],
    health_records: [],
    exam_results: [],
    hifz_logs: [],
    hifz_profiles: [],
    hifz_special_sabina: [],
    hifz_weekly_sabina: [],
    hifz_listeners: [],
    kitab_logs: [],
    notices: [],
    routines: [],
    holidays: [],
    assignments: [],
    total_paid: 0,
    total_due: 0,
  };
}
const response = (data: any) => Response.json({ data, success: true });
beforeEach(() => {
  n++;
  network.connected = true;
  const store = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    location: { search: "" },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("Owner-scoped Dexie transactions and replay", () => {
  it("replaces deleted/unpublished rows (including default alias), keeps siblings independent, prunes unlinked children", async () => {
    const owner = login(),
      db = getOfflineDb(owner);
    let data: any = {
      ...wire(),
      notices: [{ id: "n" }],
      health_records: [{id:"case",student_id:"a",status:"observing",severity:"mild",doctor_or_hospital:"Doctor A",treatment_notes:"Care A",timeline:[{note:"latest note"}]}],
      exam_summaries: [{ student_id: "a", exam_id: "e" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(data)),
    );
    expect((await initialFullSync("student")).ok).toBe(true);
    expect((await db.portalSnapshots.get("student:a"))?.data.healthRecords[0]).toMatchObject({doctor_or_hospital:"Doctor A",treatment_notes:"Care A",timeline:[{note:"latest note"}]});
    data = wire("b");
    await initialFullSync("student", { studentId: "b" });
    data = wire();
    await backgroundSync("student", "a");
    for (const key of ["student:", "student:a"])
      expect((await db.portalSnapshots.get(key))?.data).toMatchObject({
        examSummaries: [],
        healthRecords: [],
        notices: [],
      });
    expect((await db.portalSnapshots.get("student:b"))?.studentId).toBe("b");
    data = wire("a", ["a"]);
    await backgroundSync("student", "a");
    expect(await db.portalSnapshots.get("student:b")).toBeUndefined();
    login("other");
    expect(await getOfflineDb().portalSnapshots.count()).toBe(0);
  });
  it("retains last good snapshot on failed, incomplete, wrong-person or wrong-child responses; clears it on denied authorization", async () => {
    const db = getOfflineDb(login());
    let res = () => response(wire());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res()),
    );
    await initialFullSync("student");
    const good = await db.portalSnapshots.get("student:");
    for (const bad of [
      { ...wire(), assignments: null },
      { ...wire(), health_records: null },
      { ...wire(), health_records:[{id:"case",student_id:"b",status:"observing",severity:"moderate",timeline:[]}] },
      { ...wire(), profile: { id: "other", madrasa_id: `m${n}` } },
      { ...wire(), attendance: [{ id: "x", student_id: "b" }] },
    ]) {
      res = () => response(bad);
      expect((await initialFullSync("student")).ok).toBe(false);
      expect(await db.portalSnapshots.get("student:")).toEqual(good);
    }
    res = () => new Response(null, { status: 500 });
    expect((await initialFullSync("student")).ok).toBe(false);
    res = () => new Response(null, { status: 403 });
    expect((await initialFullSync("student")).ok).toBe(false);
    expect(await db.portalSnapshots.count()).toBe(0);
  });
  it("does not commit a late response after logout or owner change", async () => {
    const db = getOfflineDb(login());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        login("other");
        return response(wire());
      }),
    );
    expect((await initialFullSync("student")).ok).toBe(false);
    expect(await db.portalSnapshots.count()).toBe(0);
    await clearOfflineAuthSession();
    expect(browserSession()).toBeNull();
  });
  it("replays only its own Teacher queue; no concurrent duplicate, no success on an HTML login response", async () => {
    const owner = login("one", "teacher"),
      db = getOfflineDb(owner);
    network.connected = false;
    await postTeacherEntry("attendance", { records: [] }, owner);
    login("two", "teacher");
    network.connected = true;
    const f = vi.fn(async (_u: string, _o: any) => new Response("login"));
    vi.stubGlobal("fetch", f);
    await processOfflineOutbox();
    expect(f).not.toHaveBeenCalled();
    login("one", "teacher");
    await processOfflineOutbox();
    expect(await db.offlineOutbox.count()).toBe(1);
    expect((await db.offlineOutbox.toArray())[0].retryCount).toBe(1);
    f.mockImplementation(async () => Response.json({ success: true }));
    await Promise.all([processOfflineOutbox(), processOfflineOutbox()]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][1].headers["X-Qawmi-Sync-Owner"]).toBe(owner);
    expect(await db.offlineOutbox.count()).toBe(0);
  });
  it("never posts or queues a known freeze; marks refused on replay aren't retried after unlock or in the way of other entries", async () => {
    const owner = login("one", "teacher"), db = getOfflineDb(owner);
    const payload = {exam_id: "e", records: [{student_id: "s", marks_obtained: 0}]};
    const send = vi.fn(async () => Response.json({error: "লক করা", code: "EXAM_LOCKED"}, {status: 409}));
    vi.stubGlobal("fetch", send);
    const refuse = () => { throw new Error("read only"); };
    for (const online of [true, false]) {
      network.connected = online;
      await expect(postTeacherEntry("exam_marks", payload, owner, refuse)).rejects.toThrow("read only");
    }
    expect(send).not.toHaveBeenCalled();
    expect(await db.offlineOutbox.count()).toBe(0);
    await postTeacherEntry("exam_marks", payload, owner); // was unlocked at offline entry
    network.connected = true;
    await processOfflineOutbox();
    expect(await db.offlineOutbox.toArray()).toMatchObject([{rejected: "EXAM_LOCKED", status: "failed"}]);
    network.connected = false;
    await postTeacherEntry("attendance", {}, owner);
    network.connected = true;
    send.mockImplementation(async () => Response.json({success: true}));
    await processOfflineOutbox();
    await processOfflineOutbox();
    expect(send).toHaveBeenCalledTimes(2);
    expect(await db.offlineOutbox.toArray()).toMatchObject([{rejected: "EXAM_LOCKED"}]);
  });
  it("isolates Admin operations from portals and checks server acknowledgement before removal", async () => {
    const owner = login("admin", "admin"),
      db = getOfflineDb(owner);
    await db.syncQueue.add({
      id: "q",
      entity: "students",
      action: "UPDATE",
      payload: { id: "x" },
      recordId: "x",
      timestamp: 1,
      status: "pending",
      retryCount: 0,
    });
    const f = vi.fn(async (_u: string, _o: any) =>
      Response.json({ success: false }),
    );
    vi.stubGlobal("fetch", f);
    login("one", "teacher");
    await processSyncQueue();
    expect(f).not.toHaveBeenCalled();
    login("admin", "admin");
    expect((await processSyncQueue()).failed).toBe(1);
    f.mockImplementation(async () =>
      Response.json({ success: true, data: { id: "x" } }),
    );
    await Promise.all([processSyncQueue(), processSyncQueue()]);
    expect(await db.syncQueue.count()).toBe(0);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("Hifz snapshot and outbox isolation", () => {
  it("atomically mirrors the selected child; bad or missing Hifz data cannot clear the previous snapshot", async () => {
    const db = getOfflineDb(login());
    const h = (id: string) => ({
      student_id: id,
      madrasa_id: `m${n}`,
      hifz_category: "sabqi",
    });
    let data: any = { ...wire(), hifz_profiles: [h("a")] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(data)),
    );
    expect((await initialFullSync("student")).ok).toBe(true);
    expect(await db.hifzProfiles.get("a")).toMatchObject({ student_id: "a" });
    data = { ...wire("b"), hifz_profiles: [h("a")] };
    expect((await initialFullSync("student", { studentId: "b" })).ok).toBe(
      false,
    );
    data = { ...wire("b"), hifz_weekly_sabina: undefined };
    expect((await initialFullSync("student", { studentId: "b" })).ok).toBe(
      false,
    );
    expect(await db.hifzProfiles.count()).toBe(1);
    data = { ...wire("b"), hifz_profiles: [h("b")] };
    expect((await initialFullSync("student", { studentId: "b" })).ok).toBe(
      true,
    );
    expect(await db.hifzProfiles.get("a")).toBeUndefined();
    expect(
      (await db.portalSnapshots.get("student:a"))?.data.hifzProfiles[0]
        .student_id,
    ).toBe("a");
    await clearOfflineAuthSession();
    expect(await db.hifzProfiles.count()).toBe(0);
  });
  it("keeps a stale correction for review without blocking later Hifz entries", async () => {
    const owner = login("teach", "teacher"),
      db = getOfflineDb(owner);
    network.connected = false;
    await postTeacherEntry("hifz", { kind: "daily" }, owner);
    await postTeacherEntry("hifz", { kind: "weekly" }, owner);
    network.connected = true;
    const send = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "নতুন লগ এসেছে" }, { status: 409 }),
      )
      .mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal("fetch", send);
    await processOfflineOutbox();
    await processOfflineOutbox();
    expect(send).toHaveBeenCalledTimes(2);
    expect(await db.offlineOutbox.toArray()).toMatchObject([
      { rejected: "HIFZ_REVIEW", payload: { kind: "daily" } },
    ]);
  });
});
