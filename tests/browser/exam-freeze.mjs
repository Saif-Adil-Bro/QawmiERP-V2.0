// Regression: an open governance console must not retain its first empty exam list.
// Disposable Postgres + Next and a loopback-only browser; no deployed targets or credentials.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { withSessionStack } from "../sql/session/session-stack.mjs";
import { fixtureProxy } from "./fixture-proxy.mjs";

const tools = createRequire(resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"));
const puppeteer = tools("puppeteer-core"), chromium = tools("@sparticuz/chromium");

async function exercise({ db, lite, anon, base, api }) {
  const tenant = randomUUID(), other = randomUUID();
  const email = "exam-operator@example.test", password = randomBytes(32).toString("hex");
  const { data, error } = await lite.getClient({ apikey: anon }).auth.signUp({ email, password });
  assert.ok(!error && data.user);
  const own = ["ছামাহি (Quarterly)", "শশমাহি (Half-Yearly)"], foreign = "FOREIGN-FIXTURE-EXAM";
  await db`INSERT INTO public.madrasas(id,name,contact_email,metadata,security_metadata) VALUES
    (${tenant},'Fixture A',${email},'{}','{}'),(${other},'Fixture B','b@example.test','{}','{}')`;
  await db`INSERT INTO public.users(id,madrasa_id,role,email,full_name) VALUES (${data.user.id},${tenant},'muhtamim',${email},'Fixture Operator')`;
  await db`INSERT INTO public.exams(madrasa_id,title,year,start_date,status,is_locked) VALUES
    (${tenant},${own[0]},'2026','2026-07-21','Completed',false),
    (${tenant},${own[1]},'2026','2026-10-20','Published',true),
    (${other},${foreign},'2026','2026-10-21','Completed',false)`;
  await db.unsafe(`GRANT SELECT ON public.users, public.madrasas, public.exams, public.exam_settings TO authenticated;
    GRANT UPDATE ON public.exams TO service_role`);

  const wire = await fixtureProxy([base, api]);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(), headless: true,
      args: [...chromium.args.filter(x => !["--disable-web-security", "--allow-running-insecure-content", "--disable-site-isolation-trials", "--single-process"].includes(x)), ...wire.args],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(20_000);
    const text = (p = page) => p.$eval("body", el => el.innerText.normalize("NFC").replace(/\s+/g, " "));
    const waitText = value => page.waitForFunction(t => document.body.innerText.normalize("NFC").replace(/\s+/g, " ").includes(t), {}, value.normalize("NFC"));
    const tap = label => page.evaluate(t => [...document.querySelectorAll("button")].find(b => b.innerText.normalize("NFC").includes(t)).click(), label.normalize("NFC"));
    const tab = "পরীক্ষা ও সেশন ফ্রিজ";
    const retry = 'button[aria-label="পরীক্ষার তালিকা আবার পড়ুন"]';
    async function checkRows(frozen) {
      await waitText("মোট ২ টি পরীক্ষা");
      await waitText(`${tab} ${frozen}`);
      const shown = await text();
      assert.ok(own.every(t => shown.includes(t.normalize("NFC"))) && !shown.includes(foreign));
    }

    await page.goto(base + "/login");
    await page.locator("input[name=identifier]").fill(email);
    await page.locator("input[name=password]").fill(password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname === "/dashboard");

    // Same rows throughout. On a successful but filtered read neither an exam nor its existence may leak.
    await db.unsafe("CREATE POLICY fixture_hide_exams ON public.exams AS RESTRICTIVE FOR SELECT TO authenticated USING(false)");
    await page.goto(base + "/dashboard/settings/data-governance?tab=exams");
    await waitText("এই অ্যাকাউন্টে কোনো পরীক্ষা দেখা যাচ্ছে না।");
    const hidden = await text();
    assert.ok([...own, foreign].every(t => !hidden.includes(t.normalize("NFC"))));
    await tap("হিসাব পিরিয়ড লক");
    await page.waitForFunction(() => !document.body.innerText.includes("Exam Marks Freeze"));
    await db.unsafe("DROP POLICY fixture_hide_exams ON public.exams");
    const list = await browser.newPage();
    await list.goto(base + "/dashboard/exams");
    const fromList = await text(list);
    assert.ok(own.every(t => fromList.includes(t.normalize("NFC"))) && !fromList.includes(foreign));
    await list.close();

    // Stay on the existing document: opening the tab, not a hard reload, must recover both rows.
    await tap(tab);
    await checkRows("১");
    console.log("OK: opening the previously empty freeze tab recovers the same tenant's exams (2 total / 1 frozen)");

    await db.unsafe("REVOKE SELECT ON public.exams FROM authenticated");
    await page.click(retry);
    await waitText("পরীক্ষার তালিকা পড়ার অনুমতি পাওয়া যায়নি।");
    const failed = await text();
    assert.ok(!failed.includes("মোট ০ টি পরীক্ষা") && !failed.includes(`${tab} ০`.normalize("NFC")));
    assert.ok([...own, foreign].every(t => !failed.includes(t.normalize("NFC"))));
    await db.unsafe("GRANT SELECT ON public.exams TO authenticated");
    await page.click(retry);
    await checkRows("১");
    console.log("OK: a refused read has no misleading count; same-page retry restores 2/1 without a new login");

    await page.click('button[title^="নম্বর ফ্রিজ/লক করুন"]');
    await tap("হ্যাঁ, ফ্রিজ (লক) করুন");
    await checkRows("২");
    assert.equal((await db`SELECT count(*)::int AS n FROM public.exams WHERE madrasa_id=${tenant} AND is_locked`)[0].n, 2);
    console.log("OK: a successful fixture lock revalidates the displayed badge from the server");
  } finally {
    try { await browser?.close(); } finally { await wire.close(); }
  }
}

await withSessionStack(exercise, { buildForBrowser: true });
