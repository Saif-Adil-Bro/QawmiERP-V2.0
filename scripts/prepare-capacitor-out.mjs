import fs from "node:fs";
import path from "node:path";
import { capacitorServerUrl } from "./capacitor-server-url.cjs";

const serverUrl = capacitorServerUrl();
const outDir = path.resolve(process.cwd(), "out");
const indexFile = path.join(outDir, "index.html");

fs.mkdirSync(outDir, { recursive: true });
// Keep the web reader and its dependency in sync, including for a static export.
for (const file of ["offline.html", "offline-portal.js", "offline-hifz.js", "hifz.css"]) {
  fs.copyFileSync(path.resolve("public", file), path.join(outDir, file));
}

// Capacitor's local errorPath cannot read a remote origin's IndexedDB. Even if a
// user was previously logged in, offer only a fresh app navigation, never history,
// referrer, a deep link, or a cached authenticated document. No bridge/JS required.
const start = serverUrl ? new URL("/login", serverUrl).href : "/";
const href = start
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const fallbackPage = (action) => `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="referrer" content="no-referrer" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
  <title>QawmiERP — সংযোগ নেই</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
      text-align: center;
    }
    .card {
      max-width: 420px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 28px 24px;
    }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #cbd5e1; }
    a { color: #a7f3d0; display: inline-block; padding: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>পোর্টাল খোলা যায়নি</h1>
    <p>এই পাতায় কোনো শিক্ষার্থীর সংরক্ষিত তথ্য দেখানো হয় না।</p>
    <p>সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</p>
    ${action}
  </div>
</body>
</html>
`;
fs.writeFileSync(
  path.join(outDir, "native-offline.html"),
  fallbackPage(`<a href="${href}">পোর্টালে ফিরুন</a>`),
);
// Do not overwrite a real static build, or bake an old server URL into its default page.
if (!fs.existsSync(indexFile)) {
  fs.writeFileSync(
    indexFile,
    fallbackPage("<p>এই বিল্ডে পোর্টাল চালাতে CAPACITOR_SERVER_URL দিয়ে পুনরায় বিল্ড করুন।</p>"),
  );
}
console.log("Prepared Capacitor offline assets.");
