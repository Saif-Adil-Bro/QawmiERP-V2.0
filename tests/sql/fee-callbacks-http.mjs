// Run with a clean test-only `npm run build` and QAWMI_PG_BIN. This mounts the real
// Next routes. Only the PSP and a narrow PostgREST transport are stand-ins; the
// migration, row locks, uniqueness, rollback and financial rows are real PostgreSQL.
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { withDisposablePostgres } from "./disposable-postgres.mjs";

if (
  !existsSync(".next/BUILD_ID") ||
  [".env", ".env.local", ".env.production", ".env.production.local"].some(existsSync)
)
  throw new Error("Use a clean test checkout with npm run build and no deployment env files.");
const A = "a0000000-0000-4000-8000-000000000001",
  B = "b0000000-0000-4000-8000-000000000001";
const ref = "TXN-fixture-shared",
  val = "validation-A";
const account = (store) => `SANDBOX:${createHash("sha256").update(store).digest("hex")}`;
const config = (store) => ({
  environment: "SANDBOX",
  is_enabled: true,
  active_provider: "SSLCOMMERZ",
  sslcommerz: { is_live: false, store_id: store, store_passwd: "fixture-only" },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function within(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
await withDisposablePostgres(async ({ db }) => {
  const intents = new Map();
  await db.unsafe(`GRANT USAGE ON SCHEMA public TO service_role;
    GRANT SELECT, UPDATE ON public.madrasas, public.student_fees TO service_role;
    GRANT SELECT ON public.students TO service_role;
    GRANT SELECT,INSERT,UPDATE ON public.fees,public.fee_payments,public.fee_payment_allocations TO service_role;`);
  const reserve = (t, intent) =>
    db.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`;
      return tx`SELECT public.write_portal_fee_intent(${t},${tx.json(intent)}::jsonb)`;
    });
  for (const [tenant, store] of [
    [A, "fixture-a"],
    [B, "fixture-b"],
  ]) {
    await db`INSERT INTO public.madrasas(id,name,contact_email,metadata) VALUES (${tenant},'Private school','school@example.test',${db.json({ payment_gateway_config: config(store) })})`;
    const [p] =
      await db`INSERT INTO public.students(madrasa_id,first_name,last_name) VALUES (${tenant},'Private','Pupil') RETURNING id`;
    const [type] =
      await db`INSERT INTO public.fee_types(madrasa_id,name,code) VALUES (${tenant},'Fee','F') RETURNING id`;
    const allocations = [];
    for (const [period, initial, amount] of [
      ["M1", 60, 60],
      ["M2", 80.5, 15.25],
    ]) {
      const [bill] =
        await db`INSERT INTO public.student_fees(madrasa_id,student_id,session_id,fee_type_id,fee_type_name,billing_period,payable_amount,due_amount,fund_id,fund_name)
        VALUES (${tenant},${p.id},'term',${type.id},'Fee',${period},${initial},${initial},${period},'Fund') RETURNING id`;
      allocations.push({ student_fee_id: bill.id, allocated_amount: amount });
    }
    const intent = {
      madrasa_id: tenant,
      student_id: p.id,
      student_name: "Private Pupil",
      status: "PENDING",
      transaction_id: ref,
      provider: "SSLCOMMERZ",
      sslcommerz_scope: account(store),
      payment_channel: "bKash",
      amount: 75.25,
      convenience_fee: 2,
      total_payable: 77.25,
      allocations,
    };
    await reserve(tenant, intent);
    intents.set(tenant, intent);
  }
  // The same merchant cannot reserve another tenant's reference, even before validation.
  await reserve(A, { ...intents.get(A), transaction_id: "TXN-reserved-by-A" });
  await assert.rejects(
    reserve(B, {
      ...intents.get(B),
      transaction_id: "TXN-reserved-by-A",
      sslcommerz_scope: account("fixture-a"),
    }),
    { code: "23505" },
  );
  const ownDoc = async (t) =>
    (await db`SELECT registration_no::jsonb AS doc FROM public.madrasas WHERE id=${t}`)[0].doc;
  const setDoc = (t, doc) =>
    db`UPDATE public.madrasas SET registration_no=${JSON.stringify(doc)} WHERE id=${t}`;
  const donation = {
    id: "d1",
    madrasa_id: A,
    trx_id: "DON-fixture",
    receipt_no: "D-1",
    status: "PENDING",
    gateway_provider: "SSLCOMMERZ",
    amount: 5,
  };
  await db`SELECT public.replace_portal_gateway_key(${A},'online_donations',NULL,${db.json([donation])}::jsonb)`;
  const before = await ownDoc(A);
  const records = async (t) =>
    (
      await db`SELECT
    (SELECT count(*)::int FROM public.fees WHERE madrasa_id=${t}) AS raw,
    (SELECT count(*)::int FROM public.fee_payments WHERE madrasa_id=${t}) AS receipts,
    (SELECT count(*)::int FROM public.portal_fee_checkouts WHERE madrasa_id=${t} AND validation_id IS NOT NULL) AS claims,
    (SELECT sum(paid_amount)::text FROM public.student_fees WHERE madrasa_id=${t}) AS paid`
    )[0];
  const balances = (t) =>
    db`SELECT id,paid_amount,due_amount,status FROM public.student_fees WHERE madrasa_id=${t} ORDER BY id`;
  const initialBills = await balances(A);
  const empty = { raw: 0, receipts: 0, claims: 0, paid: "0.00" };
  const replies = new Map();
  const valid = {
    status: "VALID",
    tran_id: ref,
    val_id: val,
    currency: "BDT",
    amount: "77.25",
    bank_tran_id: "BANK-VERIFIED",
  };
  replies.set(val, { body: valid });
  let concurrent = false,
    webhookReads = 0;
  const settlementPids = new Set();
  const donationValidating = deferred(),
    releaseDonation = deferred();
  let holdDonation = false;
  const backend = createServer(async (req, res) => {
    const u = new URL(req.url, "http://fixture.invalid");
    const send = (code, value) =>
      res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(value));
    try {
      if (req.method === "GET" && u.pathname === "/validator") {
        const key = u.searchParams.get("val_id"),
          reply = replies.get(key);
        if (
          u.searchParams.get("store_id") !== (reply?.store || "fixture-a") ||
          !reply ||
          u.searchParams.get("store_passwd") !== "fixture-only"
        )
          return send(200, { status: "INVALID" });
        if (key === "val-donation" && holdDonation) {
          donationValidating.resolve();
          await within(releaseDonation.promise, 20000, "donation validation wait");
        }
        return send(reply.status || 200, reply.body);
      }
      if (req.headers.apikey !== "fixture-service") return send(403, {});
      if (req.method === "GET" && u.pathname === "/rest/v1/madrasas") {
        const tenant = u.searchParams.get("id")?.replace(/^eq\./, "");
        const [row] = await db`SELECT * FROM public.madrasas WHERE id=${tenant}`;
        return send(row ? 200 : 406, row || {});
      }
      if (req.method === "GET" && u.pathname === "/rest/v1/webhook_endpoints") {
        webhookReads++;
        return send(200, []);
      }
      if (
        req.method === "POST" &&
        ["/rest/v1/rpc/settle_portal_fee_intent", "/rest/v1/rpc/confirm_portal_donation_return"].includes(
          u.pathname,
        )
      ) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const args = JSON.parse(Buffer.concat(chunks));
        const result = await db.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`;
          if (u.pathname.endsWith("/confirm_portal_donation_return"))
            return tx`SELECT public.confirm_portal_donation_return(${args.p_tenant},${tx.json(args.p_expected)}::jsonb,${args.p_ref}) AS value`;
          if (concurrent) {
            assert.equal(args.p_expected.status, "PENDING");
            settlementPids.add((await tx`SELECT pg_backend_pid() AS pid`)[0].pid);
          }
          return tx`SELECT public.settle_portal_fee_intent(${args.p_tenant},${tx.json(args.p_expected)}::jsonb,${args.p_ref},${args.p_bank}) AS value`;
        });
        return send(200, result[0].value);
      }
      return send(404, { code: "UNEXPECTED_FIXTURE_PATH" });
    } catch (err) {
      return send(400, { code: err.code || "FIXTURE_ERROR", message: "Fixture operation failed" });
    }
  }).listen(0, "127.0.0.1");
  await once(backend, "listening");
  let child;
  try {
    child = fork(new URL("./fee-callback-next.mjs", import.meta.url), [String(backend.address().port)], {
      execArgv: [],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      silent: true,
    });
    child.stdout.resume();
    child.stderr.resume();
    const [message] = await within(
      Promise.race([
        once(child, "message"),
        once(child, "exit").then(() => {
          throw new Error("Test Next app exited before listening");
        }),
      ]),
      30000,
      "Next test startup timed out",
    );
    const url = `http://127.0.0.1:${message.port}`;
    const call = (route, tenant, validationId, id = ref) =>
      fetch(`${url}/api/payments/sslcommerz/${route}${tenant ? "?tenant=" + tenant : ""}`, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        body: new URLSearchParams({
          tran_id: id,
          val_id: validationId,
          amount: "1",
          status: "VALID",
          bank_tran_id: "UNTRUSTED-FORM",
          is_simulated: "true",
        }),
      });
    const ipn = async (tenant, key, status, id = ref) => {
      const res = await call("ipn", tenant, key, id);
      assert.equal(res.status, status, `IPN ${key}`);
      assert.match(res.headers.get("cache-control"), /no-store/);
      assert.deepEqual(await res.json(), { success: status === 200 });
    };
    const verifyJson = (body) =>
      fetch(`${url}/api/payments/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const verifyInput = { madrasa_id: A, transaction_id: ref, gateway_ref: val };
    assert.equal((await verifyJson({ ...verifyInput, is_simulated: true })).status, 401);
    assert.equal(
      (await verifyJson({ ...verifyInput, gateway_ref: undefined, bank_tran_id: "FORM" })).status,
      403,
    );
    await ipn(null, val, 400);
    await ipn(B, val, 400);
    for (const [query, body] of [
      [`tenant=${A}&tenant=${B}`, { tran_id: ref, val_id: val }],
      [
        `tenant=${A}`,
        [
          ["tran_id", ref],
          ["val_id", val],
          ["val_id", val],
        ],
      ],
    ]) {
      const invalid = await fetch(`${url}/api/payments/sslcommerz/ipn?${query}`, {
        method: "POST",
        body: new URLSearchParams(body),
      });
      assert.equal(invalid.status, 400);
    }
    for (const [key, patch, http, expected] of [
      ["under", { amount: "77.24" }, 200, 400],
      ["precision", { amount: "77.251" }, 200, 400],
      ["partial", { amount: "77.25xyz" }, 200, 400],
      ["currency", { currency: "USD" }, 200, 400],
      ["different-val", { val_id: "other" }, 200, 400],
      ["other-ref", { tran_id: "different" }, 200, 400],
      ["psp-failed", { status: "FAILED" }, 200, 400],
      ["outage", {}, 503, 503],
    ]) {
      replies.set(key, { body: { ...valid, val_id: key, ...patch }, status: http });
      await ipn(A, key, expected);
    }
    for (const patch of [
      { provider: "DIRECT_ISLAMI_BANK" },
      { sslcommerz_scope: null },
      { total_payable: 77.24 },
      {
        amount: 74.25,
        convenience_fee: 3,
        allocations: [
          { student_fee_id: intents.get(A).allocations[1].student_fee_id, allocated_amount: 74.25 },
        ],
      },
    ]) {
      await setDoc(A, {
        ...before,
        online_transactions: before.online_transactions.map((t) =>
          t.transaction_id === ref ? { ...t, ...patch } : t,
        ),
      });
      await ipn(A, val, patch.provider ? 400 : 409);
    }
    const rotated = config("different-merchant");
    await setDoc(A, { ...before, payment_gateway_config: rotated });
    await ipn(A, val, 409);
    await setDoc(A, before);
    assert.deepEqual(await records(A), empty);
    assert.deepEqual(await records(B), empty);
    assert.deepEqual(await balances(A), initialBills);
    // Authoritative validator succeeds but a bill balance changes: no payment, line or proof consumed.
    const secondBill = intents.get(A).allocations[1].student_fee_id;
    await db`UPDATE public.student_fees SET due_amount=1 WHERE id=${secondBill}`;
    await ipn(A, val, 409);
    assert.deepEqual(await records(A), empty);
    assert.equal((await db`SELECT count(*)::int AS n FROM public.fee_payment_allocations`)[0].n, 0);
    assert.deepEqual(await ownDoc(A), before); // failed claim also rolled back the intent/receipt counter
    assert.deepEqual(
      (await balances(A)).map((b) => b.due_amount),
      initialBills.map((b) => (b.id === secondBill ? "1.00" : b.due_amount)),
    );
    await db`UPDATE public.student_fees SET due_amount=80.5 WHERE id=${secondBill}`;
    console.log(
      "OK mounted callbacks: bad/unavailable proof, changed account, wrong tenant/provider, balance conflict; no partial credit",
    );

    // Delay a donation callback after it has read the old metadata document.
    replies.set("val-donation", {
      body: { ...valid, tran_id: donation.trx_id, val_id: "val-donation", amount: "5.00" },
    });
    holdDonation = true;
    const slowDonation = call("ipn", A, "val-donation", donation.trx_id);
    slowDonation.catch(() => {});
    await within(donationValidating.promise, 5000, "donation did not reach validator");
    const locked = deferred(),
      release = deferred();
    const lock = db.begin(async (tx) => {
      await tx`SELECT id FROM public.madrasas WHERE id=${A} FOR UPDATE`;
      locked.resolve();
      await within(release.promise, 10000, "fixture tenant lock");
    });
    await locked.promise;
    concurrent = true;
    let responses;
    try {
      responses = Promise.all([call("success", A, val), call("ipn", A, val)]);
      responses.catch(() => {});
      // Do not merely issue two sequential retries: observe both independent PG
      // sessions waiting for a lock while they still hold the pending version.
      const until = Date.now() + 7000;
      for (;;) {
        if (
          settlementPids.size === 2 &&
          (
            await db`SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid IN ${db([...settlementPids])} AND wait_event_type='Lock'`
          )[0].n === 2
        )
          break;
        if (Date.now() > until) throw new Error("Did not observe two overlapping PostgreSQL settlers");
        await delay(20);
      }
    } finally {
      release.resolve();
      await lock;
      concurrent = false;
    }
    const [browser, notification] = await responses;
    assert.match(browser.headers.get("cache-control"), /no-store/);
    assert.equal(browser.headers.get("referrer-policy"), "no-referrer");
    assert.equal(browser.status, 303);
    assert.equal(notification.status, 200);
    assert.deepEqual(await notification.json(), { success: true });
    const location = new URL(browser.headers.get("location"), url);
    assert.equal(location.origin, url);
    assert.equal(location.pathname, "/portal/fees");
    assert.equal(location.searchParams.get("student_id"), intents.get(A).student_id);
    assert.equal(location.searchParams.get("success"), "true");
    releaseDonation.resolve();
    assert.equal((await slowDonation).status, 200);
    holdDonation = false;
    const receipt = location.searchParams.get("receipt");
    assert.ok(receipt);
    replies.set(val, { body: { ...valid, status: "VALIDATED" } });
    await ipn(A, val, 200);
    assert.deepEqual(await (await verifyJson(verifyInput)).json(), {
      success: true,
      receipt_no: receipt,
      transaction_id: ref,
    });
    const summary = { raw: 1, receipts: 1, claims: 1, paid: "75.25" };
    assert.deepEqual(await records(A), summary);
    assert.deepEqual(await records(B), empty);
    const after = await ownDoc(A),
      settled = after.online_transactions.find((t) => t.transaction_id === ref);
    assert.equal(settled.receipt_no, receipt);
    assert.equal(settled.status, "SUCCESS");
    assert.equal(settled.bank_tran_id, "BANK-VERIFIED");
    assert.equal(after.online_donations[0].status, "VERIFIED");
    assert.equal(webhookReads, 1);
    const [p] = await db`SELECT * FROM public.fee_payments WHERE madrasa_id=${A}`;
    assert.deepEqual(
      [p.receipt_no, p.transaction_ref, p.total_amount_received, p.session_id],
      [receipt, val, "75.25", "term"],
    );
    assert.deepEqual(
      (
        await db`SELECT allocated_amount,fund_id FROM public.fee_payment_allocations WHERE payment_id=${p.id} ORDER BY fund_id`
      ).map((a) => [a.allocated_amount, a.fund_id]),
      [
        ["60.00", "M1"],
        ["15.25", "M2"],
      ],
    );
    assert.deepEqual(
      (
        await db`SELECT paid_amount,due_amount,status FROM public.student_fees WHERE madrasa_id=${A} ORDER BY billing_period`
      ).map((b) => [b.paid_amount, b.due_amount, b.status]),
      [
        ["60.00", "0.00", "PAID"],
        ["15.25", "65.25", "PARTIAL"],
      ],
    );
    console.log(
      "OK two PostgreSQL sessions blocked on the same fee: one receipt, two bill lines, one webhook lookup; slow donation preserved it",
    );
    // A different confirmation or a reversed receipt is not a successful replay.
    replies.set("second-proof", { body: { ...valid, val_id: "second-proof" } });
    await ipn(A, "second-proof", 409);
    replies.set(val, { body: { ...valid, bank_tran_id: "CHANGED-BANK" } });
    await ipn(A, val, 409);
    replies.set(val, { body: valid });
    for (const status of ["VOID", "REVERSED"]) {
      await db`UPDATE public.fee_payments SET status=${status} WHERE id=${p.id}`;
      await ipn(A, val, 409);
    }
    for (const route of ["fail", "cancel"]) {
      const r = await call(route, A, val);
      const dest = new URL(r.headers.get("location"), url);
      assert.equal(r.status, 303);
      assert.ok(dest.searchParams.get("error"));
      assert.equal(dest.searchParams.has("success"), false);
    }
    assert.deepEqual(await records(A), summary);
    assert.deepEqual(await records(B), empty);
    // Even after reversal, a consumed val_id cannot be claimed by another
    // checkout/tenant using the same merchant; different merchants are independent.
    const originalB = await ownDoc(B),
      otherRef = "TXN-other-same-merchant";
    await setDoc(B, { ...originalB, payment_gateway_config: config("fixture-a") });
    await reserve(B, { ...intents.get(B), sslcommerz_scope: account("fixture-a"), transaction_id: otherRef });
    replies.set(val, { body: { ...valid, tran_id: otherRef } });
    await ipn(B, val, 409, otherRef);
    assert.deepEqual(await records(B), empty);
    await setDoc(B, { ...(await ownDoc(B)), payment_gateway_config: config("fixture-b") });
    replies.set(val, { store: "fixture-b", body: valid });
    await ipn(B, val, 200);
    assert.deepEqual(await records(B), summary);
    assert.deepEqual(await records(A), summary);
    console.log(
      "OK VOID/REVERSED and conflicting proof never repost; val_id claimed once per merchant, isolated across tenants",
    );
  } finally {
    releaseDonation.resolve();
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      if (child.connected) child.disconnect();
      try {
        await within(stopped, 4000, "Next shutdown");
      } catch {
        child.kill("SIGKILL");
        await stopped;
      }
    }
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});
