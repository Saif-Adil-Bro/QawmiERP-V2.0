// No DSN or tenant input. All destructive operations are confined to this fresh cluster.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { withDisposablePostgres } from "./disposable-postgres.mjs";
const integrity = readFileSync(
    "supabase_finance_integrity_migration.sql",
    "utf8",
  ),
  upgrade = readFileSync("supabase_round7_migration.sql", "utf8");
let savedBills, tenant;
await withDisposablePostgres(
  async ({ db }) => {
    const conn = await db.reserve();
    try {
      for (const sql of [integrity, upgrade, upgrade]) await conn.unsafe(sql);
    } finally {
      conn.release();
    }
    const [{ id: t }, { id: other }] =
      await db`insert into madrasas(name,contact_email) values('Fixture A','a@r7.test'),('Fixture B','b@r7.test') returning id`;
    const term = "this-year",
      type = "monthly",
      acct = {
        fund_id: "fund-general",
        fund_name: "সাধারণ ফান্ড (General Fund)",
      };
    await db`insert into fee_types(id,madrasa_id,name,code,fund_id,fund_name) values(${type},${t},'Tuition','T',${acct.fund_id},${acct.fund_name})`;
    await db`insert into academic_sessions(id,madrasa_id,name,start_date,end_date,is_active) values(${term},${t},'Current','2026-01-01','2026-12-31',true)`;
    const ss =
      await db`insert into students(madrasa_id,first_name,last_name) select ${t},'Fixture',i::text from generate_series(1,6) i returning id`;
    const bills = ss.map((s, i) => ({
      id: randomUUID(),
      madrasa_id: t,
      session_id: "earlier-term",
      student_id: s.id,
      fee_type_id: type,
      fee_type_name: "Tuition",
      billing_period: ["ডিসেম্বর (December) 2026", "2026-12-01", "2026-12"][
        i % 3
      ],
      base_amount: i === 5 ? 1600 : 2000,
      payable_amount: i === 5 ? 1600 : 2000,
      due_amount: i === 5 ? 1600 : 2000,
      paid_amount: 0,
      status: "UNPAID",
      ...acct,
    }));
    for (const b of bills.slice(0, 3))
      await db`insert into student_fees ${db(b)}`;
    await db`update madrasas set registration_no=jsonb_build_object('student_fees',${db.json(bills.slice(3))}::jsonb)::text,finance_source_revision=finance_source_revision+1 where id=${t}`;
    const dec =
      () => db`select id,to_jsonb(b) as body from student_fees b where madrasa_id=${t} and finance_bill_period(billing_period)='2026-12'
    union all select x->>'id',x from madrasas m,jsonb_array_elements(finance_metadata(m)->'student_fees') x where m.id=${t} and finance_bill_period(x->>'billing_period')='2026-12' order by 1`;
    const initial = await dec();
    savedBills = Array.from(initial, (r) => r.body);
    tenant = t;
    assert.equal(initial.length, 6);
    assert.equal(
      initial.reduce((n, r) => n + Number(r.body.due_amount), 0),
      11600,
    );
    const insert = (b, period = "2026-12") => {
      const id = randomUUID();
      return db`select finance_edit_bills(${t},${db.json([{ id, before: null, after: { ...b, id, billing_period: period, session_id: term } }])},null)`;
    };
    // Bypass every JS existence check. Send concurrent new IDs with the *active*
    // term against December manual bills written in a different term and both books.
    for (let round = 0; round < 2; round++)
      await Promise.all(
        bills.map((b) => assert.rejects(() => insert(b), /একই বিল/)),
      );
    for (const b of bills) {
      const fresh = {
        ...b,
        id: randomUUID(),
        session_id: term,
        billing_period: "2026-12",
      };
      assert.equal(
        (
          await db`select round7_create_scheduled_bill(${t},${db.json(fresh)}) created`
        )[0].created,
        false,
      );
    }
    assert.deepEqual(await dec(), initial);
    const race = await Promise.allSettled([
      insert(bills[0], "2027-01"),
      insert(bills[0], "January 2027"),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.match(
      race.find((r) => r.status === "rejected").reason.message,
      /একই বিল/,
    );
    assert.deepEqual(await dec(), initial);
    console.log(
      "PASS finance RPC: six manual December bills, mixed books/labels/sessions, 12 duplicate attempts, same row contents and ৳11,600; concurrent new January key created once",
    );

    // Change an unpaid January row in its actual term (not a December key).
    // A read-only old-term December bill must never be "adopted" for editing.
    const [{ v: jan }] =
      await db`select to_jsonb(b) v from student_fees b where madrasa_id=${t} and finance_bill_period(billing_period)='2027-01'`;
    const adjust = (b) =>
      db`select finance_edit_bills(${t},${db.json([{ id: b.id, before: b, after: { ...b, base_amount: 1111, payable_amount: 1111, due_amount: 1111 } }])},null)`;
    await adjust(jan);
    assert.equal(
      Number(
        (await db`select due_amount from student_fees where id=${jan.id}`)[0]
          .due_amount,
      ),
      1111,
    );
    await assert.rejects(() => adjust(bills[5]));
    assert.deepEqual(await dec(), initial);
    console.log(
      "PASS active-term unpaid edit permitted; read-only old-term bill unchanged",
    );
    const devices = [
      {
        id: "main",
        name: "Main gate",
        serial_number: "REAL",
        protocol: "cloud_push",
        status: "active",
        secret_token: "fixture",
      },
      {
        id: "test",
        name: "TEST-BIOMETRIC-DELETE-ME",
        serial_number: "TESTSERIAL0001",
      },
    ];
    const patch = (expected, patch) =>
      db`select round7_patch_registry(${t},${db.json(expected)},${db.json(patch)}) ok`.then(
        (r) => r[0].ok,
      );
    assert.equal(await patch({}, { biometric_devices: devices }), true);
    assert.equal(await patch({}, { biometric_devices: [] }), false);
    const rpc = (events, opts = {}) =>
      db`select biometric_apply_events(${opts.tenant || t},${opts.dev || "test"},${opts.mode || "usb_import"},${db.json(events)},'all',${opts.credential ? db.json(opts.credential) : null},${opts.replay ? db.json(opts.replay) : null}) r`.then(
        (r) => r[0].r,
      );
    const ev = (pin, instant) => ({ pin, instant, kind: "auto" }),
      am = "2026-11-23T01:55:00.000Z";
    const events = [
      ev("480001", am),
      ev("480001", am),
      ev("480001", "2026-11-23T10:01:00.000Z"),
      ev("777777", am),
      ev("999999", am),
    ];
    const imports = await Promise.all(
      Array.from({ length: 4 }, () => rpc(events)),
    );
    assert.equal(
      imports.reduce((n, r) => n + r.duplicates, 0),
      16,
    );
    assert.equal(
      imports.reduce((n, r) => n + r.unmappedCount, 0),
      4,
    );
    const ids =
      await db`select id,device_id as dev,punch_time at time zone 'Asia/Dhaka' as local from biometric_punch_events where madrasa_id=${t} and device_user_id='480001' order by punch_time`;
    assert.equal(ids.length, 2);
    assert.equal(ids[0].local.toISOString().slice(11, 16), "07:55");
    assert.equal((await db`select count(*)::int n from attendance`)[0].n, 0);
    const mapping = {
      id: "m1",
      device_user_id: "480001",
      target_id: ss[0].id,
      user_type: "student",
      target_name: "Pupil",
    };
    assert.equal(await patch({}, { biometric_mappings: [mapping] }), true);
    const replay = (r, p) =>
      rpc([p], {
        replay: { id: r.id, mapping: mapping.id, target: mapping.target_id },
      });
    const result = await Promise.all([
      replay(ids[0], events[0]),
      replay(ids[1], events[2]),
      replay(ids[1], events[2]),
    ]);
    assert.equal(
      result.reduce((n, r) => n + r.totalProcessed, 0),
      2,
    );
    assert.equal(
      result.reduce((n, r) => n + r.attendanceDaysCreated, 0),
      1,
    );
    const day =
      await db`select date::text,status from attendance where student_id=${ss[0].id}`;
    assert.deepEqual(
      day.map((r) => [r.date, r.status]),
      [["2026-11-23", "Present"]],
    );
    assert.equal(
      (await rpc([ev("480001", "2026-11-21T18:05:00.000Z")]))
        .attendanceDaysCreated,
      1,
    );
    await db`insert into attendance(madrasa_id,student_id,date,status) values(${t},${ss[0].id},'2026-11-24','Leave')`;
    assert.equal(
      (await rpc([ev("480001", "2026-11-24T01:00:00.000Z")])).failed,
      1,
    );
    assert.equal(
      (
        await db`select status from attendance where student_id=${ss[0].id} and date='2026-11-24'`
      )[0].status,
      "Leave",
    );
    const [{ id: teacher }] =
      await db`insert into teachers(madrasa_id,first_name,last_name) values(${t},'Fixture','Teacher') returning id`;
    const [{ id: outside }] =
      await db`insert into students(madrasa_id,first_name,last_name) values(${other},'Foreign','Pupil') returning id`;
    await patch(
      { biometric_mappings: [mapping] },
      {
        biometric_mappings: [
          mapping,
          {
            ...mapping,
            id: "m2",
            device_user_id: "002",
            target_id: teacher,
            user_type: "teacher",
          },
          { ...mapping, id: "bad", device_user_id: "9", target_id: outside },
        ],
      },
    );
    assert.equal((await rpc([ev("002", am), ev("9", am)])).failed, 1);
    assert.equal(
      (
        await db`select count(*)::int n from teacher_attendance where teacher_id=${teacher} and status='Present'`
      )[0].n,
      1,
    );
    assert.equal(
      (
        await db`select count(*)::int n from attendance where student_id=${outside}`
      )[0].n,
      0,
    );
    await assert.rejects(
      () =>
        rpc(events, {
          mode: "cloud_push",
          dev: "main",
          credential: { token: "wrong" },
        }),
      /credentials/,
    );
    assert.equal(
      (
        await rpc([events[0]], {
          mode: "cloud_push",
          dev: "main",
          credential: { token: "fixture" },
        })
      ).totalProcessed,
      1,
    );
    assert.equal((await rpc([events[0]], { dev: "main" })).duplicates, 1);
    await rpc(Array.from({ length: 510 }, (_, i) => ev(String(i + 1000), am)));
    assert.equal((await rpc(events)).duplicates, 5);
    await assert.rejects(() => rpc([ev("ABC", am)]), /Invalid event/);
    const current = (
      await db`select finance_metadata(m)->'biometric_devices' d from madrasas m where id=${t}`
    )[0].d;
    assert.equal(
      await patch(
        { biometric_devices: current },
        { biometric_devices: current.filter((d) => d.id !== "test") },
      ),
      true,
    );
    assert.equal(
      (
        await db`select count(*)::int n from biometric_punch_events where device_id='test'`
      )[0].n,
      518,
    );
    assert.deepEqual(await dec(), initial);
    // A whole-document save from an older tab cannot resurrect a device.
    await assert.rejects(
      () =>
        db`update madrasas m set registration_no=jsonb_set(finance_metadata(m),'{biometric_devices}',${db.json(current)})::text where id=${t}`,
      /Registry changed/,
    );
    await assert.rejects(() => rpc([ev("480001", am)]), /no rows/);
    const [{ id: cls }] =
      await db`insert into classes(madrasa_id,name) values(${t},'Hifz') returning id`;
    const [{ id: subject }] =
      await db`insert into subjects(madrasa_id,name) values(${t},'Quran') returning id`;
    await db`insert into class_subjects(madrasa_id,class_id,subject_id) values(${t},${cls},${subject})`;
    const assign = (who) =>
      db`select round7_set_subject_teacher(${t},${cls},${subject},${who})`;
    await assign(teacher);
    const original =
      await db`select * from teacher_subjects where madrasa_id=${t}`;
    const [{ id: wrong }] =
      await db`insert into teachers(madrasa_id,first_name,last_name) values(${other},'Foreign','Teacher') returning id`;
    await assert.rejects(() => assign(wrong), /প্রতিষ্ঠানের নন/);
    await assign(teacher);
    assert.deepEqual(
      await db`select * from teacher_subjects where madrasa_id=${t}`,
      original,
    );
    console.log(
      "PASS stale registry write refused; removed fixture device cannot receive punches; failed cross-tenant teacher change preserved the original assignment",
    );
    // A tenant-owned teacher legitimises a NULL-school legacy link, not a
    // foreign teacher. Several matching assignments are ambiguous: no deletion.
    const [{ id: second }] =
      await db`insert into teachers(madrasa_id,first_name,last_name) values(${t},'Second','Teacher') returning id`;
    await db`update teacher_subjects set madrasa_id=null where id=${original[0].id}`;
    await assign(second);
    assert.equal(
      (
        await db`select teacher_id from teacher_subjects where id=${original[0].id}`
      )[0].teacher_id,
      second,
    );
    await db`insert into teacher_subjects(madrasa_id,class_id,subject_id,teacher_id) values(${t},${cls},${subject},${teacher})`;
    const links = () =>
      db`select * from teacher_subjects where class_id=${cls} order by id`;
    const linkBefore = await links();
    await assert.rejects(() => assign(null), /একাধিক/);
    assert.deepEqual(await links(), linkBefore);
    console.log(
      "PASS null-school legacy assignment repaired in place; multiple assignments fail closed",
    );
    // A copied pre-upgrade registry (the original compromised timestamps and
    // raw rows remain immutable). Only the operator-selected ID is adopted.
    const legacyLog = {
      id: "old-480001",
      device_id: "legacy-gate",
      device_user_id: "480001",
      status: "unmapped",
      punch_time: "2026-11-23T07:55:00Z",
      sync_mode: "usb_import",
      raw_data: "480001 2026-11-23 07:55",
    };
    const legacyHistory = [
      legacyLog,
      { ...legacyLog, id: "copy-480001" },
      { ...legacyLog, id: "bad-date", raw_data: "480001 23/11/2026 08:15" },
    ];
    const [{ id: school }] =
      await db`insert into madrasas(name,contact_email,registration_no) values('Old fixture','old@example.test',${JSON.stringify({ biometric_devices: [{ id: "legacy-gate", name: "Gate" }], biometric_logs: legacyHistory })}) returning id`;
    const [{ id: pupil }] =
      await db`insert into students(madrasa_id,first_name,last_name) values(${school},'Old','Pupil') returning id`;
    const linked = {
      id: "verified",
      device_user_id: "480001",
      user_type: "student",
      target_id: pupil,
    };
    await db`select round7_patch_registry(${school},'{}',${db.json({ biometric_mappings: [linked] })})`;
    const review = {
      tenant: school,
      dev: "legacy-gate",
      replay: { id: legacyLog.id, mapping: linked.id, target: pupil },
    };
    assert.equal((await rpc([ev("480001", am)], review)).totalProcessed, 1);
    assert.equal((await rpc([ev("480001", am)], review)).duplicates, 1);
    const adopted = (
      await db`select id,legacy_id,status from biometric_punch_events where madrasa_id=${school}`
    )[0];
    assert.deepEqual(
      { ...adopted },
      { id: legacyLog.id, legacy_id: legacyLog.id, status: "processed" },
    );
    assert.deepEqual(
      (
        await db`select finance_metadata(m)->'biometric_logs' history from madrasas m where id=${school}`
      )[0].history,
      legacyHistory,
    );
    const inspector = await db.reserve();
    try {
      await inspector`select set_config('qawmi.review_tenant',${t},false)`;
      await inspector.unsafe(
        readFileSync("scripts/sql/round7-readback.sql", "utf8"),
      );
    } finally {
      inspector.release();
    }
    console.log(
      "PASS legacy replay: selected source-backed log adopted once; original copies and malformed raw evidence unchanged; read-only operator report runs on restored schema",
    );
    for (const role of ["authenticated", "anon"]) {
      const [grants] =
        await db`select has_table_privilege(${role},'biometric_punch_events','select') readable,has_function_privilege(${role},'biometric_apply_events(uuid,text,text,jsonb,text,jsonb,jsonb)','execute') executable`;
      assert.deepEqual({ ...grants }, { readable: false, executable: false });
    }
    console.log(
      "PASS durable punch uniqueness across 4 concurrent imports, 510 later events, USB/push and scoped replay; 2 punches → 1 Present, manual Leave intact, valid teacher FK, no foreign attendance; only test device removed, logs kept",
    );
  },
  {
    afterColdRestore: async (db) => {
      const rows =
        await db`select to_jsonb(b) body from student_fees b where madrasa_id=${tenant} and finance_bill_period(billing_period)='2026-12'
    union all select x from madrasas m,jsonb_array_elements(finance_metadata(m)->'student_fees')x where m.id=${tenant} and finance_bill_period(x->>'billing_period')='2026-12'`;
      assert.deepEqual(
        rows.map((r) => r.body).sort((a, b) => a.id.localeCompare(b.id)),
        savedBills.slice().sort((a, b) => a.id.localeCompare(b.id)),
      );
      assert.equal(
        (
          await db`select count(*)::int n from biometric_punch_events where madrasa_id=${tenant} and device_id='test'`
        )[0].n,
        518,
      );
      assert.equal(
        (
          await db`select count(*)::int n from attendance where madrasa_id=${tenant} and status='Leave'`
        )[0].n,
        1,
      );
      assert.equal(
        (
          await db`select has_table_privilege('anon','biometric_punch_events','select') ok`
        )[0].ok,
        false,
      );
      console.log(
        "PASS isolated cold restore: all six original invoice rows identical in both books, punch evidence and manual Leave retained, anon still denied",
      );
    },
  },
);
