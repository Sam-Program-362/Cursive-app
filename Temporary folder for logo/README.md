# Cursive — Exact Logo Fixed

This package is a corrected extraction of the **exact Cursive logo shown in the approved presentation image**.

Important:
- This is NOT a recreated SVG.
- The logo geometry, cursor, glow, gradient, and proportions are preserved from the supplied visual.
- Only the crop and raster sizes were corrected.
- `icon-512.png` is the recommended source for the current Cursive app asset pipeline.

## Files
- `icon-512.png` — primary app/PWA source
- `icon-192.png` — PWA
- `maskable-512.png` — maskable PWA/Android source
- `apple-touch-icon.png` — iOS
- `favicon-32.png` — browser favicon
- `icon-1024.png` — high-resolution reference
- `cursive-logo-exact-reference.png` — exact crop before resizing

## Integration
In `Cursive-app`:
1. Replace `public/icon-512.png` with this `icon-512.png`.
2. Replace `public/icon-192.png`, `public/maskable-512.png`, `public/apple-touch-icon.png`, and `public/favicon-32.png` with the matching files.
3. Keep the existing `scripts/generate-android-assets.mjs` pipeline; it uses `public/icon-512.png` as its source.
4. Run the existing Android asset generation/build process.
5. Do NOT use the earlier hand-drawn SVG as the production icon if the goal is to preserve this exact visual.

Note: because this is an exact raster extraction, `icon.svg` should not be treated as the source of truth for this particular version. The 512px PNG is the source asset.
