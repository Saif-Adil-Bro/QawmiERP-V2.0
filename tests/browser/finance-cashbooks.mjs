import assert from "node:assert/strict";
import sharp from "sharp";
import {
  reportSnapshot,
  verifyJournalReports,
  evidenceUI,
} from "./finance-treasury-evidence.mjs";
// Real web session, server actions, mobile posting, private bytes and the actual isolated print document.
export async function cashbookUI({
  page,
  base,
  db,
  tenant,
  actor,
  pupil,
  auth,
  call,
}) {
  const day = "2020-02-02",
    path = "/dashboard/accounting/";
  const goto = (p) => page.goto(base + path + p, { waitUntil: "networkidle0" });
  const submit = async (op) => {
    await page.$eval(`input[value="${op}"]`, (el) => el.form.requestSubmit());
  };
  await goto("expense-heads");
  await page.locator("input[name=name]").fill("Fixture supplies");
  await page.select("select[name=policy]", "Other");
  await page.click("form button");
  await page.waitForFunction(
    () => document.querySelectorAll("input[name=name]").length === 2,
  );
  const [{ id: head }] =
    await db`select id from treasury_heads where madrasa_id=${tenant} and name='Fixture supplies'`;
  await goto("cashbook?date=" + day);
  await page.locator("input[name=amount]").fill("20.50");
  await submit("OPEN");
  await page.waitForSelector("input[value=CLOSE]");
  const lines = [
    { label: "Exercise book", amount: 4.25 },
    { label: "Blue pen", amount: 1 },
  ];
  const v = (
    await call(
      "/api/mobile/expenses",
      auth,
      "POST",
      {
        fund_id: "fund-general",
        category: "Other",
        head_id: head,
        student_id: pupil,
        amount: 5.25,
        line_items: lines,
        payment_method: "Cash",
        expense_date: day,
        voucher_no: "PH2-ITEMS",
      },
      201,
    )
  ).data;
  assert.deepEqual(v.line_items, lines);
  assert.equal(v.head_name, "Fixture supplies");
  for (const [i, method] of [
    "Bank",
    "bKash",
    "Nagad",
    "Online",
    "Cash",
  ].entries())
    await call(
      "/api/mobile/donations",
      auth,
      "POST",
      {
        fund_id: "fund-general",
        amount: i === 4 ? 8 : 99,
        donation_date: day,
        receipt_no: "PH2-" + method,
        payment_method: method,
      },
      201,
    );
  await goto("cashbook?date=" + day);
  const cash = await page.$eval("#cash-sheet", (e) => e.innerText);
  assert.ok(
    cash.includes("PH2-Cash") &&
      cash.includes("PH2-ITEMS") &&
      !cash.includes("PH2-Bank") &&
      !cash.includes("PH2-Nagad"),
  );
  assert.equal(
    await page.$eval("input[name=expected]", (e) => e.value),
    "23.25",
  );
  await page.$eval("input[value=CLOSE]", (e) => {
    e.form.amount.value = "23.25";
    e.form.requestSubmit();
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("input[value=CLOSE]") &&
      document.querySelector("#cash-sheet")?.textContent.includes("সমাপ্ত"),
  );
  await goto(
    "daybook?start=" +
      day +
      "&end=" +
      day +
      "&flow=expense&student=" +
      pupil +
      "&item=Blue",
  );
  let sheet = await page.$eval("#daybook-sheet", (e) => e.innerText);
  assert.ok(
    sheet.includes("PH2-ITEMS") &&
      sheet.includes("Fixture supplies") &&
      sheet.includes("Blue pen") &&
      !sheet.includes("PH2-Cash"),
  );
  const print = 'button[aria-controls="daybook-sheet"]';
  await page.focus(print);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document
      .querySelector("#document-print-iframe")
      ?.contentDocument?.body?.textContent.includes("Blue pen"),
  );
  const api = "/api/accounting/expenses/" + v.id + "/memo";
  const jpeg = await sharp({
    create: { width: 24, height: 14, channels: 3, background: "#548" },
  })
    .jpeg()
    .toBuffer();
  assert.ok([401, 403].includes((await fetch(base + api)).status));
  assert.deepEqual(
    await page.evaluate(
      async (api, bytes) => {
        const h = { "x-qawmi-memo": "1", "content-type": "image/jpeg" },
          post = (b) =>
            fetch(api, { method: "POST", headers: h, body: b }).then(
              (r) => r.status,
            );
        const absent = await fetch(api);
        const invalid = await post("not a photo"),
          saved = await post(Uint8Array.from(bytes)),
          replay = await post(Uint8Array.from(bytes));
        const r = await fetch(api);
        return [
          absent.status,
          invalid,
          saved,
          replay,
          r.status,
          r.headers.get("content-type"),
          r.headers.get("cache-control"),
        ];
      },
      api,
      [...jpeg],
    ),
    [404, 422, 201, 409, 200, "image/jpeg", "private, no-store"],
  );
  await page.focus("#daybook-sheet button");
  await page.keyboard.press("Enter");
  await page.waitForSelector('img[alt="সরবরাহকারীর মূল মেমো"]');
  const ctx = { page, base, db, tenant, auth, actor, call };
  const before = await reportSnapshot(ctx, day);
  await goto("journals");
  for (const [k, src, dst, n] of [
    ["OPENING", "", "fund-dev", 20],
    ["TRANSFER", "fund-dev", "fund-zakat", 3.75],
  ]) {
    await page.$eval(
      `input[value="${k}"]`,
      (e, { src, dst, n, day }) => {
        const f = e.form;
        if (src) f.src.value = src;
        if (dst) f.dst.value = dst;
        f.date.value = day;
        f.amount.value = n;
        f.ref.value = "Phase Two";
        f.requestSubmit();
      },
      { src, dst, n, day },
    );
    await page.waitForFunction(
      (k) =>
        document
          .querySelector(`input[value="${k}"]`)
          ?.form.querySelector("[role=status]")
          ?.textContent.includes("JV-"),
      {},
      k,
    );
  }
  await goto("daybook?start=" + day + "&end=" + day + "&q=Phase%20Two");
  sheet = await page.$eval("#daybook-sheet", (e) => e.innerText);
  assert.equal((sheet.match(/JV-/g) || []).length, 3);
  await verifyJournalReports(ctx, day, before);
  await evidenceUI({ ...ctx, voucher: v.id });
  console.log(
    "PASS operator drawer open/close, noncash exclusions, custom head and item+student search, filtered print, private validated memo upload/read, paired neutral journals on mounted routes",
  );
}
