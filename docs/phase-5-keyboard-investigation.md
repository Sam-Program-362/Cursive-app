# Phase 5 — On-screen keyboard investigation (report only)

Status: **investigation only. No editor migration was performed.**
Scope: how Cursive's Monaco editor behaves with the Android soft keyboard, why
typing can misbehave, and what the realistic fixes are.

> Honesty note: this environment has no Android device or emulator, so the
> findings below come from the current code, Monaco's model of input, and
> documented Android WebView behaviour. The "what to test" checklist at the end
> is what a real device run needs to confirm or rule out each item.

## What we have today

- `src/components/Editor/CodeEditor.tsx` renders Monaco (`monaco-editor` 0.57)
  inside the Capacitor WebView, self-hosted from `/monaco/vs`.
- `android/app/src/main/AndroidManifest.xml` sets
  `android:windowSoftInputMode="adjustResize"` on `MainActivity`.
- `CodeEditor.tsx` listens to `window.visualViewport` `resize`/`scroll` and calls
  `revealLineInCenterIfOutsideViewport` so the caret stays above the keyboard.
- `QuickKeyBar` already inserts characters through the Monaco API
  (`editor.executeEdits` via the app, not through the IME).

## How Monaco gets text from an Android keyboard

Monaco does **not** use a `contenteditable` region. It renders an invisible
`<textarea class="inputarea">`, focuses it, and mirrors typing into the model:

- Printable text arrives as `beforeinput` / `input` events (and, during IME
  composition, `compositionstart/update/end`).
- Key bindings are driven by `keydown`. On many Android soft keyboards
  (Gboard, SwiftKey, Samsung) **`keydown` reports `keyCode` 229 for every key**
  — the "all-229 problem" — so Monaco cannot tell which key was pressed.

## Root causes of the common complaints

1. **Dropped / duplicated / reordered characters.**
   Android IMEs deliver text through composition, and the WebView can fire
   `input` events out of order relative to Monaco's internal read of the
   textarea. This is the classic WebView + synthetic-textarea bug and is the
   single most-reported Monaco-on-Android issue.

2. **Autocorrect / auto-capitalise mangling code.**
   If the hidden textarea is not explicitly opted out, the IME will capitalise
   the first letter of a line, replace `for`/`if` with dictionary words, and
   insert smart quotes. Symptoms: `Print(...)` instead of `print(...)`, curly
   `’` instead of `'`.

3. **Cursor jumps / lost caret.**
   Each `input` event makes Monaco resync the textarea to the model; if the DOM
   selection moved in between (keyboard show/hide triggers a viewport resize),
   the caret lands in the wrong place.

4. **Enter / backspace / arrow keys.**
   Because of the 229 problem, hardware-style key handling is unreliable; the
   `QuickKeyBar` and IME's own keys are what actually work.

5. **`formatOnType` + IME.**
   `formatOnType: true` (our default) re-formats *on every typed character*.
   Combined with composition this can visibly rewrite the line mid-type.

## Android `editContext`

Chrome 121+ ships the **EditContext** API, and Monaco can optionally use it
(`experimentalEditContextEnabled`). It is **not** a fix on Android:

- Android WebView tracks Chrome, but EditContext does not bypass the IME — text
  still arrives through the same composition pipeline.
- It changes *how the editable region is presented*, not how the IME composes.
- Enabling it is unproven on device and would be a behaviour change we cannot
  validate here.

`selectionchange` / `beforeinput` handling is already the mechanism Monaco uses;
there is no additional hook that removes the composition problem.

## Options, ranked

**A. Targeted, low-risk hardening (do now).**
Keep Monaco and:
- After mount, force the hidden input area to opt out of IME assistance:
  `document.querySelector(".monaco-editor textarea.inputarea")` →
  set `autocorrect="off"`, `autocomplete="off"`, `autocapitalize="off"`,
  `spellcheck="false"`, `inputmode="text"`, `data-gramm="false"`.
- Turn `formatOnType` **off** on Android (keep it on the web) so the model is
  never rewritten while an IME is composing.
- Treat `QuickKeyBar` as the primary mobile input (it already inserts through
  the API and bypasses the IME entirely) and surface it more prominently.
- Keep the `visualViewport` caret reveal and `adjustResize`.

**B. CodeMirror 6 migration (revisit only if A is not enough).**
CM6 uses a `contenteditable` region observed with a DOM `MutationObserver` and
has first-class mobile/IME handling — it is the editor most Android editor apps
settle on. But it is a rewrite, not a patch:
- new editor component and styling (themes, padding, gutter);
- re-implement the Python IntelliSense provider, snippets, and the
  `QuickKeyBar`/indent/undo/redo API that today call Monaco commands;
- re-implement read-only example files and the reveal-caret-on-keyboard logic;
- re-verify every editor-dependent feature (`handleInsertText`,
  `handleContentChange`, formatting, Ctrl+Enter run).

Rough effort: **2–4 focused days** plus a regression pass on all editor
features, i.e. a real risk to working functionality for an unproven gain.

## Recommendation

**Do not migrate yet.** Apply option A (small, reversible, no feature
regression) and confirm on a real device. Only start the CM6 migration if
testing shows the composition bugs survive the hardening, and then treat it as
its own phase with a full editor regression pass.

## What to test on the device (per keyboard: Gboard + the stock keyboard)

1. Type `print("hello")` — are quotes straight (`"`) and is `print` lower-case?
2. Type a multi-line function with indentation — do characters drop/duplicate?
3. Use swipe/glide typing and voice input into the editor — does text land
   cleanly or scramble?
4. Tap mid-line and type — does the caret stay put?
5. Use Enter, Backspace and the arrow keys — do they behave?
6. Hardware/Bluetooth keyboard (if available) — does it still work correctly?
7. Confirm the caret stays above the keyboard when it opens.

Report which of these fail and with which keyboard; that decides A vs B.
