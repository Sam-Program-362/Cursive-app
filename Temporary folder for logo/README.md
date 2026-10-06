# Cursive — Exact Logo Assets v2

These assets are generated directly from the supplied high-resolution logo image (`cursive-logo-exact-source-1536.png`).

## Important
- No logo recreation.
- No vector redraw.
- No crop.
- No stretch or squeeze.
- No zooming into the artwork.
- The entire 1536×1536 source canvas is preserved at every output size.
- Every production asset is a square resize of the exact same source image using high-quality Lanczos resampling.
- The black background is part of the supplied source image and is intentionally preserved.

## Assets
- `icon-1024.png` — high-resolution master
- `icon-512.png` — primary PWA/Android generation source
- `icon-192.png` — PWA icon
- `maskable-512.png` — maskable icon; same full-canvas artwork, no crop
- `apple-touch-icon.png` — Apple touch icon
- `favicon-32.png` — favicon
- `cursive-logo-exact-source-1536.png` — original supplied source, unchanged

## Integration
Copy the corresponding files into `Cursive-app/public/` and run:

`node scripts/generate-android-assets.mjs`

Then verify the generated Android assets visually. Do not recreate `icon.svg` from the raster image. If the project still has references to `public/icon.svg`, handle those references separately rather than inventing a new logo.

## Source
The source image is kept in this package unchanged so there is an auditable master for future asset generation.
