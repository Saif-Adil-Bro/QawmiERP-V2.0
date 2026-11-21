// Run from repo root after a clean, credential-free Next build. No target URL, DSN,
// password or key inputs. Auth/Data API is Supabase Lite, not hosted Supabase.
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createServerClient } from "@supabase/ssr";
import { withSessionStack } from "./session-stack.mjs";
import { seedGuardians, securityProfile } from "./guardian-fixture.mjs";

const claims = (session) =>
  JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url"));

// Keep actual Set-Cookie values (including @supabase/ssr chunking). Never log them.
function absorb(jar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0],
      i = pair.indexOf("="),
      name = pair.slice(0, i),
      value = pair.slice(i + 1);
    if (value && !/;\s*max-age=0(?:;|$)/i.test(cookie)) jar.set(name, value);
    else jar.delete(name);
  }
}
async function exercise({ db, lite, api, anon, base, mobileKey }) {
  const [a, b] = await seedGuardians({ db, lite, anon });
  const { tenant: A, uid, email, password } = a,
    children = [...a.children, ...b.children];

  async function request(
    path,
    { status = 200, jar, token, body, key, cache = false } = {},
  ) {
    const headers = {};
    if (jar) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (token) headers.authorization = `Bearer ${token}`;
    if (key) headers["x-api-key"] = mobileKey;
    if (body) headers["content-type"] = "application/json";
    const res = await fetch(base + path, {
      method: body ? "POST" : "GET",
      body: body && JSON.stringify(body),
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if (jar) absorb(jar, res);
    if (res.status !== status) {
      const errCode =
        (
          await res
            .clone()
            .json()
            .catch(() => null)
        )?.code || "no code";
      throw new Error(
        `${path.split("?")[0]}: expected ${status}, got ${res.status} (${errCode})`,
      );
    }
    if (cache)
      assert.match(
        res.headers.get("cache-control") ?? "",
        /private,\s*no-store/,
      );
    return res;
  }
  const login = async (mobile, jar, status = 200) =>
    (
      await request(mobile ? "/api/mobile/auth/login" : "/api/auth/login", {
        body: { email, password },
        key: mobile,
        jar,
        status,
      })
    ).json();
  const snapshot = (child, auth, status = 200, portal = "student") =>
    request(
      auth.jar
        ? `/api/portal/snapshot?portal=${portal}&student_id=${child.id}`
        : `/api/mobile/portal/${portal}?student_id=${child.id}`,
      { ...auth, status, cache: true },
    );
  const bearer = (s) => ({ token: s.access_token, key: true });
  const refresh = async (s, status = 200) =>
    (
      await request("/api/mobile/auth/refresh", {
        key: true,
        body: { refresh_token: s.refresh_token },
        status,
        cache: true,
      })
    ).json();
  const revoke = async (jar, id) =>
    assert.ok(
      (
        await (
          await request("/api/auth/sessions", {
            jar,
            body: { action: "terminate_single", sessionId: id },
          })
        ).json()
      ).success,
    );
  const count = async () =>
    (await db`SELECT count(*)::int AS n FROM public.user_sessions`)[0].n;
  await request("/api/mobile/auth/logout", {
    key: true,
    body: {},
    status: 401,
    cache: true,
  });
  const jar = new Map();
  await snapshot(children[0], bearer(a.providerSession), 401); // valid provider login, not registered with this app
  const web0 = (await login(false, jar)).session,
    mob0 = (await login(true)).data;
  assert.ok(
    web0?.access_token &&
      mob0?.access_token &&
      [...jar.keys()].some((k) => k.startsWith("sb-")),
  );
  assert.equal(await count(), 2);
  async function compare(w, m) {
    for (const [index, child] of children.entries()) {
      const [wr, mr] = await Promise.all([
        snapshot(child, w),
        snapshot(child, bearer(m)),
      ]);
      const wd = (await wr.json()).data,
        md = (await mr.json()).data;
      assert.deepEqual(wd, md, "cookie/Bearer snapshot data");
      assert.equal(wd.profile.id, uid);
      assert.equal(wd.profile.madrasa_id, A);
      assert.deepEqual(
        wd.students.map((s) => s.id),
        children.slice(0, 2).map((c) => c.id),
      );
      if (index < 2) {
        assert.equal(wd.active_student.id, child.id);
        assert.equal(wd.total_paid, child.amount);
        assert.deepEqual(
          wd.fee_payments.map((p) => [
            p.student_id,
            p.receipt_no,
            Number(p.total_amount_received),
          ]),
          [[child.id, child.receipt, child.amount]],
        );
      } else {
        assert.equal(wd.active_student, null);
        assert.deepEqual(wd.fee_payments, []);
        assert.deepEqual(wd.fees, []);
      }
    }
  }
  await compare({ jar }, mob0);
  for (const child of children.slice(0, 2)) {
    const html = await (
      await request(`/portal/fees?student_id=${child.id}`, { jar })
    ).text();
    assert.ok(
      html.includes(child.receipt),
      "web fee page must render the selected receipt",
    );
    for (const other of children.filter((c) => c.id !== child.id))
      assert.ok(
        !html.includes(other.receipt),
        "only the selected ledger may reach the page",
      );
  }
  await snapshot(children[0], { jar }, 403, "teacher");
  await snapshot(children[0], bearer(mob0), 403, "teacher");
  await snapshot(children[0], { token: mob0.access_token }, 401);
  console.log(
    "OK password logins: two linked receipts/amounts match across SSR fees and both snapshots, unlinked and foreign selections empty, wrong portal/key denied",
  );

  // Rotate the real SSR cookie using the same SDK storage adapter contract, not a fabricated cookie/JWT.
  const ssr = createServerClient(api, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => {
        for (const { name, value } of values)
          value ? jar.set(name, value) : jar.delete(name);
      },
    },
  });
  await delay(1100); // second-precision JWT issuance: ensure a new access token even for very fast runs
  const rotated = await ssr.auth.refreshSession();
  assert.ok(!rotated.error && rotated.data.session, "SSR refresh");
  const web1 = rotated.data.session,
    mob1 = (await refresh(mob0)).data;
  for (const [before, after] of [
    [web0, web1],
    [mob0, mob1],
  ]) {
    assert.ok(
      before.access_token !== after.access_token,
      "access token rotated",
    );
    assert.ok(
      before.refresh_token !== after.refresh_token,
      "refresh token rotated",
    );
    assert.equal(claims(before).session_id, claims(after).session_id);
  }
  await compare({ jar }, mob1);
  assert.equal(
    await count(),
    2,
    "refresh must not register an additional session",
  );
  const list = await (await request("/api/auth/sessions", { jar })).json();
  const mobileId = list.sessions.find((s) => s.channel === "mobile")?.id;
  assert.ok(
    mobileId && list.currentSessionId && mobileId !== list.currentSessionId,
  );
  await revoke(jar, mobileId);
  for (const s of [mob0, mob1]) await snapshot(children[1], bearer(s), 401);
  const denied = await refresh(mob1, 401);
  assert.equal(denied.data, null);
  assert.equal(denied.code, "SESSION_REVOKED");
  await snapshot(children[1], { jar });
  await snapshot(children[1], bearer(web1)); // web login is also used by Bearer offline sync
  await revoke(jar, list.currentSessionId);
  await snapshot(children[1], { jar }, 401);
  await snapshot(children[1], bearer(web1), 401);
  await request("/api/auth/sessions", { jar, status: 401 });
  assert.match(
    await (await request("/login", { jar })).text(),
    /name="password"|type="password"/,
  );
  console.log(
    "OK rotated web and mobile sessions: remote termination denies cookie, Bearer and mobile refresh; independent login stays active",
  );

  const webSession = (await login(false, jar)).session;
  const fresh = (await login(true)).data;
  await delay(1100);
  const rotatedMobile = (await refresh(fresh)).data;
  await request("/api/mobile/auth/logout", {
    ...bearer(rotatedMobile),
    body: {},
    cache: true,
  });
  await snapshot(children[0], bearer(rotatedMobile), 401);
  await snapshot(children[0], { jar });
  assert.equal(
    (
      await db`SELECT is_active FROM public.user_sessions WHERE provider_session_id=${claims(fresh).session_id}`
    )[0].is_active,
    false,
  );
  const activeMobile = (await login(true)).data;
  await db`UPDATE public.madrasas SET security_metadata=${db.json(securityProfile(a, "SUSPENDED"))} WHERE id=${A}`;
  await snapshot(children[1], { jar }, 401);
  await snapshot(children[1], bearer(activeMobile), 403);
  assert.equal((await refresh(activeMobile, 403)).data, null);
  await db`UPDATE public.madrasas SET security_metadata=${db.json(securityProfile(a, "ACTIVE"))} WHERE id=${A}`;
  // Store outage is not revocation. Withhold data but do not signal the offline
  // client to erase a last-good snapshot. Restore privileges before the next case.
  await db.unsafe(
    "REVOKE EXECUTE ON FUNCTION public.current_app_session() FROM authenticated",
  );
  await snapshot(children[0], { jar }, 503);
  await snapshot(children[0], bearer(webSession), 503);
  await db.unsafe(
    "GRANT EXECUTE ON FUNCTION public.current_app_session() TO authenticated",
  );
  await snapshot(children[0], { jar });
  // A normal login cannot succeed if registration does not commit (no legacy JSON stand-in).
  await db.unsafe("REVOKE INSERT ON public.user_sessions FROM service_role");
  const before = await count(),
    failedJar = new Map();
  assert.ok(!(await login(false, failedJar, 503)).session);
  assert.equal((await login(true, undefined, 503)).data, null);
  assert.equal(await count(), before);
  await snapshot(children[0], { jar: failedJar }, 401);
  console.log(
    "OK rotated mobile logout, re-login, suspension and registry outage; both login routes withhold credentials if registration cannot commit",
  );
}

await withSessionStack(exercise);
