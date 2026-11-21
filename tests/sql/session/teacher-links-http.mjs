// Real app cookie and independent mobile login, real FK/profile binding in disposable PG.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { withSessionStack } from "./session-stack.mjs";
await withSessionStack(async ({ db, lite, base, anon, mobileKey }) => {
  const email = "instructor@example.test",
    password = randomBytes(32).toString("hex");
  const [tenant, teacher, peer, group, subject, mine] = Array.from(
    { length: 6 },
    () => randomUUID(),
  );
  const signup = await lite
    .getClient({ apikey: anon })
    .auth.signUp({ email, password });
  assert.ok(!signup.error && signup.data.user, "fixture account");
  const uid = signup.data.user.id;
  await db`INSERT INTO public.madrasas(id,name,contact_email,metadata,security_metadata) VALUES (${tenant},'Fixture',${email},'{}','{}')`;
  await db`INSERT INTO public.users(id,madrasa_id,role,full_name,email) VALUES (${uid},${tenant},'teacher','Same name',${email})`;
  // No users.teacher_id or matching email; only the administrator-maintained auth link should match.
  await db`INSERT INTO public.teachers(id,madrasa_id,first_name,last_name,auth_user_id) VALUES (${teacher},${tenant},'Same','name',${uid}),(${peer},${tenant},'Same','name',NULL)`;
  await db`INSERT INTO public.classes(id,madrasa_id,name) VALUES (${group},${tenant},'Class')`;
  await db`INSERT INTO public.subjects(id,madrasa_id,name) VALUES (${subject},${tenant},'Subject')`;
  await db`INSERT INTO public.teacher_subjects(madrasa_id,teacher_id,class_id,subject_id) VALUES (${tenant},${teacher},${group},${subject})`;
  for (const [period, instructor] of [
    [mine, teacher],
    [randomUUID(), peer],
    [randomUUID(), null],
  ])
    await db`INSERT INTO public.routines(id,madrasa_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time) VALUES (${period},${tenant},${group},${subject},${instructor},'Monday','08:00','09:00')`;
  const login = async (mobile) => {
    const res = await fetch(
      base + (mobile ? "/api/mobile/auth/login" : "/api/auth/login"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(mobile ? { "x-api-key": mobileKey } : {}),
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(20000),
      },
    );
    assert.equal(res.status, 200, "fixture teacher password login");
    if (!mobile)
      return {
        cookie: res.headers
          .getSetCookie()
          .map((h) => h.split(";")[0])
          .join("; "),
      };
    return {
      "x-api-key": mobileKey,
      authorization: `Bearer ${(await res.json()).data.access_token}`,
    };
  };
  const cookie = await login(false),
    bearer = await login(true);
  async function check(linked) {
    for (const [path, headers] of [
      ["/api/portal/snapshot?portal=teacher", cookie],
      ["/api/mobile/portal/teacher", bearer],
    ]) {
      const res = await fetch(base + path, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      assert.equal(data.profile.id, uid);
      assert.equal(data.teacher?.id ?? null, linked ? teacher : null);
      assert.deepEqual(
        data.assigned_subjects.map((a) => a.subject_id),
        linked ? [subject] : [],
      );
      assert.deepEqual(
        data.routines.map((r) => r.id),
        linked ? [mine] : [],
      );
    }
  }
  await check(true);
  await db`UPDATE public.teachers SET auth_user_id=NULL WHERE id=${teacher}`;
  await check(false);
  console.log(
    "OK mounted teacher cookie/Bearer: SQL-linked profile and direct period only; no name-based reassignment after unlink",
  );
});
