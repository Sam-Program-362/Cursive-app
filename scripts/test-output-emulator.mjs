/**
 * Behavioural tests for the run-output terminal emulator.
 *
 *   node --experimental-strip-types scripts/test-output-emulator.mjs
 *
 * (or run via bun, which understands the TS import directly)
 */

import { StreamEmulator, tokenize } from "../src/lib/runtime/output-emulator";

let failures = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  const line = ok ? `PASS  ${name}` : `FAIL  ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`;
  console.log(line);
}

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const BS = String.fromCharCode(8);

/* ------------------------------------------------------------------ */
/* Test 1 - carriage return / live counter                             */
/* ------------------------------------------------------------------ */
{
  // print(f"\r{H:02d} : {M:02d} : {S:02d}", end="", flush=True)
  const emu = new StreamEmulator();
  let H = 0;
  let M = 0;
  let S = 0;
  const seen = [];
  for (let i = 0; i <= 10; i++) {
    emu.write(`\r${pad(H)} : ${pad(M)} : ${pad(S)}`);
    seen.push(emu.toPlainText().length);
    S += 1;
    if (S === 60) {
      S = 0;
      M += 1;
    }
  }
  check("T1: counter stays on a single line", seen.every((n) => n === 1), true);
  check("T1: counter shows the final value", emu.toPlainText(), ["00 : 00 : 10"]);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

{
  const emu = new StreamEmulator();
  emu.write("\r00:00:01");
  emu.write("\r00:00:02");
  emu.write("\r00:00:03");
  check("T1: successive updates overwrite in place", emu.toPlainText(), ["00:00:03"]);
}

/* ------------------------------------------------------------------ */
/* Test 2 - progress bar using \r                                      */
/* ------------------------------------------------------------------ */
{
  // print(f"\r[{bar}] {i*5}%", end="", flush=True) for i in range(21)
  const emu = new StreamEmulator();
  const lineCounts = [];
  let firstText = null;
  for (let i = 0; i <= 20; i++) {
    const bar = "#".repeat(i) + "-".repeat(20 - i);
    emu.write(`\r[${bar}] ${i * 5}%`);
    lineCounts.push(emu.toPlainText().length);
    if (i === 0) firstText = emu.toPlainText()[0];
  }
  check("T2: bar never splits onto new lines", lineCounts.every((n) => n === 1), true);
  check("T2: bar starts empty", firstText, "[--------------------] 0%");
  check("T2: bar ends full", emu.toPlainText(), ["[####################] 100%"]);
}

/* ------------------------------------------------------------------ */
/* Test 3 - plain multi-line output                                    */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  emu.write("line one\nline two\nline three\n");
  check("T3: three separate lines", emu.toPlainText(), ["line one", "line two", "line three"]);
}
{
  const emu = new StreamEmulator();
  emu.write("a\nb\n");
  check("T3: trailing newline is only a cursor position", emu.toPlainText(), ["a", "b"]);
}
{
  const emu = new StreamEmulator();
  emu.write("a\r\nb\r\n");
  check("CRLF is treated as one newline", emu.toPlainText(), ["a", "b"]);
}

/* ------------------------------------------------------------------ */
/* Erase in line                                                       */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  emu.write("aaaaaaaaaaaaaaaa\r" + ESC + "[2Kdone");
  check("ESC[2K clears the whole line", emu.toPlainText(), ["done"]);
}
{
  const emu = new StreamEmulator();
  emu.write("abcdef\r" + ESC + "[3C" + ESC + "[K");
  check("ESC[K erases cursor to end of line", emu.toPlainText(), ["abc"]);
}

/* ------------------------------------------------------------------ */
/* Cursor movement                                                     */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  emu.write("one\ntwo\nthree");
  emu.write(ESC + "[2A" + ESC + "[GCHANGED");
  check("ESC[2A then ESC[G rewrites the first line", emu.toPlainText(), ["CHANGED", "two", "three"]);
}
{
  const emu = new StreamEmulator();
  emu.write("one\ntwo\nthree");
  // Cursor sits on the last written row (row 2). Up 1 -> row 1, down 1 -> row 2.
  // Writing "back" over "three" leaves the trailing "e": a terminal overwrites,
  // it does not erase the rest of the line (that is what ESC[K / ESC[2K are for).
  emu.write(ESC + "[A" + ESC + "[B" + ESC + "[Gback");
  check("ESC[A then ESC[B nets out", emu.toPlainText(), ["one", "two", "backe"]);
}
{
  const emu = new StreamEmulator();
  emu.write("one\ntwo\nthree\n");
  // Trailing \n parks the cursor on row 3; up 2 -> row 1. "x" overwrites the
  // first character of "two", leaving "wo".
  emu.write(ESC + "[2A" + ESC + "[Gx");
  check("ESC[A after a trailing newline is relative to the new row", emu.toPlainText(), [
    "one",
    "xwo",
    "three",
  ]);
}

/* ------------------------------------------------------------------ */
/* Backspace                                                           */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  emu.write(`abcde${BS} ${BS}XY`);
  check("backspace + space erases the character", emu.toPlainText(), ["abcdXY"]);
}

/* ------------------------------------------------------------------ */
/* SGR colours                                                         */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  emu.write(ESC + "[31mRED" + ESC + "[0m plain");
  const cells = emu.snapshot().lines[0];
  check("SGR 31 colours the run", cells.slice(0, 3).map((c) => c.fg), [
    "text-red-400",
    "text-red-400",
    "text-red-400",
  ]);
  check("SGR 0 restores the default colour", cells.slice(4).every((c) => c.fg === null), true);
}
{
  const emu = new StreamEmulator();
  emu.write(ESC + "[92mbright" + ESC + "[0mx");
  check(
    "bright SGR 92 maps to bright green",
    emu.snapshot().lines[0].slice(0, 5).every((c) => c.fg === "text-green-300"),
    true
  );
}
{
  const emu = new StreamEmulator();
  emu.write(ESC + "[1mbold" + ESC + "[22mplain");
  const cells = emu.snapshot().lines[0];
  check("SGR 1 sets bold", cells[0].style?.fontWeight, 700);
  check("SGR 22 clears bold", cells[4].style, null);
}

/* ------------------------------------------------------------------ */
/* Unknown escapes are stripped, never rendered as text                */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  // Every one of these must leave no trace on screen:
  //   ESC[?25l  private mode          ESC]0;title BEL   OSC (window title)
  //   ESC Z      two-byte escape       ESC P q ESC \     DCS (device report)
  //   ESC ( B    3-byte charset        ESC c            RIS (full reset)
  // ESC c is stripped rather than executed as a real screen reset: an output
  // panel has no cursor-addressable screen to reinitialise, and discarding the
  // bytes is the safe reading of "sequences we do not recognise are stripped".
  emu.write(
    `a${ESC}[?25lb${ESC}]0;title${BEL}c${ESC}Z${ESC}Pq${ESC}\\d${ESC}(B e${ESC}c`
  );
  check("private/OSC/DCS/charset escapes produce no garbage", emu.toPlainText(), ["abcd e"]);
}
{
  const emu = new StreamEmulator();
  // An unterminated OSC at end of input must not leak its payload either.
  emu.write(`x${ESC}]0;title`);
  check("unterminated OSC payload is discarded", emu.toPlainText(), ["x"]);
}

/* ------------------------------------------------------------------ */
/* Incremental dirty-line tracking                                     */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  emu.write("l1\nl2\nl3");
  emu.takeDirtyLines();
  emu.write("\rCHANGED");
  check("only the touched line is dirty", emu.takeDirtyLines(), [2]);
  check("untouched lines keep their text", emu.toPlainText(), ["l1", "l2", "CHANGED"]);
  emu.write(ESC + "[2A\rTOP");
  check("a cursor-up write dirties the earlier line", emu.takeDirtyLines(), [0]);
  check("content after the cursor-up write", emu.toPlainText(), ["TOP", "l2", "CHANGED"]);
  check("an idle emulator reports no dirty lines", emu.takeDirtyLines(), []);
}

/* ------------------------------------------------------------------ */
/* Streaming: feeding deltas equals feeding the whole buffer            */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator();
  const chunks = ["\r00:00:00", "\r00:00:01", "\r00:00:02"];
  let fed = 0;
  let full = "";
  for (const chunk of chunks) {
    full += chunk;
    emu.write(full.slice(fed));
    fed = full.length;
  }
  check("streamed deltas match a single write", emu.toPlainText(), ["00:00:02"]);
}

/* ------------------------------------------------------------------ */
/* Scrollback cap                                                      */
/* ------------------------------------------------------------------ */
{
  const emu = new StreamEmulator(3);
  for (let i = 0; i < 10; i++) emu.write(`line${i}\n`);
  check("scrollback is capped", emu.toPlainText().length <= 3, true);
}

/* ------------------------------------------------------------------ */
/* Tokenizer never emits control characters as text                   */
/* ------------------------------------------------------------------ */
{
  const tokens = tokenize(`a${ESC}[1;32mB${ESC}[0m${BS}\r`);
  check(
    "tokenizer splits text/colour/control tokens",
    tokens.map((t) => t.kind),
    ["text", "sgr", "text", "sgr", "bs", "cr"]
  );
}

console.log("");
if (failures === 0) {
  console.log("ALL EMULATOR TESTS PASSED");
} else {
  console.log(`${failures} TEST(S) FAILED`);
}
process.exit(failures === 0 ? 0 : 1);