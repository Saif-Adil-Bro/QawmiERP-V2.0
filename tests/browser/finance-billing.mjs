import assert from "node:assert/strict";

// Exercise the mounted generators and check the *posted* rows. No test-only app
// route, accepted status masquerading as a write, or pre-created fee structure.
export async function billingChecks({
  base,
  db,
  t,
  call,
  reviewer,
  clerk,
  mobile,
  cashier,
  foreign,
  limited,
  verify,
  pupil,
  jt,
  classId,
}) {
  const term = "current:" + t,
    structs = "/api/mobile/fee-structures",
    bills = "/api/mobile/student-fees";
  const book = async () =>
    (await db`select finance_metadata(m) m from madrasas m where id=${t}`)[0].m;
  const schedule = {
    name: "Class dues",
    class_id: classId,
    class_name: "Fixture Jamia",
    student_category: "ALL",
    session_id: "default",
    items: [
      {
        fee_type_id: jt.id,
        fee_type_name: jt.name,
        amount: 7.25,
        frequency: "MONTHLY",
      },
    ],
  };
  const denied = await call(structs, mobile, "POST", schedule, 403);
  assert.equal(denied.code, "STEP_UP_REQUIRED");
  await call(structs, limited, "POST", schedule, 403);
  const headers = {
    ...mobile,
    "x-step-up-token": await verify("fee_structure.edit"),
  };
  const sid = (await call(structs, headers, "POST", schedule, 201)).data.id;
  assert.equal(
    (await call(structs + "/" + sid, cashier)).data.session_id,
    "default",
  );
  assert.equal(
    (await call(`${structs}?class_id=${classId}&limit=1`, cashier)).data[0]
      .fee_structure_items[0].amount,
    7.25,
  );
  assert.equal(
    (await call(`${structs}?class_id=${classId}&limit=1&page=2`, cashier)).data
      .length,
    0,
  );
  await call(structs + "/" + sid, foreign, "GET", undefined, 404);
  // A new active term does not retag old bills or structures. A default selection
  // for a NEW structure resolves to the active term.
  await db`insert into academic_sessions(id,madrasa_id,name,start_date,end_date,is_active) values(${term},${t},'Active term','2026-01-01','2026-12-31',true)`;
  assert.equal(
    (await call(structs, headers, "POST", schedule, 201)).data.session_id,
    term,
  );
  await db`update students set class_id=${classId} where id=${pupil}`;
  const alumni =
    await db`insert into students(id,madrasa_id,first_name,last_name) select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,${t},'Fixture','Past' from generate_series(1,501) i returning id`;
  const profiles = Object.fromEntries(
    alumni.map((s) => [s.id, { student_status: "ALUMNI" }]),
  );
  profiles[pupil] = {
    student_status: "ACTIVE",
    residential_status: "আবাসিক",
    is_boarding: true,
    boarding_type: "হাফ-ফ্রি",
  };
  await db`insert into fee_discount_waivers(madrasa_id,student_id,session_id,discount_type,value,status,reason) values(${t},${pupil},${term},'PERCENTAGE',10,'APPROVED','Fixture concession')`;
  await db`update madrasas set registration_no=(finance_metadata(madrasas)||${db.json({ student_profiles: profiles })}::jsonb)::text where id=${t}`;
  const manual = (period) =>
    call("/api/fees/generate", clerk, "POST", {
      sessionId: "default",
      billingPeriod: period,
      dueDate: "2026-09-20",
    });
  const cron = async (period) =>
    (
      await call("/api/cron/monthly-fees", reviewer, "POST", {
        billingPeriod: period,
      })
    ).results[0];
  const first = await manual("সেপ্টেম্বর (September) 2026");
  assert.equal(first.generatedCount, 1, JSON.stringify(first));
  assert.equal((await cron("2026-09")).summary.skippedExisting, 1);
  const run = await cron("2026-10");
  assert.equal(run.successCount, 1, JSON.stringify(run));
  assert.equal(run.failedCount, 0);
  const batch = (await book()).student_fees.filter((f) =>
    ["2026-09", "2026-10"].includes(f.billing_period),
  );
  assert.equal(batch.length, 2);
  for (const f of batch)
    assert.deepEqual(
      [
        f.student_id,
        f.session_id,
        f.base_amount,
        f.discount_amount,
        f.due_amount,
        f.fund_id,
      ],
      [pupil, term, 7.25, 0.73, 6.52, "fund-general"],
    );
  const ai = (period) => ({
    actionType: "create_student_fee",
    payload: {
      studentId: pupil,
      feeTypeId: jt.id,
      feeTypeName: jt.name,
      billingPeriod: period,
      amount: 8.15,
    },
  });
  const invoice = await call("/api/ai/confirm", clerk, "POST", ai("2026-07"));
  const posted = (await call(bills + "/" + invoice.id, cashier)).data;
  assert.equal(posted.session_id, term);
  assert.equal(posted.due_amount, 8.15);
  await db`update academic_sessions set is_locked=true where id=${term}`;
  const before = (await book()).student_fees;
  assert.ok((await manual("2026-08")).error);
  assert.equal((await cron("2026-08")).status, "FAILED");
  await call("/api/ai/confirm", clerk, "POST", ai("2026-08"), 400);
  await call(
    bills,
    cashier,
    "POST",
    {
      student_id: pupil,
      fee_type_id: jt.id,
      billing_period: "2026-08",
      amount: 8,
    },
    400,
  );
  assert.deepEqual((await book()).student_fees, before);
  await db`update academic_sessions set is_locked=false where id=${term}`;
  console.log(
    "PASS real step-up structure create, empty/default vs active term, 502-pupil manual and cron, same posted concession, idempotent monthly label, AI invoice and locked generators",
  );
  // These pupils have no financial rows. Keep the browser billing demo small.
  await db`delete from students where madrasa_id=${t} and id in ${db(alumni.map((s) => s.id))}`;
  await db`insert into bazar_expenses(madrasa_id,expense_date,amount,fund_id) values(${t},'2026-08-01',10.25,'fund-general')`;
  await db`insert into meal_entries(madrasa_id,student_id,entry_date,meal_status) select ${t},${pupil},date '2015-01-01'+i,'Off' from generate_series(0,1002) i`;
  await db`insert into meal_entries(madrasa_id,student_id,entry_date,meal_status) values(${t},${pupil},'2026-08-08','On')`;
  return async function boardingUI(page) {
    const sync = async (expectError) => {
      await page.goto(base + "/dashboard/boarding/reports", {
        waitUntil: "networkidle0",
      });
      await page.select("#select_year", "2026");
      await page.select("#select_month", "08");
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (e) =>
            e.textContent.includes("২০১৫") || e.textContent.includes("2015"),
        ),
      );
      const btn = "#btn_sync_boarding_accounting:not(:disabled)";
      await page.waitForSelector(btn);
      await page.click(btn);
      await page.waitForSelector("main [role=status], main [role=alert]");
      const err = await page
        .$eval("main [role=alert]", (e) => e.innerText)
        .catch(() => null);
      if (expectError) assert.match(err || "", expectError);
      else assert.equal(err, null);
    };
    const board = async () =>
      (await book()).student_fees.filter((f) => f.id.startsWith("fee_bdr_"));
    await sync();
    let [row] = await board();
    assert.ok(row);
    assert.deepEqual(
      [row.session_id, row.base_amount, row.discount_amount, row.due_amount],
      [term, 10.25, 5.13, 5.12],
    );
    const id = row.id;
    await db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),${["student_profiles", pupil, "boarding_type"]}::text[],${db.json("লিল্লাহ বোর্ডিং (ফ্রি)")})::text where id=${t}`;
    await sync();
    const saved = await board();
    assert.equal(saved.length, 1);
    row = saved[0];
    assert.deepEqual(
      [row.id, row.discount_amount, row.due_amount, row.status],
      [id, 10.25, 0, "WAIVED"],
    );
    await db`update meal_entries set meal_status='Off' where madrasa_id=${t} and entry_date='2026-08-08'`;
    await sync(/মিল হাজিরা নেই/);
    assert.deepEqual(await board(), saved);
    await db`update meal_entries set meal_status='On' where madrasa_id=${t} and entry_date='2026-08-08'`;
    await db`update bazar_expenses set status='VOID' where madrasa_id=${t} and expense_date='2026-08-01'`;
    await sync();
    const [zero] = await board();
    assert.deepEqual([zero.id, zero.base_amount, zero.due_amount], [id, 0, 0]);
    const category = (v) =>
      db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),${["student_profiles", pupil, "boarding_type"]}::text[],${db.json(v)})::text where id=${t}`;
    await category("সাধারণ পেইং");
    await db`update bazar_expenses set status='COMPLETED' where madrasa_id=${t} and expense_date='2026-08-01'`;
    await sync();
    const url = "/api/mobile/fee-payments";
    const receipt = (
      await call(
        url,
        cashier,
        "POST",
        { student_id: pupil, student_fee_id: id, total_amount_received: 0.75 },
        201,
      )
    ).data;
    assert.equal((await board())[0].due_amount, 9.5);
    await category("হাফ-ফ্রি");
    const withPayment = await board();
    await sync(/আদায়যুক্ত/);
    assert.deepEqual(await board(), withPayment);
    await call(url + "/" + receipt.id, cashier, "DELETE", {
      reason: "Fixture reversal",
    });
    const voided = await board();
    assert.equal(voided[0].paid_amount, 0);
    await sync(/রসিদ|অপরিবর্তনীয়/);
    assert.deepEqual(await board(), voided);
    console.log(
      "PASS mounted boarding report, complete historical months, half/full/zero on one invoice; unallocated costs, paid and voided receipt history refuse repricing",
    );
  };
}
