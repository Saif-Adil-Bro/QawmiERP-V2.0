import { once } from "node:events";
import { createServer, request } from "node:http";

// All Chromium targets, including today's or a restarted service worker, use this
// allowlist. Forward the original method/headers/body; never record credentials.
export async function fixtureProxy(origins) {
  let online = true;
  const server = createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url);
    } catch {
      return res.writeHead(400).end();
    }
    if (!origins.includes(url.origin)) return res.writeHead(403).end();
    if (!online) return req.socket.destroy();
    const upstream = request(
      url,
      { method: req.method, headers: req.headers },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.on("error", () => res.destroy());
        reply.pipe(res);
      },
    );
    res.on("close", () => upstream.destroy());
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  server.on("connect", (_req, socket) => socket.destroy()); // no HTTPS/external targets
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    args: [
      `--proxy-server=http://127.0.0.1:${server.address().port}`,
      "--proxy-bypass-list=<-loopback>",
      "--disable-quic",
    ],
    setOnline(value) {
      online = value;
      if (!online) server.closeAllConnections();
    },
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
