// Test-only Next child. Permit only the disposable Auth/Data API and Next's own
// same-origin server-action redirects. No simulated tokens or route shims.
import { once } from "node:events";
import { createServer } from "node:http";
const port = Number(process.argv[2]);
if (!process.send || !Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Run the disposable session tests instead.");
const origin = `http://127.0.0.1:${port}`;
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
const server = createServer().listen(0, "127.0.0.1");
await once(server, "listening");
const appPort = server.address().port;
const allowed = new Set([origin, `http://127.0.0.1:${appPort}`]);
const wire = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const req = new Request(input, init);
  if (!allowed.has(new URL(req.url).origin))
    throw new Error("Non-fixture network disabled");
  return wire(req, { redirect: "error" });
};
const { default: next } = await import("next");
const app = next({
  dev: false,
  hostname: "127.0.0.1",
  port: appPort,
  dir: process.cwd(),
});
await app.prepare();
server.on("request", app.getRequestHandler());
process.send({ port: appPort });
process.once("disconnect", async () => {
  server.closeAllConnections();
  server.close();
  await app.close();
  process.exit(0);
});
