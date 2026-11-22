// Test-only: never accepts a database URL; owns and cleans up its own cluster.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

const minimalAuthSchema = `CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`;

export async function withDisposablePostgres(
  check,
  { authSchema = minimalAuthSchema } = {},
) {
  const bin = process.env.QAWMI_PG_BIN;
  if (!bin)
    throw new Error(
      "Set QAWMI_PG_BIN to a local PostgreSQL bin directory (initdb and pg_ctl). Run as a non-root user.",
    );
  const dir = mkdtempSync(join(tmpdir(), "qawmi-pg-"));
  const data = join(dir, "data"),
    cert = join(data, "server.crt");
  const password = randomBytes(24).toString("hex");
  const run = (exe, args) =>
    execFileSync(exe, args, { cwd: dir, stdio: "pipe", timeout: 30_000 });
  let db;
  try {
    writeFileSync(join(dir, "pw"), password, { mode: 0o600 });
    run(join(bin, "initdb"), [
      "-D",
      data,
      "-U",
      "fixture",
      "-A",
      "scram-sha-256",
      "--pwfile",
      join(dir, "pw"),
      "--no-locale",
      "--encoding=UTF8",
    ]);
    run("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      join(data, "server.key"),
      "-out",
      cert,
    ]);
    const probe = createServer().listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    run(join(bin, "pg_ctl"), [
      "-D",
      data,
      "-l",
      join(dir, "pg.log"),
      "-o",
      `-p ${port} -h 127.0.0.1 -c unix_socket_directories='' -c ssl=on`,
      "-w",
      "start",
    ]);
    const dsn = (user) =>
      `postgresql://${user}:${password}@127.0.0.1:${port}/postgres`;
    db = postgres(dsn("fixture"), {
      max: 8,
      ssl: { ca: readFileSync(cert) },
      onnotice: () => {},
    });
    const schema = await db.reserve();
    try {
      await schema.unsafe(
        `CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;`,
      );
      await schema.unsafe(authSchema);
      for (const file of [
        "supabase_schema.sql",
        "supabase_fix_account_model_migration.sql",
        "supabase_portal_parity_migration.sql",
      ]) {
        await schema.unsafe(readFileSync(file, "utf8"));
      }
    } finally {
      schema.release();
    }
    await check({ db, dsn, cert, password });
  } finally {
    await db?.end({ timeout: 2 });
    if (existsSync(join(data, "postmaster.pid")))
      run(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  }
}
