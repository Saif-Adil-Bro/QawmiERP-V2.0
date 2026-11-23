import assert from "node:assert/strict";

export async function calendarUI({ db, t, base, page, code }) {
  const key = "2018-close",
    window = {
      period_key: key,
      period_type: "MONTHLY",
      start_date: "2018-04-01",
      end_date: "2018-04-27",
      label: "Historical April close",
      is_locked: true,
      locked_at: "2018-04-28T00:00:00Z",
    };
  await db`insert into madrasa_settings(madrasa_id,namespace,setting_key,setting_value) values(${t},'locks','accounting_periods',${db.json([window])})`;
  await db.unsafe("grant insert,update on accounting_periods to service_role");
  const card = `[data-period-key="${key}"]`,
    url = base + "/dashboard/settings/data-governance";
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForSelector(card + '[data-period-locked="true"]');
  assert.ok(
    (await page.$eval(card, (n) => n.innerText)).includes(window.end_date),
  );
  await page.click(card + " button");
  await page
    .locator('textarea[placeholder="সুনির্দিষ্ট কারণ লিখুন..."]')
    .fill("Fixture review complete");
  await page.click('[aria-label="হিসাবকাল পরিবর্তন নিশ্চিত করুন"]');
  await page.waitForSelector("input[autocomplete=one-time-code]");
  assert.equal((await db`select finance_closed_periods(${t})`).length, 1);
  await page.locator("input[autocomplete=one-time-code]").fill(code());
  await page.click(
    "form:has(input[autocomplete=one-time-code]) button[type=submit]",
  );
  await page.waitForSelector(card + '[data-period-locked="false"]');
  assert.equal(
    (await db`select * from finance_closed_periods(${t})`).length,
    0,
  );
  const [{ unlocked_by, unlocked_at }] =
    await db`select unlocked_by,unlocked_at from accounting_periods where madrasa_id=${t} and period_key=${key}`;
  assert.ok(unlocked_by && unlocked_at);
  assert.equal(
    (
      await db`select count(*) from system_audit_logs where madrasa_id=${t} and action='ACCOUNTING_PERIOD_UNLOCKED'`
    )[0].count,
    "1",
  );
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.focus(card + " button");
  await page.keyboard.press("Enter");
  await page
    .locator('textarea[placeholder="সুনির্দিষ্ট কারণ লিখুন..."]')
    .fill("Close historical fixture");
  await page.click('[aria-label="হিসাবকাল পরিবর্তন নিশ্চিত করুন"]');
  await page.waitForSelector(card + '[data-period-locked="true"]');
  assert.deepEqual(
    (
      await db`select start_date::text,end_date::text from finance_closed_periods(${t})`
    )[0],
    { start_date: window.start_date, end_date: window.end_date },
  );
  try {
    await db.unsafe(
      "revoke execute on function finance_accounting_calendar(uuid) from service_role",
    );
    await page.goto(url);
    await page.waitForSelector("main [role=alert]");
    assert.equal(await page.$("[data-period-key]"), null);
  } finally {
    await db.unsafe(
      "grant execute on function finance_accounting_calendar(uuid) to service_role",
    );
  }
  console.log(
    "PASS historical nonstandard window in governance, real scoped TOTP unlock/reclose, audit, failed read is unavailable",
  );
}
