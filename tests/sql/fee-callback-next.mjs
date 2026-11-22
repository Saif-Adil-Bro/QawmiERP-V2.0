// Child of fee-callbacks-http.mjs ONLY. Hosts the built Next app on loopback. No
// test URL switch, fake proof, or validator override exists in application code.
import { createServer } from "node:http";
import { once } from "node:events";
const port = Number(process.argv[2]);
if (!process.send || !Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Run the disposable callback test instead.");
const fixture = `http://127.0.0.1:${port}`;
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: fixture,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
  NEXT_TELEMETRY_DISABLED: "1",
});
const wire = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const req = new Request(input, init),
    u = new URL(req.url);
  if (u.origin === fixture) return wire(req, { redirect: "error" });
  if (
    u.origin === "https://sandbox.sslcommerz.com" &&
    u.pathname === "/validator/api/validationserverAPI.php" &&
    req.method === "GET" &&
    req.redirect === "error" &&
    u.searchParams.get("store_passwd") === "fixture-only"
  ) {
    return wire(`${fixture}/validator${u.search}`, { signal: req.signal, redirect: "error" });
  }
  throw new Error("Non-fixture network disabled");
};
const next = (await import("next")).default;
const app = next({ dev: false, hostname: "127.0.0.1", dir: process.cwd() });
await app.prepare();
const server = createServer(app.getRequestHandler()).listen(0, "127.0.0.1");
await once(server, "listening");
process.send({ port: server.address().port });
process.once("disconnect", async () => {
  server.closeAllConnections();
  server.close();
  await app.close();
  process.exit(0);
});
