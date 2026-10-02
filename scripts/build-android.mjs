/**
 * Build the web assets that get bundled *inside* the Android APK.
 *
 * 1. Copy the Monaco runtime into `public/` so the editor is self-hosted.
 * 2. Run `next build` with `NEXT_STATIC_EXPORT=1`, which emits a fully static
 *    site into `out/` (see `next.config.mjs`).
 *
 * Capacitor's `webDir` points at `out/`, so `npx cap sync android` bakes these
 * files into the APK — the app no longer loads the remote live site.
 */
import { spawn } from "node:child_process";

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function main() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";

  await run(process.execPath, ["scripts/copy-monaco.mjs"]);
  await run(npm, ["exec", "--", "next", "build"], {
    NEXT_STATIC_EXPORT: "1",
  });

  console.log("Static Android web bundle written to out/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
