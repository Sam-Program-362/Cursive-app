/**
 * Behavioural tests for the drag-vs-tap touch rule.
 *
 *   bun scripts/test-touch-keyboard.mjs
 *
 * The rule is deliberately pure (no DOM) so it can be checked here; the DOM
 * wiring is verified on a real phone using the manual steps in the report.
 */

import {
  classifyTouch,
  touchDistance,
  setKeyboardSuppressed,
  shouldRaiseKeyboard,
  shouldBlurAfterTouch,
  shouldBlockMonacoTapGesture,
  shouldBlockSyntheticMouse,
  TAP_MAX_DISTANCE_PX,
  TAP_MAX_DURATION_MS,
} from "../src/lib/touch-keyboard";

let failures = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    ok
      ? `PASS  ${name}`
      : `FAIL  ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`
  );
}

const at = (x, y, t) => ({ x, y, t });

/* The documented thresholds: ~8px and ~300ms. */
check("thresholds match the spec", [TAP_MAX_DISTANCE_PX, TAP_MAX_DURATION_MS], [8, 300]);

/* Short, barely-moving touches are taps. */
check("still finger is a tap", classifyTouch(at(0, 0, 0), at(0, 0, 80)), "tap");
check("3px wobble is a tap", classifyTouch(at(100, 100, 0), at(103, 101, 150)), "tap");
check("exactly 8px is still a tap", classifyTouch(at(0, 0, 0), at(8, 0, 50)), "tap");
check("exactly 300ms is still a tap", classifyTouch(at(0, 0, 0), at(2, 2, 300)), "tap");

/* Anything that moves further or lasts longer is a scroll. */
check("40px swipe is a drag", classifyTouch(at(0, 0, 0), at(40, 0, 100)), "drag");
check("diagonal 20px is a drag", classifyTouch(at(0, 0, 0), at(15, 15, 120)), "drag");
check("slow hold is a drag", classifyTouch(at(0, 0, 0), at(1, 1, 500)), "drag");
check("9px is a drag", classifyTouch(at(0, 0, 0), at(9, 0, 50)), "drag");
check("301ms is a drag", classifyTouch(at(0, 0, 0), at(0, 0, 301)), "drag");

/* Distance helper. */
check("distance 3-4-5 triangle", touchDistance(at(0, 0, 0), at(3, 4, 0)), 5);

/* Keyboard suppression toggles inputmode on whatever editable element it is given. */
function fakeElement() {
  return {
    attrs: {},
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
  };
}
{
  const el = fakeElement();
  setKeyboardSuppressed(el, true);
  check("suppressing sets inputmode=none", el.attrs.inputmode, "none");
  setKeyboardSuppressed(el, false);
  check("allowing sets inputmode=text", el.attrs.inputmode, "text");
  // A null element must not throw (editor not mounted yet).
  setKeyboardSuppressed(null, true);
  check("null element is ignored", true, true);
}

/* Focus policy — the rules that make "drag never opens the keyboard" true. */
check(
  "a tap raises the keyboard",
  shouldRaiseKeyboard({ classified: "tap", skipKeyboard: false }),
  true
);
check(
  "a drag never raises the keyboard",
  shouldRaiseKeyboard({ classified: "drag", skipKeyboard: false }),
  false
);
check(
  "a tap on the scroll bar does not raise the keyboard",
  shouldRaiseKeyboard({ classified: "tap", skipKeyboard: true }),
  false
);
check(
  "a drag with the keyboard down blurs the editor",
  shouldBlurAfterTouch({
    classified: "drag",
    skipKeyboard: false,
    keyboardVisible: false,
  }),
  true
);
check(
  "a drag with the keyboard open leaves it open",
  shouldBlurAfterTouch({
    classified: "drag",
    skipKeyboard: false,
    keyboardVisible: true,
  }),
  false
);
check(
  "a tap never blurs the editor",
  shouldBlurAfterTouch({
    classified: "tap",
    skipKeyboard: false,
    keyboardVisible: false,
  }),
  false
);
check("Monaco tap gesture blocked for a drag", shouldBlockMonacoTapGesture("drag"), true);
check("Monaco tap gesture allowed for a tap", shouldBlockMonacoTapGesture("tap"), false);
check("Monaco tap gesture allowed while pending", shouldBlockMonacoTapGesture("pending"), false);
check(
  "Monaco tap gesture is left alone on its own UI",
  shouldBlockMonacoTapGesture("drag", true),
  false
);
check("synthetic mouse blocked just after a touch", shouldBlockSyntheticMouse(1000, 1200), true);
check("synthetic mouse passes once the touch is old", shouldBlockSyntheticMouse(1000, 1800), false);
check("no touch means no blocking", shouldBlockSyntheticMouse(-Infinity, 1000), false);

console.log(
  failures === 0
    ? "\nALL TOUCH KEYBOARD TESTS PASSED"
    : `\n${failures} TOUCH KEYBOARD TEST(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
