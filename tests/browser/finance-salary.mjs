import assert from "node:assert/strict";

export async function salaryUI({
  page,
  db,
  t,
  base,
  call,
  session,
  maker,
  reviewer,
  office,
  verify,
}) {
  const [{ id }] =
    await db`insert into teachers(madrasa_id,first_name,last_name,designation) values(${t},'Example','Teacher','Prior') returning id`;
  const prior = {
    id,
    madrasa_id: t,
    staff_id_code: "STF-0010",
    personal: {
      first_name: "Example",
      last_name: "Teacher",
      full_name_bn: "Example Teacher",
    },
    employment: {
      category_id: "cat-teaching",
      designation: "Prior",
      status: "ACTIVE",
      joining_date: "2026-01-01",
    },
    contact: { phone: "" },
    salary: {
      basic_salary: 10,
      allowances: { food: 2.25 },
      deductions: {},
      net_salary: 12.25,
      bank_account_no: "private-fixture-account",
    },
    updated_at: "2026-01-01",
  };
  await db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),'{staff_members}',${db.json([prior])})::text where id=${t}`;
  const w = (
    await db`insert into approval_workflows(madrasa_id,name,request_type,min_amount) values(${t},'Fixture contract','SALARY_CHANGE',0) returning id`
  )[0].id;
  await db`insert into approval_workflow_steps(madrasa_id,workflow_id,step_order,step_name,approver_role,require_step_up) values(${t},${w},1,'Contract approval','super_admin',true)`;
  await db.unsafe("grant update on teachers to service_role");
  const read = async () =>
    (
      await db`select s from madrasas m,jsonb_array_elements(finance_metadata(m)->'staff_members') s where m.id=${t} and s->>'id'=${id}`
    )[0].s;
  await session(maker);
  await page.goto(base + "/dashboard/staff?tab=profile&id=" + id, {
    waitUntil: "networkidle0",
  });
  const tab = `[data-staff-id="${id}"] button[aria-label="কর্মসংস্থান ও পদোন্নতি"]`,
    promote = `[data-staff-id="${id}"] button[aria-label="পদোন্নতি দিন"]`;
  await page.waitForSelector(tab);
  await page.focus(tab);
  await page.keyboard.press("Enter");
  await page.waitForSelector(promote, { visible: true });
  await page.focus(promote);
  await page.keyboard.press("Enter");
  const form =
    'form:has(textarea[placeholder="যেমন: বিশেষ কর্মদক্ষতার কারণে..."])';
  await page.locator(form + " input[type=text]").fill("Senior");
  await page.locator(form + " input[type=number]").fill("0");
  await page.click(form + " button[type=submit]");
  await page.waitForFunction(() =>
    document
      .querySelector("main [role=status]")
      ?.textContent.includes("Pending Approval"),
  );
  assert.deepEqual((await read()).salary, prior.salary);
  assert.equal(
    (await db`select designation from teachers where id=${id}`)[0].designation,
    "Prior",
  );
  const req = (
    await db`select * from approval_requests where madrasa_id=${t} and target_id=${id} and request_type='SALARY_CHANGE'`
  )[0];
  assert.equal(req.status, "PENDING");
  assert.equal(Number(req.amount), 2.25);
  assert.deepEqual(
    [req.payload.salaryTerms.basic_salary, req.payload.salaryTerms.net_salary],
    [0, 2.25],
  );
  const list = async (h) => (await call("/api/approvals", h)).requests;
  const forReviewer = (await list(reviewer)).find((r) => r.id === req.id);
  assert.ok(forReviewer);
  assert.ok(!JSON.stringify(forReviewer).includes("private-fixture-account"));
  assert.ok(!(await list(office)).some((r) => r.id === req.id));
  const nonfinance = (
    await db`select id from users where madrasa_id=${t} and role='office_staff' limit 1`
  )[0].id;
  const legacy = {
    id: "req-old-contract",
    madrasa_id: t,
    type: "SALARY_CHANGE",
    title: "Restricted legacy amount",
    requested_by: { user_id: nonfinance },
    status: "PENDING",
    requested_at: "2026-01-20",
    payload: { bank_account_no: "private-legacy-account" },
  };
  const general = {
    ...legacy,
    id: "req-old-exam",
    type: "RESULT_PUBLISH",
    title: "Visible exam request",
    payload: {},
  };
  await db`update madrasas set security_metadata=security_metadata||${db.json({ approval_requests: [legacy, general], user_security_profiles: { [nonfinance]: { directPermissions: ["user.view", "finance.view"] } } })}::jsonb where id=${t}`;
  const html = async (path, h) => {
    const res = await fetch(base + path, { headers: h });
    assert.equal(res.status, 200);
    return res.text();
  };
  const staffHtml = await html("/dashboard/staff", office);
  assert.ok(staffHtml.includes("Example Teacher"));
  assert.ok(!staffHtml.includes("private-fixture-account"));
  const adminUsers = await html("/dashboard/users", reviewer);
  assert.ok(adminUsers.includes(legacy.title));
  assert.ok(
    !adminUsers.includes("private-legacy-account") &&
      !adminUsers.includes("private-fixture-account"),
  );
  const directory = await html("/dashboard/users", office);
  assert.ok(directory.includes(general.title));
  assert.ok(!directory.includes(legacy.title) && !directory.includes(req.id));
  const url = "/api/approvals/" + req.id + "/decision",
    accept = { decision: "APPROVED" };
  await call(url, maker, "POST", accept, 403);
  const step = await call(url, reviewer, "POST", accept, 403);
  assert.equal(step.code, "STEP_UP_REQUIRED");
  const valid = {
    ...reviewer,
    "x-step-up-token": await verify(step.actionScope),
  };
  const response = await call(url, valid, "POST", accept);
  assert.equal(
    response.executionResult?.executed,
    true,
    JSON.stringify(response.executionResult),
  );
  await call(url, valid, "POST", accept, 400);
  const saved = await read();
  assert.deepEqual(saved.salary, req.payload.salaryTerms);
  assert.equal(saved.employment.designation, "Senior");
  assert.equal(saved.employment_history.length, 1);
  assert.equal(
    (await db`select designation from teachers where id=${id}`)[0].designation,
    "Senior",
  );
  const [outcome] =
    await db`select executed_at,final_decision_by,requested_by from approval_requests where id=${req.id}`;
  assert.ok(outcome.executed_at);
  assert.notEqual(outcome.final_decision_by, outcome.requested_by);
  const receipt = await call(
    "/api/approvals",
    office,
    "POST",
    {
      requestType: "SALARY_CHANGE",
      title: "Manual salary review",
      targetId: id,
      amount: 1,
    },
    201,
  );
  const manual = receipt.id;
  assert.equal(receipt.request.status, "PENDING");
  for (const k of ["steps", "workflow_id", "threshold_amount", "salaryTerms"])
    assert.ok(!(k in receipt.request));
  assert.ok(!(await list(office)).some((r) => r.id === manual));
  const decision = await call(
    "/api/approvals/" + manual + "/decision",
    valid,
    "POST",
    accept,
  );
  assert.equal(decision.executionResult?.executed, false);
  const [manualOutcome] =
    await db`select status,executed_at from approval_requests where id=${manual}`;
  assert.equal(manualOutcome.status, "APPROVED");
  assert.equal(manualOutcome.executed_at, null);
  assert.deepEqual(await read(), saved);
  console.log(
    "PASS promotion form: zero basic with allowance, pending not booked, distinct reviewer + scoped TOTP, projected list, one contract and teacher update",
  );
}
