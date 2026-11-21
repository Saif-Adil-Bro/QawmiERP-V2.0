import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

// NEXT_PUBLIC_* is inlined. Build the real app in a temporary project under
// the checkout's lockfile and node_modules (normal Next monorepo resolution).
// Never overwrite the root .next, config or generated types, or copy .env files.
export async function withBrowserBuild(env, check) {
  await mkdir(".cache", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/qawmi-shared-ui-"));
  try {
    for (const path of [
      "app",
      "components",
      "hooks",
      "lib",
      "public",
      "types",
      "middleware.ts",
      "next.config.ts",
      "postcss.config.mjs",
      "tsconfig.json",
      "package.json",
    ])
      await cp(path, join(dir, path), { recursive: true });
    console.log(
      "Building the shared-browser fixture against its disposable Auth API…",
    );
    await promisify(execFile)(
      process.execPath,
      [resolve("node_modules/next/dist/bin/next"), "build"],
      { cwd: dir, env, timeout: 300_000, maxBuffer: 2 ** 20 },
    );
    await check(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
