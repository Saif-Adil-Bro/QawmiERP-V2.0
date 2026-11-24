import assert from "node:assert/strict";

export async function testCalendar(db, actor) {
  const jan = {
      period_key: "2026-01",
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      is_locked: true,
      locked_at: "2026-02-01T00:00:00Z",
    },
    feb = {
      ...jan,
      period_key: "2026-02",
      start_date: "2026-02-01",
      end_date: "2026-02-28",
    };
  const [{ id: t }] =
    await db`insert into madrasas(name,contact_email,registration_no) values('Calendar','calendar@example.test',${JSON.stringify({ accounting_periods: [jan] })}) returning id`;
  await db`insert into madrasa_settings(madrasa_id,namespace,setting_key,setting_value) values(${t},'locks','accounting_periods',${db.json([feb])})`;
  const [{ id: manager }] =
    await db`insert into auth.users(id) values(gen_random_uuid()) returning id`;
  await db`insert into users(id,madrasa_id,email,full_name,role) values(${manager},${t},'manager@example.test','Manager','admin')`;
  const pay = (date) =>
    db`insert into donations(madrasa_id,amount,donation_date,fund_id) values(${t},1,${date},'fund-general')`;
  const holds = (date) => assert.rejects(() => pay(date), /লক/);
  await holds("2026-01-01");
  await holds("2026-02-28");
  await db`insert into accounting_periods(madrasa_id,period_key,start_date,end_date,label,is_locked) values(${t},'2026-01','2026-01-01','2026-01-31','Jan',false)`;
  await holds("2026-01-31"); // not an explicit unlock
  await assert.rejects(
    () =>
      db`update accounting_periods set end_date='2026-01-30' where madrasa_id=${t}`,
    /মূল তারিখ/,
  );
  await assert.rejects(
    () =>
      db`update accounting_periods set unlocked_by=${actor} where madrasa_id=${t}`,
    /প্রতিষ্ঠান/,
  );
  await db`update accounting_periods set unlocked_by=${manager},unlocked_at='2026-01-31T00:00:00Z' where madrasa_id=${t}`;
  await holds("2026-01-02"); // stale unlock before original close
  await db`update accounting_periods set unlocked_at='2026-02-02T00:00:00Z' where madrasa_id=${t}`;
  await pay("2026-01-01");
  await holds("2026-02-01");
  await assert.rejects(
    () => db`update madrasas set registration_no='{}' where id=${t}`,
    /পুরোনো হিসাবকাল/,
  );
  const src = {
    id: "L",
    transport_labour_cost: 2.35,
    collection_date: "2026-02-09",
  };
  await assert.rejects(
    () =>
      db`select finance_replace_sources(${t},${db.json({ leather_batches: null })},${db.json({ leather_batches: [src] })})`,
    /লক/,
  );
  // Hold a close open while a separate writer really waits on it; after
  // commit the writer must see the close, not its pre-lock statement snapshot.
  const close = await db.reserve(),
    poster = await db.reserve();
  try {
    await close`begin`;
    await close`insert into accounting_periods(madrasa_id,period_key,label,start_date,end_date,is_locked) values(${t},'April','April','2026-04-01','2026-04-30',true)`;
    const [{ pid }] = await poster`select pg_backend_pid() pid`;
    const posted =
      poster`insert into donations(madrasa_id,amount,donation_date,fund_id) values(${t},2,'2026-04-05','fund-general')`.then(
        () => null,
        (e) => e.message,
      );
    let blocked = false;
    for (let i = 0; i < 50 && !blocked; i++)
      [{ blocked }] =
        await db`select cardinality(pg_blocking_pids(${pid}))>0 blocked from pg_sleep(0.01)`;
    await close`commit`;
    assert.equal(blocked, true);
    assert.match(await posted, /লক/);
  } finally {
    await close`rollback`;
    close.release();
    poster.release();
  }
  await db`update madrasa_settings set setting_value=${db.json([{ ...feb, end_date: "not-a-date" }])} where madrasa_id=${t}`;
  await assert.rejects(() => pay("2026-03-01")); // damaged calendar is not "no locked periods"
  assert.equal(
    (await db`select count(*) from donations where madrasa_id=${t}`)[0].count,
    "1",
  );
  console.log(
    "PASS legacy metadata and structured closes, SQL unconfirmed vs explicit unlock, immutable windows, source-only costs, close versus concurrent post, damaged calendar fails closed",
  );
}
