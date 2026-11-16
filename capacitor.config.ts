import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.qawmierp.app',
  appName: 'QawmiERP',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true,
    ...(serverUrl && !serverUrl.includes('your-domain.com')
      ? { url: serverUrl }
      : {}),
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
