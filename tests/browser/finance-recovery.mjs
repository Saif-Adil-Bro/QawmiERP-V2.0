import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";

// All inputs, storage and IDs are disposable. This is an app export/restore
// boundary test, not a production recovery rehearsal or a money import tool.
export async function recoveryChecks({
  db,
  t,
  base,
  storage,
  call,
  reviewer,
  foreignPupil,
}) {
  const [{ madrasa_id: foreign }] =
    await db`select madrasa_id from students where id=${foreignPupil}`;
  const snapshot = async () =>
    await db`select id,madrasa_id,first_name from students where id=${foreignPupil} union all select id,madrasa_id,first_name from students where madrasa_id=${t} order by id`;
  const before = await snapshot(),
    books = async () =>
      await db`select id,finance_metadata(m)->'payments' p,finance_metadata(m)->'student_fees' b from madrasas m where id in (${t},${foreign}) order by id`;
  const pre = await books();
  const restore = async (
    modules,
    data,
    owner = t,
    restoreMode = "merge",
    status = 400,
  ) =>
    call(
      "/api/backup/restore",
      reviewer,
      "POST",
      {
        restoreMode,
        selectedModules: modules,
        backupPayload: {
          manifest: { madrasa_id: owner, is_selective: true, modules },
          data,
        },
      },
      status,
    );
  const pupilRows = {
    students: [
      {
        ...before.find((r) => r.id === foreignPupil),
        madrasa_id: t,
        first_name: "Unapplied",
      },
    ],
  };
  assert.equal(
    (await restore(["students"], pupilRows)).error,
    "FINANCIAL_RECOVERY_REQUIRED",
  );
  assert.equal(
    (await restore(["students"], pupilRows, foreign)).error,
    "TENANT_MISMATCH",
  );
  for (const m of [
    undefined,
    ["ALL"],
    ["all_metadata"],
    ["finance_transactions"],
    ["fees", "notices_sms"],
    ["settings"],
  ])
    assert.equal(
      (
        await restore(
          m,
          { fee_payment_allocations: [{ id: "Unapplied" }] },
          t,
          "replace",
        )
      ).error,
      "FINANCIAL_RECOVERY_REQUIRED",
    );
  await db.unsafe("revoke select on notices from service_role");
  try {
    assert.equal(
      (await restore(["notices_sms"], { notices: [{ id: "Unapplied" }] }))
        .error,
      "SNAPSHOT_INCOMPLETE",
    );
  } finally {
    await db.unsafe("grant select on notices to service_role");
  }
  await db.unsafe(
    "grant insert,update on notices,sms_logs to service_role; grant delete,insert,update on attendance,teacher_attendance to service_role",
  );
  const own = (
    await db`insert into notices(madrasa_id,title,content) values(${t},'Before','A') returning *`
  )[0];
  const far = (
    await db`insert into notices(madrasa_id,title,content) values(${foreign},'Foreign','B') returning *`
  )[0];
  const original = await db`select * from notices order by id`;
  const payload = {
    notices: [
      { id: own.id, title: "After" },
      { id: randomUUID(), title: "Imported", content: "Local only" },
    ],
    metadata: { notices: [{ id: "legacy-A" }], student_fees: [] },
  };
  for (const fault of ["write", "readback"]) {
    storage.fault = fault;
    try {
      assert.equal(
        (await restore(["notices_sms"], payload)).error,
        "SNAPSHOT_UNAVAILABLE",
      );
    } finally {
      storage.fault = null;
    }
    assert.deepEqual(await db`select * from notices order by id`, original);
  }
  assert.equal(
    (await db`select public from storage.buckets where id='backups'`)[0]
      ?.public,
    false,
  );
  await db`update storage.buckets set public=true where id='backups'`;
  try {
    assert.equal(
      (await restore(["notices_sms"], payload)).error,
      "SNAPSHOT_UNAVAILABLE",
    );
  } finally {
    await db`update storage.buckets set public=false where id='backups'`;
  }
  const log = async (type) =>
    (
      await db`select v from madrasas m,jsonb_array_elements(finance_metadata(m)->'backup_history') v where m.id=${t} and v->>'type'=${type}`
    )[0]?.v;
  async function readBack(note) {
    assert.ok(note?.storage_path?.startsWith("snapshots/" + t + "/"));
    const object = [...storage.driver].find(([k, v]) =>
      JSON.parse(k).some(
        (part) => typeof part === "string" && part.endsWith(note.storage_path),
      ),
    );
    assert.ok(object, "verified snapshot bytes");
    const file = JSON.parse(object[1].body.toString("utf8"));
    assert.equal(
      "sha256:" +
        createHash("sha256").update(JSON.stringify(file.data)).digest("hex"),
      note.checksum,
    );
    assert.equal(file.manifest.madrasa_id, t);
    return file;
  }
  // Every case has a valid row first. Failures in a later row/table and
  // out-of-school parent references must roll back the entire plan.
  const [{ id: foreignClass }] =
    await db`insert into classes(madrasa_id,name) values(${foreign},'Foreign class') returning id`;
  for (const invalid of [
    {
      ...payload,
      notices: [
        ...payload.notices,
        { id: far.id, title: "Collision", content: "Not ours" },
      ],
    },
    {
      ...payload,
      notices: [
        ...payload.notices,
        {
          id: randomUUID(),
          title: "Parent",
          content: "Wrong school",
          class_id: foreignClass,
        },
      ],
    },
    {
      ...payload,
      sms_logs: [{ id: randomUUID(), message: "Missing required recipient" }],
    },
  ]) {
    assert.equal(
      (await restore(["notices_sms"], invalid)).error,
      "RECOVERY_NOT_CONFIRMED",
    );
    assert.deepEqual(await db`select * from notices order by id`, original);
    assert.ok(!(await log("RESTORE_MERGE")));
    await readBack(await log("AUTO_SNAPSHOT"));
  }
  const applied = await restore(["notices_sms"], payload, t, "merge", 200);
  assert.equal(applied.restoredStats.notices, 2);
  let note = await log("AUTO_SNAPSHOT");
  const file = await readBack(note);
  assert.deepEqual(
    file.data.notices.map((r) => r.id),
    [own.id],
  );
  assert.ok(!("payments" in file.data));
  assert.equal((await log("RESTORE_MERGE")).storage_path, note.storage_path);
  assert.equal(
    (await db`select title from notices where id=${own.id}`)[0].title,
    "After",
  );
  assert.deepEqual(
    (await db`select * from notices where id=${far.id}`)[0],
    far,
  );
  assert.deepEqual(await books(), pre);
  assert.deepEqual(await snapshot(), before);
  console.log(
    "PASS full-scope holds, failed/incorrect/public snapshot refused; verified private snapshot + allowed merge, cross-school IDs/parents and later-table failures roll back",
  );
  const [{ id: pupil }] =
    await db`select id from students where madrasa_id=${t} limit 1`;
  const [a, b] =
    await db`insert into attendance(madrasa_id,student_id,date,status) values(${t},${pupil},'2026-01-03','Present'),(${foreign},${foreignPupil},'2026-01-03','Absent') returning *`;
  await db`update madrasas set metadata=metadata||'{"biometric_logs":[{"id":"fixture"}]}'::jsonb where id=${t}`;
  return async function wipeUI(page) {
    const beforeWipeBooks = await books();
    await page.goto(base + "/dashboard/settings/backup", {
      waitUntil: "networkidle0",
    });
    await page.click("button::-p-text(ডাটা মুছে ফেলা ও রিসেট)");
    await page.select('select[aria-label="মোছার মডিউল"]', "attendance");
    await page.click('input[aria-label="নির্বাচিত মডিউল মোছার সম্মতি"]');
    await page
      .locator('input[placeholder="মুছে ফেলুন অথবা DELETE"]')
      .fill("DELETE");
    page.once("dialog", (d) => d.accept());
    await page.click('button[aria-label="নির্বাচিত রেকর্ড মুছুন"]');
    await page.waitForSelector("main [role=status],main [role=alert]");
    assert.equal(
      await page.$eval("main [role=status],main [role=alert]", (el) =>
        el.getAttribute("role"),
      ),
      "status",
    );
    const w = await log("SCOPED_WIPE");
    const preWipe = await readBack(w);
    assert.deepEqual(
      preWipe.data.attendance.map((r) => r.id),
      [a.id],
    );
    assert.deepEqual(
      [...(await db`select * from attendance where id in (${a.id},${b.id})`)],
      [b],
    );
    assert.ok(
      !(
        await db`select finance_metadata(m) ? 'biometric_logs' AS found from madrasas m where id=${t}`
      )[0].found,
    );
    // Restore the actual private snapshot, not a hand-built substitute.
    const replay = await call("/api/backup/restore", reviewer, "POST", {
      backupPayload: preWipe,
      restoreMode: "merge",
      selectedModules: ["attendance"],
    });
    assert.equal(replay.restoredStats.attendance, 1);
    assert.deepEqual(
      (await db`select * from attendance where id=${a.id}`)[0],
      a,
    );
    assert.deepEqual(await books(), beforeWipeBooks);
    console.log(
      "PASS scoped attendance wipe and restore from its verified private snapshot; foreign row and both financial books unchanged",
    );
  };
}
