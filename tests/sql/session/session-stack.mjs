// Owns every service and credential. Caller-supplied targets/DSNs are not supported.
import { fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import {
  App,
  getAuthSchemaSql,
  getStorageSchemaSql, setExperimental, isExperimentalEnabled,
  SUPABASE_AUTH_HELPERS_SQL,
  generateApiKey,
} from "@supabase/lite";
import { createPostgresConnection } from "@supabase/lite/postgres";
import { withDisposablePostgres } from "../disposable-postgres.mjs";

import { snapshotStorage } from "./snapshot-storage.mjs";
import { withBrowserBuild } from "./browser-build.mjs";

export async function withSessionStack(
  check,
  { buildForBrowser = false, rpcJsonObjects = false, withStorage = false } = {},
) {
  if (
    [".env", ".env.local", ".env.production", ".env.production.local"].some(
      existsSync,
    ) ||
    (!buildForBrowser && !existsSync(".next/BUILD_ID"))
  )
    throw new Error(
      "Use a test-only checkout without deployment env files; the HTTP test also needs npm run build.",
    );
  await withDisposablePostgres(
    async ({ db, dsn, cert }) => {
      const connection = createPostgresConnection({
        url: dsn("fixture"),
        postgresOptions: {
          ssl: { ca: readFileSync(cert) },
          onnotice: () => {},
          // Supabase Lite 0.11 pre-serializes object/array RPC arguments before
          // handing them to postgres.js. Preserve PostgREST JSONB object semantics.
          ...(rpcJsonObjects ? {types:{jsonb:{to:3802,from:[3802],parse:JSON.parse,
            serialize:value=>typeof value==='string' && /^[{\[]/.test(value.trimStart()) ? value : JSON.stringify(value)}}} : {}),
        },
      });
      const previouslyEnabled=isExperimentalEnabled('storage');
      const storage=withStorage?snapshotStorage():undefined;
      let authServer;
      try {
        await db.unsafe(`GRANT USAGE ON SCHEMA public TO service_role,authenticated;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT INSERT ON public.system_audit_logs TO service_role;`);
        const anon = (await generateApiKey("publishable")).key;
        const service = (await generateApiKey("secret")).key;
        const mobileKey = randomBytes(32).toString("hex");
        if(storage){setExperimental('storage',true);await db.unsafe(getStorageSchemaSql());}
        const lite = new App({
          connection,
          ...(storage?{storage:{enabled:true}}:{}),
          auth: {
            enabled: true,
            jwt_secret: randomBytes(32).toString("hex"),
            publishable_key: anon,
            secret_key: service,
            email: { enable_confirmations: false },
          },
          options: { server: { admin: false } },
        });
        if(storage) lite._storageAdapter=storage;
        authServer = serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch: (r) => lite.fetch(r),
        });
        await once(authServer, "listening");
        const port = authServer.address().port,
          api = `http://127.0.0.1:${port}`;
        const buildEnv = {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: "production",
          NEXT_TELEMETRY_DISABLED: "1",
          RAYON_NUM_THREADS: "2",
          NEXT_PUBLIC_SUPABASE_URL: api,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
        };
        const runApp = async (cwd) => {
          const child = fork(
            new URL("./session-next.mjs", import.meta.url),
            [String(port)],
            {
              cwd,
              env: {
                ...buildEnv,
                SUPABASE_SERVICE_ROLE_KEY: service,
                MOBILE_API_KEY: mobileKey,
              },
              stdio: ["ignore", "ignore", "ignore", "ipc"],
            },
          );
          try {
            const [ready] = await Promise.race([
              once(child, "message", { signal: AbortSignal.timeout(45_000) }),
              once(child, "exit").then(() => {
                throw new Error("Test Next failed to start");
              }),
            ]);
            await check({
              db,
              lite, storage,
              anon,
              api,
              mobileKey,
              base: `http://127.0.0.1:${ready.port}`,
            });
          } finally {
            if (child.exitCode === null && child.signalCode === null) {
              const exited = once(child, "exit");
              child.kill();
              await exited;
            }
          }
        };
        // The UI SDK needs the disposable public URL/key in its actual browser chunks.
        if (buildForBrowser) await withBrowserBuild(buildEnv, runApp);
        else await runApp(process.cwd());
      } finally {
        authServer?.closeAllConnections();
        if (authServer)
          await new Promise((resolve) => authServer.close(resolve));
        await connection.close();
        if(withStorage) setExperimental('storage',previouslyEnabled);
      }
    },
    { authSchema: SUPABASE_AUTH_HELPERS_SQL + "\n" + getAuthSchemaSql() },
  );
}
