import assert from "node:assert/strict";

// Exercise the actual two firmware transports with fixture-only credentials.
// Keep these punches on the retained machine, after the UI delete readback.
export async function ingressChecks({ page, base, db, t, pupil, main }) {
  const line = "480001\t2026-11-22 07:55:00\t0";
  const adms = () =>
    page.request.post(
      base + "/api/biometric/iclock/cdata?SN=MAIN&table=ATTLOG",
      { data: line, headers: { "Content-Type": "text/plain" } },
    );
  const push = () =>
    page.request.post(base + "/api/biometric/push", {
      headers: { Authorization: "Bearer " + main.secret_token },
      data: {
        device_sn: "MAIN",
        user_id: "480001",
        timestamp: "2026-11-22 07:55:00",
      },
    });
  const first = await push();
  assert.equal(first.status(), 200);
  assert.equal((await first.json()).attendanceDaysCreated, 1);
  const firmware = await adms();
  assert.equal(firmware.status(), 200);
  assert.equal(await firmware.text(), "OK: 1");
  const again = await push();
  assert.equal((await again.json()).duplicates, 1);
  const persisted =
    await db`select date,status from attendance where madrasa_id=${t} and student_id=${pupil} and date='2026-11-22'`;
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].status, "Present");
  assert.equal(
    (
      await db`select count(*)::int n from biometric_punch_events where madrasa_id=${t} and device_id=${main.id}`
    )[0].n,
    1,
  );
  console.log(
    "PASS new Nov 22 mapped punch through JSON push, same instant via iClock & push retry: one durable event and one Present",
  );

  // Put 101 same-time rows across the page boundary; the second key in the
  // cursor is essential (OFFSET or <timestamp alone would miss the last one).
  await db`insert into biometric_punch_events(id,madrasa_id,device_id,device_name,device_user_id,punch_time,punch_date,punch_type,sync_mode,status) select 'page-'||lpad(i::text,3,'0'),${t},${main.id},${main.name},(600000+i)::text,'2026-11-24 02:00:00Z','2026-11-24','auto','usb_import','unmapped' from generate_series(1,101)i`;
  await page.getByRole("button", { name: /রিয়েলটাইম পাঞ্চ লগ/ }).click();
  await page.getByLabel("পাঞ্চের ডিভাইস").selectOption(main.id);
  await page.getByLabel("পাঞ্চের তারিখ").fill("2026-11-24");
  const cell = (pin) =>
    page.getByRole("cell", { name: String(pin), exact: true });
  await cell(600101).waitFor();
  assert.equal(await cell(600001).count(), 0);
  await page.getByRole("button", { name: "পরের পৃষ্ঠা" }).click();
  await cell(600001).waitFor();
  assert.equal(await cell(600101).count(), 0);
  await page.getByRole("button", { name: "আগের পৃষ্ঠা" }).click();
  await cell(600101).waitFor();
  await db`alter function biometric_event_counts(uuid,date) rename to fixture_counts_unavailable`;
  try {
    await page.getByRole("button", { name: "রিফ্রেশ" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "তথ্য পড়া যায়নি" })
      .waitFor();
  } finally {
    await db`alter function fixture_counts_unavailable(uuid,date) rename to biometric_event_counts`;
  }
  await page.getByRole("button", { name: "রিফ্রেশ" }).click();
  await cell(600101).waitFor();
  console.log(
    "PASS date/device-filtered history 101 tied timestamps → 100 + 1, back and forward; unavailable count shows read error",
  );
}
