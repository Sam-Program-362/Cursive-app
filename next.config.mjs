/**
 * The same codebase ships in two shapes:
 *
 *  - The hosted web app (`next build`): full Next.js server, including the
 *    `/api/*` route handlers used for Neon sync, the AI assistant proxy and
 *    GitHub push/pull.
 *  - The bundled Android app (`NEXT_STATIC_EXPORT=1 next build`): a fully
 *    static export that Capacitor copies into the APK. There is no server in
 *    the WebView, so the `/api/*` routes are not part of this build (the
 *    matching UI degrades to local-only mode).
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  ...(isStaticExport
    ? {
        // Emit plain HTML/CSS/JS into `out/` for Capacitor to bundle.
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
