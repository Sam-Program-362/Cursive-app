# Phase 6 — Pydroid-style package installs: feasibility assessment

Verdict up front: **a full "quick install any package from a repository" feature
like Pydroid 3 is not worth building for this APK, and arbitrary runtime `pip`
is not technically achievable with our Python engine.** A smaller, honest
version *is* worth it: bundle a curated set of libraries at build time, and
optionally add a runtime installer limited to **pure-Python** wheels.

## Why the full Pydroid model does not carry over

Pydroid ships its own package repository, a local HTTP server and a custom
installer because it controls its own Python runtime image. Cursive uses
**Chaquopy**, which deliberately installs packages at **build time**:

- Chaquopy runs `pip.install(...)` while Gradle is building the APK. The
  resulting pure-Python packages and pre-built native `.so` files are baked into
  the app for each ABI we ship (`arm64-v8a`, `x86_64`).
- There is **no `pip` on the device** and Chaquopy does not support runtime
  `pip install`. We cannot add one without reimplementing a dependency resolver,
  wheel unpacker and native-library loader ourselves.
- Any package with native code must be compiled for our exact ABIs and Python
  3.12; a random wheel from PyPI that says `cp312` for a different ABI, or an
  `sdist`, cannot be used on the device.

## Options

### A. Curated build-time bundle — recommended, low risk

Add a handful of common, mostly pure-Python libraries in the Chaquopy block of
`android/app/build.gradle`:

```gradle
chaquopy {
    defaultConfig {
        version = "3.12"
        pip {
            // install "requests"
            // install "beautifulsoup4"
            // install "pyperclip"
        }
    }
}
```

- Pros: works offline, no runtime installer, no security surface, small and
  predictable. `requests`, `beautifulsoup4`, `python-dateutil`, etc. are
  pure-Python and bundle cleanly; Chaquopy also provides prebuilt native
  packages (e.g. `numpy`) if we ever want them.
- Cons: fixed set, decided by us, not the user; each added package grows the APK.

### B. Runtime installer for pure-Python wheels only — optional, medium effort

A small Python module (bundled in assets) that:

1. queries the PyPI JSON API for a package,
2. picks the `py3-none-any` wheel (pure Python only),
3. downloads it, unzips it into the app's files dir,
4. appends that dir to `sys.path`.

- Pros: users can install *some* packages themselves; no native code.
- Cons: pure-Python only (no numpy/pandas/pillow), no real dependency
  resolution, needs network, and a runtime-downloaded-code story that Google
  Play policy discourages (it briefly reads as "downloading executable code").
  Because Cursive is sideloaded, the policy risk is low, but the functional
  limits remain.

### C. Full Pydroid-style manager — not recommended

Needs a bundled index, per-ABI native wheel builds, conflict handling and a
maintenance burden that vastly exceeds the value for a code-learning editor.

## Recommendation

1. **Now (when wanted, ~30 min):** add option A with a small curated list so
   common libraries just import. Keep it explicit and documented in-app.
2. **Later, only if users ask:** add option B scoped strictly to pure-Python
   wheels, clearly labelled "pure-Python packages only".
3. **Do not** attempt option C or runtime `pip`.

This is an honest "partly feasible": a curated bundle is easy and safe; a
self-service installer is possible only for pure-Python packages and is a
borderline trade-off, not the Pydroid experience.
