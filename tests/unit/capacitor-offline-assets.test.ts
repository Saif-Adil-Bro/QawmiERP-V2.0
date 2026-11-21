import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { capacitorServerUrl } from "../../scripts/capacitor-server-url.cjs";

const root = process.cwd();
let dir: string;
const read = (file: string) => readFileSync(join(dir, file), "utf8");
function node(args: string[], server: string) {
  return execFileSync(process.execPath, args, {
    cwd: dir,
    timeout: 20_000,
    env: { ...process.env, CI: "true", CAPACITOR_SERVER_URL: server, NEXT_PUBLIC_APP_URL: "" },
  });
}
const prepare = (url: string) => node(["scripts/prepare-capacitor-out.mjs"], url);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "qawmi-cap-assets-"));
  for (const file of [
    "package.json",
    "capacitor.config.ts",
    "scripts/capacitor-server-url.cjs",
    "scripts/prepare-capacitor-out.mjs",
    "public/offline.html",
    "public/offline-portal.js",
    "android/app/src/main/AndroidManifest.xml",
  ]) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(resolve(root, file), join(dir, file));
  }
  symlinkSync(join(root, "node_modules"), join(dir, "node_modules"), "junction");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("Capacitor offline packaging", () => {
  it("ships a standalone origin-neutral error document and both web reader assets in a clean Android sync", () => {
    const url = "https://stage.example.test/portal/fees";
    prepare(url);
    node([resolve(root, "node_modules/@capacitor/cli/bin/capacitor"), "sync", "android"], url);
    const assets = "android/app/src/main/assets";
    const { server } = JSON.parse(read(`${assets}/capacitor.config.json`));
    expect(server.url).toBe(new URL(url).origin);
    expect(server.appStartPath).toBe("/portal/fees");
    const errorPage = read(`${assets}/public/${server.errorPath}`);
    expect(errorPage).toContain('href="https://stage.example.test/login"');
    expect(errorPage).not.toMatch(
      /<script|\son\w+=|<iframe|\/portal\/fees|indexedDB|localStorage|#snapshot/i,
    );
    for (const file of ["offline.html", "offline-portal.js"]) {
      expect(read(`${assets}/public/${file}`)).toBe(read(`public/${file}`));
    }
  }, 25_000);
  it("keeps a static export, refreshes the retry origin on rebuild, and does not package deep links or secrets", () => {
    mkdirSync(join(dir, "out"));
    writeFileSync(join(dir, "out/index.html"), "static app entry");
    prepare("https://first.example.test");
    prepare("https://your-domain.com");
    expect(read("out/index.html")).toBe("static app entry");
    expect(read("out/native-offline.html")).toContain('href="/"');
    expect(read("out/native-offline.html")).not.toMatch(/first\.example|your-domain/);
    expect(() =>
      capacitorServerUrl({
        ...process.env,
        CAPACITOR_SERVER_URL: "https://stage.example.test/portal?student_id=private",
      }),
    ).toThrow(/without credentials, query or fragment/);
  });
});
