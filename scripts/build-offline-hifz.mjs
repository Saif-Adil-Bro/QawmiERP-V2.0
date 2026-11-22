import { build } from "esbuild";
// Deliberately use same-origin relative URLs in the authenticated offline shell.
await build({
  entryPoints: ["components/hifz/offline-reader.tsx"],
  outfile: "public/offline-hifz.js",
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "esm",
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_API_URL": '""',
    "process.env.NEXT_PUBLIC_MOBILE_API_KEY": '""',
  },
});
