// Run from repo root; see docs/portal-staging-checks.bn.md. No target/credential
// inputs. One Chromium tab/profile throughout; no cookies, owners or IDB rows injected.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { withSessionStack } from "../sql/session/session-stack.mjs";
import { seedGuardians } from "../sql/session/guardian-fixture.mjs";
import { fixtureProxy } from "./fixture-proxy.mjs";

const tools = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
);
const puppeteer = tools("puppeteer-core"),
  chromium = tools("@sparticuz/chromium");
async function exercise(stack) {
  const { db, base, api } = stack;
  const [a, b] = await seedGuardians(stack);
  const pupils = [...a.children, ...b.children];
  const wire = await fixtureProxy([base, api]);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: [
        ...chromium.args.filter(
          (x) =>
            ![
              "--disable-web-security",
              "--allow-running-insecure-content",
              "--disable-site-isolation-trials",
              "--single-process",
            ].includes(x),
        ),
        ...wire.args,
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.setDefaultTimeout(20_000);
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    const state = (offline) =>
      cdp.send("Network.overrideNetworkState", {
        offline,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    const visible = () => page.$eval("body", (el) => el.innerText);
    const waitText = (text) =>
      page.waitForFunction(
        (t) => document.body?.innerText.includes(t),
        {},
        text,
      );
    const feePath = (c) => `/portal/fees?student_id=${c.id}`;
    const currency = (n) =>
      `৳ ${n.toLocaleString("bn-BD", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
    function checkVisible(text, child, extra = []) {
      if (child)
        assert.ok(text.includes(child.name), "selected pupil is identified");
      for (const c of pupils)
        assert.equal(
          text.includes(c.receipt),
          c === child,
          "only the selected child's posted receipt is visible",
        );
      for (const t of extra)
        assert.ok(!text.includes(t), "foreign identity must not be visible");
    }
    const markers = (g) => [g.name, ...g.children.map((c) => c.name)];
    const controlled = () =>
      page.waitForFunction(
        () =>
          navigator.serviceWorker.controller?.scriptURL ===
          `${location.origin}/sw.js`,
      );
    async function signIn(g) {
      await page.locator("input[name=identifier]").fill(g.email);
      await page.locator("input[name=password]").fill(g.password);
      const [reply] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url() === base + "/api/auth/login" &&
            r.request().method() === "POST",
        ),
        page.click("button[type=submit]"),
      ]);
      assert.equal(reply.status(), 200, "password form accepted");
      await page.waitForFunction(() => location.pathname === "/portal");
      await waitText(g.name);
      await controlled();
    }
    async function chooseSecond(g, foreign) {
      const [first, c] = g.children;
      await page.locator('aside a[href="/portal/fees"]').click();
      await page.waitForFunction(() => location.pathname === "/portal/fees");
      const switcher = `main a[href="${feePath(c)}"]`;
      await page.waitForSelector(switcher, { visible: true });
      await waitText(first.receipt);
      checkVisible(await visible(), first, markers(foreign));
      const defaultEntry = await currentEntry();
      const [pull] = await Promise.all([
        page.waitForResponse((r) => {
          const u = new URL(r.url());
          return (
            u.pathname === "/api/portal/snapshot" &&
            u.searchParams.get("student_id") === c.id
          );
        }),
        page.locator(switcher).click(),
      ]);
      assert.equal(pull.status(), 200, "selected child sync response");
      await waitText(c.receipt);
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("header button")).some(
          (el) => el.innerText.includes("সিঙ্কড:") && el.getClientRects().length,
        ),
      );
      const text = await visible();
      checkVisible(text, c, markers(foreign));
      assert.ok(
        text.includes(currency(c.amount)),
        "selected amount rendered online",
      );
      await controlled();
      assert.equal(
        await snapshotCount(g, `student:${c.id}`),
        1,
        "selected snapshot committed before disconnect",
      );
      return defaultEntry;
    }
    async function disconnect() {
      wire.setOnline(false);
      await page.setOfflineMode(true);
    }
    async function coldReload() {
      const doc = await page.reload({ waitUntil: "load" });
      assert.ok(doc?.fromServiceWorker(), "real SW served the reload");
      await page.waitForSelector("#snapshot");
    }
    async function reconnect() {
      // Override the replacement document: navigator state can reset on navigation.
      await state(true);
      await page.waitForFunction(() => !navigator.onLine, { polling: 50 });
      wire.setOnline(true);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.setOfflineMode(false).then(() => state(false)),
      ]); // real online event reloads the fallback
    }
    const history = () => cdp.send("Page.getNavigationHistory");
    async function currentEntry() {
      const h = await history();
      return h.entries[h.currentIndex].id;
    }
    async function backTo(entry) {
      const h = await history(),
        at = h.entries.findIndex((e) => e.id === entry);
      assert.ok(
        at >= 0 && at < h.currentIndex,
        "earlier fee entry still in this tab's history",
      );
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        // Use the actual history entry through the browser, not JS in the document
        // about to be discarded (its evaluation can die on successful traversal).
        cdp.send("Page.navigateToHistoryEntry", { entryId: entry }),
      ]);
      // Check the returned document before waiting for the expected live/empty view.
      const text = await visible();
      for (const old of [...markers(a), ...a.children.map((c) => c.receipt)])
        assert.ok(!text.includes(old), "Back must not display A’s data to B");
    }

    // Read only: wait behind the fallback's IDB open on this origin. In particular
    // an initially hidden element alone is not evidence of a missing snapshot.
    async function snapshotCount(guardian, key) {
      return page.evaluate(
        async ({ name, key }) => {
          if (!(await indexedDB.databases()).some((d) => d.name === name))
            return 0;
          return new Promise((resolve, reject) => {
            const open = indexedDB.open(name);
            open.onerror = () =>
              reject(new Error("Cannot inspect fixture snapshot"));
            open.onupgradeneeded = () => open.transaction.abort();
            open.onsuccess = () => {
              const db = open.result,
                t = db.transaction("portalSnapshots", "readonly");
              const count = t.objectStore("portalSnapshots").count(key);
              t.oncomplete = () => {
                db.close();
                resolve(count.result);
              };
              t.onabort = () => {
                db.close();
                reject(new Error("Snapshot read aborted"));
              };
            };
          });
        },
        {
          name: `QawmiERP-scope-${guardian.tenant}:${guardian.uid}:student`,
          key,
        },
      );
    }
    await page.goto(base + "/login");
    await signIn(a);
    const aDefaultEntry = await chooseSecond(a, b);
    await disconnect();
    await coldReload();
    await page.waitForSelector("#snapshot:not([hidden])");
    let text = await visible();
    checkVisible(text, a.children[1], markers(b));
    assert.ok(text.includes(`৳${a.children[1].amount}`));
    const aEntry = await currentEntry(); // retain the actual rendered A document in history
    await page.goto(base + "/portal"); // leave A's fee entry behind; reconnect on the dashboard
    await page.waitForSelector("#snapshot");
    await reconnect();
    await waitText(a.name);
    console.log(
      "OK shared Chromium: A selected the second child in the fee UI; SW offline reload showed only the synced receipt and amount",
    );

    await page.locator("aside button::-p-text(লগআউট করুন)").click();
    await page.waitForSelector("input[name=password]", { visible: true });
    assert.equal(page.url(), base + "/login", "server confirmed logout");
    assert.equal(
      await page.evaluate(
        () => localStorage.getItem("qawmi_offline_auth_session") === null,
      ),
      true,
    );
    assert.deepEqual(
      (
        await db`SELECT is_active FROM public.user_sessions WHERE user_id=${a.uid}`
      ).map((s) => s.is_active),
      [false],
    );
    assert.equal(
      await snapshotCount(a),
      0,
      "logout removed A’s synced snapshots",
    );
    checkVisible(await visible(), null, markers(a));
    await signIn(b);
    await chooseSecond(b, a);
    await disconnect();
    await coldReload();
    await page.waitForSelector("#snapshot:not([hidden])");
    text = await visible();
    checkVisible(text, b.children[1], markers(a));
    assert.ok(text.includes(`৳${b.children[1].amount}`));
    const fresh = "FIXTURE-FRESH",
      topup = 6.25,
      selected = b.children[1];
    await db`INSERT INTO public.fee_payments(madrasa_id,session_id,student_id,student_name,receipt_no,total_amount_received)
        VALUES (${b.tenant},'fixture-term',${selected.id},${selected.name},${fresh},${topup})`;
    assert.ok(
      !(await visible()).includes(fresh),
      "offline copy has not changed",
    );
    await reconnect();
    await waitText(fresh);
    text = await visible();
    checkVisible(text, selected, markers(a));
    assert.ok(
      text
        .split("\n")
        .some((line) => line.trim() === currency(selected.amount + topup)),
      "updated total visible on reconnect",
    );
    console.log(
      "OK shared Chromium: A logged out, B logged in; B's offline fee copy excluded A, reconnect showed B's newly posted receipt",
    );

    await disconnect();
    await backTo(aEntry);
    assert.equal(
      page.url(),
      base + feePath(a.children[1]),
      "Back revisited the first guardian's actual fee entry",
    );
    async function emptyFallback() {
      await page.waitForSelector("#snapshot");
      assert.equal(
        await snapshotCount(b, `student:${a.children[1].id}`),
        0,
        "B has no copy under A’s selection",
      );
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      const result = await page.$eval("#snapshot", (el) => ({
        hidden: el.hidden,
        empty: !el.textContent,
      }));
      assert.deepEqual(
        result,
        { hidden: true, empty: true },
        "no snapshot for B at A's selected child URL",
      );
      checkVisible(await visible(), null, [...markers(a), fresh]);
    }
    await emptyFallback();
    await coldReload();
    await emptyFallback();
    await reconnect();
    await waitText(b.name);
    await waitText("কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি");
    checkVisible(await visible(), null, [...markers(a), fresh]);
    assert.equal(
      await page.evaluate(() => !!document.querySelector("#snapshot")),
      false,
      "live portal revalidated the foreign selection",
    );
    await backTo(aDefaultEntry);
    assert.equal(
      page.url(),
      base + "/portal/fees",
      "Back to A's earlier online fee entry",
    );
    await waitText(b.name);
    await waitText(b.children[0].receipt);
    checkVisible(await visible(), b.children[0], [...markers(a), fresh]);
    console.log(
      "OK shared Chromium: Back to A's selected fee entry and offline reload were empty, reconnect revalidated B; Back to the default fee entry showed B's first child",
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      await wire.close();
    }
  }
}
await withSessionStack(exercise, { buildForBrowser: true });
