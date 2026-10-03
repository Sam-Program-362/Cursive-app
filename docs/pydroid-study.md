# Studying Pydroid 3 (v8.6) — notes for Cursive

**What this document is.** A plain-English write-up of how the Pydroid 3 Android
app is built and behaves, so we can copy the *ideas* (never the code or art) into
Cursive. Pydroid 3 is closed-source commercial software. I only *read* the
unpacked APK: the Android manifest, resource names and text, and the file list.
Nothing was copied, nothing calls Pydroid's servers, and the Pydroid repo is not a
dependency of this project.

**How I read it.** An APK is a zip. Inside it there is:

- `AndroidManifest.xml` — the app's "ID card": permissions, screens, services.
- `resources.arsc` — all the text the app shows (button labels, messages).
- `assets/` — files shipped with the app (here: the Python engine, packed).
- `lib/<cpu>/` — native code for each CPU architecture.
- `classes*.dex` — compiled Java/Kotlin code (not human-readable; I did not try
  to decompile it, and we are not allowed to copy it anyway).

Most resource *names* in this APK are deliberately scrambled (shuffled short
names like `res/9T.xml`), so I learned the behaviour mainly from the readable
message text and the component names.

---

## 0. How the app is put together (useful context)

- **One-screen-class app with many helper screens.** Main entry is
  `ru.iiec.pydroid.MainActivity`; settings is `ru.iiec.pydroid.PydroidSettings`;
  the package manager screen is `ru.iiec.pydroid.pipactivity.PipActivity`; the
  examples gallery is `qwe.qweqwe.texteditor.samples.SamplesActivity`; there is a
  first-run walkthrough `...ui.onboarding.OnBoardingActivity`.
- **A real terminal emulator is embedded.** Components `iiec.androidterm.Term`,
  `TermInternal`, `TermService`, `RunScript`, `RunShortcut`, `WindowList`. This is
  the classic "Terminal Emulator for Android" project, reused to run a shell.
- **Python is packaged as compressed bundles**, not loose files. Assets include
  `finalpackage3_arm64.tar.xz` (the Python 3 runtime + standard library) and
  `accomp_files.tar.xz`, plus `busybox`. The app unpacks them into its own
  storage on first run (there is an "Installing Python" / "Python successfully
  installed" screen). Native pieces live in `lib/arm64-v8a/`:
  `libpydr.so` (the Python engine), `libarchepydr.so`, `libandrobugz.so`
  (crash reporting), and the terminal `.so` files.
- **This build is arm64-only** (the version string is `8.06_arm64`). There is no
  32-bit or x86 code in this APK.
- **There is a small local web server** (`META-INF/nanohttpd`, the NanoHTTPD
  library). It is used by the "repository plugin" that fetches prebuilt library
  packages (see §3).
- It bundles a lot of commercial plumbing we do not need: Google Ads, Firebase
  messaging/analytics, Google Play Billing (for "premium"), and Picasso.

---

## 1. STORAGE — permissions, project location, dialogs, denied behaviour

### Permissions it requests

From the manifest (storage-relevant ones in bold):

- **`MANAGE_EXTERNAL_STORAGE`** — the "All files access" permission.
- **`READ_EXTERNAL_STORAGE`**, **`WRITE_EXTERNAL_STORAGE`** — the older, pre-Android-11
  way to read/write shared storage.
- The manifest also sets `requestLegacyExternalStorage="true"` and
  `preserveLegacyExternalStorage="true"` so older file-path behaviour keeps
  working after an update.
- Non-storage flags it also uses: `INTERNET`, `ACCESS_NETWORK_STATE`,
  `WAKE_LOCK` (keep the CPU awake while a script runs), `FOREGROUND_SERVICE`,
  `POST_NOTIFICATIONS`, `DUMP`, plus ad/billing/Firebase permissions.

It declares hardware features `android.hardware.touchscreen` and
`android.hardware.wifi`.

### Where projects live by default

Pydroid does **not** force one location; it lets you choose, and the message text
describes three kinds of folder:

1. **A public/shared folder** — "A folder that can *also* be accessed from other
   applications. All files copied here will be synchronized and available in
   `%1$s`." This is the classic external storage location you can see in a phone
   file manager (and, historically, in Google Drive sync).
2. **An app-private folder** — "A folder that is *not* accessible from other apps
   except file manager. Requires no synchronization, but will be removed on
   uninstall."
3. **A system-picked folder (Storage Access Framework)** — "A secure way to
   access files in any supported location. **Supports single files only (no
   projects).**"

So the default is effectively "pick a folder"; if you grant All-files access it
uses normal file paths (option 1), otherwise it runs in a restricted mode
(option 2/3).

### How Open / Save / Save As / Import are organised

The navigation menu (read from resource keys) has exactly these file actions:

- `nav_new_file`, `nav_open_file`, `nav_save_file`, `nav_save_file_as`
- `nav_recent_files` — "Recent files" (message "No recent files found" exists)
- `nav_sample_files` and `nav_examples` — bundled example programs (there are
  **64** `example_*` files in `assets/examples`)
- `nav_run_terminal`, `nav_run_logs`, `nav_run_pip`, `nav_python_interpreter`
- `nav_settings`, `nav_terminal_settings`, `nav_share_button`, `nav_pastebin`,
  `nav_more_ides`, `nav_get_premium`, `nav_feedback`, `nav_privacy_policy`

The file dialogs themselves are the familiar shape: **New folder**, **Rename**,
**Save as**, **Import**, a confirmation for **Overwrite** ("This name is already
used in this folder, do you want to overwrite it?"), an **Open file error**
message, and a path/command dialog. Pydroid uses a reusable "pick a directory"
screen (`com.getdirectory.GetFileActivity`) and a share/FileProvider to hand
files to other apps.

### What happens when permission is denied

It keeps working, in a limited mode, and nags politely:

- "All files access is required!"
- "To manage files, grant the app permission to access all files in the settings"
- Button **Grant Permissions** / **Allow permission**.
- "`%1$s` is currently running in the **Scoped Storage mode**. If you want it to
  have full storage access, please click Grant permissions button below."
- "Running without permission" and **Scoped Storage Info** help screens.
- On Android 11+ you cannot pop the permission dialog directly — the app has to
  send you to the Settings screen, hence the wording above.

**Take-away:** Pydroid asks for full storage access first, and only falls back to
scoped/app-private access if you refuse.

---

## 2. RUNNING CODE — launch, working directory, input, stop

### How a script is launched

Two routes, both visible in the menus:

1. **Editor "Run"** — runs the current file with the chosen interpreter.
2. **Terminal** — `iiec.androidterm` windows; you can run `RunScript`/`RunShortcut`
   and even open extra command windows. The terminal can run arbitrary commands
   and a full shell.

The "interpreter" is selectable (`nav_python_interpreter`, `pref_interpreter_name`),
and there is an **"Initial command"** preference that is run automatically when a
terminal opens, plus settings to **prepend directories to PATH**
(`allow_prepend_path`) and to treat certain extensions as executable
(`do_path_extensions`).

### Working directory

The terminal runs relative to a chosen directory, and command windows require
full paths ("Command window requires full path, no arguments. For other commands
use Arguments window (ex: `cd /sdcard`)"). In practice the working directory is
the folder the script/terminal was opened in — i.e. **the project folder**, so
`open("data.txt")` and `import utils` work relative to it.

### stdin / `input()`

There is a persistent console/terminal that receives output, and `input()` is
served through it (or through a prompt dialog). The app has a lot of
**keyboard plumbing** — a "control key", "FN keys", and an "IME" setting — with a
big mapped list, e.g. `FNKEY E : Control-[ (ESC)`, `FNKEY T : Tab`,
`FNKEY A/D : Left/Right`, `FNKEY W/S : Up/Down`, `FNKEY 1..9 : F1-F9`. This exists
because a soft keyboard has no Ctrl/Esc/arrow keys, and Python editing needs them.

### Stop

Avoiding running away: terminal windows can be closed ("Closes this terminal
window only"), there is a "close window on process exit" preference, and the
long-running service (`WAKE_LOCK`, foreground service) is managed so the CPU
stays awake while a script runs.

---

## 3. PACKAGES — how the "pip" experience works

Menus/strings involved: `nav_run_pip`, `ru.iiec.pydroid.pipactivity.PipActivity`,
"Quick Install", "install_pydroid_quick_install_repository_*".

Key facts from the app text:

- **"Quick Install" is the headline feature:** "install most popular libraries in
  just two clicks". A screen lists popular libraries and installs them for you.
- It relies on a **"repository plugin"**: "An additional plugin is required to
  install libraries from Quick Install repository, because apps are forbidden to
  download executable code directly." That is the Google Play policy that bars a
  downloadable-code store inside an app. Their workaround is a plugin plus a
  **local NanoHTTPD server** to fetch prebuilt wheel packages.
- The dialog offers: "Do you want to install it from Quick Install?", "Do you
  want to install missing libraries now?", "No libraries installed yet, so
  nothing to add", "Do you want to keep all installed libraries?" (on upgrade),
  and an **"enter pip command"** box for manual installs.
- Some libraries are gated behind **premium** ("This library is currently
  provided as a part of premium features").

**What this implies for us:** the *user experience* (a searchable Packages screen
with Install / Uninstall / list, plus a Quick-Install list of popular libraries)
is easy to understand and worth copying. The *mechanism* (a bundled plugin and
server that downloads compiled code) is both legally and technically awkward, so
Cursive should not reproduce it — see the Phase 6 ideas below.

---

## 4. FEATURES WORTH MATCHING — ranked by usefulness to a learner

1. **Real files and real folders (full storage access).** This is the single
   biggest reason Pydroid feels like a desktop: your code lives in normal files
   you can also see in a file manager, and `open()`/`import` use real paths.
2. **A working console that supports `input()` and Cancel/Stop.** Beginners hit
   `input()` in their first lesson.
3. **Open / Save / Save As / Recent files / Import.** Basic but essential, and
   the "remember last folder" behaviour matters.
4. **A straightforward way to install popular libraries** (the Quick-Install
   idea, without the shady download mechanism).
5. **Editor comfort:** autocomplete, auto-close quotes/brackets, tab-vs-spaces,
   font size, cursor style, light/dark editor theme.
6. **Extra keys / special-key row** (Ctrl, Esc, Tab, arrows) because soft
   keyboards lack them.
7. **Bundled Examples** (64 sample programs) — great for learning, and they stay
   separate from your own files.
8. **"Open with" support:** Pydroid registers `text/x-python` plus `.py` path
   patterns, so tapping a `.py` file in a file manager or email opens it in
   Pydroid.
9. **A real terminal** for advanced users (nice-to-have, higher effort).
10. **Run logs / interpreter info** (nice-to-have).

Premium-only extras (no ads, more libraries) are commercial, not useful features.

---

## 5. HOW CURSIVE SHOULD DO EACH ONE (standard Android APIs + Chaquopy)

Everything below uses only documented Android APIs and the Chaquopy engine Cursive
already ships. No Pydroid code or servers.

### 5.1 Storage

- **First run:** show a short explanation, then request **All files access** by
  sending the user to
  `Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION` (Android 11+). Check it
  with `Environment.isExternalStorageManager()`. This is allowed for a sideloaded
  app; Play Store rules do not apply to us.
- **Default workspace:** `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)/Cursive`
  so it appears in the phone's file manager. Changeable in Settings.
- **If denied:** fall back to the app's own external folder
  (`getExternalFilesDir(null)`) **plus** the system folder picker
  (`Intent.ACTION_OPEN_DOCUMENT_TREE`, then
  `takePersistableUriPermission`), and tell the user exactly what is limited
  (only the folders they picked; Python code runs against copied/streamed files).

### 5.2 File dialogs (Open / Save / Save As / Import / Export)

- When we have full access: a **built-in browser** over real `File` paths
  (navigate, go up, New folder, Rename, Delete, sort, show full path, remember
  last folder).
- When we don't: the built-in SAF pickers (`ACTION_OPEN_DOCUMENT`,
  `ACTION_CREATE_DOCUMENT`, `ACTION_OPEN_DOCUMENT_TREE`) with persisted access.
- "Share/Open with" uses a small `FileProvider` (`androidx.core.content.FileProvider`).

### 5.3 Running code

- Already done with Chaquopy. Keep: write the file into the project folder, set the
  **working directory to the script's folder**, put that folder on `sys.path`, then
  `exec` the file. `input()` is served by the in-app console (already implemented
  via the `inputRequest` event + Stop button).
- Add a real **Stop** that interrupts the running script (already implemented with
  a trace-based stop sentinel).

### 5.4 "Open with" (.py from other apps)

- Add an intent filter on the main activity: `ACTION_VIEW`, `mimeType`
  `text/x-python`, plus `scheme="content"`/`"file"` and a `.py` path pattern, with
  `CATEGORY_DEFAULT`. On receipt, copy/read the incoming URI
  (`ContentResolver.openInputStream`) and open it in a new tab.

### 5.5 Secrets

- A small Android-side plugin backed by the **Android Keystore**
  (`AndroidKeyStore`) plus `EncryptedSharedPreferences` for the GitHub token and
  AI keys. Never `localStorage`, never the repo. Trim whitespace/newlines on paste.

### 5.6 Packages (see Phase 6 for the full plan)

- **Runtime:** download pure-Python wheels (`py3-none-any`) from PyPI into an
  app-storage `site-packages`, add it to `sys.path`. Works for pure-Python
  libraries; honest "not available on Android" for compiled ones.
- **Build-time:** bundle the handful of prebuilt Android wheels Chaquopy's own
  package index offers (verify the current address/versions before committing).
- Present the same **simple screen** as Pydroid (search / install / uninstall /
  list) but with our own implementation and no external repository server.

---

*Prepared for Phase 0 of the Cursive v2 work. Report only — no app changes were
made while producing this document.*
