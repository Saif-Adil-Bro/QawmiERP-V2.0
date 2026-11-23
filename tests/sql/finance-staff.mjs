import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function staffChangeChecks(db, t, actor, other) {
  const wf = randomUUID(),
    step = {
      id: randomUUID(),
      step_order: 1,
      step_name: "Review",
      approver_role: "admin",
      require_step_up: true,
      sla_hours: 24,
      allow_delegation: false,
    };
  const cfg = {
    id: wf,
    madrasa_id: t,
    name: "Contract test",
    request_type: "SALARY_CHANGE",
    min_amount: 0,
    is_active: false,
    priority: 0,
    require_two_person: true,
    steps: [step],
  };
  const write = (op, w = cfg, tenant = t, user = actor) =>
    db`select finance_write_workflow(${tenant},${user},${wf},${op},${db.json(w)})`;
  await write("create");
  await assert.rejects(() =>
    write("edit", { ...cfg, steps: [step, { ...step, id: randomUUID() }] }),
  );
  assert.equal(
    (
      await db`select require_step_up from approval_workflow_steps where workflow_id=${wf} and id=${step.id}`
    )[0].require_step_up,
    true,
  );
  const [{ id: otherActor }] =
    await db`insert into auth.users(id) values(gen_random_uuid()) returning id`;
  await db`insert into users(id,madrasa_id,full_name,email) values(${otherActor},${other},'School B reviewer','hr-b@example.invalid')`;
  await assert.rejects(() =>
    write("create", { ...cfg, madrasa_id: other }, other, otherActor),
  );
  await assert.rejects(() => write("archive", cfg, other, otherActor));
  const [owner] =
    await db`select madrasa_id,is_active from approval_workflows where id=${wf}`;
  assert.equal(owner.madrasa_id, t);
  const [{ id: usedId }] =
    await db`insert into approval_requests(madrasa_id,workflow_id,request_type,title,target_id) values(${t},${wf},'SALARY_CHANGE','History','fixture-staff') returning id`;
  await assert.rejects(() => write("edit"));
  await write("archive");
  assert.equal(
    (await db`select workflow_id from approval_requests where id=${usedId}`)[0]
      .workflow_id,
    wf,
  );
  assert.equal(
    (
      await db`select require_step_up from approval_workflow_steps where id=${step.id}`
    )[0].require_step_up,
    true,
  );
  const [{ id }] =
    await db`insert into teachers(madrasa_id,first_name,last_name,designation) values(${t},'Teacher','Example','Prior') returning id`;
  const prior = {
      id,
      madrasa_id: t,
      updated_at: "2026-02-01",
      salary: { basic_salary: 10, net_salary: 10 },
    },
    next = {
      ...prior,
      updated_at: "2026-02-20",
      salary: { basic_salary: 12, net_salary: 14.25 },
    };
  await db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),'{staff_members}',coalesce(finance_metadata(madrasas)->'staff_members','[]')||${db.json([prior])}::jsonb)::text where id=${t}`;
  const req = randomUUID();
  const payload = {
    action: "promote_staff",
    staffId: id,
    salaryTerms: next.salary,
    priorUpdate: prior.updated_at,
    priorSalary: prior.salary,
  };
  await db`insert into approval_requests(id,madrasa_id,request_type,title,target_id,amount,payload,status,final_decision_by) values(${req},${t},'SALARY_CHANGE','Example',${id},14.25,${db.json(payload)},'APPROVED',${actor})`;
  const post = (row, tenant = t) =>
    db`select finance_edit_staff(${tenant},${actor},${db.json(prior)},${db.json(row)},${db.json({ designation: "Senior" })},null,${req})`;
  await assert.rejects(
    () => post({ ...next, salary: { basic_salary: 13, net_salary: 14.25 } }),
    /বেতন/,
  );
  await assert.rejects(() => post(next, other));
  assert.equal(
    (await db`select designation from teachers where id=${id}`)[0].designation,
    "Prior",
  );
  // A failure AFTER the mirror update must still preserve the teacher, the
  // prior salary contract and the audit in the tenant's metadata.
  const before = (
    await db`select registration_no,finance_source_revision from madrasas where id=${t}`
  )[0];
  await db.unsafe(`create function fixture_block_contract() returns trigger language plpgsql as $$ begin raise exception 'fixture blocked contract write'; end $$;
    create trigger fixture_block_contract before update on madrasas for each row execute function fixture_block_contract()`);
  try {
    await assert.rejects(() => post(next), /fixture blocked contract write/);
  } finally {
    await db.unsafe(
      "drop trigger fixture_block_contract on madrasas; drop function fixture_block_contract()",
    );
  }
  assert.deepEqual(
    (
      await db`select registration_no,finance_source_revision from madrasas where id=${t}`
    )[0],
    before,
  );
  assert.equal(
    (await db`select designation from teachers where id=${id}`)[0].designation,
    "Prior",
  );
  await post(next);
  await assert.rejects(() => post(next), /বদলেছে/);
  const current = async () =>
    (
      await db`select m from madrasas t,jsonb_array_elements(finance_metadata(t)->'staff_members') m where t.id=${t} and m->>'id'=${id}`
    )[0].m;
  assert.deepEqual(await current(), next);
  assert.equal(
    (await db`select designation from teachers where id=${id}`)[0].designation,
    "Senior",
  );
  await assert.rejects(
    () =>
      db`update madrasas set registration_no=jsonb_set(finance_metadata(madrasas),'{staff_members}',(select jsonb_agg(case when m->>'id'=${id} then ${db.json(prior)}::jsonb else m end) from jsonb_array_elements(finance_metadata(madrasas)->'staff_members') m))::text where id=${t}`,
    /চুক্তি/,
  );
  assert.deepEqual(await current(), next);
  const [{ id: fresh }] =
    await db`insert into teachers(madrasa_id,first_name,last_name) values(${t},'Unenrolled','Teacher') returning id`;
  const enroll = () =>
    db`select finance_register_teacher(${t},${actor},${db.json({ id: fresh, madrasa_id: t, employment: {}, id_card: {}, salary: { net_salary: 500 } })})`;
  await enroll();
  await assert.rejects(enroll);
  const [m] =
    await db`select finance_metadata(madrasas) meta from madrasas where id=${t}`;
  const teacher = m.meta.staff_members.find((s) => s.id === fresh);
  assert.equal(teacher.salary.net_salary, 0);
  assert.ok(teacher.staff_id_code);
  const addition = {
    id: `sal_${id}_2018_11`,
    staff_id: id,
    madrasa_id: t,
    month: "11",
    year: "2018",
    status: "PENDING",
    net_salary: 14.25,
  };
  const draft = (items) =>
    db`select finance_draft_payroll(${t},${actor},${db.json(m.meta.staff_members)},${db.json(m.meta.staff_salary_records || [])},${db.json(items)})`;
  await assert.rejects(
    () => draft([{ ...addition, net_salary: 16 }]),
    /Invalid payroll draft/,
  );
  await assert.rejects(
    () => draft([addition, addition]),
    /Duplicate payroll draft/,
  );
  await draft([addition]);
  await assert.rejects(() => draft([addition]), /চুক্তি বদলেছে/);
  await assert.rejects(
    () =>
      db`update madrasas set registration_no=${JSON.stringify(m.meta)} where id=${t}`,
    /সংরক্ষিত পেরোল/,
  );
  const [{ n }] =
    await db`select count(*)::int n from madrasas m,jsonb_array_elements(finance_metadata(m)->'staff_salary_records') r where m.id=${t} and r->>'id'=${addition.id}`;
  assert.equal(n, 1);
  console.log(
    "PASS workflow owner/atomic step/used history; salary approval/contract + teacher rollback; explicit zero-salary enrolment and stale/duplicate payroll draft refused",
  );
}
