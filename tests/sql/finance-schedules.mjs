import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Same changes on JSON and SQL books. A stale edit never replaces adjacent bills,
// a paid/voided allocation, another school's globally unique fee type, or a checkout.
export async function scheduleScenarios(db) {
  for (const sqlBook of [false, true]) {
    const [{ id: t }] =
      await db`insert into madrasas(name,contact_email) values('Scheduling',${randomUUID() + "@example.test"}) returning id`;
    const [{ id: manager }] =
      await db`insert into auth.users(id) values(gen_random_uuid()) returning id`;
    await db`insert into users(id,madrasa_id,email,full_name,role) values(${manager},${t},${randomUUID() + "@example.test"},'Manager','admin')`;
    const [{ id: pupil }] =
      await db`insert into students(madrasa_id,first_name,last_name) values(${t},'School','Pupil') returning id`;
    const type = "type:" + t,
      acct = {
        fund_id: "fund-general",
        fund_name: "সাধারণ ফান্ড (General Fund)",
      },
      ft = {
        id: type,
        madrasa_id: t,
        name: "Tuition",
        frequency: "MONTHLY",
        code: "T",
        category: "ACADEMIC",
        default_amount: 10,
        ...acct,
      };
    const meta = async () =>
      (await db`select finance_metadata(m) r from madrasas m where id=${t}`)[0]
        .r;
    if (sqlBook)
      await db`insert into fee_types(madrasa_id,name,code) values(${t},'Another type','L')`;
    const conf = (k, changes, base = []) =>
      db`select finance_fee_config(${t},${k},${db.json(changes)},${db.json(base)})`;
    const ch = (id, before, after) => ({ id, before, after });
    const cfg = async (k, id) =>
      sqlBook
        ? (
            await db`select to_jsonb(x) r from ${db(k)} x where madrasa_id=${t} and id=${id}`
          )[0]?.r
        : (await meta())[k]?.find((x) => x.id === id);
    await conf("fee_types", [ch(type, null, ft)]);
    const initial = await cfg("fee_types", type);
    const race = await Promise.allSettled([
      conf("fee_types", [ch(type, initial, { ...ft, name: "A" })]),
      conf("fee_types", [ch(type, initial, { ...ft, name: "B" })]),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    const updated = await cfg("fee_types", type);
    const selectTerm = async (wanted = null, allow = true) =>
      (
        await db`select finance_billing_session(${t},${wanted},${allow}) term`
      )[0].term;
    assert.equal(await selectTerm(), "default");
    await assert.rejects(() => selectTerm(null, false), /শিক্ষাবর্ষ/);
    await db`update madrasas set registration_no=(finance_metadata(madrasas)||'{"sessions":[{"id":"S","is_current":true}]}')::text where id=${t}`;
    assert.equal(await selectTerm(), "S");
    await assert.rejects(() => selectTerm("previous"), /শিক্ষাবর্ষ/);
    const alt = randomUUID();
    await db`insert into academic_sessions(id,madrasa_id,name,start_date,end_date,is_active) values(${alt},${t},'Other','2027-01-01','2027-12-31',true)`;
    await assert.rejects(() => selectTerm("S"), /শিক্ষাবর্ষ/);
    await db`delete from academic_sessions where id=${alt}`;
    const [{ id: classId }] =
      await db`insert into classes(madrasa_id,name) values(${t},'Class') returning id`;
    const sid = randomUUID(),
      item = {
        fee_type_id: type,
        fee_type_name: updated.name,
        amount: 10,
        frequency: "MONTHLY",
      },
      s = {
        id: sid,
        session_id: "S",
        name: "Schedule",
        class_name: "Class",
        class_id: classId,
        student_category: "ALL",
        items: [item],
        total_monthly_amount: 10,
        total_onetime_amount: 0,
      };
    await conf("fee_structures", [ch(sid, null, s)]);
    const original = await cfg("fee_structures", sid);
    const invalid = { ...s, items: [{ ...item, fee_type_id: "foreign" }] };
    await assert.rejects(
      () => conf("fee_structures", [ch(sid, original, invalid)]),
      /কাঠামো/,
    );
    assert.deepEqual(await cfg("fee_structures", sid), original);
    await assert.rejects(
      () =>
        conf("fee_structures", [
          ch(sid, original, { ...s, total_monthly_amount: 50 }),
        ]),
      /কাঠামো/,
    );
    const b = (id, period) => ({
      id,
      madrasa_id: t,
      session_id: "S",
      student_id: pupil,
      fee_type_id: type,
      fee_type_name: "Tuition",
      billing_period: period,
      due_date: period + "-15",
      base_amount: 10,
      payable_amount: 10,
      due_amount: 10,
      paid_amount: 0,
      status: "UNPAID",
      ...acct,
    });
    const edit = (changes, audit = null) =>
      db`select finance_edit_bills(${t},${db.json(changes)},${audit ? db.json(audit) : null})`;
    const one = b(randomUUID(), "2026-01"),
      two = b(randomUUID(), "2026-02");
    await edit([ch(one.id, null, one), ch(two.id, null, two)], {
      id: randomUUID(),
      action: "GENERATE_MONTHLY_FEES",
      user_name: "Test",
      user_role: "accountant",
      details: "two unpaid bills",
    });
    const b1 = await cfg("student_fees", one.id),
      b2 = await cfg("student_fees", two.id);
    const label = "জানুয়ারি (January) 2026",
      same = { ...one, id: randomUUID(), billing_period: label };
    assert.equal(
      (await db`select finance_bill_period(${label}) ym`)[0].ym,
      "2026-01",
    );
    await assert.rejects(() => edit([ch(same.id, null, same)]), /একই বিল/);
    await db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),'{sessions,0,is_locked}','true')::text where id=${t}`;
    await assert.rejects(() => edit([ch(one.id, b1, null)]), /শিক্ষাবর্ষ/);
    await assert.rejects(
      () => conf("fee_structures", [ch(sid, original, null)]),
      /শিক্ষাবর্ষ/,
    );
    assert.deepEqual(await cfg("student_fees", one.id), b1);
    await db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),'{sessions,0,is_locked}','false')::text where id=${t}`;
    await db`insert into accounting_periods(madrasa_id,period_key,label,start_date,end_date,is_locked) values(${t},'Feb','closed','2026-02-01','2026-02-28',true)`;
    await assert.rejects(
      () => edit([ch(one.id, b1, null), ch(two.id, b2, null)]),
      /লক/,
    );
    assert.deepEqual(await cfg("student_fees", one.id), b1);
    const costly = {
      ...b1,
      base_amount: 12.75,
      payable_amount: 12.75,
      due_amount: 12.75,
    };
    await edit([ch(one.id, b1, costly)]);
    await assert.rejects(() => edit([ch(one.id, b1, null)]), /বদলেছে/);
    const amended = await cfg("student_fees", one.id);
    await assert.rejects(
      () => edit([ch(one.id, amended, { ...costly, base_amount: 1 })]),
      /বিল/,
    );
    // A PSP reservation and its original fee terms survive an attempted edit.
    if (sqlBook) {
      const intent = {
        transaction_id: "held:" + t,
        madrasa_id: t,
        student_id: pupil,
        amount: 2.25,
        total_payable: 2.25,
        provider: "SSLCOMMERZ",
        sslcommerz_scope: "SANDBOX:" + "b".repeat(64),
        status: "PENDING",
        allocations: [
          { student_fee_id: one.id, allocated_amount: 2.25, ...acct },
        ],
      };
      await db`select write_portal_fee_intent(${t},${db.json(intent)},false)`;
      await assert.rejects(() => edit([ch(one.id, amended, null)]), /checkout/);
      assert.deepEqual(await cfg("student_fees", one.id), amended);
      await db`select write_portal_fee_intent(${t},${db.json(intent)},true)`;
    }
    await db`update accounting_periods set is_locked=false,unlocked_at=now(),unlocked_by=${manager} where madrasa_id=${t}`;
    await conf("fee_types", [ch(type, updated, null)]);
    assert.equal((await cfg("fee_types", type)).is_active, false);
    await assert.rejects(
      () => edit([ch("new", null, b("new", "2026-03"))]),
      /খাত/,
    );
    await assert.rejects(
      () => conf("fee_structures", [ch(sid, original, s)]),
      /খাত/,
    );
    const edited = await cfg("student_fees", one.id);
    await edit([ch(one.id, edited, null), ch(two.id, b2, null)]);
    assert.equal(await cfg("student_fees", one.id), undefined);
    assert.equal(await cfg("student_fees", two.id), undefined);
    if (sqlBook) {
      const foreign = (
        await db`select id from fee_types where madrasa_id<>${t} limit 1`
      )[0].id;
      await assert.rejects(
        () => conf("fee_types", [ch(foreign, null, { ...ft, id: foreign })]),
        /প্রতিষ্ঠানের খাত/,
      );
    }
  }
  console.log(
    "PASS SQL/JSON schedule CAS, fee-type races and archive, stale/incomplete force-update, locked batch rollback, exact delete, child and tenant validation",
  );
}
