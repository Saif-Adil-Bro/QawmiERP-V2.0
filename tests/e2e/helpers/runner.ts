export type TestCallback = () => void | Promise<void>;
export type SuiteCallback = () => void | Promise<void>;
export type DescribeFn = (name: string, fn: SuiteCallback) => void;
export type ItFn = (name: string, fn: TestCallback) => void;
export type HookFn = (fn: TestCallback) => void;

interface RunnerBindings {
  describe: DescribeFn;
  it: ItFn;
  beforeAll: HookFn;
  afterAll: HookFn;
  beforeEach: HookFn;
  afterEach: HookFn;
}

const isVitestRuntime = Boolean(
  process.env.VITEST ||
    (globalThis as Record<string, unknown>).__vitest_worker__
);

async function resolveRunner(): Promise<RunnerBindings> {
  if (isVitestRuntime) {
    const vitestPkg = "vitest";
    const v = (await import(vitestPkg)) as Record<string, unknown>;
    return {
      describe: v.describe as DescribeFn,
      it: v.it as ItFn,
      beforeAll: v.beforeAll as HookFn,
      afterAll: v.afterAll as HookFn,
      beforeEach: v.beforeEach as HookFn,
      afterEach: v.afterEach as HookFn,
    };
  }

  const nt = await import("node:test");
  return {
    describe: nt.describe as unknown as DescribeFn,
    it: nt.it as unknown as ItFn,
    beforeAll: nt.before as unknown as HookFn,
    afterAll: nt.after as unknown as HookFn,
    beforeEach: nt.beforeEach as unknown as HookFn,
    afterEach: nt.afterEach as unknown as HookFn,
  };
}

const bindings = await resolveRunner();

export const describe: DescribeFn = bindings.describe;
export const it: ItFn = bindings.it;
export const beforeAll: HookFn = bindings.beforeAll;
export const afterAll: HookFn = bindings.afterAll;
export const beforeEach: HookFn = bindings.beforeEach;
export const afterEach: HookFn = bindings.afterEach;
export const isVitest: boolean = isVitestRuntime;
