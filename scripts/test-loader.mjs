import module from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"];

function resolveFile(basePath) {
  const candidates = [
    basePath,
    ...EXTENSIONS.map((ext) => basePath + ext),
    ...EXTENSIONS.map((ext) => path.join(basePath, "index" + ext)),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return pathToFileURL(candidate).href;
      }
    } catch {
      // ignore invalid path
    }
  }
  return null;
}

if (typeof module.registerHooks === "function") {
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith("@/")) {
        const found = resolveFile(path.join(root, specifier.slice(2)));
        if (found) return nextResolve(found, context);
      }
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        context.parentURL?.startsWith("file:")
      ) {
        const dir = path.dirname(fileURLToPath(context.parentURL));
        const found = resolveFile(path.resolve(dir, specifier));
        if (found) return nextResolve(found, context);
      }
      return nextResolve(specifier, context);
    },
  });
}
