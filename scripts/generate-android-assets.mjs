/**
 * Generate Android launcher icons and splash screens from the web app icon.
 *
 * Run with:  node scripts/generate-android-assets.mjs
 * (sharp is a devDependency; the generated PNGs are committed.)
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RES = path.join(ROOT, "android/app/src/main/res");
// Generate Android resources directly from the authoritative, complete source canvas.
const SOURCE = path.join(
  ROOT,
  "Temporary folder for logo/cursive-logo-exact-source-1536.png"
);

/** Brand background — matches the web app's slate/indigo theme. */
const BRAND = { r: 0x1a, g: 0x1b, b: 0x2e, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const LAUNCHER = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

/** Adaptive-icon foreground canvas is 108dp. */
const FOREGROUND = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const SPLASH = {
  "port-mdpi": [320, 480],
  "port-hdpi": [480, 800],
  "port-xhdpi": [720, 1280],
  "port-xxhdpi": [960, 1600],
  "port-xxxhdpi": [1280, 1920],
  "land-mdpi": [480, 320],
  "land-hdpi": [800, 480],
  "land-xhdpi": [1280, 720],
  "land-xxhdpi": [1600, 960],
  "land-xxxhdpi": [1920, 1280],
};

async function logo(size, padding = 0) {
  const inner = Math.max(1, Math.round(size * (1 - padding)));
  const buffer = await sharp(SOURCE)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  if (padding === 0) return buffer;
  return sharp({
    create: { width: size, height: size, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: buffer, gravity: "center" }])
    .png()
    .toBuffer();
}

async function write(relativePath, buffer) {
  const target = path.join(RES, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
}

async function squareIcon(size) {
  const inner = await logo(size, 0.28);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
}

async function roundIcon(size) {
  const square = await squareIcon(size);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>
     </svg>`
  );
  return sharp(square)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function foregroundIcon(size) {
  // Keep the artwork inside the adaptive-icon safe zone (~66%).
  const inner = await logo(size, 0.44);
  return sharp({
    create: { width: size, height: size, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
}

async function splash(w, h) {
  const inner = await logo(Math.min(w, h), 0.72);
  return sharp({
    create: { width: w, height: h, channels: 4, background: BRAND },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  for (const [density, size] of Object.entries(LAUNCHER)) {
    await write(`mipmap-${density}/ic_launcher.png`, await squareIcon(size));
    await write(`mipmap-${density}/ic_launcher_round.png`, await roundIcon(size));
  }

  for (const [density, size] of Object.entries(FOREGROUND)) {
    await write(
      `mipmap-${density}/ic_launcher_foreground.png`,
      await foregroundIcon(size)
    );
  }

  for (const [folder, [w, h]] of Object.entries(SPLASH)) {
    await write(`drawable-${folder}/splash.png`, await splash(w, h));
  }

  // Density-less fallback (treated as mdpi) — matches the Capacitor template.
  await write("drawable/splash.png", await splash(480, 320));

  console.log("Android icons and splash screens generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
