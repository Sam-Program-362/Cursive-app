import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Version 1 of the Android app intentionally loads the deployed Cursive site.
 * This means saving, the database, GitHub sync, and web updates continue to
 * use the same service as the browser version.
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
    allowMixedContent: false,
  },
};

export default config;
