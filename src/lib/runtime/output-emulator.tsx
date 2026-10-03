/** Minimal dependency-free terminal emulation for the Run-output panel.

The Run output panel used to append raw text into a <div>, so every \r, \b and
\x1b[...] sequence was shown literally. This module replaces that plain append
with a small VT100/ANSI state machine:

  - Output is a 2D buffer: an array of lines, each line an array of cells. A
    cell is a character plus the SGR attributes it was written with.
  - A cursor (row, col) tracks the insertion point. Incoming text is consumed
    token by token:
        LF  -> move to the next line (created when needed)
        CR  -> move to column 0 of the *current* line (no new line is created)
        BS  -> move one column left (the caller erases by writing a space)
        TAB -> advance to the next multiple of 8
        any other printable character -> placed at the cursor, overwriting
        whatever was there, then the cursor advances
  - ANSI escape sequences that are understood:
        CSI 2 K     erase the whole line          CSI K   erase cursor -> EOL
        CSI <n> A   cursor up n lines (default 1) CSI <n> B cursor down n
        CSI <n> C   cursor right n                CSI <n> D cursor left n
        CSI <n> G   move to column n (1-based)     CSI <n> H  move to row/col
        CSI <n> J   erase display (0/1/2)
        SGR 30-37 / 90-97   set foreground colour
        SGR 0        reset all attributes
        SGR 1/2/3/4/7/9 and 22/23/24/27/29
                   bold / dim / italic / underline / inverse / strikethrough
                   plus their "off" counterparts
    Anything else is silently stripped so it can never appear as garbage.
  - Incremental rendering: after each write the emulator knows exactly which
    lines changed and gives those lines a fresh array identity. Combined with
    the memoised TerminalLine below, untouched lines are skipped by React, so a
    per-second counter or a tight progress-bar loop only costs the lines it
    actually modified.

Why not xterm.js (MIT, the reference emulator)? It renders into its own
canvas/DOM output element and owns its own theming, which cannot inherit this
panel's Tailwind dark-terminal styling without replacing the Output tab's
container wholesale. The escape surface that Python's print/progress libraries
actually use is small and fully described by the decades-old public VT100/ANSI
standard, so a focused tokenizer is the better fit. The parser follows the
published ECMA-48 / VT100 grammar rather than being tuned to a few examples.
*/

import React, { useCallback, useMemo, useRef, useState } from "react";

/** Control characters built by code point, so no source-level escapes are
 *  needed and the literal bytes stay out of this file. */
const ESC = String.fromCharCode(27);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BS = String.fromCharCode(8);
const DEL = String.fromCharCode(127);
const TAB = String.fromCharCode(9);
const SPACE = " ";

/** CSI introducer: ESC '[' parameter-bytes intermediate-bytes final-byte. */
const CSI_RE = new RegExp("^" + ESC + "\\[([0-9;?<>=]*)([ -/]*)([@-~])");

/**
 * "String" escapes - OSC / DCS / SOS / PM / APC - e.g. `\x1b]0;title\x07`.
 * The payload is a window title or an icon name that never belongs on screen,
 * and the sequence ends at BEL or ST (ESC backslash). Matched before the
 * generic escape rule because `]`/`P`/`^`/`_` are themselves final bytes.
 */
const STRING_ESCAPE_RE = new RegExp(
  "^" + ESC + "[\\]P^_][^\\x1b]*(?:\\x07|\\x1b\\\\|$)"
);

/**
 * Every other well-formed escape, per ECMA-48: ESC followed by a final byte
 * (0x30-0x7E), or by one or more intermediate bytes (0x20-0x2F) and a final
 * byte. This correctly swallows all three bytes of things like `ESC ( B`
 * (designate charset), which a naive two-byte match would leak the `B`.
 */
const ESCAPE_RE = new RegExp("^" + ESC + "(?:[ -/]+[@-~]|[@-~])");

/* ------------------------------------------------------------------ */
/* Cells and pen state                                                 */
/* ------------------------------------------------------------------ */

export interface Cell {
  /** The character. */
  ch: string;
  /** Tailwind text-colour class from the active SGR state, or null. */
  fg: string | null;
  /** Tailwind background-colour class from the active SGR state, or null. */
  bg: string | null;
  /** Bold / dim / italic / underline / inverse / strikethrough styling. */
  style: React.CSSProperties | null;
}

/** Mutable pen state carried between writes. */
interface PenState {
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  strike: boolean;
}

function newPen(): PenState {
  return {
    fg: null,
    bg: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
    strike: false,
  };
}

/** SGR 30-37 (standard) and 90-97 (bright) foreground colours. */
const SGR_FG: Record<number, string> = {
  30: "text-slate-500",
  31: "text-red-400",
  32: "text-green-400",
  33: "text-yellow-400",
  34: "text-blue-400",
  35: "text-fuchsia-400",
  36: "text-cyan-400",
  37: "text-slate-200",
  90: "text-slate-400",
  91: "text-red-300",
  92: "text-green-300",
  93: "text-yellow-300",
  94: "text-blue-300",
  95: "text-fuchsia-300",
  96: "text-cyan-300",
  97: "text-slate-100",
};

/** SGR 40-47 and 100-107 background colours. */
const SGR_BG: Record<number, string> = {
  40: "bg-slate-500/25",
  41: "bg-red-400/25",
  42: "bg-green-400/25",
  43: "bg-yellow-400/25",
  44: "bg-blue-400/25",
  45: "bg-fuchsia-400/25",
  46: "bg-cyan-400/25",
  47: "bg-slate-200/25",
  100: "bg-slate-400/25",
  101: "bg-red-300/25",
  102: "bg-green-300/25",
  103: "bg-yellow-300/25",
  104: "bg-blue-300/25",
  105: "bg-fuchsia-300/25",
  106: "bg-cyan-300/25",
  107: "bg-slate-100/25",
};

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

export type Token =
  | { kind: "text"; value: string }
  | { kind: "lf" }
  | { kind: "cr" }
  | { kind: "bs" }
  | { kind: "tab" }
  | { kind: "sgr"; params: number[] }
  | { kind: "eraseLine"; mode: number }
  | { kind: "eraseDisplay"; mode: number }
  | { kind: "cursorUp"; n: number }
  | { kind: "cursorDown"; n: number }
  | { kind: "cursorRight"; n: number }
  | { kind: "cursorLeft"; n: number }
  | { kind: "cursorColumn"; col: number }
  | { kind: "cursorTo"; row: number; col: number };

/** Parse "\x1b[1;31m"-style parameters into numbers. */
function parseParams(raw: string): number[] {
  if (!raw) return [];
  return raw.split(";").map((part) => {
    const n = Number(part);
    return Number.isFinite(n) ? n : 0;
  });
}

/**
 * Split raw output into tokens. Unknown escape sequences are dropped; other C0
 * control characters are dropped too, so nothing unprintable reaches the screen.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let text = "";
  let i = 0;

  const flushText = () => {
    if (text) {
      tokens.push({ kind: "text", value: text });
      text = "";
    }
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === LF) {
      flushText();
      tokens.push({ kind: "lf" });
      i += 1;
    } else if (ch === CR) {
      flushText();
      tokens.push({ kind: "cr" });
      i += 1;
    } else if (ch === BS || ch === DEL) {
      flushText();
      tokens.push({ kind: "bs" });
      i += 1;
    } else if (ch === TAB) {
      flushText();
      tokens.push({ kind: "tab" });
      i += 1;
    } else if (ch === ESC) {
      const rest = input.slice(i);
      const csi = CSI_RE.exec(rest);

      if (csi) {
        const params = parseParams(csi[1]);
        const final = csi[3];
        const first = params.length > 0 ? params[0] : undefined;
        // CSI with no numeric parameter behaves as 1 for cursor motion.
        const n = first === undefined || first === 0 ? 1 : first;

        flushText();
        switch (final) {
          case "m":
            tokens.push({ kind: "sgr", params: params.length ? params : [0] });
            break;
          case "K":
            tokens.push({
              kind: "eraseLine",
              mode: first === undefined ? 0 : first,
            });
            break;
          case "J":
            tokens.push({
              kind: "eraseDisplay",
              mode: first === undefined ? 0 : first,
            });
            break;
          case "A":
            tokens.push({ kind: "cursorUp", n });
            break;
          case "B":
            tokens.push({ kind: "cursorDown", n });
            break;
          case "C":
            tokens.push({ kind: "cursorRight", n });
            break;
          case "D":
            tokens.push({ kind: "cursorLeft", n });
            break;
          case "G":
            tokens.push({ kind: "cursorColumn", col: Math.max(0, n - 1) });
            break;
          case "H":
          case "f": {
            const row = params.length > 0 ? params[0] : 1;
            const col = params.length > 1 ? params[1] : 1;
            tokens.push({
              kind: "cursorTo",
              row: Math.max(0, row - 1),
              col: Math.max(0, col - 1),
            });
            break;
          }
          default:
            // Recognised shape, unhandled meaning: strip it silently.
            break;
        }
        i += csi[0].length;
        continue;
      }

      const stringEscape = STRING_ESCAPE_RE.exec(rest);
      if (stringEscape) {
        // OSC/DCS/SOS/PM/APC payload (window title, icon, ...) - discard it
        // whole, including the introducer and the terminator.
        flushText();
        i += stringEscape[0].length;
        continue;
      }

      const escape = ESCAPE_RE.exec(rest);
      if (escape) {
        // A well-formed escape we do not emulate (RIS, charset selection,
        // private modes, ...). Consume every byte so nothing leaks as text.
        flushText();
        i += escape[0].length;
        continue;
      }

      // Lone trailing ESC, or an escape we cannot even parse: swallow the ESC
      // and the following character so it can never be rendered as text.
      flushText();
      i += Math.min(2, rest.length);
    } else if (ch.charCodeAt(0) < 32) {
      // Other C0 controls (bell, form feed, vertical tab, ...).
      i += 1;
    } else {
      text += ch;
      i += 1;
    }
  }

  flushText();
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Emulator                                                            */
/* ------------------------------------------------------------------ */

/** Snapshot of the emulated screen. */
export interface ScreenSnapshot {
  lines: Cell[][];
  row: number;
  col: number;
}

export class StreamEmulator {
  private lines: Cell[][] = [[]];
  private cursorRow = 0;
  private cursorCol = 0;
  private pen: PenState = newPen();
  /** Lines changed since the last render; each was given a fresh identity. */
  private dirty = new Set<number>();

  constructor(private readonly maxLines = 5000) {}

  /** Feed raw output through the tokeniser and into the buffer. */
  write(chunk: string): void {
    for (const token of tokenize(chunk)) this.apply(token);
  }

  /** Drop all content; reset the cursor and the pen. */
  reset(): void {
    this.lines = [[]];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.pen = newPen();
    this.dirty = new Set([0]);
  }

  /** Current screen contents. */
  snapshot(): ScreenSnapshot {
    return { lines: this.lines, row: this.cursorRow, col: this.cursorCol };
  }

  /**
   * Indexes of lines changed since the previous call. Each changed line already
   * has a new array identity so memoised rows can skip untouched lines.
   */
  takeDirtyLines(): number[] {
    if (this.dirty.size === 0) return [];
    const indexes = Array.from(this.dirty).sort((a, b) => a - b);
    this.dirty = new Set();
    return indexes;
  }

  /**
   * The screen as plain text, one entry per line.
   *
   * A trailing newline parks the cursor on a fresh empty row. That row is a
   * cursor position rather than output, so it is not reported here (it would
   * otherwise show up as a blank line when copying).
   */
  toPlainText(): string[] {
    const rows = this.lines;
    const end =
      rows.length > 0 && rows[rows.length - 1].length === 0
        ? rows.length - 1
        : rows.length;
    return rows.slice(0, end).map((line) => line.map((cell) => cell.ch).join(""));
  }

  /* ---------------- internals ---------------- */

  private apply(token: Token): void {
    switch (token.kind) {
      case "lf":
        this.newline();
        break;
      case "cr":
        this.cursorCol = 0;
        break;
      case "bs":
        if (this.cursorCol > 0) this.cursorCol -= 1;
        break;
      case "tab": {
        const next = Math.min(this.cursorCol + (8 - (this.cursorCol % 8)), 4096);
        for (let c = this.cursorCol; c < next; c++) this.put(SPACE);
        this.cursorCol = next;
        break;
      }
      case "text":
        for (const ch of token.value) this.put(ch);
        break;
      case "sgr":
        this.applySgr(token.params);
        break;
      case "eraseLine":
        this.eraseLine(token.mode);
        break;
      case "eraseDisplay":
        this.eraseDisplay(token.mode);
        break;
      case "cursorUp":
        this.cursorRow = Math.max(0, this.cursorRow - token.n);
        break;
      case "cursorDown":
        this.ensureRow(this.cursorRow + token.n);
        this.cursorRow += token.n;
        break;
      case "cursorRight":
        this.cursorCol += token.n;
        break;
      case "cursorLeft":
        this.cursorCol = Math.max(0, this.cursorCol - token.n);
        break;
      case "cursorColumn":
        this.cursorCol = token.col;
        break;
      case "cursorTo":
        this.ensureRow(token.row);
        this.cursorRow = token.row;
        this.cursorCol = token.col;
        break;
    }
  }

  private applySgr(params: number[]): void {
    for (const p of params) {
      if (p === 0) this.pen = newPen();
      else if (p === 1) this.pen.bold = true;
      else if (p === 2) this.pen.dim = true;
      else if (p === 3) this.pen.italic = true;
      else if (p === 4) this.pen.underline = true;
      else if (p === 7) this.pen.inverse = true;
      else if (p === 9) this.pen.strike = true;
      else if (p === 22) {
        this.pen.bold = false;
        this.pen.dim = false;
      } else if (p === 23) this.pen.italic = false;
      else if (p === 24) this.pen.underline = false;
      else if (p === 27) this.pen.inverse = false;
      else if (p === 29) this.pen.strike = false;
      else if (p === 39) this.pen.fg = null;
      else if (p === 49) this.pen.bg = null;
      else if (SGR_FG[p]) this.pen.fg = SGR_FG[p];
      else if (SGR_BG[p]) this.pen.bg = SGR_BG[p];
    }
  }

  /** Write one printable character at the cursor, overwriting what is there. */
  private put(ch: string): void {
    this.ensureRow(this.cursorRow);
    const line = this.lines[this.cursorRow];

    // If the cursor jumped right of the end (e.g. after CSI G), pad the gap.
    while (line.length < this.cursorCol) {
      line.push({ ch: SPACE, fg: null, bg: null, style: null });
    }

    line[this.cursorCol] = {
      ch,
      fg: this.pen.fg,
      bg: this.pen.bg,
      style: this.styleFor(),
    };
    this.mark(this.cursorRow);
    this.cursorCol += 1;
  }

  private styleFor(): React.CSSProperties | null {
    const p = this.pen;
    if (!p.bold && !p.dim && !p.italic && !p.underline && !p.inverse && !p.strike) {
      return null;
    }
    return {
      fontWeight: p.bold ? 700 : undefined,
      opacity: p.dim ? 0.7 : undefined,
      fontStyle: p.italic ? "italic" : undefined,
      textDecoration:
        p.underline || p.strike
          ? [p.underline ? "underline" : null, p.strike ? "line-through" : null]
              .filter(Boolean)
              .join(" ")
          : undefined,
      filter: p.inverse ? "invert(1)" : undefined,
    };
  }

  private newline(): void {
    this.cursorCol = 0;
    this.ensureRow(this.cursorRow + 1);
    this.cursorRow += 1;
    this.trim();
  }

  /** EL - erase in line. The cursor itself never moves. */
  private eraseLine(mode: number): void {
    this.ensureRow(this.cursorRow);
    const line = this.lines[this.cursorRow];
    if (mode === 0) {
      line.length = Math.min(line.length, this.cursorCol);
    } else if (mode === 1) {
      for (let i = 0; i < Math.min(this.cursorCol + 1, line.length); i++) {
        line[i] = { ch: SPACE, fg: null, bg: null, style: null };
      }
    } else {
      line.length = 0;
    }
    this.mark(this.cursorRow);
  }

  /** ED - erase in display. */
  private eraseDisplay(mode: number): void {
    if (mode === 2) {
      this.lines = [[]];
      this.cursorRow = 0;
      this.cursorCol = 0;
      this.mark(0);
      return;
    }

    this.ensureRow(this.cursorRow);
    const line = this.lines[this.cursorRow];
    if (mode === 0) {
      line.length = Math.min(line.length, this.cursorCol);
      this.lines.length = this.cursorRow + 1;
    } else {
      for (let i = 0; i <= this.cursorCol && i < line.length; i++) {
        line[i] = { ch: SPACE, fg: null, bg: null, style: null };
      }
      this.lines.length = this.cursorRow + 1;
    }
    for (let i = 0; i < this.lines.length; i++) this.mark(i);
  }

  private ensureRow(row: number): void {
    while (this.lines.length <= row) this.lines.push([]);
  }

  /** Cap the scrollback so a runaway program cannot grow the buffer forever. */
  private trim(): void {
    if (this.lines.length <= this.maxLines) return;
    const drop = this.lines.length - this.maxLines;
    this.lines.splice(0, drop);
    this.cursorRow = Math.max(0, this.cursorRow - drop);
  }

  /**
   * Record that `index` changed and give the line a brand-new array identity so
   * React.memo can tell it apart from the previous render.
   */
  private mark(index: number): void {
    if (index < 0 || index >= this.lines.length) return;
    this.lines[index] = this.lines[index].slice();
    this.dirty.add(index);
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * One rendered line. Memoised so React skips lines the emulator did not touch -
 * this is what keeps a per-second counter or a tight progress-bar loop cheap.
 */
export const TerminalLine = React.memo(function TerminalLine({
  cells,
  defaultClassName,
}: {
  cells: Cell[];
  defaultClassName: string;
}) {
  return (
    <div className="whitespace-pre-wrap break-all leading-relaxed">
      {cells.map((cell, index) => (
        <span
          key={index}
          className={[defaultClassName, cell.fg, cell.bg]
            .filter(Boolean)
            .join(" ")}
          style={cell.style ?? undefined}
        >
          {cell.ch}
        </span>
      ))}
    </div>
  );
});

/** Handle returned by {@link useTerminal}. */
export interface TerminalHandle {
  /** Rendered lines, ready to drop into JSX. */
  render: React.ReactNode;
  /** Feed more raw output in. Safe to call repeatedly; state accumulates. */
  write: (chunk: string) => void;
  /** Clear the screen, the cursor and the pen. */
  reset: () => void;
  /** Current screen as plain text lines (used by the Copy button). */
  toPlainText: () => string[];
}

/**
 * React binding for {@link StreamEmulator}.
 *
 * The emulator instance lives in a ref so it survives re-renders and keeps
 * accumulating across chunks. This hook calls exactly three hooks, in a fixed
 * order, on every render - it must stay unconditional.
 */
export function useTerminal(
  defaultClassName: string,
  maxLines = 5000
): TerminalHandle {
  const emulatorRef = useRef<StreamEmulator | null>(null);
  if (emulatorRef.current === null) {
    emulatorRef.current = new StreamEmulator(maxLines);
  }

  // Bumped after every mutation so `render` is recomputed.
  const [version, setVersion] = useState(0);

  const write = useCallback((chunk: string) => {
    const emu = emulatorRef.current;
    if (!emu || !chunk) return;
    emu.write(chunk);
    setVersion((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    emulatorRef.current?.reset();
    setVersion((n) => n + 1);
  }, []);

  const toPlainText = useCallback(() => emulatorRef.current?.toPlainText() ?? [], []);

  const render = useMemo(() => {
    const emu = emulatorRef.current;
    if (!emu) return null;
    const { lines } = emu.snapshot();
    return lines.map((cells, index) => (
      <TerminalLine key={index} cells={cells} defaultClassName={defaultClassName} />
    ));
    // `version` is what invalidates this after each write.
  }, [defaultClassName, version]);

  return { render, write, reset, toPlainText };
}