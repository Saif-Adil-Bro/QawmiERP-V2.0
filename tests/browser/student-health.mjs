// Production-built Next, disposable provider/PG, loopback-only Chromium. No live SMS.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fixtureProxy } from "./fixture-proxy.mjs";
import { withSessionStack } from "../sql/session/session-stack.mjs";
import { seedGuardians } from "../sql/session/guardian-fixture.mjs";
const require = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
);
const chromium = require("@sparticuz/chromium"),
  puppeteer = require("puppeteer-core");
async function exercise(stack) {
  const { db, base, api, lite, anon, mobileKey } = stack,
    [family, foreign] = await seedGuardians(stack),
    [first, second, unlinked] = family.children;
  const email = "clinic@example.test",
    password = randomBytes(32).toString("hex"),
    tenant = family.tenant;
  async function addUser(email, role) {
    const { data, error } = await lite
      .getClient({ apikey: anon })
      .auth.signUp({ email, password });
    assert.ok(!error && data.user);
    await db`INSERT INTO public.users(id,madrasa_id,role,email,full_name) VALUES(${data.user.id},${tenant},${role},${email},${role})`;
  }
  await addUser(email, "hostel_manager");
  await addUser("clinic-teacher@example.test", "teacher");
  await addUser("clinic-accountant@example.test", "accountant");
  await db.unsafe(
    `GRANT SELECT ON public.users,public.madrasas TO authenticated; GRANT SELECT,INSERT,UPDATE ON public.madrasa_settings TO service_role;`,
  );
  const group = randomUUID();
  await db`INSERT INTO public.classes(id,name,madrasa_id) VALUES(${group},'Fixture Jamat',${tenant})`;
  await db`UPDATE public.students SET class_id=${group},parent_phone='০১৭১২৩৪৫৬৭৮',father_name='Fixture Guardian' WHERE madrasa_id=${tenant}`;
  await db`UPDATE public.madrasas SET metadata='{"contact_phone":"01700000123"}' WHERE id=${tenant}`;
  const wire = await fixtureProxy([base, api]);
  let browser, stagePage;
  try {
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: [
        ...chromium.args.filter(
          (a) =>
            ![
              "--disable-web-security",
              "--allow-running-insecure-content",
              "--disable-site-isolation-trials",
              "--single-process",
            ].includes(a),
        ),
        ...wire.args,
      ],
    });
    async function sign(email, password, home, width = 1200) {
      const ctx = await browser.createBrowserContext(),
        p = await ctx.newPage();
      await p.setViewport({ width, height: 860 });
      p.setDefaultTimeout(18000);
      await p.goto(base + "/login");
      await p.locator("input[name=identifier]").fill(email);
      await p.locator("input[name=password]").fill(password);
      await p.click("button[type=submit]");
      await p.waitForFunction((home) => location.pathname === home, {}, home);
      return p;
    }
    const tap = async (p, selector, text) => {
      const handle = await p.waitForFunction(
        (sel, t) =>
          [...document.querySelectorAll(sel)].find(
            (el) =>
              el.innerText.normalize("NFC").trim() === t.normalize("NFC") &&
              el.getClientRects().length &&
              !el.disabled,
          ),
        {},
        selector,
        text,
      );
      try {
        await handle.asElement().click();
      } finally {
        await handle.dispose();
      }
    };
    const wait = async (p, text, sel = "body") => {
      try {
        await p.waitForFunction(
          (t, sel) =>
            document
              .querySelector(sel)
              ?.innerText.normalize("NFC")
              .includes(t.normalize("NFC")),
          {},
          text,
          sel,
        );
      } catch (e) {
        throw new Error(
          `Missing ${text} / ${(await p.$eval("body", (el) => el.innerText)).slice(-1000)}`,
          { cause: e },
        );
      }
    };
    const page = (stagePage = await sign(email, password, "/dashboard"));
    const path = "/dashboard/students/health";
    await page.goto(base + path + "?new=1");
    async function report(p, child, med, notify) {
      await p.waitForSelector("dialog[open]");
      const id = await p.$(
        'dialog select:has(option[value="' + child.id + '"])',
      );
      assert.ok(id);
      await id.select(child.id);
      await p.select('dialog select:has(option[value="critical"])', "critical");
      await p.type("dialog textarea[name=symptoms]", "Fixture symptoms");
      await p.type("dialog textarea[name=care]", med);
      await p.type("dialog input[name=doctor]", "Clinic " + child.name);
      await p.type("dialog input[name=diet]", "Fixture diet");
      if (notify) await p.click("dialog input[type=checkbox]");
      await tap(p, "dialog button", "নথি সংরক্ষণ করুন");
      await wait(p, "স্বাস্থ্য নথি সংরক্ষিত হয়েছে।", "[role=status]");
    }
    await report(page, first, "Legacy care", true);
    await wait(page, "বার্তা পাঠানোর নিশ্চয়তা পাওয়া যায়নি।");
    const archive =
      await db`SELECT setting_key,setting_value FROM public.madrasa_settings WHERE madrasa_id=${tenant} AND namespace='student_health_v1'`;
    assert.equal(archive.length, 1);
    const legacyId = archive[0].setting_key;
    assert.ok(!JSON.stringify(archive[0]).includes("Legacy care"));
    console.log(
      "OK: pre-migration report + initial visit in sealed settings; failed alert is visible, not marked sent",
    );
    const ddl = await db.reserve();
    try {
      await ddl.unsafe(
        await readFile("supabase_student_health_migration.sql", "utf8"),
      );
    } finally {
      ddl.release();
    }
    await lite.connection.clearSchemaCache();
    await page.goto(base + path + "?notify=" + legacyId);
    await page.waitForSelector("dialog[open]");
    await page.click('dialog button[aria-label="বন্ধ করুন"]');
    await tap(page, "article button", "নথি ও ফলো-আপ");
    await wait(page, "Legacy care", "dialog");
    await page.type("textarea[name=note]", "Follow-up after cutover");
    await tap(page, "dialog button", "ফলো-আপ সংরক্ষণ করুন");
    await wait(page, "স্বাস্থ্য নথি হালনাগাদ হয়েছে।", "[role=status]");
    await tap(page, "button", "নতুন নথি");
    await report(page, second, "SQL care", false);
    const [sql] =
      await db`SELECT * FROM public.student_health_records WHERE madrasa_id=${tenant}`;
    assert.equal(sql.student_id, second.id);
    assert.equal(sql.guardian_notified_at, null);
    assert.equal(
      (
        await db`SELECT * FROM public.student_health_timeline WHERE record_id=${sql.id}`
      ).length,
      1,
    );
    await tap(page, "button", "বিশেষ খাবারের তালিকা");
    await wait(page, "Fixture diet", "#health-kitchen-print");
    assert.doesNotMatch(
      await page.$eval("#health-kitchen-print", (e) => e.innerText),
      /SQL care|01712345678|Fixture symptoms/,
    );
    await tap(page, "#health-kitchen-print button", "ফিরে যান");
    console.log(
      "OK: old-case follow-up after migration, new atomic SQL case, kitchen-only print list",
    );
    // A disposable RPC stands in for the legacy SMS gateway, reachable only within this fixture.
    await db.unsafe(
      `CREATE TABLE fixture_clinic_messages(dst text,msg text); CREATE FUNCTION public.fixture_clinic_sms(token text,dst text,msg text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.fixture_clinic_messages VALUES(dst,msg); RETURN '{"success":true}'::jsonb; END $$; GRANT USAGE ON SCHEMA public TO anon; GRANT EXECUTE ON FUNCTION public.fixture_clinic_sms(text,text,text) TO anon;`,
    );
    await lite.connection.clearSchemaCache();
    await db`UPDATE public.madrasas SET metadata=metadata::jsonb || ${db.json({ sms_gateway: { provider: "custom", apiEndpoint: api + "/rest/v1/rpc/fixture_clinic_sms", apiKey: "fixture", isEnabled: true, httpMethod: "POST_JSON", apiKeyParamName: "token", phoneParamName: "dst", messageParamName: "msg", customHeaders: { apikey: anon } } })}::jsonb WHERE id=${tenant}`;
    await page.goto(base + path + "?notify=" + sql.id);
    await wait(page, "অভিভাবককে স্বাস্থ্য আপডেট", "dialog");
    await page
      .locator("dialog textarea")
      .fill("Fixture edited guardian update");
    await tap(page, "dialog button", "এসএমএস পাঠান");
    await wait(page, "অভিভাবককে বার্তা পাঠানো হয়েছে।", "[role=status]");
    assert.deepEqual(
      [...(await db`SELECT * FROM fixture_clinic_messages`)],
      [{ dst: "8801712345678", msg: "Fixture edited guardian update" }],
    );
    assert.ok(
      (
        await db`SELECT guardian_notified_at FROM student_health_records WHERE id=${sql.id}`
      )[0].guardian_notified_at,
    );
    const audit =
      await db`SELECT action,summary FROM system_audit_logs WHERE entity_type='student_health_record'`;
    for (const a of [
      "STUDENT_HEALTH_REPORTED",
      "STUDENT_HEALTH_UPDATED",
      "GUARDIAN_HEALTH_ALERT_SENT",
    ])
      assert.ok(audit.some((r) => r.action === a));
    assert.doesNotMatch(
      JSON.stringify(audit),
      /SQL care|Legacy care|edited guardian/,
    );
    console.log(
      "OK: edited guardian SMS reaches only fixture phone, provider receipt stamps SQL, audit has no narrative",
    );
    const parent = (stagePage = await sign(
      family.email,
      family.password,
      "/portal",
      390,
    ));
    await wait(parent, "Legacy care", "dialog[open]");
    await tap(parent, "dialog button", "আমি অবগত হয়েছি (Acknowledge)");
    await wait(parent, "প্রাপ্তি নিশ্চিত হয়েছে");
    await parent.reload();
    await wait(parent, "Legacy care");
    assert.equal(await parent.$("dialog[open]"), null);
    await parent.goto(base + "/portal/fees?student_id=" + second.id);
    await wait(parent, "SQL care", "dialog[open]");
    assert.ok(
      !(await parent.$eval("body", (e) => e.innerText)).includes("Legacy care"),
    );
    assert.equal(
      await parent.$eval("dialog a", (a) => a.getAttribute("href")),
      "tel:01700000123",
    );
    await tap(parent, "dialog button", "আমি অবগত হয়েছি (Acknowledge)");
    await wait(parent, "প্রাপ্তি নিশ্চিত হয়েছে");
    assert.ok(
      (
        await db`SELECT guardian_acknowledged_at FROM student_health_records WHERE id=${sql.id}`
      )[0].guardian_acknowledged_at,
    );
    const mob = async (g) => {
      const res = await fetch(base + "/api/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": mobileKey },
        body: JSON.stringify({ email: g.email, password: g.password }),
      });
      assert.equal(res.status, 200);
      return {
        authorization: "Bearer " + (await res.json()).data.access_token,
        "x-api-key": mobileKey,
        "content-type": "application/json",
      };
    };
    const headers = await mob(family),
      mobile = base + "/api/mobile/portal/student";
    const read = async (child) =>
      (await (await fetch(mobile + "?student_id=" + child, { headers })).json())
        .data.health_records;
    assert.equal((await read(second.id))[0].treatment_notes, "SQL care");
    assert.deepEqual(await read(unlinked.id), []);
    assert.deepEqual(await read(foreign.children[0].id), []);
    const foreignAck = await fetch(mobile, {
      method: "POST",
      headers: await mob(foreign),
      body: JSON.stringify({ record_id: sql.id }),
    });
    assert.equal(foreignAck.status, 403);
    console.log(
      "OK: current-session dismissal, persistent child-specific portal/deep-link alerts, verified family ack and mobile scope",
    );
    stagePage = page;
    await page.goto(base + path, { waitUntil: "networkidle2" });
    await page.evaluate(
      (name) =>
        Array.from(document.querySelectorAll("article"))
          .find((a) => a.innerText.includes(name))
          .querySelectorAll("button")[2]
          .click(),
      second.name,
    );
    await page.waitForSelector("dialog[open]");
    await tap(page, "dialog button", "সুস্থ হিসেবে সংরক্ষণ করুন");
    await wait(page, "স্বাস্থ্য নথি হালনাগাদ হয়েছে।");
    const after = await read(second.id);
    assert.equal(after[0].status, "recovered");
    assert.equal(after[0].timeline.length, 2);
    assert.ok(after[0].recovered_at);
    await parent.reload();
    await wait(parent, "আলহামদুলিল্লাহ, আপনার সন্তান এখন সুস্থ");
    assert.equal(await parent.$("dialog[open]"), null);
    await page.goto(base + "/dashboard");
    await wait(page, "অসুস্থ শিক্ষার্থী ও স্বাস্থ্য আপডেট", "main");
    const widget = await page.$eval(
      `a[href="${path}?notify=${legacyId}"]`,
      (a) => a.closest("section").innerText,
    );
    assert.ok(
      widget.includes(first.name) &&
        !widget.includes(second.name) &&
        widget.includes("১"),
    );
    console.log(
      "OK: enabled native dashboard widget excludes the recovered student and enables quick notification",
    );
    const teacher = await sign(
      "clinic-teacher@example.test",
      password,
      "/teacher-portal",
    );
    await teacher.goto(base + "/teacher-portal/health");
    await wait(teacher, "নতুন নথি");
    const accountant = await sign(
      "clinic-accountant@example.test",
      password,
      "/dashboard",
    );
    await accountant.goto(base + path);
    await wait(accountant, "অনুমতি নেই");
    assert.ok(
      !(await accountant.$eval("body", (e) => e.innerText)).includes(
        "Legacy care",
      ),
    );
    console.log(
      "OK: recovery timeline and 48h reassurance; teacher shell allowed, accountant denied",
    );
  } catch (error) {
    if (stagePage)
      console.error(
        "Fixture page:",
        new URL(stagePage.url()).pathname,
        (
          await stagePage.$eval("main", (n) => n.innerText).catch(() => "")
        ).slice(-1300),
      );
    throw error;
  } finally {
    try {
      await browser?.close();
    } finally {
      await wire.close();
    }
  }
}
await withSessionStack(exercise, { buildForBrowser: true });
