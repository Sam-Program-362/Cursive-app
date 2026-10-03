import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for the Android build (Cursive.apk).
 *
 * The editor is bundled *inside* the APK: `webDir` points at the static
 * export produced by `npm run build:android` (Next.js writes it to `out/`),
 * and `npx cap sync android` copies it into the app. There is intentionally no
 * `server.url` — the app never loads the remote live site, so it starts fast
 * and keeps working offline.
 */
const config: CapacitorConfig = {
  appId: "com.cursive.app",
  appName: "Cursive",
  webDir: "out",
  android: {
    backgroundColor: "#1a1b2e",
    allowMixedContent: false,
  },
  plugins: {
    // Route calls to external APIs (GitHub, AI providers) through the native
    // HTTP bridge so they are not blocked by WebView CORS rules.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
