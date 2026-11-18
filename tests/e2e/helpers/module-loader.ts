import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteHandler = (
  req: Request,
  context?: { params: Promise<Record<string, string>> }
) => Promise<Response>;

const REPO_ROOT = process.cwd();
const CANDIDATE_EXTS = [
  "",
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
];

function isVitestRuntime(): boolean {
  return Boolean(
    process.env.VITEST ||
      (globalThis as Record<string, unknown>).__vitest_worker__
  );
}

interface E2eShimState {
  headers: Headers;
  cookies: Map<string, string>;
  revalidatedPaths: string[];
  revalidatedTags: string[];
}

function getShimState(): E2eShimState {
  const g = globalThis as Record<string, unknown>;
  if (!g.__QAWMI_E2E_STATE__) {
    g.__QAWMI_E2E_STATE__ = {
      headers: new Headers(),
      cookies: new Map<string, string>(),
      revalidatedPaths: [],
      revalidatedTags: [],
    };
  }
  return g.__QAWMI_E2E_STATE__ as E2eShimState;
}

export async function installBoundaryHooks(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (g.__QAWMI_E2E_HOOKS_INSTALLED__) {
    return;
  }
  g.__QAWMI_E2E_HOOKS_INSTALLED__ = true;

  // Ensure Node registerHooks are installed (idempotent with register-hooks.mjs)
  const hooksFile = path.resolve(
    REPO_ROOT,
    "tests/e2e/helpers/register-hooks.mjs"
  );
  if (fs.existsSync(hooksFile)) {
    const hooksUrl = pathToFileURL(hooksFile).href;
    await import(hooksUrl);
  }

  // Inside Vitest, also register vi.doMock for Next.js boundary modules
  if (isVitestRuntime()) {
    const vitestPkg = "vitest";
    const vitestMod = (await import(vitestPkg)) as {
      vi?: {
        doMock: (name: string, factory: () => Record<string, unknown>) => void;
      };
    };
    const vi = vitestMod.vi;
    if (vi && typeof vi.doMock === "function") {
      vi.doMock("next/headers", () => ({
        headers: async () => getShimState().headers,
        cookies: async () => {
          const map = getShimState().cookies;
          return {
            get(name: string) {
              if (!map.has(name)) return undefined;
              return { name, value: map.get(name) as string };
            },
            getAll() {
              return Array.from(map.entries()).map(([name, value]) => ({
                name,
                value,
              }));
            },
            has(name: string) {
              return map.has(name);
            },
            set(
              nameOrObj: string | { name: string; value: string },
              value?: string
            ) {
              if (typeof nameOrObj === "string") {
                map.set(nameOrObj, String(value ?? ""));
              } else if (nameOrObj && typeof nameOrObj.name === "string") {
                map.set(nameOrObj.name, String(nameOrObj.value ?? ""));
              }
            },
            delete(name: string) {
              map.delete(name);
            },
          };
        },
        draftMode: async () => ({
          isEnabled: false,
          enable() {},
          disable() {},
        }),
      }));

      vi.doMock("next/cache", () => ({
        revalidatePath(p: string) {
          getShimState().revalidatedPaths.push(String(p));
        },
        revalidateTag(tag: string) {
          getShimState().revalidatedTags.push(String(tag));
        },
        unstable_cache<T>(fn: T): T {
          return fn;
        },
        unstable_noStore() {},
      }));

      vi.doMock("next/navigation", () => ({
        redirect(url: string): never {
          const err = new Error(`NEXT_REDIRECT: ${url}`) as Error & {
            digest?: string;
          };
          err.digest = `NEXT_REDIRECT;replace;${url};307;`;
          throw err;
        },
        permanentRedirect(url: string): never {
          const err = new Error(`NEXT_REDIRECT: ${url}`) as Error & {
            digest?: string;
          };
          err.digest = `NEXT_REDIRECT;replace;${url};308;`;
          throw err;
        },
        notFound(): never {
          const err = new Error("NEXT_NOT_FOUND") as Error & {
            digest?: string;
          };
          err.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
          throw err;
        },
      }));
    }
  }
}

export function resolveModulePath(specifier: string): string | null {
  const rel = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.replace(/^\//, "");
  const basePath = path.resolve(REPO_ROOT, rel);
  for (const ext of CANDIDATE_EXTS) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export async function loadModule<
  T extends Record<string, unknown> = Record<string, unknown>
>(specifier: string, requiredExports?: readonly string[]): Promise<T> {
  await installBoundaryHooks();

  const resolvedPath = resolveModulePath(specifier);
  if (!resolvedPath) {
    throw new assert.AssertionError({
      message: `[E2E_MISSING_MODULE] Required production module "${specifier}" does not exist yet.`,
      actual: null,
      expected: specifier,
    });
  }

  const importTarget = isVitestRuntime()
    ? specifier
    : pathToFileURL(resolvedPath).href;
  const mod = (await import(importTarget)) as Record<string, unknown>;

  if (requiredExports && requiredExports.length > 0) {
    const missing = requiredExports.filter(
      (name) => !(name in mod) || mod[name] === undefined
    );
    if (missing.length > 0) {
      throw new assert.AssertionError({
        message: `[E2E_MISSING_EXPORT] Module "${specifier}" is missing required export(s): ${missing.join(
          ", "
        )}. Found exports: ${Object.keys(mod).join(", ") || "(none)"}.`,
        actual: Object.keys(mod),
        expected: [...requiredExports],
      });
    }
  }

  return mod as T;
}

export async function loadRouteHandler(
  apiSubpath: string,
  method: HttpMethod
): Promise<RouteHandler> {
  const cleanSubpath = apiSubpath.replace(/^\/+|\/+$/g, "");
  const specifier = `@/app/api/${cleanSubpath}/route`;
  const mod = await loadModule<Record<string, unknown>>(specifier, [method]);
  const handler = mod[method];
  assert.equal(
    typeof handler,
    "function",
    `[E2E_MISSING_EXPORT] Route "${specifier}" export "${method}" must be a function.`
  );
  return handler as RouteHandler;
}

export async function loadAction<
  T extends (...args: never[]) => unknown = (...args: unknown[]) => Promise<unknown>
>(actionModule: string, exportName: string): Promise<T> {
  const cleanMod = actionModule.replace(/^\/+|\/+$/g, "");
  const specifier = `@/app/actions/${cleanMod}`;
  const mod = await loadModule<Record<string, unknown>>(specifier, [exportName]);
  const fn = mod[exportName];
  assert.equal(
    typeof fn,
    "function",
    `[E2E_MISSING_EXPORT] Action module "${specifier}" export "${exportName}" must be a function.`
  );
  return fn as T;
}

export function readProjectFile(relPath: string): string {
  const absPath = path.resolve(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new assert.AssertionError({
      message: `[E2E_MISSING_FILE] Required project file "${relPath}" does not exist yet.`,
      actual: null,
      expected: relPath,
    });
  }
  return fs.readFileSync(absPath, "utf8");
}
