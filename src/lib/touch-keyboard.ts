"use client";

/**
 * Touch behaviour for the editor: a drag only scrolls, a tap types.
 *
 * The first attempt failed because Monaco's hidden `textarea.inputarea` kept
 * focus after a tap, so Android re-opened the soft keyboard on *any* later touch.
 * The rule now is:
 *
 *  - While the keyboard is hidden the textarea sits at `inputmode="none"` and is
 *    blurred, so Android has nothing to re-show when you drag.
 *  - Every touch is classified from a capture-phase listener using movement and
 *    duration. Focus-causing events caused by a *drag* (Monaco's own tap gesture,
 *    and the synthetic mousedown/click the browser fires after touchend) are
 *    stopped, so a drag never focuses the editor or moves the cursor.
 *  - A confirmed tap flips the textarea to `inputmode="text"`, focuses it and
 *    asks the keyboard to show.
 *  - When the keyboard is hidden (back key / hide key) we listen for the event
 *    and blur the input so the editor is not stuck focused.
 *  - If the keyboard is already open, a drag leaves it exactly as it is.
 *
 * The Capacitor Keyboard plugin provides the show/hide events; visualViewport /
 * window resize is used as a fallback (and on the web).
 */

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

export interface TouchSample {
  x: number;
  y: number;
  t: number;
}

export type TouchKind = "tap" | "drag";

/** A touch that moves no more than this many pixels is still a tap. */
export const TAP_MAX_DISTANCE_PX = 8;
/** A touch that lasts no longer than this many ms is still a tap. */
export const TAP_MAX_DURATION_MS = 300;

/** Pure decision rule, kept DOM-free so it can be unit-tested. */
export function classifyTouch(
  start: TouchSample,
  end: TouchSample,
  thresholdPx = TAP_MAX_DISTANCE_PX,
  maxTapMs = TAP_MAX_DURATION_MS
): TouchKind {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const moved = Math.sqrt(dx * dx + dy * dy);
  const elapsed = end.t - start.t;
  return moved <= thresholdPx && elapsed <= maxTapMs ? "tap" : "drag";
}

export function touchDistance(start: TouchSample, end: TouchSample): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ------------------------------------------------------------------ */
/* The decision rules (pure, so the behaviour is unit-testable)        */
/* ------------------------------------------------------------------ */

/** Only a confirmed tap may focus the editor and raise the keyboard. */
export function shouldRaiseKeyboard(input: {
  classified: TouchKind;
  skipKeyboard: boolean;
}): boolean {
  return input.classified === "tap" && !input.skipKeyboard;
}

/**
 * Force the editor to give up focus. A drag while the keyboard is already
 * down must blur it (so Android has nothing to re-show); a drag while the
 * keyboard is open must leave it alone.
 */
export function shouldBlurAfterTouch(input: {
  classified: TouchKind;
  skipKeyboard: boolean;
  keyboardVisible: boolean;
}): boolean {
  return (
    input.classified === "drag" && !input.skipKeyboard && !input.keyboardVisible
  );
}

/** Monaco's own tap gesture focuses and moves the caret — a drag must stop it. */
export function shouldBlockMonacoTapGesture(
  classified: TouchKind | "pending",
  skipKeyboard = false
): boolean {
  // Touches on Monaco's own UI (scroll bar, minimap, suggestion list) are left
  // to Monaco — blocking them would break scrolling by bar or picking a
  // suggestion.
  return classified === "drag" && !skipKeyboard;
}

/**
 * The browser fires mousedown/click after touchend; they would focus the
 * editor for a gesture that was only a scroll.
 */
export function shouldBlockSyntheticMouse(
  lastTouchEndAt: number,
  now: number,
  holdMs = 700
): boolean {
  return now - lastTouchEndAt < holdMs;
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return navigator.maxTouchPoints > 0 || "ontouchstart" in window;
}

function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Keyboard visibility                                                  */
/* ------------------------------------------------------------------ */

let keyboardVisible = false;
const keyboardListeners = new Set<(visible: boolean) => void>();
let trackingStarted = false;

function setKeyboardVisible(visible: boolean) {
  if (keyboardVisible === visible) return;
  keyboardVisible = visible;
  keyboardListeners.forEach((listener) => listener(visible));
}

export function getKeyboardVisible(): boolean {
  return keyboardVisible;
}

export function subscribeKeyboardVisible(
  listener: (visible: boolean) => void
): () => void {
  keyboardListeners.add(listener);
  return () => keyboardListeners.delete(listener);
}

/**
 * Start listening for the keyboard showing/hiding. The Capacitor Keyboard
 * plugin is the source of truth on device; visualViewport + window resize is
 * the fallback (and what runs on the web).
 */
function ensureKeyboardTracking() {
  if (trackingStarted || typeof window === "undefined") return;
  trackingStarted = true;

  if (isNativePlatform()) {
    // On Android the will/did pairs fire almost together; both are wired so
    // visibility is correct regardless of which arrives first.
    const safe = (promise: Promise<unknown>) => promise.catch(() => undefined);
    safe(Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true)));
    safe(Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true)));
    // Only the confirmed "did hide" flips it off: transient will-hide flashes
    // (keyboard layout changes) must not blur the editor while typing.
    safe(Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false)));
  }

  // Fallback: the layout viewport shrinks while the keyboard is up. Track the
  // tallest size seen as "keyboard closed" and reset it on orientation change.
  let baselineHeight = window.innerHeight;
  let baselineWidth = window.innerWidth;
  const measure = () => {
    const height = window.innerHeight;
    const width = window.innerWidth;
    if (Math.abs(width - baselineWidth) > 100) {
      // Orientation changed — recalibrate instead of guessing a keyboard.
      baselineWidth = width;
      baselineHeight = height;
      return;
    }
    if (height > baselineHeight) baselineHeight = height;
    setKeyboardVisible(height < baselineHeight - 120);
  };
  window.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("resize", measure);
}

/** `true` while the soft keyboard is up. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(keyboardVisible);
  useEffect(() => {
    ensureKeyboardTracking();
    return subscribeKeyboardVisible(setVisible);
  }, []);
  return visible;
}

/* ------------------------------------------------------------------ */
/* Editable-element helpers                                             */
/* ------------------------------------------------------------------ */

/** Suppress (inputmode="none") or allow (inputmode="text") the soft keyboard. */
export function setKeyboardSuppressed(
  el: HTMLElement | null,
  suppressed: boolean
): void {
  if (!el) return;
  el.setAttribute("inputmode", suppressed ? "none" : "text");
}

/** Opt an editor field out of IME autocorrect / auto-capitalisation / smart quotes. */
export function configureCodeInput(el: HTMLElement | null): void {
  if (!el) return;
  el.setAttribute("autocorrect", "off");
  el.setAttribute("autocomplete", "off");
  el.setAttribute("autocapitalize", "off");
  el.setAttribute("spellcheck", "false");
  el.setAttribute("data-gramm", "false");
}

/** Hide the keyboard and take focus away so Android has nothing to re-show. */
export function closeKeyboard(el: HTMLElement | null): void {
  if (!el) return;
  setKeyboardSuppressed(el, true);
  if (el.ownerDocument.activeElement === el) el.blur();
}

/** Make an editable element focusable again and show the keyboard for it. */
export function openKeyboard(el: HTMLElement | null): void {
  if (!el) return;
  setKeyboardSuppressed(el, false);
  const doc = el.ownerDocument;
  if (doc.activeElement === el) {
    // Changing inputmode on an already-focused element does not reliably
    // re-open the keyboard, so bounce focus inside the same user gesture.
    el.blur();
  }
  el.focus();
  if (isNativePlatform()) {
    Keyboard.show().catch(() => {
      /* best effort — focus alone normally suffices */
    });
  }
}

/* ------------------------------------------------------------------ */
/* Monaco-specific guards                                               */
/* ------------------------------------------------------------------ */

/**
 * Tap targets Monaco handles itself (scroll bar, minimap, suggestion list,
 * widgets). We must not steal those: scrolling by the side bar stays
 * keyboard-free and picking a suggestion still works.
 */
const MONACO_SELF_MANAGED = [
  ".scrollbar",
  ".minimap",
  ".suggest-widget",
  ".monaco-list",
  ".parameter-hints-widget",
  ".find-widget",
  ".context-view",
  ".margin-view-overlays",
];

export function isSelfManagedTouch(node: EventTarget | null): boolean {
  if (!node || typeof (node as Element).closest !== "function") return false;
  const el = node as Element;
  return MONACO_SELF_MANAGED.some((selector) => Boolean(el.closest(selector)));
}

/** Monaco's own tap gesture (a CustomEvent that does not bubble). */
export const MONACO_TAP_EVENT = "-monaco-gesturetap";

/* ------------------------------------------------------------------ */
/* The hook                                                             */
/* ------------------------------------------------------------------ */

export interface TouchDragVsTapOptions {
  thresholdPx?: number;
  maxTapMs?: number;
  /** Called for a confirmed tap that lands on the editable surface. */
  onTap?: (x: number, y: number) => void;
  enabled?: boolean;
}

interface TouchState {
  x: number;
  y: number;
  t: number;
  classified: "pending" | TouchKind;
  skipKeyboard: boolean;
}

/**
 * Attach drag-vs-tap handling to `containerRef`, toggling the keyboard on the
 * editable element in `targetRef` (Monaco's hidden textarea, or a plain
 * textarea when both refs are the same element).
 */
export function useTouchDragVsTap(
  containerRef: React.RefObject<HTMLElement | null>,
  targetRef: React.RefObject<HTMLElement | null>,
  options: TouchDragVsTapOptions = {}
): void {
  const {
    thresholdPx = TAP_MAX_DISTANCE_PX,
    maxTapMs = TAP_MAX_DURATION_MS,
    enabled = true,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || !isTouchDevice()) return;

    ensureKeyboardTracking();

    const state: TouchState = {
      x: 0,
      y: 0,
      t: 0,
      classified: "pending",
      skipKeyboard: false,
    };
    let lastTouchEndAt = -Infinity;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        state.classified = "drag";
        return;
      }
      const touch = event.touches[0];
      state.x = touch.clientX;
      state.y = touch.clientY;
      state.t = Date.now();
      state.classified = "pending";
      state.skipKeyboard = isSelfManagedTouch(event.target);
      // While the keyboard is down, keep the input non-focusable so a plain
      // touch can never re-show it. Focus/selection are untouched here so
      // long-press selection still works.
      if (!state.skipKeyboard && !getKeyboardVisible()) {
        setKeyboardSuppressed(targetRef.current, true);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (state.classified !== "pending") return;
      const touch = event.touches[0];
      if (!touch) return;
      const distance = touchDistance(state, {
        x: touch.clientX,
        y: touch.clientY,
        t: Date.now(),
      });
      if (distance > thresholdPx) {
        state.classified = "drag";
        if (
          shouldBlurAfterTouch({
            classified: "drag",
            skipKeyboard: state.skipKeyboard,
            keyboardVisible: getKeyboardVisible(),
          })
        ) {
          // Scrolling must not focus or raise the keyboard.
          closeKeyboard(targetRef.current);
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const end: TouchSample = {
        x: touch ? touch.clientX : state.x,
        y: touch ? touch.clientY : state.y,
        t: Date.now(),
      };

      if (state.classified === "pending") {
        state.classified = classifyTouch(state, end, thresholdPx, maxTapMs);
      }

      // Let Monaco's own tap handling run when the touch landed on its UI
      // (suggestion list, line-number gutter, scroll bar) — that interaction
      // needs the browser's synthetic events. Otherwise they would refocus the
      // editor after a gesture that was only a scroll, so we stop them.
      const selfManagedTap = state.skipKeyboard && state.classified === "tap";
      lastTouchEndAt = selfManagedTap ? -Infinity : Date.now();

      if (state.classified === "drag") {
        if (
          shouldBlurAfterTouch({
            classified: "drag",
            skipKeyboard: state.skipKeyboard,
            keyboardVisible: getKeyboardVisible(),
          })
        ) {
          closeKeyboard(targetRef.current);
        }
        return;
      }

      // Confirmed tap.
      if (
        !shouldRaiseKeyboard({
          classified: state.classified,
          skipKeyboard: state.skipKeyboard,
        })
      ) {
        return;
      }
      optionsRef.current.onTap?.(end.x, end.y);
      openKeyboard(targetRef.current);
    };

    /* --- Focus-causing events: stop the ones a drag produces --------------- */

    const blockTapGesture = (event: Event) => {
      // Monaco's own tap gesture focuses the textarea and moves the caret.
      // A drag must do neither; a tap is fine because we already arranged the
      // focus ourselves just above.
      if (shouldBlockMonacoTapGesture(state.classified, state.skipKeyboard)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const blockSyntheticMouse = (event: Event) => {
      if (shouldBlockSyntheticMouse(lastTouchEndAt, Date.now())) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const blockSyntheticPointer = (event: Event) => {
      const pointerEvent = event as PointerEvent;
      if (
        (pointerEvent as any).pointerType === "mouse" &&
        shouldBlockSyntheticMouse(lastTouchEndAt, Date.now())
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const capture = { capture: true } as AddEventListenerOptions;
    const captureBlocking = { capture: true, passive: false } as AddEventListenerOptions;

    container.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    container.addEventListener("touchmove", onTouchMove, {
      capture: true,
      passive: true,
    });
    container.addEventListener("touchend", onTouchEnd, {
      capture: true,
      passive: true,
    });
    container.addEventListener("touchcancel", onTouchEnd, {
      capture: true,
      passive: true,
    });

    container.addEventListener(MONACO_TAP_EVENT, blockTapGesture, captureBlocking);
    container.addEventListener("mousedown", blockSyntheticMouse, captureBlocking);
    container.addEventListener("click", blockSyntheticMouse, captureBlocking);
    container.addEventListener("auxclick", blockSyntheticMouse, captureBlocking);
    container.addEventListener("pointerdown", blockSyntheticPointer, captureBlocking);

    return () => {
      container.removeEventListener("touchstart", onTouchStart, capture);
      container.removeEventListener("touchmove", onTouchMove, capture);
      container.removeEventListener("touchend", onTouchEnd, capture);
      container.removeEventListener("touchcancel", onTouchEnd, capture);
      container.removeEventListener(MONACO_TAP_EVENT, blockTapGesture, capture);
      container.removeEventListener("mousedown", blockSyntheticMouse, capture);
      container.removeEventListener("click", blockSyntheticMouse, capture);
      container.removeEventListener("auxclick", blockSyntheticMouse, capture);
      container.removeEventListener("pointerdown", blockSyntheticPointer, capture);
    };
  }, [containerRef, targetRef, enabled, thresholdPx, maxTapMs]);

  // When the keyboard goes away the editor must lose focus too, otherwise it
  // stays "stuck" and Android re-shows the keyboard on the next touch.
  useEffect(() => {
    if (!enabled) return;
    ensureKeyboardTracking();
    return subscribeKeyboardVisible((visible) => {
      if (!visible) closeKeyboard(targetRef.current);
    });
  }, [targetRef, enabled]);
}
