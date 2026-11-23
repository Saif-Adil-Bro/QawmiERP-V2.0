// Authenticated browser, mounted Next routes, disposable Auth/Data API and PG.
// No live tenant, gateway, printer or SMS. Set QAWMI_FINANCE_HTTP_ONLY=1 for just the API checks.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { approvalChecks } from "./finance-approvals.mjs";
import { fixtureProxy } from "./fixture-proxy.mjs";
import { withSessionStack } from "../sql/session/session-stack.mjs";
import { seedGuardians } from "../sql/session/guardian-fixture.mjs";
const httpOnly = process.env.QAWMI_FINANCE_HTTP_ONLY === "1";
await withSessionStack(
  async (stack) => {
    const { db, base, api, anon, lite, mobileKey } = stack;
    const [family, other] = await seedGuardians(stack),
      t = family.tenant,
      pupil = family.children[0].id;
    const email = "finance@example.test",
      password = randomBytes(32).toString("hex");
    const { data, error } = await lite
      .getClient({ apikey: anon })
      .auth.signUp({ email, password });
    assert.ok(!error && data.user);
    await db`insert into users(id,madrasa_id,role,full_name,email) values(${data.user.id},${t},'accountant','Fixture accountant',${email})`;
    // This pre-migration orphan must stay visible for manual review, not land in General.
    await db`insert into donations(madrasa_id,receipt_no,donation_type,amount) values(${t},'MHF-HISTORY','Zakat',14)`;
    const conn = await db.reserve();
    try {
      await conn.unsafe(
        await readFile("supabase_finance_integrity_migration.sql", "utf8"),
      );
    } finally {
      conn.release();
    }
    await db.unsafe(`GRANT SELECT ON users,students,classes TO authenticated; GRANT SELECT(id,name) ON madrasas TO authenticated;
    GRANT DELETE,INSERT,UPDATE,SELECT ON fee_types,fee_structures,fee_structure_items,student_fees TO service_role;
    GRANT SELECT,INSERT,UPDATE ON madrasa_settings,madrasas,fees,fee_payments,fee_payment_allocations,student_fees,fee_audit_logs,donations,expenses TO service_role;`);
    await db`insert into zakat_funds(id,madrasa_id,name,code,category) values('fixture-book',${t},'Fixture Library','LIB','Development')`;
    await db`insert into donations(madrasa_id,receipt_no,fund_id,amount) values(${t},'D-LIB','fixture-book',20.25)`;
    await db`insert into expenses(madrasa_id,voucher_no,fund_id,category,amount) values(${t},'E-LIB','fixture-book','Maintenance',5)`;
    await db`insert into fee_types(id,madrasa_id,name,code) values('tuition',${t},'Tuition','T')`;
    await db`insert into academic_sessions(id,madrasa_id,name,start_date,end_date,is_active) values('term',${t},'Current','2026-01-01','2026-12-31',true)`;
    await db`insert into student_fees(id,madrasa_id,student_id,session_id,fee_type_id,fee_type_name,billing_period,base_amount,payable_amount,due_amount,fund_id,fund_name) values('bill',${t},${pupil},'term','tuition','Fee','2026-11',50,50,50,'fixture-book','Fixture Library')`;
    async function call(path, headers, method = "GET", body, code = 200) {
      const res = await fetch(base + path, {
        method,
        headers: { "content-type": "application/json", ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await res.json();
      assert.equal(
        res.status,
        code,
        `${method} ${path}: ${res.status} ${result.error?.message || result.error || result.message}`,
      );
      return result;
    }
    async function login(email, password) {
      const r = await call(
        "/api/mobile/auth/login",
        { "x-api-key": mobileKey },
        "POST",
        { email, password },
      );
      return {
        "x-api-key": mobileKey,
        authorization: `Bearer ${r.data.access_token}`,
      };
    }
    const auth = await login(email, password),
      parent = await login(family.email, family.password),
      url = "/api/mobile/fee-payments";
    await call(url, parent, "GET", undefined, 403);
    async function operator(tenant, role, label) {
      const address = `${label}@example.test`,
        pass = randomBytes(32).toString("hex");
      const { data, error } = await lite
        .getClient({ apikey: anon })
        .auth.signUp({ email: address, password: pass });
      assert.ok(data.user && !error);
      await db`insert into users(id,madrasa_id,role,full_name,email) values(${data.user.id},${tenant},${role},${label},${address})`;
      return login(address, pass);
    }
    const limited = await operator(t, "librarian", "library-staff");
    await call(url, limited, "GET", undefined, 403);
    await call("/api/mobile/donations", limited, "GET", undefined, 403);
    await call("/api/mobile/dashboard", parent, "GET", undefined, 403);
    // Same display name doesn't identify a donor. Test the actual list/detail
    // projections (including free-text notes), and the stable member-ID filter.
    const [{ id: donor }] =
      await db`insert into donors(madrasa_id,name,phone,address) values(${t},'Test directory','01700000001','Fixture street') returning id`;
    const [{ id: far }] =
      await db`insert into donors(madrasa_id,name,phone,address) values(${other.tenant},'Test directory','01700000002','Another street') returning id`;
    const member = "fixture-member";
    await db`update madrasas set registration_no=(finance_metadata(madrasas)||${db.json({ life_member_donors: [{ id: member, name: "Test directory", madrasa_id: t }] })}::jsonb)::text,finance_source_revision=finance_source_revision+1 where id=${t}`;
    const [{ id: memberReceipt }] =
      await db`insert into donations(madrasa_id,member_id,receipt_no,amount,fund_id,notes) values(${t},${member},'TEST-MEMBER',1,'fund-general','[Donor: Test directory, 01700000001]') returning id`;
    const memberRows = (
      await call("/api/mobile/donations?member_id=" + member, auth)
    ).data;
    assert.deepEqual(
      memberRows.map((r) => r.id),
      [memberReceipt],
    );
    const details = (await call("/api/mobile/donations/" + memberReceipt, auth))
        .data,
      directory = (await call("/api/mobile/donors/" + donor, auth)).data;
    assert.ok(!JSON.stringify([details, directory]).includes("01700000001"));
    await call("/api/mobile/donors/" + far, auth, "GET", undefined, 404);
    assert.deepEqual(
      (await call("/api/mobile/search?q=directory", limited)).data.donors,
      [],
    );
    assert.deepEqual(
      (await call("/api/mobile/search?q=directory", auth)).data.donors,
      [{ id: donor, name: "Test directory" }],
    );
    const settings = (await call("/api/mobile/settings", limited)).data;
    for (const key of [
      "registration_no",
      "metadata",
      "security_metadata",
      "finance_source_revision",
    ])
      assert.ok(!(key in settings.madrasa));
    assert.deepEqual(Object.keys(settings.settings).sort(), [
      "active_session_id",
      "madrasa_prefix",
    ]);
    const scoped = (await call("/api/mobile/dashboard", limited)).data;
    assert.ok(
      !("total_income" in scoped.stats) &&
        !("monthly_income_expense" in scoped.charts),
    );
    await call("/api/mobile/boarding/bazar", limited, "GET", undefined, 403);
    await call("/api/mobile/fee-waivers", parent, "GET", undefined, 403);
    await call(
      "/api/mobile/fee-waivers",
      auth,
      "POST",
      { student_id: pupil, discount_type: "FULL_WAIVER", status: "APPROVED" },
      409,
    );
    assert.equal(
      (
        await db`select count(*) from fee_discount_waivers where madrasa_id=${t}`
      )[0].count,
      "0",
    );
    const financial = (await call("/api/mobile/dashboard", auth)).data;
    assert.ok(Number.isFinite(financial.stats.total_income));
    const bills = "/api/mobile/student-fees",
      types = "/api/mobile/fee-types";
    const newType = (
      await call(
        types,
        auth,
        "POST",
        {
          name: "Books",
          code: "B",
          default_amount: 3,
          fund_id: "fixture-book",
          fund_name: "Fixture Library",
        },
        201,
      )
    ).data;
    const generated = (
      await call(
        bills,
        auth,
        "POST",
        {
          student_id: pupil,
          fee_type_id: newType.id,
          billing_period: "2026-12",
          amount: 3.25,
        },
        201,
      )
    ).data;
    assert.equal(generated.session_id, "term");
    await db`update academic_sessions set is_locked=true where id='term'`;
    await call(bills + "/" + generated.id, auth, "PATCH", { amount: 99 }, 409);
    await db`update academic_sessions set is_locked=false where id='term'`;
    await call(
      bills + "/" + generated.id,
      auth,
      "PATCH",
      { paid_amount: 3.25 },
      400,
    );
    await call(bills + "/" + generated.id, auth, "PATCH", { amount: 3.5 });
    assert.equal(
      Number((await call(bills + "/" + generated.id, auth)).data.due_amount),
      3.5,
    );
    await call(bills + "/" + generated.id, auth, "DELETE", {});
    await call(bills + "/" + generated.id, auth, "GET", undefined, 404);
    await call(types + "/" + newType.id, auth, "DELETE", {});
    assert.equal(
      (await call(types + "/" + newType.id, auth)).data.is_active,
      false,
    );
    // The other storage mode: first type, invoice and payment stay in the JSON book;
    // collection, detail and filtering must not disappear from mobile after a 201.
    const [{ id: empty }] =
      await db`insert into madrasas(name,contact_email) values('JSON school','json@example.test') returning id`;
    const ja = await operator(empty, "accountant", "legacy-cashier");
    const [{ id: jp }] =
      await db`insert into students(madrasa_id,first_name,last_name) values(${empty},'Legacy','Pupil') returning id`;
    const jt = (
      await call(
        types,
        ja,
        "POST",
        {
          name: "Class dues",
          code: "CD",
          default_amount: 5,
          fund_id: "fund-general",
          fund_name: "সাধারণ ফান্ড (General Fund)",
        },
        201,
      )
    ).data;
    const classId = (
      await db`insert into classes(madrasa_id,name) values(${empty},'Fixture Jamia') returning id`
    )[0].id;
    const jb = (
      await call(
        bills,
        ja,
        "POST",
        {
          student_id: jp,
          fee_type_id: jt.id,
          billing_period: "2026-12",
          amount: 5,
        },
        201,
      )
    ).data;
    const jr = (
      await call(
        url,
        ja,
        "POST",
        { student_id: jp, student_fee_id: jb.id, total_amount_received: 1.25 },
        201,
      )
    ).data;
    assert.equal(
      (await call(url + "/" + jr.id, ja)).data.receipt_no,
      jr.receipt_no,
    );
    assert.equal((await call(bills + "/" + jb.id, ja)).data.due_amount, 3.75);
    assert.equal((await call(url + "?student_id=" + jp, ja)).data.length, 1);
    assert.equal(
      Number(
        (
          await db`select count(*) from fee_payments where madrasa_id=${empty}`
        )[0].count,
      ),
      0,
    );
    await call(url + "/" + jr.id, auth, "GET", undefined, 404);
    console.log(
      "PASS limited role cannot read finance, SQL-only and JSON-only mobile schedules, charges, receipts and scoped lists",
    );
    const input = {
      student_id: pupil,
      student_fee_id: "bill",
      total_amount_received: 12.75,
      idempotency_key: "fixture-collection",
      payment_date: "2026-11-12",
    };
    await call(
      url,
      auth,
      "POST",
      { ...input, student_id: other.children[0].id },
      400,
    );
    const payment = (await call(url, auth, "POST", input, 201)).data;
    assert.match(payment.receipt_no, /^MR-2026-\d+$/);
    assert.equal(payment.fund_name, "Fixture Library");
    const due = async () =>
      Number(
        (await db`select due_amount from student_fees where id='bill'`)[0]
          .due_amount,
      );
    assert.equal(await due(), 37.25);
    const repeat = await call(url, auth, "POST", input, 201);
    assert.equal(repeat.data.id, payment.id);
    assert.equal(await due(), 37.25);
    assert.equal(
      (await call(`${url}/${payment.id}`, auth)).data.receipt_no,
      payment.receipt_no,
    );
    const cancel = (reason, expected = 200) =>
      call(`${url}/${payment.id}`, auth, "DELETE", { reason }, expected);
    await cancel("", 400);
    await cancel("duplicate");
    assert.equal(await due(), 50);
    assert.equal(
      (await db`select status from fees where id=${payment.db_fee_id}`)[0]
        .status,
      "VOID",
    );
    await cancel("duplicate", 409);
    const restore = () =>
      call(`${url}/${payment.id}`, auth, "PATCH", {
        status: "COMPLETED",
        reason: "verified original receipt",
      });
    await restore();
    assert.equal(await due(), 37.25);
    assert.equal(
      Number(
        (
          await db`select count(*) from fee_audit_logs where record_id=${payment.id}`
        )[0].count,
      ),
      3,
    );
    console.log(
      "PASS mounted mobile collection, retry, fee detail, reasoned void/restore, SQL dues, tenant and guardian scope",
    );
    const waiverUI = await approvalChecks(stack, empty, ja, call, {
      classId,
      jt,
      pupil: jp,
      limited,
      foreign: auth,
      foreignPupil: pupil,
    });
    if (httpOnly) return;
    const require = createRequire(
        resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
      ),
      chromium = require("@sparticuz/chromium"),
      puppeteer = require("puppeteer-core");
    const wire = await fixtureProxy([base, api]);
    let browser, page;
    const grid = '[data-fund-id="fixture-book"]',
      statement = "#fund-statement-print-area",
      print = 'button[title="স্টেটমেন্ট প্রিন্ট করুন"]';
    try {
      browser = await puppeteer.launch({
        executablePath: await chromium.executablePath(),
        headless: true,
        args: [
          ...chromium.args.filter(
            (a) =>
              ![
                "--single-process",
                "--disable-web-security",
                "--allow-running-insecure-content",
                "--disable-site-isolation-trials",
              ].includes(a),
          ),
          ...wire.args,
        ],
      });
      await waiverUI(browser, jp, jb.id);
      page = await browser.newPage();
      page.setDefaultTimeout(16000);
      await page.setViewport({ width: 460, height: 850 });
      await page.goto(base + "/login");
      await page.locator("input[name=identifier]").fill(email);
      await page.locator("input[name=password]").fill(password);
      await page.click("button[type=submit]");
      await page.waitForFunction(() =>
        location.pathname.startsWith("/dashboard"),
      );
      // Same display name, distinct owners: an active and a voided member
      // receipt stay in that history, not in the SQL donor's. No raw phone in RSC.
      const [voided] =
        await db`insert into donations(madrasa_id,member_id,receipt_no,amount,fund_id) values(${t},${member},'HISTORY-VOID',2.25,'fund-general') returning id`;
      await db`update donations set status='VOID' where madrasa_id=${t} and id=${voided.id}`;
      await page.goto(base + "/dashboard/fundraising/donors", {
        waitUntil: "networkidle0",
      });
      assert.ok(!(await page.content()).includes("01700000001"));
      const hist = 'dialog[aria-label="দাতার খতিয়ান"]';
      const history = async (id) => {
        await page.locator(`[data-history-for="${id}"]`).click();
        await page.waitForSelector(hist);
        return page.$eval(hist, (e) => e.innerText);
      };
      const memberHistory = await history(member);
      for (const text of [
        "TEST-MEMBER",
        "HISTORY-VOID",
        "বাতিল (VOID)",
        "মোট জমা (বাতিল বাদে): ৳ ১",
      ])
        assert.ok(memberHistory.includes(text), text);
      await page.locator(hist + " header button").click();
      const sqlHistory = await history(donor);
      assert.ok(
        sqlHistory.includes("কোনো জমা নেই") &&
          !sqlHistory.includes("TEST-MEMBER"),
      );
      console.log(
        "PASS selected web donor history by member ID vs same-name donor, VOID visible but not received, private receipt note withheld",
      );
      const ledgerButton = grid + ' button[title*="খতিয়ান"]';
      const fundsPage = () =>
        page.goto(base + "/dashboard/zakat/funds", {
          waitUntil: "networkidle0",
        });
      const open = async () => {
        await fundsPage();
        await page.locator(ledgerButton).click();
      };
      await open();
      await page.waitForSelector(statement);
      assert.ok(
        (await page.$eval("#reconciliation", (n) => n.textContent)).includes(
          "MHF-HISTORY",
        ),
      );
      const text = await page.$eval(statement, (n) => n.textContent);
      for (const expected of [payment.receipt_no, "D-LIB", "E-LIB", "৩৩", "২৮"])
        assert.ok(text.includes(expected), expected);
      await page.click(print);
      await page.waitForFunction(
        (ref) =>
          document
            .querySelector("#document-print-iframe")
            ?.contentDocument?.body?.textContent?.includes(ref),
        {},
        payment.receipt_no,
      );
      // Click the real receipt button; the isolated receipt must carry its stored number and selected fund.
      const button = await page.waitForFunction(() =>
        [...document.querySelectorAll("tr")]
          .find(
            (r) => r.getClientRects().length && r.textContent.includes("D-LIB"),
          )
          ?.querySelector("button"),
      );
      await button.asElement().click();
      await page.waitForSelector("#donation-receipt-sheet");
      assert.ok(
        (
          await page.$eval("#donation-receipt-sheet", (n) => n.textContent)
        ).includes("D-LIB"),
      );
      await cancel("operator correction");
      await open();
      await page.waitForSelector(statement);
      const cancelled = await page.$eval(statement, (n) => n.textContent);
      assert.ok(cancelled.includes(`[VOID] ${payment.receipt_no}`));
      assert.ok(cancelled.includes("১৫.২৫"));
      await page.goto(
        base + `/dashboard/accounting/fees/${payment.id}/receipt`,
      );
      await page.waitForSelector("#dual-money-receipt-sheet");
      const feeSheet = await page.$eval(
        "#dual-money-receipt-sheet",
        (el) => el.innerText,
      );
      for (const term of [
        "Fixture Library",
        payment.receipt_no,
        "operator correction",
      ])
        assert.ok(feeSheet.includes(term), term);
      // A failed ledger read is not a printable zero ledger.
      await fundsPage();
      await page.waitForSelector(grid);
      await db.unsafe("REVOKE SELECT ON bazar_expenses FROM service_role");
      await page.locator(ledgerButton).click();
      await page.waitForSelector('[role="alert"]');
      assert.equal(await page.$eval(print, (b) => b.disabled), true);
      assert.equal(await page.$(statement), null);
      console.log(
        "PASS narrow web ledger, isolated print, real receipt, orphan review, void refresh, failed read disables print",
      );
    } catch (e) {
      if (page)
        console.error(
          "Fixture screen:",
          new URL(page.url()).pathname,
          (await page.$eval("main", (n) => n.innerText).catch(() => "")).slice(
            -1000,
          ),
        );
      throw e;
    } finally {
      try {
        await browser?.close();
      } finally {
        await wire.close();
      }
    }
  },
  { buildForBrowser: !httpOnly, rpcJsonObjects: true, withStorage: true },
);
