import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = process.cwd();
const RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

function tryResolveFile(basePath) {
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const NEXT_HEADERS_SHIM = `
function getState() {
  const g = globalThis;
  if (!g.__QAWMI_E2E_STATE__) {
    g.__QAWMI_E2E_STATE__ = {
      headers: new Headers(),
      cookies: new Map(),
      revalidatedPaths: [],
      revalidatedTags: [],
    };
  }
  return g.__QAWMI_E2E_STATE__;
}

export async function headers() {
  const state = getState();
  return state.headers instanceof Headers ? state.headers : new Headers(state.headers || {});
}

export async function cookies() {
  const state = getState();
  const map = state.cookies instanceof Map ? state.cookies : new Map();
  state.cookies = map;
  return {
    get(name) {
      if (!map.has(name)) return undefined;
      return { name, value: map.get(name) };
    },
    getAll() {
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    },
    has(name) {
      return map.has(name);
    },
    set(nameOrObj, value) {
      if (typeof nameOrObj === "string") {
        map.set(nameOrObj, String(value ?? ""));
      } else if (nameOrObj && typeof nameOrObj.name === "string") {
        map.set(nameOrObj.name, String(nameOrObj.value ?? ""));
      }
    },
    delete(name) {
      map.delete(name);
    },
  };
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}
`;

const NEXT_CACHE_SHIM = `
function getState() {
  const g = globalThis;
  if (!g.__QAWMI_E2E_STATE__) {
    g.__QAWMI_E2E_STATE__ = {
      headers: new Headers(),
      cookies: new Map(),
      revalidatedPaths: [],
      revalidatedTags: [],
    };
  }
  return g.__QAWMI_E2E_STATE__;
}

export function revalidatePath(path) {
  const state = getState();
  if (!Array.isArray(state.revalidatedPaths)) state.revalidatedPaths = [];
  state.revalidatedPaths.push(String(path));
}

export function revalidateTag(tag) {
  const state = getState();
  if (!Array.isArray(state.revalidatedTags)) state.revalidatedTags = [];
  state.revalidatedTags.push(String(tag));
}

export function unstable_cache(fn) {
  return fn;
}

export function unstable_noStore() {}
`;

const NEXT_NAVIGATION_SHIM = `
export function redirect(url) {
  const err = new Error("NEXT_REDIRECT: " + url);
  err.digest = "NEXT_REDIRECT;replace;" + url + ";307;";
  throw err;
}

export function permanentRedirect(url) {
  const err = new Error("NEXT_REDIRECT: " + url);
  err.digest = "NEXT_REDIRECT;replace;" + url + ";308;";
  throw err;
}

export function notFound() {
  const err = new Error("NEXT_NOT_FOUND");
  err.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
  throw err;
}

export function useRouter() {
  return { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}
`;

export function installNodeE2eHooks() {
  if (globalThis.__QAWMI_E2E_NODE_HOOKS_INSTALLED__) {
    return;
  }
  globalThis.__QAWMI_E2E_NODE_HOOKS_INSTALLED__ = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/headers") {
        return { url: "qawmi-e2e-shim:next/headers", shortCircuit: true };
      }
      if (specifier === "next/cache") {
        return { url: "qawmi-e2e-shim:next/cache", shortCircuit: true };
      }
      if (specifier === "next/navigation") {
        return { url: "qawmi-e2e-shim:next/navigation", shortCircuit: true };
      }
      if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
      }
      if (
        specifier.startsWith("next/") &&
        !specifier.endsWith(".js") &&
        !specifier.endsWith(".mjs")
      ) {
        const candidate = path.join(REPO_ROOT, "node_modules", specifier + ".js");
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return nextResolve(specifier + ".js", context);
        }
      }

      if (specifier.startsWith("@/")) {
        const rel = specifier.slice(2);
        const resolved = tryResolveFile(path.join(REPO_ROOT, rel));
        if (resolved) {
          return { url: pathToFileURL(resolved).href, shortCircuit: true };
        }
      }

      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        context.parentURL &&
        context.parentURL.startsWith("file://")
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const resolved = tryResolveFile(path.resolve(parentDir, specifier));
        if (resolved) {
          return { url: pathToFileURL(resolved).href, shortCircuit: true };
        }
      }

      return nextResolve(specifier, context);
    },

    load(url, context, nextLoad) {
      if (url === "qawmi-e2e-shim:next/headers") {
        return { format: "module", source: NEXT_HEADERS_SHIM, shortCircuit: true };
      }
      if (url === "qawmi-e2e-shim:next/cache") {
        return { format: "module", source: NEXT_CACHE_SHIM, shortCircuit: true };
      }
      if (url === "qawmi-e2e-shim:next/navigation") {
        return { format: "module", source: NEXT_NAVIGATION_SHIM, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
}

installNodeE2eHooks();
