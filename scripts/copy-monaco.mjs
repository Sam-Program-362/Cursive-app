/**
 * Copy the Monaco Editor runtime into `public/monaco/vs`.
 *
 * Cursive configures Monaco to load from `/monaco/vs` (see the `loader.config`
 * call in `src/components/Editor/CodeEditor.tsx`) instead of the CDN. That makes
 * the editor fully self-hosted, which is what lets the bundled Android APK
 * open the editor without fetching anything from `cursive-coding.vercel.app`.
 *
 * The copied files are large (~25 MB) and are git-ignored; they are regenerated
 * by `predev` / `prebuild` and by `scripts/build-android.mjs`.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "node_modules/monaco-editor/min/vs");
const DEST = path.join(ROOT, "public/monaco/vs");
const MARKER = path.join(ROOT, "public/monaco/.version");

async function currentVersion() {
  const raw = await readFile(
    path.join(ROOT, "node_modules/monaco-editor/package.json"),
    "utf8"
  );
  return JSON.parse(raw).version;
}

async function main() {
  if (!existsSync(SOURCE)) {
    throw new Error(
      "monaco-editor is not installed. Run `npm install` before building."
    );
  }

  const version = await currentVersion();

  if (existsSync(MARKER)) {
    const installed = (await readFile(MARKER, "utf8")).trim();
    if (installed === version && existsSync(path.join(DEST, "loader.js"))) {
      return;
    }
  }

  await rm(path.join(ROOT, "public/monaco"), { recursive: true, force: true });
  await mkdir(path.dirname(DEST), { recursive: true });
  await cp(SOURCE, DEST, { recursive: true });
  await writeFile(MARKER, `${version}\n`);

  console.log(`Monaco Editor ${version} copied to public/monaco/vs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
