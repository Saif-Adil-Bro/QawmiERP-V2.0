// Runs as part of exam-freeze.mjs, with disposable accounts, Postgres and a loopback-only browser.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fixtureProxy } from "./fixture-proxy.mjs";

export async function exerciseTeacherMarks({ db, lite, anon, mobileKey, base, api }) {
  const tools = createRequire(resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"));
  const chromium = tools("@sparticuz/chromium");
  const [
    tenant,
    foreign,
    teacher,
    group,
    otherClass,
    subject,
    frozen,
    open,
    otherExam,
    zero,
    pending,
    component,
    resultId,
  ] = Array.from({ length: 13 }, () => randomUUID());
  const email = `marks-${teacher}@example.test`,
    admin = `admin-${teacher}@example.test`,
    password = randomBytes(32).toString("hex");
  await db`INSERT INTO public.madrasas(id,name,contact_email,metadata,security_metadata) VALUES (${tenant},'Marks',${email},'{}','{}'),(${foreign},'Foreign', 'other@example.test','{}','{}')`;
  for (const [name, role] of [
    [email, "teacher"],
    [admin, "muhtamim"],
  ]) {
    const { data, error } = await lite.getClient({ apikey: anon }).auth.signUp({ email: name, password });
    assert.ok(!error && data.user);
    await db`INSERT INTO public.users(id,madrasa_id,role,full_name,email) VALUES (${data.user.id},${tenant},${role},'Fixture',${name})`;
    if (name === email)
      await db`INSERT INTO public.teachers(id,madrasa_id,first_name,last_name,auth_user_id) VALUES (${teacher},${tenant},'Instructor','Fixture',${data.user.id})`;
  }
  await db`INSERT INTO public.classes(id,madrasa_id,name) VALUES (${group},${tenant},'Assigned class'),(${otherClass},${tenant},'UNASSIGNED CLASS')`;
  await db`INSERT INTO public.subjects(id,madrasa_id,name) VALUES (${subject},${tenant},'Quran')`;
  await db`INSERT INTO public.teacher_subjects(madrasa_id,teacher_id,class_id,subject_id) VALUES (${tenant},${teacher},${group},${subject})`;
  await db`INSERT INTO public.exams(id,madrasa_id,title,year,start_date,status,is_locked) VALUES
    (${frozen},${tenant},'Frozen fixture','2026','2026-10-01','Completed',true),
    (${open},${tenant},'Open fixture','2026','2026-09-01','Published',false),
    (${otherExam},${foreign},'FOREIGN EXAM','2026','2026-10-01','Published',true)`;
  for (const exam of [frozen, open])
    for (const s of ["Quran", "UNASSIGNED SUBJECT"])
      await db`INSERT INTO public.exam_subjects(madrasa_id,exam_id,class_id,subject_name,total_marks,pass_marks) VALUES (${tenant},${exam},${group},${s},50,15)`;
  for (const [i, [id, name]] of [
    [zero, "Zero"],
    [pending, "Pending"],
    [component, "Parts"],
  ].entries())
    await db`INSERT INTO public.students(id,madrasa_id,class_id,first_name,last_name,roll_number) VALUES (${id},${tenant},${group},${name},'Pupil',${String(i + 1)})`;
  await db`INSERT INTO public.exam_results(id,madrasa_id,exam_id,student_id,subject_name,total_marks,marks_obtained) VALUES (${resultId},${tenant},${frozen},${zero},'Quran',40,0)`;
  await db`INSERT INTO public.exam_results(madrasa_id,exam_id,student_id,subject_name,total_marks,marks_obtained,written_marks,oral_marks) VALUES (${tenant},${open},${component},'Quran',50,15,10,5)`;
  await db.unsafe(`GRANT SELECT ON public.users, public.madrasas, public.exams, public.exam_results, public.classes, public.exam_subjects, public.exam_settings TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.exam_results TO service_role;`);

  const wire = await fixtureProxy([base, api]);
  let browser;
  try {
    browser = await tools("puppeteer-core").launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: [
        ...chromium.args.filter(
          (x) =>
            ![
              "--disable-web-security",
              "--allow-running-insecure-content",
              "--disable-site-isolation-trials",
              "--single-process",
            ].includes(x),
        ),
        ...wire.args,
      ],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    const viewport = (width) => page.setViewport({ width, height: 850 });
    const visit = (exam) => page.goto(`${base}/teacher-portal/exams?exam_id=${exam}`);
    const select = 'select[aria-label="পরীক্ষা নির্বাচন করুন"]';
    const mark = 'input[aria-label="প্রাপ্ত নম্বর"]';
    const label = "নম্বর সংরক্ষণ করুন";
    const text = () => page.$eval("body", (el) => el.innerText.normalize("NFC"));
    const waitText = (t) =>
      page
        .waitForFunction((s) => document.body.innerText.normalize("NFC").includes(s), {}, t.normalize("NFC"))
        .catch(async (error) => {
          throw new Error(`Missing ${t} at ${page.viewport().width}px: ${await text()}`, { cause: error });
        });
    const waitClosed = (timeout = 20_000) =>
      page.waitForFunction(
        () => !document.querySelector('input[type="number"]') && document.body.innerText.includes("লক করা আছে"),
        { timeout },
      );
    const waitOpen = () =>
      page.waitForFunction(
        (s) => [...document.querySelectorAll(s)].some((el) => el.offsetWidth && !el.disabled),
        {},
        mark,
      );
    const focusCheck = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const save = () =>
      page.evaluate(
        (s) => [...document.querySelectorAll("button")].find((el) => el.innerText.includes(s)).click(),
        label,
      );
    async function login(name, tab = page) {
      await tab.goto(base + "/login");
      await tab.locator("input[name=identifier]").fill(name);
      await tab.locator("input[name=password]").fill(password);
      await tab.click('button[type="submit"]');
      await tab.waitForFunction(() => !location.pathname.includes("login"));
    }
    await viewport(1200);
    await login(email);
    await visit(frozen);
    await waitClosed();
    const snapshot = await page.evaluate(
      async () => (await (await fetch("/api/portal/snapshot?portal=teacher")).json()).data,
    );
    assert.deepEqual(
      snapshot?.students.map((s) => s.first_name),
      ["Zero", "Pending", "Parts"],
      "directory",
    );
    assert.equal(
      snapshot.exam_subjects.filter((s) => s.exam_id === frozen).length,
      1,
      `entry definitions ${JSON.stringify(snapshot.assigned_subjects)}`,
    );
    for (const width of [1200, 390]) {
      await viewport(width);
      await waitText("Zero Pupil");
      const view = await text();
      for (const token of ["৪০", "০", "রাসিব (Fail)", "—", "বাকি (২)", "সম্পন্ন (১)"])
        assert.ok(view.includes(token.normalize("NFC")), token);
      for (const token of [label, "FOREIGN EXAM", "UNASSIGNED CLASS", "UNASSIGNED SUBJECT"])
        assert.ok(!view.includes(token));
      assert.equal(await page.$$eval('input[type="number"]', (els) => els.length), 0);
      const search = 'input[placeholder*="সার্চ"]';
      await page.locator(search).fill("Pending");
      await page.waitForFunction(() => !document.body.innerText.includes("Zero Pupil"));
      await waitText("Pending Pupil");
      await page.focus(search);
      await page.keyboard.press("Home");
      await page.keyboard.down("Shift");
      await page.keyboard.press("End");
      await page.keyboard.up("Shift");
      await page.keyboard.press("Backspace");
    }
    assert.deepEqual(
      snapshot.exams.map((e) => [e.id, e.is_locked]),
      [
        [frozen, true],
        [open, false],
      ],
    );
    assert.ok(snapshot.exam_results.every((r) => r.subject_name === "Quran"));
    console.log(
      "OK: frozen desktop/mobile show saved zero, saved maximum, grade and missing marks; filters and tenant/subject scope intact",
    );

    await viewport(1200);
    await page.select(select, open);
    await waitOpen();
    const entry = `tbody tr:first-child ${mark}`;
    await page.locator(entry).fill("21");
    await focusCheck();
    // A real router.refresh() of unchanged server props should also leave the draft intact.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForNetworkIdle({ idleTime: 350 });
    assert.equal(await page.$eval(entry, (el) => el.valueAsNumber), 21);
    await page.locator('tbody input[aria-label="লিখিত"]').fill("12");
    const saved = page.waitForResponse(
      (r) => r.url().endsWith("/api/teacher/save-marks") && r.request().method() === "POST",
    );
    await save();
    const response = await saved;
    assert.deepEqual(await response.json(), { success: true });
    const values =
      await db`SELECT student_id, marks_obtained::float8 AS n FROM public.exam_results WHERE exam_id=${open} ORDER BY n`;
    assert.deepEqual(
      values.map((v) => [v.student_id, v.n]),
      [
        [component, 17],
        [zero, 21],
      ],
    );
    await page
      .waitForFunction(
        (s) => Number(document.querySelector(s)?.value) === 21 && !document.querySelector(s).disabled,
        {},
        entry,
      )
      .catch(async (err) => {
        throw new Error(
          `Saved inputs: ${await page.$$eval('input[type="number"]', (els) => els.map((el) => [el.value, el.disabled]))}; ${await text()}`,
          { cause: err },
        );
      });
    await page.locator(entry).fill("43");
    await db`UPDATE public.exams SET is_locked=true WHERE id=${open}`;
    // The click races ahead of the next lock poll. The refusal must itself switch the mounted form to saved values.
    const conflict = page.waitForResponse((r) => r.url().endsWith("/api/teacher/save-marks"));
    await save();
    assert.equal((await (await conflict).json()).code, "EXAM_LOCKED");
    await waitClosed();
    await waitText("২১");
    assert.ok(!(await text()).includes("৪৩"));
    await db`UPDATE public.exams SET is_locked=false WHERE id=${open}`;
    await focusCheck();
    await waitOpen();
    assert.equal(await page.$eval(entry, (el) => el.valueAsNumber), 21);
    await page.locator(entry).fill("38");
    await db`UPDATE public.exams SET is_locked=true WHERE id=${open}`;
    // Stay in the visible tab: no navigation, focus event or Save.
    await waitClosed(45_000);
    await waitText("২১");
    assert.ok(!(await text()).includes("৩৮"));
    console.log(
      "OK: published/unlocked edits save (including component totals); unchanged refresh keeps drafts; refusal, external lock and unlock reconcile without reload",
    );

    // Legacy schema: relational column absent. Settings win per exam, then metadata. A lookup failure isn't an unlock.
    await db.unsafe("ALTER TABLE public.exams RENAME COLUMN is_locked TO fixture_saved_lock");
    await db`UPDATE public.madrasas SET metadata=${db.json({ exam_locks: { [open]: { is_locked: true }, [frozen]: { is_locked: true } } })} WHERE id=${tenant}`;
    await db`INSERT INTO public.madrasa_settings(madrasa_id,namespace,setting_key,setting_value) VALUES (${tenant},'locks','exam_locks',${db.json({ [open]: { is_locked: false } })})`;
    await visit(frozen);
    await waitClosed();
    await page.select(select, open);
    await waitOpen();
    await db.unsafe("REVOKE SELECT ON public.madrasa_settings FROM service_role");
    await focusCheck();
    await waitText("লক অবস্থা যাচাই করা যায়নি");
    assert.equal(await page.$(entry), null);
    await db.unsafe("GRANT SELECT ON public.madrasa_settings TO service_role");
    await focusCheck();
    await waitOpen();
    await db.unsafe("ALTER TABLE public.exams RENAME COLUMN fixture_saved_lock TO is_locked");
    console.log("OK: per-exam structured/metadata fallbacks and failed lock lookup keep reads and edits distinct");

    // Same refusal on AI and native staff write paths. A portal user never needs the generic raw tables.
    const rec = {
      exam_id: frozen,
      class_id: group,
      subject_name: "Quran",
      records: [{ student_id: zero, total_marks: 50, marks_obtained: 9 }],
    };
    const post = (path, body) =>
      page.evaluate(
        async ([url, data]) => {
          const r = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(data),
          });
          return [r.status, await r.json()];
        },
        [path, body],
      );
    assert.equal(
      (
        await post("/api/ai/confirm", {
          actionType: "enter_exam_mark",
          payload: { examId: frozen, studentId: zero, subjectName: "Quran", marksObtained: 9, totalMarks: 50 },
        })
      )[1].code,
      "EXAM_LOCKED",
    );
    assert.equal((await post("/api/teacher/save-marks", { ...rec, subject_name: "UNASSIGNED SUBJECT" }))[0], 403);
    assert.equal((await post("/api/teacher/save-marks", { ...rec, exam_id: otherExam }))[0], 403);
    const res = await fetch(base + "/api/mobile/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": mobileKey },
      body: JSON.stringify({ email: admin, password }),
    });
    assert.equal(res.status, 200);
    const token = (await res.json()).data.access_token;
    for (const [method, path, body, code] of [
      [
        "POST",
        "exam-results",
        { ...rec, student_id: zero, subject_id: subject, marks_obtained: 9, total_marks: 50 },
        "EXAM_LOCKED",
      ],
      ["PATCH", `exam-results/${resultId}`, { marks_obtained: 9 }, "EXAM_LOCKED"],
      ["DELETE", `exam-results/${resultId}`, null, "EXAM_LOCKED"],
      ["PATCH", `exams/${frozen}`, { is_locked: false }, "LOCK_ACTION_REQUIRED"],
    ]) {
      const r = await fetch(base + "/api/mobile/" + path, {
        method,
        headers: { "content-type": "application/json", "x-api-key": mobileKey, authorization: `Bearer ${token}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal((await r.json()).code, code, path);
    }
    assert.equal((await db`SELECT marks_obtained::int AS n FROM public.exam_results WHERE id=${resultId}`)[0].n, 0);
    console.log("OK: scoped teacher, AI confirmation and native staff writes keep frozen fixture results intact");

    const ctx = await browser.createBrowserContext(),
      staff = await ctx.newPage();
    await login(admin, staff);
    await staff.goto(`${base}/dashboard/exams/${frozen}/setup`);
    await staff.waitForSelector('input[type="date"]:disabled');
    const selectContaining = async (value) => {
      const handle = await staff.waitForFunction(
        (v) =>
          [...document.querySelectorAll("select")].find(
            (s) => !s.matches(":disabled") && [...s.options].some((o) => o.value === v),
          ),
        {},
        value,
      );
      await handle.asElement().select(value);
      await handle.dispose();
    };
    await selectContaining(group);
    await staff.waitForFunction(() =>
      [...document.querySelectorAll("table input:disabled")].some((i) => i.value === "Quran"),
    );
    assert.equal(await staff.$('input[type="radio"]:enabled'), null);
    assert.ok(!(await staff.$eval("body", (el) => el.innerText.includes("তারিখ আপডেট করুন"))));
    await staff.goto(`${base}/dashboard/exams/${frozen}/marks`);
    await selectContaining(group);
    await selectContaining("Quran");
    await staff.evaluate(() =>
      [...document.querySelectorAll("button")].find((b) => b.innerText.includes("শিক্ষার্থী খুঁজুন")).click(),
    );
    await staff.waitForSelector('tbody input[type="number"]:disabled');
    assert.equal(await staff.$("tbody input:enabled"), null);
    await db`UPDATE public.exams SET is_locked=false WHERE id=${frozen}`;
    await staff.evaluate(() => window.dispatchEvent(new Event("focus")));
    await staff.waitForSelector('tbody input[type="number"]:enabled');
    console.log(
      "OK: locked dashboard setup keeps the class selector, not write controls; a loaded marks grid follows a later unlock",
    );
    await ctx.close();
  } finally {
    try {
      await browser?.close();
    } finally {
      await wire.close();
    }
  }
}
