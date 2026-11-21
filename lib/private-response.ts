// Offline copies live in the owner-scoped database, never an HTTP cache keyed by URL.
export const privateResponseHeaders = { "Cache-Control": "private, no-store" } as const;
