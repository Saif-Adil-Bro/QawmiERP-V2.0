import JSZip from "jszip";
import {
  ALLOWED_WIDGET_PERMISSIONS,
  type WidgetManifest,
  type WidgetPermission,
  type WidgetSize,
} from "./types";

const MAX_ZIP_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_FILES_COUNT = 30;
const MAX_UNCOMPRESSED_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

const FORBIDDEN_EXT_RE =
  /\.(php|phtml|exe|dll|sh|bash|bat|cmd|ps1|py|rb|pl|cgi|jar|war|env|key|pem)$/i;

function isSafeZipPath(relPath: string): boolean {
  if (!relPath || relPath.startsWith("/") || relPath.startsWith("\\")) return false;
  if (relPath.includes("..") || relPath.includes("\\") || relPath.includes("\0")) return false;
  if (FORBIDDEN_EXT_RE.test(relPath)) return false;
  return true;
}

function normalizeRelativeRef(ref: string): string {
  return ref
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .split("?")[0]
    .split("#")[0];
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const QAWMI_BRIDGE_SDK = `<script>
(function () {
  var listeners = [];
  window.addEventListener("message", function (event) {
    if (!event || !event.data || event.data.type !== "QAWMI_WIDGET_DATA") return;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](event.data.payload || {}); } catch (e) {}
    }
  });
  window.QawmiERP = {
    requestData: function () {
      try {
        window.parent.postMessage({ type: "QAWMI_WIDGET_REQUEST_DATA" }, "*");
      } catch (e) {}
    },
    onData: function (cb) {
      if (typeof cb === "function") listeners.push(cb);
    }
  };
})();
</script>`;

export interface ParsedCustomWidget {
  id: string;
  title: string;
  description: string;
  version: string;
  author: string;
  size: WidgetSize;
  permissions: WidgetPermission[];
  bundleHtml: string;
}

export async function parseCustomWidgetZip(
  input: ArrayBuffer | Uint8Array
): Promise<{ ok: true; widget: ParsedCustomWidget } | { ok: false; error: string }> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength === 0) {
    return { ok: false, error: "আপলোড করা .zip ফাইলটি খালি।" };
  }
  if (bytes.byteLength > MAX_ZIP_BYTES) {
    return {
      ok: false,
      error: "উইজেট .zip ফাইলের সাইজ সর্বোচ্চ ২ মেগাবাইট (2 MB) হতে পারবে।",
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return { ok: false, error: "সঠিক .zip ফাইল নয় — অনুগ্রহ করে একটি ভ্যালিড ZIP আর্কাইভ আপলোড করুন।" };
  }

  const fileEntries = Object.values(zip.files).filter((f) => !f.dir);
  if (fileEntries.length === 0) {
    return { ok: false, error: ".zip ফাইলের ভেতরে কোনো ফাইল পাওয়া যায়নি।" };
  }
  if (fileEntries.length > MAX_FILES_COUNT) {
    return {
      ok: false,
      error: `উইজেট প্যাকেজে সর্বোচ্চ ${MAX_FILES_COUNT}টি ফাইল থাকতে পারবে।`,
    };
  }

  for (const entry of fileEntries) {
    if (!isSafeZipPath(entry.name)) {
      return {
        ok: false,
        error: `অননুমোদিত বা অনিরাপদ ফাইল পাথ পাওয়া গেছে: ${entry.name}`,
      };
    }
  }

  // Detect optional single top-level folder (WordPress plugin zip style)
  let rootPrefix = "";
  const directManifest = zip.file("manifest.json");
  if (!directManifest) {
    const manifestCandidate = fileEntries.find(
      (f) => f.name.endsWith("/manifest.json") && f.name.split("/").length === 2
    );
    if (manifestCandidate) {
      rootPrefix = manifestCandidate.name.slice(0, -"manifest.json".length);
    }
  }

  const getFileText = async (relPath: string): Promise<string | null> => {
    const clean = normalizeRelativeRef(relPath);
    if (!isSafeZipPath(clean)) return null;
    const f = zip.file(`${rootPrefix}${clean}`);
    if (!f || f.dir) return null;
    return f.async("string");
  };

  const manifestRaw = await getFileText("manifest.json");
  if (!manifestRaw) {
    return {
      ok: false,
      error: "প্যাকেজের রুটে manifest.json ফাইলটি পাওয়া যায়নি।",
    };
  }

  let manifest: WidgetManifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    return { ok: false, error: "manifest.json ফাইলটি সঠিক JSON ফরম্যাটে নেই।" };
  }

  const rawId = String(manifest.id || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-_]{1,38}[a-z0-9]$/.test(rawId)) {
    return {
      ok: false,
      error:
        "manifest.json-এ 'id' অবশ্যই ৩-৪০ অক্ষরের ইংরেজি ছোট হাতের অক্ষর, সংখ্যা বা '-' হতে হবে (যেমন: madrasa-prayer-widget)।",
    };
  }

  const title = String(manifest.name || "").trim();
  if (!title || title.length > 80) {
    return {
      ok: false,
      error: "manifest.json-এ বৈধ 'name' (সর্বোচ্চ ৮০ অক্ষর) দেওয়া আবশ্যক।",
    };
  }

  const entryFile = normalizeRelativeRef(manifest.entry || "index.html");
  if (!entryFile.endsWith(".html") && !entryFile.endsWith(".htm")) {
    return { ok: false, error: "entry ফাইল অবশ্যই .html হতে হবে।" };
  }

  let html = await getFileText(entryFile);
  if (!html) {
    return {
      ok: false,
      error: `manifest.json-এ উল্লেখিত '${entryFile}' ফাইলটি প্যাকেজে পাওয়া যায়নি।`,
    };
  }

  // Inline relative <link rel="stylesheet" href="...">
  const cssLinkRegex = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const cssMatches = Array.from(html.matchAll(cssLinkRegex));
  for (const m of cssMatches) {
    const href = m[1];
    if (/^https?:\/\//i.test(href) || href.startsWith("//")) continue;
    const cssText = await getFileText(href);
    if (cssText !== null) {
      html = html.replace(m[0], `<style>\n${cssText}\n</style>`);
    }
  }

  // Inline relative <script src="..."></script>
  const scriptSrcRegex = /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const scriptMatches = Array.from(html.matchAll(scriptSrcRegex));
  for (const m of scriptMatches) {
    const src = m[1];
    if (/^https?:\/\//i.test(src) || src.startsWith("//")) continue;
    const jsText = await getFileText(src);
    if (jsText !== null) {
      const safeJs = jsText.replace(/<\/script>/gi, "<\\/script>");
      html = html.replace(m[0], `<script>\n${safeJs}\n</script>`);
    }
  }

  if (new TextEncoder().encode(html).byteLength > MAX_UNCOMPRESSED_BYTES) {
    return {
      ok: false,
      error: "উইজেটের মোট HTML/CSS/JS সাইজ ১.৫ মেগাবাইটের বেশি হতে পারবে না।",
    };
  }

  // Inject QawmiERP Bridge SDK right before </head> or at the top
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n${QAWMI_BRIDGE_SDK}`);
  } else {
    html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtmlAttr(title)}</title>${QAWMI_BRIDGE_SDK}</head><body>${html}</body></html>`;
  }

  const permissions = Array.isArray(manifest.permissions)
    ? manifest.permissions.filter((p): p is WidgetPermission =>
        (ALLOWED_WIDGET_PERMISSIONS as string[]).includes(String(p))
      )
    : [];

  const size: WidgetSize = manifest.size === "full" ? "full" : "half";

  return {
    ok: true,
    widget: {
      id: rawId.startsWith("custom-") ? rawId : `custom-${rawId}`,
      title,
      description: String(manifest.description || "").trim().slice(0, 240),
      version: String(manifest.version || "1.0.0").trim().slice(0, 24),
      author: String(manifest.author || "Custom Developer").trim().slice(0, 60),
      size,
      permissions,
      bundleHtml: html,
    },
  };
}

/**
 * Generates a working sample custom widget .zip archive for admins/developers to test immediately.
 */
export async function buildSampleWidgetZipBuffer(): Promise<Uint8Array> {
  const zip = new JSZip();

  const manifest: WidgetManifest = {
    id: "madrasa-live-pulse",
    name: "মাদরাসা লাইভ পালস (Sample Widget)",
    version: "1.0.0",
    description:
      "QawmiERP Read-Only ডেটা ব্রিজ ব্যবহার করে শিক্ষার্থী, উপস্থিতি ও আজকের আয়ের লাইভ কার্ড প্রদর্শন করে।",
    author: "QawmiERP SDK",
    entry: "index.html",
    size: "half",
    permissions: ["madrasa.read", "students.read", "attendance.read", "finance.read"],
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  zip.file(
    "style.css",
    `* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
body { margin: 0; padding: 16px; background: #f8fafc; color: #0f172a; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #d1fae5; color: #065f46; }
.title { font-size: 15px; font-weight: 700; margin: 0; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
.label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
.val { font-size: 18px; font-weight: 800; color: #0f172a; }
`
  );

  zip.file(
    "app.js",
    `document.addEventListener("DOMContentLoaded", function () {
  if (window.QawmiERP) {
    window.QawmiERP.onData(function (data) {
      document.getElementById("madrasa-name").textContent = data.madrasaName || "আমার মাদরাসা";
      document.getElementById("students").textContent = data.studentsCount ?? 0;
      document.getElementById("present").textContent = data.todayPresent ?? 0;
      document.getElementById("income").textContent = "৳ " + (data.todayIncome ?? 0);
      document.getElementById("teachers").textContent = data.teachersCount ?? 0;
    });
    window.QawmiERP.requestData();
  }
});
`
  );

  zip.file(
    "index.html",
    `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <title>Madrasa Live Pulse</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <div class="header">
      <h3 class="title" id="madrasa-name">লোড হচ্ছে...</h3>
      <span class="badge">ZIP Plugin Active</span>
    </div>
    <div class="grid">
      <div class="card"><div class="label">মোট শিক্ষার্থী</div><div class="val" id="students">—</div></div>
      <div class="card"><div class="label">মোট শিক্ষক</div><div class="val" id="teachers">—</div></div>
      <div class="card"><div class="label">আজকের উপস্থিতি</div><div class="val" id="present">—</div></div>
      <div class="card"><div class="label">আজকের আয়</div><div class="val" id="income">—</div></div>
    </div>
    <script src="app.js"></script>
  </body>
</html>
`
  );

  return zip.generateAsync({ type: "uint8array" });
}
