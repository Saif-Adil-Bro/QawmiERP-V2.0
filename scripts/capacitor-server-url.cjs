// Used by both the Capacitor config loader (CommonJS) and the asset builder.
exports.capacitorServerUrl = function capacitorServerUrl(env = process.env) {
  const raw = env.CAPACITOR_SERVER_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  let url;
  try {
    url = new URL(raw);
  } catch {
    /* Do not echo a malformed value into the build log. */
  }
  if (
    !url ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Capacitor requires an HTTP(S) app URL without credentials, query or fragment.");
  }
  return url.hostname === "your-domain.com" ? undefined : url;
};
