import type { CapacitorConfig } from "@capacitor/cli";

import { capacitorServerUrl } from "./scripts/capacitor-server-url.cjs";

const serverUrl = capacitorServerUrl();

const config: CapacitorConfig = {
  appId: "com.qawmierp.app",
  appName: "QawmiERP",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: true,
    // A main-frame native error navigates to the *local* origin, not the failed URL.
    errorPath: "native-offline.html",
    // Android also uses server.url as a WebView allowed-origin rule (no path).
    ...(serverUrl ? { url: serverUrl.origin } : {}),
    ...(serverUrl && serverUrl.pathname !== "/" ? { appStartPath: serverUrl.pathname } : {}),
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#0f172a",
    },
  },
};

export default config;
