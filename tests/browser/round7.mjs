// Real Next server/actions, isolated provider, real PG and a Chromium-only fixture.
// Test tooling from tests/sql/session; QAWMI_BROWSER_TOOLS points to an npm prefix
// containing playwright-core and @sparticuz/chromium. No production targets.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { withSessionStack } from "../sql/session/session-stack.mjs";
import { ingressChecks } from "./round7-ingress.mjs";
import { fixtureProxy } from "./fixture-proxy.mjs";
const tools = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
);
await withSessionStack(
  async ({ db, lite, anon, base, api, storage, serviceClient }) => {
    const conn = await db.reserve();
    try {
      for (const f of [
        "supabase_finance_integrity_migration.sql",
        "supabase_finance_cashbooks_migration.sql",
        "supabase_round7_migration.sql",
      ])
        await conn.unsafe(readFileSync(f, "utf8"));
    } finally {
      conn.release();
    }
    await db.unsafe(`grant select on users,students,teachers,classes to authenticated; grant select(id,name) on madrasas to authenticated;
    grant select,update,insert,delete on all tables in schema public to service_role;`);
    const email = "r7-admin@example.test",
      password = randomBytes(32).toString("hex");
    const { data, error } = await lite
      .getClient({ apikey: anon })
      .auth.signUp({ email, password });
    assert.ok(!error && data.user);
    const [{ id: t }] =
      await db`insert into madrasas(name,contact_email) values('R7 Fixture',${email}) returning id`;
    await db`insert into users(id,madrasa_id,role,full_name,email) values(${data.user.id},${t},'super_admin','Admin Fixture',${email})`;
    const [{ id: c }] =
      await db`insert into classes(name,madrasa_id) values('Hifz',${t}) returning id`;
    const [{ id: ta }, { id: tb }, { id: tc }] =
      await db`insert into teachers(madrasa_id,first_name,last_name,phone) values(${t},'নুরুল','ইসলাম','01711223344'),(${t},'মাওলানা নুরুল','ইসলাম','+৮৮০১৭১১২২৩৩৪৪'),(${t},'Other','Teacher','01987654321') returning id`;
    const subs =
      await db`insert into subjects(madrasa_id,name) values(${t},'Fixture Tajwid'),(${t},'Fixture Quran'),(${t},'Fixture S2') returning id`;
    for (const s of subs)
      await db`insert into class_subjects(madrasa_id,class_id,subject_id) values(${t},${c},${s.id})`;
    for (const [i, teacher] of [ta, tb].entries())
      await db`insert into teacher_subjects(madrasa_id,class_id,subject_id,teacher_id) values(${t},${c},${subs[i].id},${teacher})`;
    const [{ id: neighbor }] =
      await db`insert into madrasas(name,contact_email) values('Other fixture','b@example.test') returning id`;
    const [{ id: outside }] =
      await db`insert into teachers(madrasa_id,first_name,last_name) values(${neighbor},'Other-tenant','Directory') returning id`;
    const members = [
      {
        id: "staff-n",
        legacy_id: ta,
        madrasa_id: t,
        staff_id_code: "T01",
        personal: {
          first_name: "নুরুল",
          last_name: "ইসলাম",
          full_name_bn: "নুরুল ইসলাম",
        },
        contact: { phone: "০১৭১১২২৩৩৪৪" },
        employment: {
          category_id: "cat-teaching",
          category_name: "Teaching",
          department_id: "academic",
          department_name: "Academic",
          designation: "Teacher",
          status: "ACTIVE",
          joining_date: "2025-01-01",
        },
        salary: {
          basic_salary: 0,
          net_salary: 0,
          allowances: {},
          deductions: {},
        },
        id_card: {},
        leave_balance: {},
        responsibilities: [],
        employment_history: [],
        created_at: new Date().toISOString(),
      },
    ];
    const main = {
      id: "main",
      name: "Real main gate",
      serial_number: "MAIN",
      status: "active",
      protocol: "cloud_push",
      secret_token: "fixture-only-main",
      target_audience: "all",
    };
    const pupils =
      await db`insert into students(madrasa_id,first_name,last_name,class_id) select ${t},'Pupil',i::text,${c} from generate_series(1,6)i returning id`;
    await db`update madrasas set registration_no=${JSON.stringify({ staff_members: members, class_teachers: { [c]: { teacher_id: "staff-n", teacher_name: "নুরুল ইসলাম" } }, student_profiles: { [pupils[0].id]: { student_code: "MUSE-480001", monthly_fee: 1600 } } })} where id=${t}`;
    assert.ok(
      (
        await db`select round7_patch_registry(${t},'{}',${db.json({ biometric_devices: [main] })}) ok`
      )[0].ok,
    );
    // Lite's first REST query lazily prepares PG roles with GRANT statements.
    // Finish that fixture-only DDL before the first concurrent Next requests.
    const warm = await serviceClient
      .from("users")
      .select("madrasa_id")
      .eq("email", email)
      .limit(2);
    assert.equal(warm.error, null);
    assert.equal(warm.data[0].madrasa_id, t);
    const type = "tuition-test",
      term = "2026";
    await db`insert into academic_sessions(id,madrasa_id,name,start_date,end_date,is_active) values(${term},${t},'Current','2026-01-01','2026-12-31',true)`;
    await db`insert into fee_types(id,madrasa_id,name,code,frequency,default_amount,fund_id,fund_name) values(${type},${t},'Monthly tuition','MONTHLY','MONTHLY',2000,'fund-general','সাধারণ ফান্ড (General Fund)')`;
    const financeRows = () =>
      db`select id,to_jsonb(f) body from student_fees f where madrasa_id=${t} and finance_bill_period(billing_period)='2026-12' order by id`;
    const groups = await fixtureProxy([base, api]),
      engine =
        tools("@sparticuz/chromium").default || tools("@sparticuz/chromium"),
      { chromium } = tools("playwright-core");
    const browser = await chromium.launch({
      executablePath: await engine.executablePath(),
      headless: true,
      args: [
        ...engine.args.filter(
          (x) =>
            ![
              "--single-process",
              "--disable-web-security",
              "--allow-running-insecure-content",
              "--disable-site-isolation-trials",
            ].includes(x),
        ),
        ...groups.args,
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1000, height: 850 },
      timezoneId: "UTC",
    });
    let page = await context.newPage();
    page.setDefaultTimeout(20000);
    const diagnostic = [];
    const trace = (msg) => {
      diagnostic.push(msg);
      if (diagnostic.length > 40) diagnostic.shift();
    };
    page.on("pageerror", (err) =>
      trace("client error: " + err.message.slice(0, 150)),
    );
    page.on("requestfailed", (req) =>
      trace(
        [
          req.method(),
          new URL(req.url()).pathname,
          req.failure()?.errorText,
        ].join(" "),
      ),
    );
    page.on("response", (r) => {
      if (r.request().isNavigationRequest() || r.status() >= 400)
        trace(
          [
            r.status(),
            new URL(r.url()).pathname,
            r.headers()["content-type"],
          ].join(" "),
        );
    });
    const btn = (part) => page.getByRole("button", { name: part }),
      text = (s) =>
        page
          .getByText(s, { exact: true })
          .filter({ visible: true })
          .first()
          .waitFor();
    const open = (path) =>
      page.goto(base + path, { waitUntil: "domcontentloaded" });
    const request = async (path, b) => {
      const res = await page.request.post(base + path, { data: b });
      const body = await res.json();
      assert.ok(res.ok(), JSON.stringify(body));
      return body;
    };
    try {
      await open("/login");
      // Force the recognized-tenant failure into the metadata audit book. The
      // mounted viewer must show it alongside committed SQL finance events.
      await db.unsafe(`CREATE FUNCTION r7_fixture_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='LOGIN_FAILED' THEN RAISE EXCEPTION 'fixture audit storage failure'; END IF; RETURN NEW; END$$;
        CREATE TRIGGER r7_fixture_audit_fault BEFORE INSERT ON system_audit_logs FOR EACH ROW EXECUTE FUNCTION r7_fixture_audit_fault()`);
      const bad = await page.request.post(base + "/api/auth/login", {
        data: { email, password: "incorrect-fixture" },
      });
      assert.equal(bad.status(), 401);
      await db`drop trigger r7_fixture_audit_fault on system_audit_logs`;
      const failed = (
        await db`select finance_metadata(m)->'system_audit_logs_fallback' logs from madrasas m where id=${t}`
      )[0].logs;
      assert.ok(
        failed?.some((l) => l.action === "LOGIN_FAILED" && l.madrasa_id === t),
      );
      await page.locator("input[name=identifier]").fill(email);
      await page.locator("input[name=password]").fill(password);
      await page.locator("button[type=submit]").click();
      await page.waitForURL("**/dashboard**");
      await open("/dashboard/settings/audit-logs");
      await text("LOGIN_FAILED");
      console.log(
        "PASS recognized failed login persisted via fallback and visible to its operator",
      );
      await open("/dashboard/staff?tab=profile&id=staff-n");
      await btn("দায়িত্ব ও ক্লাস").click();
      await text("১ টি জামাত");
      await text("২ টি কিতাব");
      await text("Fixture Tajwid");
      await text("Fixture Quran");
      // Even a denied auxiliary table must not blank the two known assignments.
      await db`revoke select on routines from service_role`;
      await page.reload();
      await btn("দায়িত্ব ও ক্লাস").click();
      await text("২ টি কিতাব");
      await text("রুটিন পড়া যায়নি");
      await db`grant select on routines to service_role`;
      console.log(
        "PASS PB-06: mounted staff drawer, legacy staff id + 2 teacher UUIDs, Hifz in-charge & two books. Failed routines query leaves assignments visible.",
      );
      await open(`/dashboard/teachers/${tc}/subjects`);
      await page
        .locator("select[name=class_subject]:visible")
        .selectOption(`${c}|${subs[2].id}`);
      const denied = await page.request.post(
        base + "/api/teachers/" + outside + "/subjects",
        { data: { classId: c, subjectId: subs[2].id } },
      );
      assert.ok(!denied.ok());
      assert.equal(
        (
          await db`select count(*)::int n from teacher_subjects where teacher_id=${outside}`
        )[0].n,
        0,
      );
      const receipt = new Promise((resolve) =>
        page.route(
          `**/api/teachers/${tc}/subjects`,
          async (route) => {
            resolve(route);
          },
          { times: 1 },
        ),
      );
      await btn("বিষয় এসাইন করুন").click();
      const held = await receipt;
      const dialog = page.waitForEvent("dialog");
      await page.evaluate(() => {
        setTimeout(() => location.reload(), 0);
      });
      const native = await dialog;
      assert.equal(native.type(), "beforeunload");
      await native.dismiss();
      await held.continue();
      await text("বিষয় সফলভাবে এসাইন করা হয়েছে!");
      await page.reload();
      assert.equal(
        (
          await db`select count(*)::int n from teacher_subjects where madrasa_id=${t} and class_id=${c} and teacher_id=${tc} and subject_id=${subs[2].id}`
        )[0].n,
        1,
      );
      console.log(
        "PASS S2: trusted click → native Chromium beforeunload → Stay → real save → reload retained exactly one assignment; original two untouched",
      );
      assert.equal(
        (
          await db`select count(*)::int n from teacher_subjects where (teacher_id,subject_id) in ((${ta}::uuid,${subs[0].id}::uuid),(${tb}::uuid,${subs[1].id}::uuid)) and madrasa_id=${t} and class_id=${c}`
        )[0].n,
        2,
      );
      const sameAssignment = await page.request.patch(
        base + `/api/classes/${c}/subjects`,
        { data: { subjectId: subs[2].id, teacherId: tc } },
      );
      assert.equal((await sameAssignment.json()).success, true);
      const failedPatch = await page.request.patch(
        base + `/api/classes/${c}/subjects`,
        { data: { subjectId: subs[2].id, teacherId: outside } },
      );
      assert.equal(failedPatch.status(), 400);
      assert.equal(
        (
          await db`select teacher_id from teacher_subjects where class_id=${c} and subject_id=${subs[2].id}`
        )[0].teacher_id,
        tc,
      );
      const manual = await request("/api/fees/generate", {
        sessionId: term,
        billingPeriod: "ডিসেম্বর (December) 2026",
        classId: c,
        feeTypeIds: [type],
      });
      assert.equal(manual.generatedCount, 6, JSON.stringify(manual));
      const pre = await financeRows();
      assert.equal(pre.length, 6);
      assert.equal(
        pre.reduce((a, b) => a + Number(b.body.due_amount), 0),
        11600,
      );
      const crons = await Promise.all(
        [1, 2].map(() =>
          request("/api/cron/monthly-fees", { billingPeriod: "2026-12" }),
        ),
      );
      for (const cr of crons) {
        assert.equal(cr.results[0].summary.generatedCount, 0);
        assert.equal(cr.results[0].summary.skippedExisting, 6);
      }
      assert.deepEqual(await financeRows(), pre);
      // Exercise the real dispatcher, not just the evaluator. Keep other jobs off
      // (no notifications). Expire only this isolated fixture's lease to exercise
      // the next eligible tick without waiting 15 minutes in CI.
      for (const k of [
        "monthly_fee_generation",
        "overdue_reminders",
        "absence_alerts",
        "process_queues",
        "digest_reports",
        "early_warning",
        "anomalies",
      ])
        await db`insert into automation_rules(madrasa_id,rule_key,name,cron_expression,is_enabled) values(${t},${k},${k},'0 7 1 * *',${k === "monthly_fee_generation"})`;
      const due = () =>
        db`update automation_rules set next_run_at=now()-interval '1 minute',last_run_at=now()-interval '16 minutes' where madrasa_id=${t} and rule_key='monthly_fee_generation'`;
      const heartbeat = async () =>
        (
          await db`select setting_value b from madrasa_settings where madrasa_id=${t} and namespace='automation' and setting_key='scheduler_heartbeat'`
        )[0]?.b;
      await due();
      await db`update academic_sessions set is_locked=true where madrasa_id=${t} and id=${term}`;
      const badRun = await page.request.post(base + "/api/cron/dispatch", {
        data: {},
      });
      assert.equal(badRun.status(), 503);
      assert.equal((await badRun.json()).ok, false);
      assert.ok((await heartbeat()).lastError);
      assert.ok(
        (
          await db`select id from job_execution_logs where madrasa_id=${t} and job_key='monthly_fee_generation' and status='FAILED' and finished_at is not null`
        ).length,
      );
      assert.equal(
        (
          await db`select next_run_at between now() and now()+interval '16 minutes' lease from automation_rules where madrasa_id=${t} and rule_key='monthly_fee_generation'`
        )[0].lease,
        true,
      );
      await db`update academic_sessions set is_locked=false where madrasa_id=${t} and id=${term}`;
      await due();
      const ds = await Promise.all([
        request("/api/cron/dispatch", {}),
        request("/api/cron/dispatch", {}),
      ]);
      assert.equal(
        ds.reduce((n, r) => n + r.totalExecuted, 0),
        1,
      );
      const completed =
        await db`select started_at,finished_at from job_execution_logs where job_key='monthly_fee_generation' and status='SUCCESS' and madrasa_id=${t}`;
      assert.equal(completed.length, 3);
      assert.ok(completed.every((r) => r.started_at && r.finished_at));
      assert.ok((await heartbeat()).lastSuccessAt);
      assert.equal((await heartbeat()).lastError, null);
      assert.ok(
        (
          await db`select last_run_at,next_run_at from automation_rules where madrasa_id=${t} and rule_key='monthly_fee_generation'`
        )[0].last_run_at,
      );
      assert.deepEqual(await financeRows(), pre);
      console.log(
        "PASS DEC-1: six manual December invoices ৳11,600, two monthly HTTP runs skipped six each, every field unchanged. Real monthly dispatcher: locked session → 503/FAILED + retry lease; next eligible concurrent triggers → exactly one SUCCESS, heartbeat read back.",
      );
      await open("/dashboard/settings/automation");
      await page.getByRole("heading", { name: "শিডিউলার হার্টবিট" }).waitFor();
      await page.getByText(/শেষ সফল ডিসপ্যাচ:/).waitFor();
      await open("/dashboard/zakat/collection");
      await btn("নামবিহীন").click();
      await page.getByPlaceholder("যেমন: 5000").fill("10");
      await page.getByPlaceholder("খালি রাখলে অটো তৈরি হবে").fill("R7-RECEIPT");
      await page.locator("form select").first().selectOption("fund-general");
      await page.locator("form button[type=submit]").first().click();
      await page.waitForFunction(() =>
        document.body.textContent.includes("R7-RECEIPT"),
      );
      const loads = [];
      page.on("request", (req) => {
        if (
          req.url().endsWith("/dashboard/attendance/devices") &&
          req.headers()["next-action"]
        )
          loads.push(req.method());
      });
      const cold = performance.now();
      await open("/dashboard/attendance/devices");
      await page
        .getByRole("heading", { name: "Real main gate", exact: true })
        .waitFor();
      await text("লাইভ ডিভাইস নেই");
      console.log(
        "Local device-list navigation to visible card: " +
          Math.round(performance.now() - cold) +
          " ms, " +
          loads.length +
          " server-action request(s); not a production latency claim.",
      );
      await btn(/নতুন ডিভাইস যোগ করুন/)
        .first()
        .click();
      const form = page
        .locator("form:visible")
        .filter({ has: page.getByPlaceholder("যেমন: মেইন গেট পাঞ্চ মেশিন") });
      await form
        .locator("input[type=text]")
        .nth(0)
        .fill("TEST-BIOMETRIC-DELETE-ME");
      await form.locator("input[type=text]").nth(1).fill("TESTSERIAL0001");
      await form.locator("button[type=submit]").click();
      await text("TEST-BIOMETRIC-DELETE-ME");
      const card = page.locator("div.group:visible").filter({
        has: page.getByRole("heading", {
          name: "TEST-BIOMETRIC-DELETE-ME",
          exact: true,
        }),
      });
      assert.ok(!(await card.innerText()).includes("192.168.1.201"));
      // Hold the real connection-test action until its visible loading state
      // has painted. Then allow the normal server response to finish.
      await card.locator('button[title="কানেকশন টেস্ট"]:enabled').waitFor();
      let observeTest;
      const checkStarted = new Promise((resolve) => {
        observeTest = resolve;
      });
      await page.route(
        "**/dashboard/attendance/devices",
        (route) => {
          if (route.request().headers()["next-action"]) observeTest(route);
          else return route.continue();
        },
        { times: 1 },
      );
      await card.getByTitle("কানেকশন টেস্ট").click();
      const checking = await checkStarted;
      await card.locator('button[aria-busy="true"]:disabled').waitFor();
      await checking.continue();
      await page
        .getByText(/TEST-BIOMETRIC-DELETE-ME: লাইভ সংযোগ নিশ্চিত নয়/)
        .waitFor();
      await card.getByTitle("সম্পাদনা").click();
      await form.getByLabel("অবস্থান (ঐচ্ছিক)").fill("Test desk");
      await form.locator("button[type=submit]").click();
      await text("Test desk");
      const deviceId = (
        await db`select d->>'id' id from madrasas m,jsonb_array_elements(finance_metadata(m)->'biometric_devices')d where m.id=${t} and d->>'serial_number'='TESTSERIAL0001'`
      )[0].id;
      await btn(/ইউএসবি \/ ফাইল/).click();
      await page
        .locator(`select:visible:has(option[value="${deviceId}"])`)
        .selectOption(deviceId);
      const line = (pin) => `${pin}\t2026-11-23 07:55:00\t0`;
      const csv = [
        line("480001"),
        line("480001"),
        "480001\t2026-11-23 16:00:00\t1",
        line("777777"),
        line("999999"),
        line("ABC"),
        "480001\t23/11/2026 08:15",
      ].join("\n");
      await page
        .locator("#biometric-file")
        .last()
        .setInputFiles({
          name: "r7.dat",
          mimeType: "text/plain",
          buffer: Buffer.from(csv),
        });
      await btn(/হাজিরা প্রসেস/).click();
      await page
        .getByText(/ম্যাপিং অপেক্ষায় 4.*777777.*999999.*ডুপ্লিকেট 1, বাতিল 2/)
        .first()
        .waitFor();
      await page.getByText(/লাইন 7: তারিখ/).waitFor();
      await btn(/হাজিরা প্রসেস/).click();
      await page
        .getByText(/ডুপ্লিকেট 5, বাতিল 2/)
        .first()
        .waitFor();
      await btn(/হাজিরা প্রসেস/).click();
      await page.waitForFunction(() =>
        document.body.innerText.includes("ডুপ্লিকেট 5, বাতিল 2"),
      );
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll("button")).find(
            (b) =>
              b.textContent.includes("হাজিরা প্রসেস") &&
              b.getClientRects().length,
          )?.disabled,
      );
      assert.equal(
        (
          await db`select count(*)::int n from system_audit_logs where madrasa_id=${t} and action='BIOMETRIC_FILE_IMPORTED'`
        )[0].n,
        3,
      );
      assert.equal(
        (
          await db`select count(*)::int n from attendance where madrasa_id=${t}`
        )[0].n,
        0,
      );
      await btn(/আইডি ও ইউজার ম্যাপিং/).click();
      await btn(/Auto-Map All/).click();
      await page.getByRole("alertdialog").getByText("নিশ্চিত করুন").click();
      await page
        .getByText(/নতুন ম্যাপিং 1টি/)
        .first()
        .waitFor();
      await btn(/Auto-Map All/).click();
      await page.getByRole("alertdialog").getByText("নিশ্চিত করুন").click();
      await page
        .getByText(/নতুন ম্যাপিং 0টি/)
        .first()
        .waitFor();
      await btn(/রিয়েলটাইম পাঞ্চ লগ/).click();
      await page.locator("input[type=date]:visible").fill("2026-11-23");
      await page
        .getByText(/07:55:00/)
        .first()
        .waitFor();
      for (let i = 0; i < 2; i++) {
        await btn("পুনঃপ্রক্রিয়া").first().click();
        await page.getByRole("alertdialog").getByText("নিশ্চিত করুন").click();
        await page.waitForFunction(
          (n) =>
            Array.from(document.querySelectorAll("td")).filter(
              (td) => td.textContent.trim() === "উপস্থিতি সফল",
            ).length >= n,
          i + 1,
        );
      }
      assert.equal(
        (
          await db`select count(*)::int n from biometric_punch_events where madrasa_id=${t} and status='unmapped'`
        )[0].n,
        2,
      );
      assert.equal(
        (
          await db`select count(*)::int n from attendance where madrasa_id=${t} and student_id=${pupils[0].id} and date='2026-11-23' and status='Present'`
        )[0].n,
        1,
      );
      await btn(/ডিভাইস তালিকা/).click();
      await card.getByText("৪ বার", { exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 820 });
      await card.getByTitle("মুছে ফেলুন").click();
      await page
        .getByRole("alertdialog")
        .getByText("বাতিল", { exact: true })
        .click();
      await card.getByTitle("মুছে ফেলুন").click();
      await page.getByRole("alertdialog").getByText("নিশ্চিত করুন").click();
      await page.getByText("ডিভাইস মুছে ফেলা হয়েছে।", { exact: true }).waitFor();
      await page
        .getByRole("heading", { name: "TEST-BIOMETRIC-DELETE-ME", exact: true })
        .waitFor({ state: "detached" });
      // The toast confirms commit. Also wait for the registry read/transition
      // before reloading, so a still outstanding App Router POST doesn't race
      // Chromium's document navigation in the middle of that response.
      await btn("রিফ্রেশ").waitFor();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("button")).some(
          (b) =>
            b.innerText.trim() === "রিফ্রেশ" &&
            !b.disabled &&
            b.getClientRects().length,
        ),
      );
      await page.reload({ waitUntil: "load" });
      await page
        .getByRole("heading", { name: "Real main gate", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "TEST-BIOMETRIC-DELETE-ME" })
          .count(),
        0,
      );
      assert.equal(
        (
          await db`select count(*)::int n from biometric_punch_events where madrasa_id=${t}`
        )[0].n,
        4,
      );
      const remaining = (
        await db`select finance_metadata(m)->'biometric_devices' devs from madrasas m where id=${t}`
      )[0].devs;
      assert.deepEqual(remaining, [main]);
      console.log(
        "PASS biometric UI: add/edit/test, offline header, duplicate & rejected lines, unknown PIN warnings, local 07:55, auto-map, reviewed replay → 1 day, cancel then delete fixture device only.",
      );
      // The mobile delete and reload have been asserted. Open an independent
      // desktop tab in the same authenticated context for the next workflows.
      const narrow = page;
      page = await context.newPage();
      await page.setViewportSize({ width: 1150, height: 870 });
      page.setDefaultTimeout(20000);
      await narrow.close();
      await page.bringToFront();
      await open("/dashboard/attendance/devices");
      await ingressChecks({ page, base, db, t, pupil: pupils[0].id, main });
      // 505 older SQL events, one mirrored in legacy metadata. Keep the
      // real LOGIN_FAILED fallback-only; deny any accidental foreign carryover.
      const carry = (
        await db`select finance_metadata(m)->'system_audit_logs_fallback' logs from madrasas m where id=${t}`
      )[0].logs;
      assert.ok(
        carry?.some((r) => r.action === "LOGIN_FAILED"),
        "fallback audit event retained after UI writes",
      );
      const more =
        await db`insert into system_audit_logs(madrasa_id,module,action,summary,created_at) select ${t},'generic','OLDER_FIXTURE',i::text,now()-interval '3 days' from generate_series(1,505)i returning id`;
      const mirror = { ...carry[0], id: more[0].id, action: "OLDER_FIXTURE" };
      assert.ok(
        (
          await db`select round7_patch_registry(${t},${db.json({ system_audit_logs_fallback: carry })},${db.json({ system_audit_logs_fallback: [...carry, mirror] })}) ok`
        )[0].ok,
      );
      const canonicalCount =
        (
          await db`select count(*)::int n from system_audit_logs where madrasa_id=${t}`
        )[0].n + carry.length;
      await open("/dashboard/settings/audit-logs");
      for (const action of [
        "LOGIN_FAILED",
        "MONTHLY_FEES_GENERATED",
        "DONATION_RECEIPT_CREATED",
        "BIOMETRIC_DEVICE_ADDED",
        "BIOMETRIC_DEVICE_UPDATED",
        "BIOMETRIC_CONNECTION_TESTED",
        "BIOMETRIC_DEVICE_DELETED",
      ])
        await text(action);
      console.log(
        "PASS P3: login failure, real donation receipt, fee generation and all device actions visible in mounted tenant audit viewer",
      );
      const bn = canonicalCount.toLocaleString("bn-BD");
      assert.equal(
        (
          await page
            .getByText("মোট রেকর্ড", { exact: true })
            .locator("../..")
            .locator("p")
            .first()
            .innerText()
        ).trim(),
        bn,
      );
      await open("/dashboard/settings/backup");
      await page
        .getByRole("checkbox", { name: "অডিট ট্রেইল ও সিকিউরিটি লগ" })
        .locator("..")
        .getByText(bn + " টি রেকর্ড", { exact: true })
        .waitFor();
      console.log(
        "PASS FOLLOWUP6 independently: mounted backup and audit KPI = " +
          canonicalCount +
          " with >500 rows, a SQL mirror and one fallback-only LOGIN_FAILED; display limit 200",
      );
      const eventRows = () =>
        db`select to_jsonb(e) v from biometric_punch_events e where madrasa_id=${t} order by id`;
      const beforeEvents = await eventRows();
      await db`insert into biometric_punch_events(madrasa_id,device_id,device_name,device_user_id,punch_time,punch_date,punch_type,sync_mode,status) values(${neighbor},'neighbor','Foreign','1',now(),current_date,'auto','usb_import','unmapped')`;
      await btn(/ডাটা মুছে ফেলা ও রিসেট/).click();
      await page.getByLabel("মোছার মডিউল").selectOption("attendance");
      await page.getByLabel("নির্বাচিত মডিউল মোছার সম্মতি").check();
      await page.getByPlaceholder("মুছে ফেলুন অথবা DELETE").fill("DELETE");
      page.once("dialog", (d) => d.accept());
      await btn("নির্বাচিত রেকর্ড মুছুন").click();
      await text("নির্বাচিত রেকর্ড মোছা হয়েছে");
      assert.equal((await eventRows()).length, 0);
      const note = (
        await db`select x from madrasas m,jsonb_array_elements(finance_metadata(m)->'backup_history')x where m.id=${t} and x->>'type'='SCOPED_WIPE'`
      )[0].x;
      const object = [...storage.driver].find(([k]) =>
        JSON.parse(k).some(
          (s) => typeof s === "string" && s.endsWith(note.storage_path),
        ),
      );
      const snapshot = JSON.parse(object[1].body.toString("utf8"));
      assert.equal(
        "sha256:" +
          createHash("sha256")
            .update(JSON.stringify(snapshot.data))
            .digest("hex"),
        note.checksum,
      );
      assert.equal(
        snapshot.data.biometric_punch_events.length,
        beforeEvents.length,
      );
      assert.ok(
        snapshot.data.biometric_punch_events.every((e) => e.madrasa_id === t),
      );
      assert.ok(
        !snapshot.data.student_fees && !snapshot.data.system_audit_logs,
      );
      const restored = await request("/api/backup/restore", {
        restoreMode: "merge",
        selectedModules: ["attendance"],
        backupPayload: snapshot,
      });
      assert.equal(
        restored.restoredStats.biometric_punch_events,
        beforeEvents.length,
      );
      assert.deepEqual(await eventRows(), beforeEvents);
      assert.equal(
        (
          await db`select count(*)::int n from biometric_punch_events where madrasa_id=${neighbor}`
        )[0].n,
        1,
      );
      assert.deepEqual(await financeRows(), pre);
      console.log(
        "PASS attendance-only export → confirmed wipe → private snapshot checksum → HTTP restore: all event rows identical, foreign event and six December invoices intact",
      );
    } catch (e) {
      console.error(
        "Navigation trace (no headers or query strings):",
        diagnostic,
      );
      console.error(
        "Document state:",
        await page
          .evaluate(() => ({
            ready: document.readyState,
            title: document.title,
            contentType: document.contentType,
            bodyBytes: document.body?.innerHTML.length,
            headings: [...document.querySelectorAll("h3")]
              .map((h) => h.innerText)
              .slice(-8),
          }))
          .catch(() => null),
      );
      console.error(
        "Fixture page on failure:",
        new URL(page.url()).pathname,
        (
          await page
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(-1800),
      );
      throw e;
    } finally {
      await browser.close();
      await groups.close();
    }
  },
  {
    buildForBrowser: process.env.QAWMI_ROUND7_REUSE_TEST_BUILD !== "1",
    rpcJsonObjects: true,
    withStorage: true,
  },
);
