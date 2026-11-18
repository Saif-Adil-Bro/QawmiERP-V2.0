import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , mode = "unit", ...extraArgs] = process.argv;
const root = process.cwd();
const baseDir = mode === "e2e" ? path.join(root, "tests", "e2e") : path.join(root, "tests", "unit");

function collectTestFiles(targetPath) {
  const results = [];
  if (!fs.existsSync(targetPath)) return results;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (/\.test\.(ts|tsx|mts|js|mjs)$/.test(targetPath)) {
      results.push(targetPath);
    }
    return results;
  }
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTestFiles(full));
    } else if (entry.isFile() && /\.test\.(ts|tsx|mts|js|mjs)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results.sort();
}

const filters = [];
const passthroughFlags = [];

for (const arg of extraArgs) {
  if (arg === "--") continue;
  if (arg.startsWith("-")) {
    passthroughFlags.push(arg);
  } else {
    filters.push(arg);
  }
}

let files = [];
if (filters.length === 0) {
  files = collectTestFiles(baseDir);
} else {
  const allBaseFiles = collectTestFiles(baseDir);
  const matchedSet = new Set();

  for (const filter of filters) {
    const directCandidate = path.resolve(root, filter);
    const relativeToBase = path.resolve(baseDir, filter);

    if (fs.existsSync(directCandidate)) {
      for (const f of collectTestFiles(directCandidate)) matchedSet.add(f);
    } else if (fs.existsSync(relativeToBase)) {
      for (const f of collectTestFiles(relativeToBase)) matchedSet.add(f);
    } else {
      const normalized = filter.replace(/\\/g, "/");
      for (const f of allBaseFiles) {
        if (f.replace(/\\/g, "/").includes(normalized)) {
          matchedSet.add(f);
        }
      }
    }
  }
  files = Array.from(matchedSet).sort();
}

if (files.length === 0) {
  console.error(
    `No test files found for mode="${mode}"${filters.length ? ` with filters=[${filters.join(", ")}]` : ""} in ${path.relative(root, baseDir)}`
  );
  process.exit(1);
}

const vitestBin = path.join(root, "node_modules", "vitest", "vitest.mjs");
const hasVitest = fs.existsSync(vitestBin);

const nodeTestFiles = [];
const vitestFiles = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const usesNodeTest = /from\s+["']node:test["']|require\(["']node:test["']\)/.test(content);
  if (usesNodeTest || !hasVitest) {
    nodeTestFiles.push(file);
  } else {
    vitestFiles.push(file);
  }
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "test",
};

if (vitestFiles.length > 0) {
  const relFiles = vitestFiles.map((f) => path.relative(root, f));
  const res = spawnSync(process.execPath, [vitestBin, "run", ...passthroughFlags, ...relFiles], {
    stdio: "inherit",
    cwd: root,
    env,
  });
  if (res.error) {
    console.error(res.error);
    process.exit(1);
  }
  if ((res.status ?? 1) !== 0) {
    process.exit(res.status ?? 1);
  }
}

if (nodeTestFiles.length > 0) {
  const loaderPath = path.join(root, "scripts", "test-loader.mjs");
  const res = spawnSync(
    process.execPath,
    [
      "--no-warnings",
      "--experimental-transform-types",
      "--import",
      loaderPath,
      "--test",
      ...passthroughFlags,
      ...nodeTestFiles,
    ],
    {
      stdio: "inherit",
      cwd: root,
      env,
    }
  );
  if (res.error) {
    console.error(res.error);
    process.exit(1);
  }
  if ((res.status ?? 1) !== 0) {
    process.exit(res.status ?? 1);
  }
}

process.exit(0);
