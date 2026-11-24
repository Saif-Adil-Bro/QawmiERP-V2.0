import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Capture actual report endpoints before and after the two journal vouchers.
export async function reportSnapshot({ page, auth, call }, day) {
  const mobile = (await call("/api/mobile/dashboard", auth)).data.stats;
  const asOf = await page.evaluate(async (day) => {
    async function reserve(dateTo) {
      const r = await fetch("/api/bi/custom-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataset: "funds", groupBy: "category", dateTo }),
      });
      if (!r.ok) throw Error(`BI funds report: ${r.status}`);
      return (await r.json()).summary.totalAmount;
    }
    return Promise.all([reserve("2020-02-01"), reserve(day)]);
  }, day);
  return { mobile, asOf };
}
export async function verifyJournalReports(inputs, day, before) {
  const { page, base } = inputs,
    after = await reportSnapshot(inputs, day);
  for (const k of [
    "total_income",
    "total_expense",
    "today_income",
    "today_expense",
  ])
    assert.equal(after.mobile[k], before.mobile[k], k);
  assert.equal(after.mobile.net_balance, before.mobile.net_balance + 20);
  assert.deepEqual(after.asOf, [before.asOf[0], before.asOf[1] + 20]);
  await page.goto(base + "/dashboard", { waitUntil: "networkidle0" });
  assert.equal(
    Number(
      await page.$eval(
        "[data-finance-balance]",
        (n) => n.dataset.financeBalance,
      ),
    ),
    after.mobile.net_balance,
  );
  await page.goto(base + "/dashboard/zakat/funds", {
    waitUntil: "networkidle0",
  });
  await page
    .locator('[data-fund-id="fund-dev"] button[title*="খতিয়ান"]')
    .click();
  await page.waitForSelector("#fund-statement-print-area");
  await page.focus('button[title="স্টেটমেন্ট প্রিন্ট করুন"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document
      .querySelector("#document-print-iframe")
      ?.contentDocument?.body?.textContent.includes("JV-"),
  );
  const printed = await page.evaluate(() => {
    const s = document
      .querySelector("#document-print-iframe")
      .contentDocument.querySelector("#fund-statement-print-area");
    return {
      text: s.textContent,
      entries: [...s.querySelectorAll("tbody tr")]
        .filter(
          (r) => r.innerText.includes("JV-") || r.textContent.includes("JV-"),
        )
        .map((r) => [...r.cells].slice(3).map((c) => c.textContent.trim())),
    };
  });
  assert.ok(printed.text.includes("১৬.২৫"));
  assert.deepEqual(
    printed.entries.sort(),
    [
      ["-", "-", "২০"],
      ["-", "-", "-৩.৭৫"],
    ].sort(),
  );
  console.log(
    "PASS opening +20 and neutral transfer: dated BI reserve, same web/mobile balance, unchanged income and expense, isolated ledger prints distinct journal column",
  );
}

// All fixture records live in this disposable PG. Read the actual JSON blob sent to the download,
// not a hand-built export or test-only route. The restricted session uses the same mounted actions.
export async function evidenceUI({
  page,
  db,
  base,
  tenant,
  actor,
  voucher,
  auth,
  call,
}) {
  const open = (path, p = page) =>
    p.goto(base + path, { waitUntil: "networkidle0" });
  const [{ security_metadata: originalSecurity }] =
    await db`select security_metadata from madrasas where id=${tenant}`;
  async function grants(perms) {
    await db`update madrasas set security_metadata=jsonb_set(coalesce(security_metadata,'{}'::jsonb),'{user_security_profiles}',coalesce(security_metadata->'user_security_profiles','{}')||${db.json({ [actor]: { directPermissions: perms } })}::jsonb) where id=${tenant}`;
  }
  const marker = "Private-pay-fixture";
  const [pay] =
    await db`insert into expenses(madrasa_id,fund_id,category,expense_date,amount,voucher_no,description,line_items,restricted_beneficiary) values(${tenant},'fund-general','Salary','2011-03-02',3.25,'PAY-ITEM',${marker},${db.json([{ label: marker, amount: 3.25 }])},${marker}) returning id`;
  await db`insert into treasury_memos(expense_id,madrasa_id,actor_id,image) select ${pay.id},madrasa_id,actor_id,image from treasury_memos where expense_id=${voucher}`;
  const [foreign] =
    await db`select madrasa_id,id from users where madrasa_id<>${tenant} limit 1`;
  const [other] =
    await db`insert into expenses(madrasa_id,fund_id,category,amount) values(${foreign.madrasa_id},'fund-general','Other',1) returning id`;
  await db`insert into treasury_memos(expense_id,madrasa_id,actor_id,image) select ${other.id},${foreign.madrasa_id},${foreign.id},image from treasury_memos where expense_id=${voucher}`;
  const memo = (id) => "/api/accounting/expenses/" + id + "/memo";
  assert.deepEqual(
    await page.evaluate(
      async (url) => [
        (await fetch(url)).status,
        (await fetch(url, { method: "POST", headers: { "x-qawmi-memo": "1" } }))
          .status,
      ],
      memo(other.id),
    ),
    [404, 404],
  );
  const heads = await page.browserContext().newPage();
  try {
    await grants(["settings.backup"]);
    // Cross the 500-row boundaries with real scoped primary/composite keys.
    await db`with v as (insert into expenses(madrasa_id,fund_id,category,expense_date,amount) select ${tenant},'fund-general','Other','2010-01-01',0.01 from generate_series(1,499) returning id,madrasa_id)
      insert into treasury_memos(expense_id,madrasa_id,actor_id,image) select v.id,v.madrasa_id,${actor},m.image from v, treasury_memos m where m.expense_id=${voucher}`;
    await db`insert into treasury_days(madrasa_id,operator_id,cash_date,opening) select u.madrasa_id,u.id,'2000-01-01'::date+i,0 from (select id,madrasa_id from users where madrasa_id=${tenant} order by id limit 2) u,generate_series(1,251) i`;
    await open("/dashboard/settings/backup");
    await page.$eval("button::-p-text(সবগুলো আনচেক করুন)", (b) => b.click());
    for (const k of ["finance_transactions", "expenses"])
      await page.$eval(`input[type=checkbox][value="${k}"]`, (el) =>
        el.click(),
      );
    await page.evaluate(() => {
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (blob instanceof Blob && blob.type.startsWith("application/json"))
          window.exportedFinance = blob.text();
        return create(blob);
      };
    });
    await page.$eval("button::-p-text(মডিউল ডাউনলোড করুন)", (b) => b.click());
    await page.waitForFunction(() => !!window.exportedFinance);
    const { data, manifest } = JSON.parse(
      await page.evaluate(() => window.exportedFinance),
    );
    assert.equal(manifest.madrasa_id, tenant);
    assert.equal(manifest.is_selective, true);
    assert.deepEqual(manifest.cold_backup_required_for, [
      "treasury_memos.image",
    ]);
    assert.deepEqual(manifest.modules.sort(), [
      "expenses",
      "finance_transactions",
    ]);
    assert.equal(
      manifest.checksum,
      "sha256:" +
        createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    );
    assert.ok(!("treasury_memos" in data) && !("donations" in data));
    const indexes = data.treasury_memo_index;
    assert.equal(indexes.length, 501);
    assert.equal(new Set(indexes.map((r) => r.expense_id)).size, 501);
    assert.ok(!indexes.some((r) => r.expense_id === other.id));
    for (const r of indexes)
      assert.deepEqual(Object.keys(r).sort(), [
        "bytes",
        "created_at",
        "expense_id",
        "sha256",
      ]);
    const bytes = (
      await db`select image from treasury_memos where expense_id=${voucher}`
    )[0].image;
    assert.equal(
      indexes.find((r) => r.expense_id === voucher).sha256,
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(
      indexes.find((r) => r.expense_id === voucher).bytes,
      bytes.length,
    );
    for (const key of [
      "treasury_days",
      "treasury_fee_tenders",
      "treasury_journals",
      "treasury_heads",
      "expenses",
    ]) {
      const actual =
        await db`select count(*)::int n from ${db(key)} where madrasa_id=${tenant}`;
      assert.ok(manifest.included_tables.includes(key));
      assert.equal(data[key].length, actual[0].n);
      assert.ok(data[key].every((r) => r.madrasa_id === tenant));
    }
    const days = data.treasury_days.map(
      (r) => r.operator_id + ":" + r.cash_date,
    );
    assert.ok(days.length > 500);
    assert.equal(new Set(days).size, days.length);
    const status = await page.evaluate(
      async (backupPayload) => {
        const r = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restoreMode: "merge", backupPayload }),
        });
        return [r.status, (await r.json()).error];
      },
      { manifest, data },
    );
    assert.deepEqual(status, [400, "FINANCIAL_RECOVERY_REQUIRED"]);
    console.log(
      "PASS mounted selective export: 501 memo descriptors, checksum/size match private bytes, paged composite drawers, no foreign voucher or image, financial restore held",
    );
    await open("/dashboard/accounting/expense-heads", heads);
    await open("/dashboard/accounting/journals");
    // Change rights in the fixture AFTER both forms exist. Hidden buttons are not the access control.
    await grants(["finance.view"]);
    await db`update users set role='office_staff' where madrasa_id=${tenant} and id=${actor}`;
    await page.$eval("input[value=ADJUST_IN]", (i) => {
      const f = i.form;
      f.dst.value = "fund-general";
      f.amount.value = "1";
      f.ref.value = "Not posted";
      f.requestSubmit();
    });
    await heads.$eval("form:has(input[name=name])", (f) => {
      f.elements.name.value = "Not created";
      f.requestSubmit();
    });
    for (const p of [page, heads])
      await p.waitForFunction(() =>
        [...document.querySelectorAll("main [role=status]")].some((n) =>
          n.textContent.includes("অনুমতি নেই"),
        ),
      );
    assert.equal(
      (
        await db`select count(*)::int n from treasury_journals where reason='Not posted'`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await db`select count(*)::int n from treasury_heads where name='Not created'`
      )[0].n,
      0,
    );
    const path = "/api/mobile/expenses",
      dt = "2011-03-02";
    const row = (await call(path + "/" + pay.id, auth)).data;
    assert.equal(row.amount, 3.25);
    assert.equal(row.salary_hidden, true);
    assert.ok(!JSON.stringify(row).includes(marker));
    const list = (await call(path + "?expense_date=" + dt, auth)).data;
    assert.deepEqual(list, [row]);
    assert.deepEqual((await call(path + "?q=" + marker, auth)).data, []);
    await open("/dashboard/accounting/expenses?month=03&year=2011");
    assert.ok(!(await page.content()).includes(marker));
    await page.focus('button[title="ভাউচার দেখুন ও প্রিন্ট করুন"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector("#expense-voucher-sheet");
    await page.focus('button[aria-controls="expense-voucher-sheet"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document
        .querySelector("#document-print-iframe")
        ?.contentDocument?.body?.textContent.includes("PAY-ITEM"),
    );
    assert.ok(
      !(
        await page.$eval(
          "#document-print-iframe",
          (f) => f.contentDocument.body.textContent,
        )
      ).includes(marker),
    );
    await open(`/dashboard/accounting/daybook?start=${dt}&end=${dt}`);
    assert.ok(!(await page.content()).includes(marker));
    assert.ok(
      (await page.$eval("#daybook-sheet", (s) => s.textContent)).includes(
        "PAY-ITEM",
      ),
    );
    assert.deepEqual(
      await page.evaluate(
        async (url) => [
          (await fetch(url)).status,
          (
            await fetch(url, {
              method: "POST",
              headers: { "x-qawmi-memo": "1" },
            })
          ).status,
        ],
        memo(pay.id),
      ),
      [404, 403],
    );
    console.log(
      "PASS finance.view can reconcile salary amount but cannot search private terms, read the memo or see names on web/daybook/print/mobile; already-mounted journal/head actions refuse mutations",
    );
  } finally {
    await db`update users set role='accountant' where madrasa_id=${tenant} and id=${actor}`;
    await db`update madrasas set security_metadata=${db.json(originalSecurity ?? {})} where id=${tenant}`;
    await heads.close();
  }
}
