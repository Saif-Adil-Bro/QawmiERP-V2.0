import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "out");
const indexFile = path.join(outDir, "index.html");

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(indexFile)) {
  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>QawmiERP</title>
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
    code { background: #0f172a; padding: 2px 6px; border-radius: 6px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>QawmiERP Android</h1>
    <p>সার্ভার URL কনফিগার করা নেই অথবা ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।</p>
    <p>বিল্ড করার সময় <code>CAPACITOR_SERVER_URL</code> সেট করুন।</p>
  </div>
</body>
</html>
`;
  fs.writeFileSync(indexFile, html, "utf8");
  console.log("Generated fallback out/index.html for Capacitor.");
}
