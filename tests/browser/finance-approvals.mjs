import { salaryUI } from "./finance-salary.mjs";
import { calendarUI } from "./finance-calendar.mjs";
import { billingChecks } from "./finance-billing.mjs";
import { recoveryChecks } from "./finance-recovery.mjs";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

// Act as the enrolled test authenticator. The secret is issued by the disposable
// app's real enrollment flow; never print OTPs, passwords, cookies or tokens.
function totp(secret) {
  const bits = [...secret.replace(/=+$/, "")]
    .map((c) =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        .indexOf(c)
        .toString(2)
        .padStart(5, "0"),
    )
    .join("");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  return String(
    (h.readUInt32BE(h.at(-1) & 15) & 0x7fffffff) % 1000000,
  ).padStart(6, "0");
}
export async function approvalChecks(
  { base, db, lite, anon, mobileKey, storage },
  t,
  cashier,
  call,
  billing,
) {
  let reviewerMobile;
  async function webUser(role) {
    const email = `finance-${role}@example.test`,
      password = randomBytes(32).toString("hex");
    const { data, error } = await lite
      .getClient({ apikey: anon })
      .auth.signUp({ email, password });
    assert.ok(!error && data.user);
    await db`insert into users(id,madrasa_id,role,full_name,email) values(${data.user.id},${t},${role},${role},${email})`;
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 200);
    if (role === "super_admin") {
      const { data } = await call(
        "/api/mobile/auth/login",
        { "x-api-key": mobileKey },
        "POST",
        { email, password },
      );
      reviewerMobile = {
        "x-api-key": mobileKey,
        authorization: `Bearer ${data.access_token}`,
      };
    }
    return {
      cookie: r.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; "),
    };
  }
  const reviewer = await webUser("super_admin"),
    clerk = await webUser("accountant"),
    maker = await webUser("admin"),
    office = await webUser("office_staff");
  await db.unsafe(
    "GRANT INSERT,UPDATE ON approval_requests,approval_step_decisions,user_mfa_settings,step_up_verifications TO service_role;",
  );
  const [{ id: w }] =
    await db`insert into approval_workflows(madrasa_id,name,request_type,min_amount) values(${t},'Fixture second signature','LARGE_EXPENSE',100) returning id`;
  await db`insert into approval_workflow_steps(madrasa_id,workflow_id,step_order,step_name,approver_role,require_step_up) values(${t},${w},1,'Verify voucher','super_admin',true)`;
  const expense = {
    category: "Maintenance",
    amount: 102.25,
    fund_id: "fund-general",
    expense_date: "2026-11-03",
    description: "Test only",
  };
  const expenseUrl = "/api/mobile/expenses",
    ai = "/api/ai/confirm",
    path = (id) => `/api/approvals/${id}/decision`;
  const lines=[{label:"Parts",amount:100},{label:"Oil",amount:2.25}];
  const req = (await call(expenseUrl, cashier, "POST", {...expense,payment_method:"Cash",line_items:lines}, 202)).data
    .approvalRequestId;
  assert.ok(req);
  const approved = { decision: "APPROVED" },
    confirm = (id) => ({
      actionType: "submit_approval_decision",
      payload: { requestId: id, ...approved },
    });
  const count = async () =>
    Number(
      (await db`select count(*) from expenses where madrasa_id=${t}`)[0].count,
    );
  assert.equal(await count(), 0);
  await call(path(req), cashier, "POST", approved, 401); // A mobile Bearer alone is not a web session.
  assert.equal(
    (await call(path(req), reviewer, "POST", approved, 403)).code,
    "STEP_UP_REQUIRED",
  );
  const step = await call(ai, reviewer, "POST", confirm(req), 403);
  assert.equal(step.code, "STEP_UP_REQUIRED");
  assert.equal(await count(), 0);
  const setup = "/api/auth/mfa/setup";
  const { secret } = await call(setup, reviewer, "POST", {
    action: "begin_totp",
  });
  await call(setup, reviewer, "POST", {
    action: "confirm_totp",
    code: totp(secret),
  });
  const verify = async (scope) => {
    const args = { actionScope: scope, channel: "totp" },
      ch = await call("/api/auth/step-up/challenge", reviewer, "POST", args);
    return (
      await call("/api/auth/step-up/verify", reviewer, "POST", {
        ...args,
        challengeId: ch.challengeId,
        code: totp(secret),
      })
    ).token;
  };
  const verified = {
    ...reviewer,
    "x-step-up-token": await verify(step.actionScope),
  };
  const out = await call(ai, verified, "POST", confirm(req));
  assert.ok(out.executionResult?.executed, JSON.stringify(out.executionResult));
  assert.equal(out.executionResult.result.expense.id, req);
  const [approvedVoucher]=await db`select e.line_items,e.operator_id,r.requested_by from expenses e join approval_requests r on r.id=e.id where e.id=${req}`;
  assert.deepEqual(approvedVoucher.line_items,lines);assert.equal(approvedVoucher.operator_id,approvedVoucher.requested_by);
  await call(path(req), verified, "POST", approved, 400);
  assert.equal(await count(), 1);
  const pending = await call(
    ai,
    clerk,
    "POST",
    {
      actionType: "add_expense",
      payload: { ...expense, expenseDate: expense.expense_date },
    },
    202,
  );
  assert.ok(pending.pendingApproval);
  await call(path(pending.approvalRequestId), clerk, "POST", approved, 403);
  await call(path(pending.approvalRequestId), verified, "POST", {
    decision: "REJECTED",
  });
  assert.equal(await count(), 1);
  // Older requests without frozen terms must not auto-execute under a new policy.
  const { approvalRequestId: old } = (
    await call(expenseUrl, cashier, "POST", expense, 202)
  ).data;
  await db`update approval_requests set payload=payload-'financeWorkflow' where id=${old}`;
  await call(path(old), verified, "POST", approved, 409);
  assert.equal(await count(), 1);
  const { approvalRequestId: collision } = (
    await call(
      expenseUrl,
      cashier,
      "POST",
      { ...expense, voucher_no: out.executionResult.result.expense.voucher_no },
      202,
    )
  ).data;
  const failed = await call(path(collision), verified, "POST", approved);
  assert.equal(failed.executionResult.executed, false);
  assert.equal(await count(), 1);
  assert.equal(
    (
      await db`select executed_at from approval_requests where id=${collision}`
    )[0].executed_at,
    null,
  );
  // Validate the correction path without resetting an APPROVED row to PENDING.
  // A new corrected voucher has a new request and still needs a second signature.
  const changed = (
    await call(
      expenseUrl,
      cashier,
      "POST",
      { ...expense, voucher_no: "TERMS-1" },
      202,
    )
  ).data.approvalRequestId;
  await db`update approval_workflow_steps set approver_role='admin' where workflow_id=${w}`;
  await call(path(changed), verified, "POST", approved, 409);
  assert.equal(
    (await db`select status from approval_requests where id=${changed}`)[0]
      .status,
    "PENDING",
  );
  await db`update approval_workflow_steps set approver_role='super_admin' where workflow_id=${w}`;
  const corrected = (
    await call(
      expenseUrl,
      cashier,
      "POST",
      { ...expense, voucher_no: "CORRECTED-1" },
      202,
    )
  ).data.approvalRequestId;
  const decide = () =>
    fetch(base + path(corrected), {
      method: "POST",
      headers: { "content-type": "application/json", ...verified },
      body: JSON.stringify(approved),
    });
  const races = await Promise.all([decide(), decide()]);
  assert.equal(races.filter((r) => r.status === 200).length, 1);
  assert.ok(races.every((r) => [200, 400, 409].includes(r.status)));
  assert.equal(await count(), 2);
  const [posted] =
    await db`select id,voucher_no,amount from expenses where id=${corrected} and madrasa_id=${t}`;
  assert.equal(posted.voucher_no, "CORRECTED-1");
  assert.equal(Number(posted.amount), 102.25);
  assert.equal(
    (
      await db`select count(*) from approval_step_decisions where request_id=${corrected}`
    )[0].count,
    "1",
  );
  await assert.rejects(
    () => db`update expenses set amount=3 where id=${corrected}`,
    /অনুমোদন/,
  );
  assert.deepEqual(
    (
      await db`select action from system_audit_logs where entity_id=${corrected} order by action`
    ).map((r) => r.action),
    ["APPROVAL_REQUESTED", "APPROVAL_STEP_DECIDED", "EXPENSE_CREATED"],
  );
  const before = (
    await db`select registration_no,finance_source_revision from madrasas where id=${t}`
  )[0];
  assert.ok((await call("/api/admin/backfill?dryRun=true", reviewer)).success);
  await call("/api/admin/backfill", reviewer, "POST", { dryRun: false }, 409);
  assert.deepEqual(
    (
      await db`select registration_no,finance_source_revision from madrasas where id=${t}`
    )[0],
    before,
  );
  console.log(
    "PASS Bearer submission vs cookie decision, TOTP step-up on both web/AI, pending vs booked, second signature, reject, concurrent decision, changed terms, failed posting/corrected request and protected backfill",
  );
  const wipeUI = await recoveryChecks({
    storage,
    base,
    db,
    t,
    reviewer,
    call,
    foreignPupil: billing.foreignPupil,
  });
  const boardingUI = await billingChecks({
    base,
    db,
    t,
    call,
    reviewer,
    clerk,
    mobile: reviewerMobile,
    cashier,
    verify,
    ...billing,
  });
  // Drive the regular cashier UI and its Next actions, not a special test route.
  return async function waiverUI(browser, pupil, billId) {
    const [{ id: waiver }] =
      await db`insert into approval_workflows(madrasa_id,name,request_type,min_amount) values(${t},'Fixture waiver','FEE_WAIVER',1) returning id`;
    await db`insert into approval_workflow_steps(madrasa_id,workflow_id,step_order,step_name,approver_role,require_step_up) values(${t},${waiver},1,'Review waiver','super_admin',true)`;
    const card = (id) => `[data-approval-id="${id}"]`;
    const context = await browser.createBrowserContext(),
      page = await context.newPage();
    page.setDefaultTimeout(20000);
    async function session(headers) {
      await context.setCookie(
        ...headers.cookie.split("; ").map((s) => {
          const i = s.indexOf("=");
          return {
            name: s.slice(0, i),
            value: s.slice(i + 1),
            domain: new URL(base).hostname,
            path: "/",
          };
        }),
      );
    }
    async function submit() {
      await page.goto(
        base + "/dashboard/accounting/fees/new?student_id=" + pupil,
      );
      await page.waitForSelector('tbody input[max="3.75"]');
      await page
        .locator(`[data-bill-id="${billId}"] [aria-label="বিলে ছাড়"]`)
        .fill("3.75");
      // Other months are now due too. Waive this bill only and collect NO cash.
      await page.locator('[aria-label="আদায়কৃত নগদ"]').fill("0");
      await page.click("button[type=submit]:not([disabled])");
      await page.waitForFunction(() =>
        document
          .querySelector("main [role=status]")
          ?.textContent.includes("Pending Approval"),
      );
      return (
        await db`select id from approval_requests where madrasa_id=${t} and request_type='FEE_WAIVER' and status='PENDING' order by created_at desc`
      )[0].id;
    }
    try {
      await salaryUI({
        page,
        db,
        t,
        base,
        call,
        session,
        maker,
        reviewer,
        office,
        verify,
      });
      await session(reviewer);
      await wipeUI(page);
      await boardingUI(page);
      await calendarUI({ db, t, base, page, code: () => totp(secret) });
      await session(clerk);
      const original = (
        await call("/api/mobile/student-fees/" + billId, cashier)
      ).data;
      assert.equal(Number(original.due_amount), 3.75);
      const first = await submit();
      await page.goto(base + "/dashboard/approvals", {
        waitUntil: "networkidle0",
      });
      await page.waitForSelector(card(first));
      const button = card(first) + ' button[aria-label="আবেদন বাতিল"]';
      await page.focus(button);
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.request().headers()["next-action"] &&
            r.request().method() === "POST",
        ),
        page.keyboard.press("Enter"),
      ]);
      await page.waitForFunction(
        (sel) =>
          !document.querySelector(sel) ||
          document.querySelector("main [role=alert]"),
        {},
        card(first),
      );
      const alert = await page
        .$eval("main [role=alert]", (e) => e.textContent)
        .catch(() => null);
      assert.equal(alert, null);
      assert.equal(
        (await db`select status from approval_requests where id=${first}`)[0]
          .status,
        "CANCELLED",
      );
      const id = await submit();
      assert.notEqual(first, id);
      assert.equal(
        (await call("/api/mobile/student-fees/" + billId, cashier)).data
          .due_amount,
        3.75,
      );
      const challenge = await call(path(id), reviewer, "POST", approved, 403);
      const result = await call(
        path(id),
        { ...reviewer, "x-step-up-token": await verify(challenge.actionScope) },
        "POST",
        approved,
      );
      assert.equal(
        result.executionResult?.executed,
        true,
        JSON.stringify(result.executionResult),
      );
      const receipt = result.executionResult.result.payment;
      assert.deepEqual(
        receipt.allocations.map((a) => a.student_fee_id),
        [billId],
      );
      assert.equal(Number(receipt.total_amount_received), 0);
      assert.equal(Number(receipt.discount_total), 3.75);
      assert.ok(!receipt.db_fee_id);
      assert.equal(
        (await call("/api/mobile/student-fees/" + billId, cashier)).data
          .due_amount,
        0,
      );
      assert.equal(
        (
          await db`select count(*) from fee_audit_logs where record_id=${receipt.id} and action='COLLECT_FEE_PAYMENT'`
        )[0].count,
        "1",
      );
      await page.goto(
        base + `/dashboard/accounting/fees/${receipt.id}/receipt`,
      );
      await page.waitForSelector("#dual-money-receipt-sheet");
      assert.ok(
        (
          await page.$eval("#dual-money-receipt-sheet", (e) => e.innerText)
        ).includes(receipt.receipt_no),
      );
      console.log(
        "PASS real cashier form: partial balance, noncash waiver, requester cancellation/resubmission, protected final decision, audit and receipt",
      );
    } catch (e) {
      console.error(
        "Waiver screen:",
        new URL(page.url()).pathname,
        (await page.$eval("main", (n) => n.innerText).catch(() => "")).slice(
          -860,
        ),
      );
      throw e;
    } finally {
      await context.close();
    }
  };
}
