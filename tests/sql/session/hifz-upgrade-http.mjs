// Mounted routes on the production build, disposable PG/provider sessions only.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { withSessionStack } from "./session-stack.mjs";
import { seedGuardians } from "./guardian-fixture.mjs";
await withSessionStack(async (stack) => {
  const { db, base, lite, anon, mobileKey } = stack;
  const [family, foreign] = await seedGuardians(stack);
  const [s, peer, notMine] = family.children,
    t = family.tenant;
  const [teacher, group, subject] = Array.from({ length: 3 }, () =>
      randomUUID(),
    ),
    email = "hifz-fixture@example.test",
    password = randomBytes(32).toString("hex");
  const signup = await lite
    .getClient({ apikey: anon })
    .auth.signUp({ email, password });
  const uid = signup.data.user.id;
  await db`INSERT INTO users(id,madrasa_id,role,full_name,email) VALUES(${uid},${t},'hifz_teacher','Fixture Hifz teacher',${email})`;
  await db`INSERT INTO teachers(id,madrasa_id,first_name,last_name,auth_user_id) VALUES(${teacher},${t},'Hifz','Teacher',${uid})`;
  await db`INSERT INTO classes(id,madrasa_id,name) VALUES(${group},${t},'হিফজ')`;
  await db`UPDATE students SET class_id=${group} WHERE id IN (${s.id},${peer.id})`;
  await db`INSERT INTO subjects(id,madrasa_id,name) VALUES(${subject},${t},'Quran')`;
  await db`INSERT INTO teacher_subjects(madrasa_id,teacher_id,class_id,subject_id) VALUES(${t},${teacher},${group},${subject})`;
  await db.unsafe(
    "GRANT SELECT ON public.users,public.madrasas TO authenticated; GRANT SELECT,INSERT,UPDATE ON public.madrasa_settings TO service_role; GRANT INSERT,UPDATE ON public.hifz_logs TO service_role;",
  );
  async function api(path, headers = {}, body, status = 200) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { ...headers, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await r.json();
    assert.equal(
      r.status,
      status,
      `${path} ${JSON.stringify(json).slice(0, 600)}`,
    );
    return json;
  }
  async function login(email, password, mobile) {
    const r = await fetch(
      base + (mobile ? "/api/mobile/auth/login" : "/api/auth/login"),
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": mobileKey },
        body: JSON.stringify({ email, password }),
      },
    );
    assert.equal(r.status, 200);
    return mobile
      ? {
          "x-api-key": mobileKey,
          authorization: `Bearer ${(await r.json()).data.access_token}`,
        }
      : {
          cookie: r.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .join("; "),
        };
  }
  // SW install happens before login too. A login HTML redirect cached as JS
  // would break the cold form even after a successful authenticated sync.
  for (const [asset,type] of [['/offline-hifz.js','javascript'],['/hifz.css','text/css']]){
    const r=await fetch(base+asset,{redirect:'manual'});assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes(type));
  }
  const cookie = await login(email, password, false),
    bearer = await login(email, password, true),
    guardian = await login(family.email, family.password, true),
    owner = `${t}:${uid}:teacher`;
  const save = (body, status = 200, native = false) =>
    api(
      native ? "/api/mobile/portal/teacher" : "/api/teacher/save-hifz",
      { ...(native ? bearer : cookie), "X-Qawmi-Sync-Owner": owner },
      { current_class_id: group, ...body },
      status,
    );
  const profile = {
    kind: "profile",
    student_id: s.id,
    default_sabina_partner_id: peer.id,
    hifz_category: "khatmi",
    previously_memorized_paras: Array.from({ length: 30 }, (_, i) => i + 1),
  };
  await save({ ...profile, previously_memorized_paras: [1] }, 400);
  await save({ ...profile, default_sabina_partner_id: notMine.id }, 403);
  await save({ ...profile, student_id: foreign.children[0].id }, 403);
  await save(profile);
  const daily = {
    current_date: "2026-11-05",
    records: [
      {
        student_id: s.id,
        student_category: "khatmi",
        morning_session_done: true,
        morning_para_from: 1,
        morning_para_to: 30,
        morning_pages: 610,
        morning_mistakes: 2,
        notes: "Fixture মন্তব্য",
      },
    ],
  };
  await save(daily);
  await save(daily);
  const weekly = {
    kind: "weekly",
    sabina_date: "2026-11-05",
    student_id: s.id,
    listener_student_id: peer.id,
    para_from: 2,
    para_to: 4,
    counts: { 2: 0, 3: 2, 4: 3 },
  };
  await save(weekly, 200, true);
  const special = {
    kind: "special",
    id: randomUUID(),
    title: "Fixture paired Sabina",
    start_date: "2026-11-05",
    duration_days: 3,
    listening_mode: "one_to_one",
    participants: { reciter_group_ids: [s.id], listener_group_ids: [peer.id] },
  };
  await save(special);
  const sitting = {
    kind: "sitting",
    event_id: special.id,
    id: randomUUID(),
    reciter_id: s.id,
    listener_ids: [peer.id],
    timestamp: "2026-11-05T05:00:00+06:00",
    session_label: "ফজর",
    para_from: 1,
    para_to: 2,
    counts: { 2: 3 },
  };
  await save(sitting);
  await save(sitting);
  const personal = async (id) =>
    (await api("/api/mobile/portal/student?student_id=" + id, guardian)).data;
  let view = await personal(s.id);
  assert.equal(view.hifz_profiles[0].total_khatams_completed, 1);
  assert.equal(view.hifz_logs.length, 1);
  assert.deepEqual(
    view.hifz_weekly_sabina[0].para_breakdown.map((p) => p.status),
    ["perfect", "good", "weak"],
  );
  assert.equal(view.hifz_special_sabina[0].session_logs.length, 1);
  assert.equal(
    (await personal(peer.id)).hifz_special_sabina[0].session_logs.length,
    0,
  );
  assert.equal((await personal(notMine.id)).hifz_profiles.length, 0);
  await api("/api/mobile/hifz", guardian, undefined, 403);
  await api(
    "/api/mobile/portal/teacher",
    guardian,
    { ...weekly, current_class_id: group },
    403,
  );
  const archive =
    await db`SELECT setting_value FROM madrasa_settings WHERE madrasa_id=${t} AND namespace LIKE 'hifz_%'`;
  assert.equal(archive.length, 3);
  assert.ok(!JSON.stringify(archive).includes(special.title));
  console.log(
    "OK mounted cookie/bearer: notes + structured fallback, Thursday, class/tenant denials and selected-child projections",
  );
  const ddl = await db.reserve();
  try {
    await ddl.unsafe(
      await readFile("supabase_hifz_upgrade_migration.sql", "utf8"),
    );
  } finally {
    ddl.release();
  }
  await lite.connection.clearSchemaCache();
  await save(profile);
  await save(weekly);
  await save({ ...sitting, id: randomUUID(), session_label: "আসর" }, 200, true);
  await save({ kind: "finish", event_id: special.id });
  await save({ ...special, id: randomUUID(), title: "SQL event" });
  await save({
    ...daily,
    records: [{ ...daily.records[0], morning_para_to: 29 }],
  });
  await save({
    ...daily,
    current_date: "2026-11-06",
    records: [{ ...daily.records[0], morning_para_from: 30 }],
  });
  view = await personal(s.id);
  assert.deepEqual(view.hifz_profiles[0].khatam_completion_dates, [
    "2026-11-06",
  ]);
  assert.equal(view.hifz_weekly_sabina.length, 1);
  assert.equal(
    view.hifz_special_sabina.find((v) => v.id === special.id).session_logs
      .length,
    2,
  );
  assert.equal(view.hifz_special_sabina.length, 2);
  const [totals] =
    await db`SELECT total_khatams_completed FROM hifz_student_profiles WHERE student_id=${s.id}`;
  assert.equal(totals.total_khatams_completed, 1);
  const rev1 = randomUUID(),
    rev2 = randomUUID(),
    day = "2026-11-07";
  const next = {
    current_date: day,
    records: [
      {
        ...daily.records[0],
        morning_para_from: 1,
        morning_para_to: 1,
        change_id: rev1,
        expected_revision: null,
      },
    ],
  };
  await save(next);
  await save(next);
  await save({
    ...next,
    records: [
      {
        ...next.records[0],
        morning_para_to: 2,
        change_id: rev2,
        expected_revision: rev1,
      },
    ],
  });
  await save(next, 409);
  assert.equal(
    (
      await db`SELECT morning_para_to FROM hifz_logs WHERE student_id=${s.id} AND log_date=${day}`
    )[0].morning_para_to,
    2,
  );
  // Two concurrent database transactions for different days of one student.
  await Promise.all(
    [
      ["2026-11-11", 1, 15],
      ["2026-11-12", 16, 30],
    ].map(
      ([d, lo, hi]) =>
        db`INSERT INTO hifz_logs(madrasa_id,student_id,log_date,student_category,morning_session_done,morning_para_from,morning_para_to) VALUES(${t},${peer.id},${d},'khatmi',true,${lo},${hi})`,
    ),
  );
  assert.equal(
    (
      await db`SELECT total_khatams_completed FROM hifz_student_profiles WHERE student_id=${peer.id}`
    )[0].total_khatams_completed,
    1,
  );
  console.log(
    "OK: acknowledged daily replay is a no-op, stale replay cannot overwrite a correction, concurrent different-day sessions complete one cycle",
  );
  const adminEmail = "hifz-admin@example.test";
  const { data: account } = await lite
    .getClient({ apikey: anon })
    .auth.signUp({ email: adminEmail, password });
  await db`INSERT INTO users(id,madrasa_id,role,email,full_name) VALUES(${account.user.id},${t},'admin',${adminEmail},'Admin')`;
  const adminMobile = await login(adminEmail, password, true),
    adminCookie = await login(adminEmail, password, false);
  const dailyList = await api(
    `/api/mobile/hifz?student_id=${s.id}&log_date=2026-11-05`,
    adminMobile,
  );
  assert.equal(dailyList.data.length, 1);
  assert.equal(dailyList.data[0].morning_para_to, 29);
  assert.equal(
    (await api("/api/mobile/hifz?kind=weekly", adminMobile)).data.length,
    1,
  );
  const newDaily = (
    await api(
      "/api/mobile/hifz",
      adminMobile,
      {
        student_id: peer.id,
        log_date: "2026-11-15",
        sabak_para: 2,
        sabak_mistakes: 2,
      },
      201,
    )
  ).data;
  const item = base + "/api/mobile/hifz/" + newDaily.id;
  const patch = await fetch(item, {
    method: "PATCH",
    headers: { ...adminMobile, "content-type": "application/json" },
    body: JSON.stringify({ sabak_mistakes: 1 }),
  });
  assert.equal(patch.status, 200);
  assert.match((await patch.json()).data.notes, /"sabak_mistakes":1/);
  assert.equal(
    (await fetch(item, { method: "DELETE", headers: adminMobile })).status,
    200,
  );
  const widgetPage = await fetch(base + "/dashboard", { headers: adminCookie });
  assert.equal(widgetPage.status, 200);
  const html = await widgetPage.text();
  assert.ok(html.includes('aria-label="হিফজুল কুরআন ও সবিনা সারসংক্ষেপ"'));
  assert.ok(html.includes("SQL event"));
  const audits =
    await db`SELECT action,actor_id FROM system_audit_logs WHERE madrasa_id=${t} AND module='hifz'`;
  assert.ok(audits.length >= 10);
  assert.ok(audits.every((a) => [uid, account.user.id].includes(a.actor_id)));
  console.log(
    "OK mounted cutover: profile/weekly promoted without duplicates, archived event stays editable, canonical daily cycles and actor-bound audit",
  );
});
