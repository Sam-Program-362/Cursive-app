import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for the Android build (Cursive.apk).
 *
 * The native app loads the same live editor as the web app, so editor fixes
 * ship instantly without rebuilding the APK. The bundled `webDir` is only a
 * placeholder that Capacitor requires to exist.
 */
const config: CapacitorConfig = {
  appId: "com.cursive.app",
  appName: "Cursive",
  webDir: "public",
  server: {
    url: "https://cursive-coding.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#1a1b2e",
    allowMixedContent: false,
  },
};

export default config;
