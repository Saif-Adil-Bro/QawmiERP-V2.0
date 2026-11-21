// Opt-in Chromium integration check. No app server, Supabase or gateway credentials.
// See docs/portal-parity-rollout.bn.md for the disposable browser-tools install.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";

const tools = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
);
const puppeteer = tools("puppeteer-core");
const chromium = tools("@sparticuz/chromium");
const bundle = await build({
  stdin: {
    contents: `
  import * as sync from './lib/portal-sync'; import * as auth from './lib/offline-auth';
  import * as admin from './lib/syncManager'; import {getOfflineDb} from './lib/offlineDb';
  Object.assign(window, {sync,auth,admin,db:getOfflineDb});`,
    resolveDir: process.cwd(),
  },
  define: {
    "process.env.NEXT_PUBLIC_API_URL": '""',
    "process.env.NEXT_PUBLIC_MOBILE_API_KEY": '""',
  },
  platform: "browser",
  bundle: true,
  write: false,
});
const html =
  '<!doctype html><title>Online fixture</title><p>ONLINE_FIXTURE</p><script src="/test.js"></script>';
const context = {
  online: true,
  tenant: "m1",
  user: "p1",
  ids: ["a", "b"],
  posts: [],
  hold: null,
};
function wire(child) {
  const students = context.ids.map((id) => ({
    id,
    first_name: `Pupil ${id}`,
    madrasa_id: context.tenant,
  }));
  const active_student =
    students.find((s) => s.id === (child || context.ids[0])) || null;
  return {
    version: 1,
    portal: "student",
    profile: { id: context.user, madrasa_id: context.tenant },
    students,
    active_student,
    fee_invoices: [],
    fee_discounts: [],
    fee_payments: active_student
      ? [
          {
            id: "r",
            student_id: active_student.id,
            receipt_no: `RCPT-${active_student.id}`,
            total_amount_received: 80,
            payment_date: "2026-01-02",
          },
        ]
      : [],
    total_paid: active_student ? 80 : 0,
    total_due: 0,
    classes: [],
    attendance: [],
    exams: [],
    exam_results: [],
    exam_summaries: [],
    health_records: active_student ? [{id:"case-"+active_student.id,student_id:active_student.id,status:"under_treatment",severity:"severe",illness_type:"জ্বর",doctor_or_hospital:`Doctor-${active_student.id}`,treatment_notes:`Care-${active_student.id}`,updated_at:"2026-11-18T00:00:00Z",timeline:[{status:"under_treatment",note:`Note-${active_student.id}`,created_at:"2026-11-18T00:00:00Z"}]}] : [],
    emergency_phone: "01712345678",
    hifz_logs: [],
    kitab_logs: [],
    notices: [],
    routines: [],
    holidays: [],
    assignments: [],
  };
}
const server = createServer(async (req, res) => {
  // Break transport for *all* browser targets, including the independently running SW.
  if (!context.online) {
    req.socket.destroy();
    return;
  }
  const url = new URL(req.url, "http://fixture.test");
  res.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/portal/cache-fixture") {
    // Model a bad/older deployment that left a fresh private document in the HTTP cache.
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Type", "text/html");
    return res.end("<p>OLD_OWNER_DOCUMENT</p>");
  }
  if (url.pathname === "/api/portal/snapshot") {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ data: wire(url.searchParams.get("student_id")) }),
    );
  }
  if (req.method !== "GET") {
    context.posts.push({
      owner: req.headers["x-qawmi-sync-owner"],
      path: url.pathname,
    });
    if (context.hold) {
      context.hold.started();
      await context.hold.wait;
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ success: true, data: { id: "confirmed" } }),
    );
  }
  const assets = {
    "/offline-portal.js": "text/javascript",
    "/offline.html": "text/html; charset=utf-8",
    "/sw.js": "text/javascript",
    "/favicon.png": "image/png",
  };
  if (assets[url.pathname]) {
    res.setHeader("Content-Type", assets[url.pathname]);
    return res.end(await readFile(`public${url.pathname}`));
  }
  if (url.pathname === "/test.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles[0].contents);
  }
  res.setHeader("Content-Type", "text/html");
  res.end(html);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}`;
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
let browser;
try {
  browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  const a = await browser.newPage(),
    b = await browser.newPage();
  await Promise.all([a, b].map((p) => p.goto(url)));
  // Seed Chromium's real HTTP cache before SW installation (not Cache Storage).
  const cachePage = await browser.newPage();
  await cachePage.goto(`${url}/portal/cache-fixture`);
  assert.match(
    await cachePage.$eval("body", (el) => el.textContent),
    /OLD_OWNER_DOCUMENT/,
  );
  await cachePage.goto(url);
  assert.match(
    await cachePage.evaluate(async () =>
      (
        await fetch("/portal/cache-fixture", {
          cache: "only-if-cached",
          mode: "same-origin",
        })
      ).text(),
    ),
    /OLD_OWNER_DOCUMENT/,
  );
  const login = (page, userId, madrasaId, role) =>
    page.evaluate(
      async (s) => {
        await auth.saveOfflineAuthSession({
          ...s,
          accessToken: "",
          savedAt: Date.now(),
        });
        return auth.ownerKey(s);
      },
      { userId, madrasaId, role },
    );
  await a.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await a.waitForFunction(() => !!navigator.serviceWorker.controller);
  await login(b, "p1", "m1", "parent");
  assert.equal(
    (
      await a.evaluate(() =>
        sync.initialFullSync("student", { studentId: "b" }),
      )
    ).ok,
    true,
  );
  await a.goto(`${url}/portal/fees?student_id=b`);
  context.online = false;
  await a.setOfflineMode(true);
  await a.reload();
  await a.waitForSelector("#snapshot:not([hidden])");
  const cold = await a.$eval("#snapshot", (s) => s.textContent);
  assert.match(cold, /Pupil b/);
  assert.match(cold, /RCPT-b/);
  for (const marker of ["Doctor-b","Care-b","Note-b"]) assert.ok(cold.includes(marker));
  assert.doesNotMatch(cold,/Doctor-a|Care-a|Note-a/);
  await a.waitForSelector("#snapshot dialog[open]");
  assert.doesNotMatch(cold, /Pupil a|RCPT-a/);
  await login(b, "p2", "m2", "parent");
  await a.waitForFunction(() => document.querySelector("#snapshot").hidden);
  assert.equal(await a.$eval("#snapshot", (s) => s.textContent), "");
  await a.reload();
  assert.equal(await a.$eval("#snapshot", (s) => s.hidden), true);
  await cachePage.goto(`${url}/portal/cache-fixture`);
  assert.equal(await cachePage.$eval("#snapshot", (el) => el.hidden), true);
  assert.doesNotMatch(
    await cachePage.$eval("body", (el) => el.textContent),
    /OLD_OWNER_DOCUMENT/,
  );
  await cachePage.close();
  const urls = await b.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (k) =>
          (await (await caches.open(k)).keys()).map((r) => r.url),
        ),
      )
    ).flat(),
  );
  assert.ok(urls.some((s) => s.endsWith("/offline.html")));
  assert.ok(
    !urls.some(
      (s) => new URL(s).pathname.startsWith("/portal") || s.includes("/api/"),
    ),
  );
  // Reapply network state on the replacement document (headless Chromium may reset it on reload).
  const cdp = await a.createCDPSession();
  const state = (offline) =>
    cdp.send("Network.overrideNetworkState", {
      offline,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  await state(true);
  await a.waitForFunction(() => !navigator.onLine);
  context.online = true;
  await a.setOfflineMode(false);
  await Promise.all([a.waitForNavigation({ timeout: 10000 }), state(false)]);
  assert.equal(await a.title(), "Online fixture");
  console.log(
    "OK Chromium: selected child hard reload, bypassed old owner's fresh HTTP cache, tenant/account switch, reconnect",
  );

  // Model the native errorPath's different origin with the actual bundled document.
  // This is a browser check of the artifact, not an Android WebView or APK run.
  const dir = await mkdtemp(resolve(tmpdir(), "qawmi-native-error-"));
  const local = createServer();
  try {
    await symlink(resolve("public"), resolve(dir, "public"), "junction");
    execFileSync(
      process.execPath,
      [resolve("scripts/prepare-capacitor-out.mjs")],
      {
        cwd: dir,
        env: { ...process.env, CAPACITOR_SERVER_URL: url },
      },
    );
    const doc = await readFile(resolve(dir, "out/native-offline.html"));
    local.on("request", (req, res) => {
      if (req.url !== "/native-offline.html") return res.writeHead(404).end();
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(doc);
    });
    local.listen(0, "127.0.0.1");
    await once(local, "listening");
    const page = await browser.newPage();
    await page.goto(
      `http://127.0.0.1:${local.address().port}/native-offline.html`,
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("qawmi_offline_auth_session"),
      ),
      null,
    );
    assert.doesNotMatch(
      await page.$eval("body", (el) => el.textContent),
      /Pupil|RCPT-|OLD_OWNER_DOCUMENT/,
    );
    await Promise.all([page.waitForNavigation(), page.click("a")]);
    assert.equal(page.url(), `${url}/login`);
    await page.close();
    console.log(
      "OK Chromium: bundled native error page on a separate origin → fresh hosted login, no private snapshot",
    );
  } finally {
    local.closeAllConnections();
    local.close();
    await rm(dir, { recursive: true, force: true });
  }

  const owner = await login(a, "teacher", "m1", "teacher");
  await a.setOfflineMode(true);
  const queued = await a.evaluate(
    (o) => sync.postTeacherEntry("attendance", { records: [] }, o),
    owner,
  );
  assert.equal(queued.offlineQueued, true);
  await a.setOfflineMode(false);
  await login(b, "teacher", "m2", "teacher");
  await b.evaluate(() => sync.processOfflineOutbox());
  assert.equal(context.posts.length, 0);
  await login(b, "teacher", "m1", "teacher");
  // Simulate a tab that terminated while it owned a live lease, then expiry.
  await b.evaluate(async () => {
    const q = db().offlineOutbox;
    await q.update((await q.toArray())[0].id, {
      status: "syncing",
      leaseUntil: Date.now() + 60000,
    });
  });
  await a.evaluate(() => sync.processOfflineOutbox());
  assert.equal(context.posts.length, 0);
  await b.evaluate(async () => {
    const q = db().offlineOutbox;
    await q.update((await q.toArray())[0].id, { leaseUntil: Date.now() - 1 });
  });
  const entered = deferred(),
    ack = deferred();
  context.hold = { started: entered.resolve, wait: ack.promise };
  const first = a.evaluate(() => sync.processOfflineOutbox());
  await entered.promise;
  await b.evaluate(() => sync.processOfflineOutbox());
  assert.equal(context.posts.length, 1);
  ack.resolve();
  await first;
  context.hold = null;
  assert.equal(context.posts[0].owner, owner);
  assert.equal(await b.evaluate(() => db().offlineOutbox.count()), 0);
  console.log(
    "OK Chromium: owner-isolated queue, live and expired leases, overlapping drain in independent tabs",
  );

  const original = await login(a, "admin", "m1", "admin");
  const received = deferred(),
    release = deferred();
  context.hold = { started: received.resolve, wait: release.promise };
  const mutation = a.evaluate(() =>
    admin.offlineMutate({
      entity: "students",
      action: "CREATE",
      payload: { first_name: "fixture" },
    }),
  );
  await received.promise;
  const next = await login(b, "admin", "m2", "admin");
  release.resolve();
  const reply = await mutation;
  context.hold = null;
  assert.equal(reply.success, false);
  for (const key of [original, next])
    assert.equal(await b.evaluate((k) => db(k).students.count(), key), 0);
  console.log(
    "OK Chromium: a late successful mutation after account switch changes neither owner’s cache",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  server.close();
}
