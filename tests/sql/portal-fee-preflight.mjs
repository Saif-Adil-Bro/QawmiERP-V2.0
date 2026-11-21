// Called ONLY with the disposable PGlite database. No staging credentials or network.
import assert from "node:assert/strict";
import { readFeePreflight } from "../../scripts/portal-fee-preflight.mjs";

export async function assertFeePreflight(db) {
  const tenants = ["a0000000-0000-4000-8000-000000000001", "b0000000-0000-4000-8000-000000000001"];
  const student = (tenant) => tenant.slice(0, -2) + "31";
  const receiptNumbers = [];
  const docs = [];
  const query = (text, args) => db.query(text, args);
  for (const [i, tenant] of tenants.entries()) {
    const type = `type-${i}`,
      bill = `bill-${i}`,
      child = student(tenant);
    await query(
      `INSERT INTO public.madrasas(id,name,contact_email) VALUES ($1,'Private school','private@example.test')`,
      [tenant],
    );
    await query(
      `INSERT INTO public.students(id,madrasa_id,first_name,last_name) VALUES ($1,$2,'Private','Pupil')`,
      [child, tenant],
    );
    await query(`INSERT INTO public.fee_types(id,madrasa_id,name,code) VALUES ($1,$2,'Fee','F')`, [
      type,
      tenant,
    ]);
    await query(
      `INSERT INTO public.student_fees(id,madrasa_id,session_id,student_id,fee_type_id,fee_type_name,billing_period,payable_amount,due_amount)
      VALUES ($1,$2,'term',$3,$4,'Fee','M',100.50,100.50)`,
      [bill, tenant, child, type],
    );
    // Both tenants deliberately have the SAME transaction reference, receipt number, date and amount.
    const intent = {
      madrasa_id: tenant,
      student_id: child,
      student_name: "Private Pupil",
      provider: "SSLCOMMERZ",
      sslcommerz_scope: "SANDBOX:" + (i ? "b" : "a").repeat(64),
      status: "PENDING",
      transaction_id: "txn-1",
      amount: 25.25,
      total_payable: 26.25,
      convenience_fee: 1,
      payment_channel: "bKash",
      allocations: [{ student_fee_id: bill, allocated_amount: 25.25 }],
    };
    await query(`SELECT public.write_portal_fee_intent($1,$2)`, [tenant, JSON.stringify(intent)]);
    await query(`SELECT public.settle_portal_fee_intent($1,$2,'verified','private-bank-ref')`, [
      tenant,
      JSON.stringify(intent),
    ]);
    const {
      rows: [payment],
    } = await query("SELECT id,receipt_no,db_fee_id FROM public.fee_payments WHERE madrasa_id=$1", [tenant]);
    receiptNumbers.push(payment.receipt_no);
    const {
      rows: [row],
    } = await query("SELECT registration_no::jsonb AS doc FROM public.madrasas WHERE id=$1", [tenant]);
    docs[i] = {
      ...row.doc,
      student_fees: [
        {
          id: bill,
          student_id: child,
          payable_amount: 100.5,
          paid_amount: 25.25,
          due_amount: 75.25,
          billing_period: "M",
        },
      ],
      payments: [
        {
          ...payment,
          student_id: child,
          receipt_no: ` ${payment.receipt_no.toLowerCase()} `,
          total_amount_received: 25.25,
          status: "COMPLETED",
        },
      ],
    };
    // A: legacy registration JSON overrides stale dedicated keys. B: dedicated column plus a plain registration number.
    await query("UPDATE public.madrasas SET metadata=$2,registration_no=$3 WHERE id=$1", [
      tenant,
      JSON.stringify(i ? docs[i] : { payments: [] }),
      i ? "REG-B" : JSON.stringify(docs[i]),
    ]);
  }
  assert.equal(receiptNumbers[0], receiptNumbers[1]);
  const [a, b] = tenants;
  const {
    rows: [aMirror],
  } = await query("SELECT id FROM public.fees WHERE madrasa_id=$1", [a]);
  // A `fees`-only collection is a legitimate separate receipt, not a duplicate of the same amount.
  await query(
    `INSERT INTO public.fees(madrasa_id,student_id,fee_type,amount,notes) VALUES ($1,$2,'Fee',25.25,'[রসিদ: MANUAL-01]')`,
    [a, student(a)],
  );
  const setA = (doc) =>
    query("UPDATE public.madrasas SET registration_no=$2 WHERE id=$1", [a, JSON.stringify(doc)]);
  const run = (ids = tenants) =>
    db.transaction(async (tx) => {
      const report = await readFeePreflight(async (text, args) => (await tx.query(text, args)).rows, ids);
      const {
        rows: [mode],
      } = await tx.query(
        `SELECT current_setting('transaction_read_only') AS ro, current_setting('transaction_isolation') AS isolation`,
      );
      assert.deepEqual(mode, { ro: "on", isolation: "repeatable read" });
      return report;
    });
  const clean = await run();
  assert.equal(clean.status, "CHECKS_CLEAR");
  assert.deepEqual(
    clean.institutions.map((r) => [r.institution, r.blockers, r.review]),
    [
      ["A", {}, {}],
      ["B", {}, {}],
    ],
  );
  assert.deepEqual(clean.institutions[0].inventory, {
    legacy_bills: 1,
    sql_bills: 1,
    legacy_receipts: 1,
    sql_receipts: 1,
    collections: 2,
    standalone_collections: 1,
    pending_intents: 0,
  });
  assert.equal(clean.institutions[1].inventory.standalone_collections, 0);
  assert.doesNotMatch(JSON.stringify(clean), /Private|private|txn-1|MR-|0000-4000|MANUAL-01/i);

  await db.exec("GRANT SELECT(validation_id) ON public.portal_fee_checkouts TO anon");
  assert.deepEqual(
    (await run()).institutions.map((r) => r.blockers),
    [{ checkout_permissions: 1 }, { checkout_permissions: 1 }],
  );
  await db.exec("REVOKE SELECT(validation_id) ON public.portal_fee_checkouts FROM anon");

  const pending = (ref, amount = 45.25, bill = "bill-0") => ({
    madrasa_id: a,
    student_id: student(a),
    student_name: "Private Pupil",
    convenience_fee: 1,
    payment_channel: "Islami Bank",
    provider: "DIRECT_ISLAMI_BANK",
    status: "PENDING",
    transaction_id: ref,
    amount,
    total_payable: amount + 1,
    allocations: [{ student_fee_id: bill, allocated_amount: amount }],
  });
  const doc = structuredClone(docs[0]);
  doc.online_transactions.push(pending("A-pending"));
  await setA(doc);
  const pendingOnly = await run();
  assert.equal(pendingOnly.status, "HOLD");
  assert.deepEqual(pendingOnly.institutions[0].blockers, {});
  assert.deepEqual(pendingOnly.institutions[0].review, { pending_statement_check: 1 });
  assert.deepEqual(pendingOnly.institutions[1], clean.institutions[1]);
  const legacySsl = structuredClone(doc);
  legacySsl.online_transactions[1].provider = "SSLCOMMERZ";
  await setA(legacySsl);
  assert.deepEqual((await run()).institutions[0].blockers, { unbound_ssl_checkout: 1 });
  const lostIntent = structuredClone(docs[0]);
  lostIntent.online_transactions = [];
  await setA(lostIntent);
  assert.deepEqual((await run()).institutions[0].blockers, { checkout_without_matching_intent: 1 });
  await setA(doc);
  await query("UPDATE public.fee_payments SET transaction_ref='other' WHERE madrasa_id=$1", [a]);
  assert.deepEqual((await run()).institutions[0].blockers, { settled_ssl_proof_mismatch: 1 });
  await query("UPDATE public.fee_payments SET transaction_ref='verified' WHERE madrasa_id=$1", [a]);
  await query(
    `UPDATE public.madrasas SET metadata='{"online_transactions":[{"status":"PENDING"}]}' WHERE id=$1`,
    [a],
  );
  assert.deepEqual((await run()).institutions[0].review, {
    pending_statement_check: 1,
    shadowed_fee_keys: 1,
  });
  await query(`UPDATE public.madrasas SET metadata='{}' WHERE id=$1`, [a]);

  doc.online_transactions.push(pending("A-pending-2"), {
    ...pending("old-ref", 1, "bill-1"),
    madrasa_id: undefined,
  });
  doc.student_fees[0].paid_amount = 99;
  doc.student_fees.push({ ...doc.student_fees[0], id: "bill-1" }); // only B has this ID
  doc.payments[0].total_amount_received = 30;
  doc.payments.push({ ...doc.payments[0], id: "unknown", db_fee_id: undefined, receipt_no: "unknown" });
  await setA(doc);
  const dirty = await run();
  assert.deepEqual(dirty.institutions[0].blockers, {
    intent_identity_or_status: 1,
    pending_amount_or_allocation: 1,
    overlapping_pending_bills: 1,
    legacy_bill_not_posted: 1,
    legacy_bill_conflict: 1,
    legacy_receipt_conflict: 1,
    legacy_receipt_unresolved: 1,
  });
  assert.deepEqual(dirty.institutions[0].review, { pending_statement_check: 3 });
  assert.deepEqual(dirty.institutions[1], clean.institutions[1]);
  assert.equal(
    (await query("SELECT registration_no::jsonb AS doc FROM public.madrasas WHERE id=$1", [a])).rows[0].doc
      .online_transactions.length,
    4,
  );

  // Historical void/reversed receipts legitimately have no live collection mirror.
  // A gateway SUCCESS still pointing to either is NOT a completed receipt.
  for (const status of ["VOID", "REVERSED"]) {
    const historical = structuredClone(docs[0]);
    historical.payments[0].status = status;
    await setA(historical);
    await query("UPDATE public.fee_payments SET status=$2 WHERE madrasa_id=$1", [a, status]);
    assert.deepEqual((await run()).institutions[0].blockers, { success_without_matching_receipt: 1 });
    const receipt = `manual-${status}`;
    await query(
      `INSERT INTO public.fee_payments(id,receipt_no,madrasa_id,student_id,session_id,student_name,status,db_fee_id)
      VALUES ($1::text,$1::text,$2,$3,'term','Fixture',$4,gen_random_uuid())`,
      [receipt, a, student(a), status],
    );
    assert.deepEqual((await run()).institutions[0].blockers, { success_without_matching_receipt: 1 });
  }
  await query(
    "UPDATE public.fee_payments SET status='COMPLETED' WHERE madrasa_id=$1 AND id LIKE 'online:%'",
    [a],
  );
  await setA(docs[0]);
  assert.equal((await run()).status, "CHECKS_CLEAR");

  // Duplicate copies, wrong bill owner, wrong receipt on a success and inconsistent structured vs raw amounts.
  const wrongBill = structuredClone(docs[0]);
  wrongBill.online_transactions[0].allocations[0].student_fee_id = "different-bill"; // same paid total
  await setA(wrongBill);
  assert.deepEqual((await run()).institutions[0].blockers, {
    success_allocation_mismatch: 1,
    settled_ssl_proof_mismatch: 1,
  });
  await setA(docs[0]);
  await query(
    `UPDATE public.fee_payment_allocations SET student_fee_id='bill-1' WHERE student_fee_id='bill-0'`,
  );
  await query("UPDATE public.fees SET amount=30 WHERE id=$1", [aMirror.id]);
  await query(
    `INSERT INTO public.fees(madrasa_id,student_id,fee_type,amount,notes) SELECT madrasa_id,student_id,fee_type,25.25,notes FROM public.fees WHERE id=$1`,
    [aMirror.id],
  );
  const broken = structuredClone(docs[0]);
  broken.online_transactions.push({
    ...broken.online_transactions[0],
    transaction_id: "other-success",
    receipt_no: "missing",
  });
  await setA(broken);
  const mismatches = await run();
  assert.deepEqual(mismatches.institutions[0].blockers, {
    allocation_bill_owner: 1,
    success_allocation_mismatch: 1,
    success_without_matching_receipt: 1,
    settled_ssl_proof_mismatch: 1,
    duplicate_collection_mirrors: 1,
    receipt_mirror_conflict: 1,
  });
  assert.deepEqual(mismatches.institutions[1], clean.institutions[1]);

  await assert.rejects(run([a, a.toUpperCase()]), /Usage/);
  await assert.rejects(run([a, b.replace(/1$/, "9")]), /Institution B: not found/);
  await query(`UPDATE public.madrasas SET registration_no='{private-invalid-json' WHERE id=$1`, [a]);
  await assert.rejects(
    run(),
    (err) => /Institution A:.*SQLSTATE 22P02/.test(err.message) && !/private-invalid/.test(err.message),
  );
  await setA({ payments: null });
  await assert.rejects(run(), /Institution A:.*SQLSTATE 22023/);
  await setA(docs[0]);
  await db.exec(
    "GRANT SELECT ON public.madrasas,public.students,public.student_fees,public.fees,public.fee_payments,public.fee_payment_allocations,public.portal_fee_checkouts TO authenticated; SET ROLE authenticated;",
  );
  try {
    await assert.rejects(run(), /Institution A:.*SQLSTATE 42501/);
  } finally {
    await db.exec("RESET ROLE");
  }
  console.log(
    "OK read-only fee preflight: two isolated tenants, clear/hold/incomplete, receipt and allocation conflicts, RLS and redaction",
  );
}
