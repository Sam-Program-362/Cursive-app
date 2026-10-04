"use client";

/**
 * Touch behaviour for the editor: drag scrolls, tap types.
 *
 * On Android the soft keyboard appears whenever an editable element receives
 * focus. Monaco opens the keyboard by focusing its hidden `textarea.inputarea`
 * on a tap (see `pointerHandler.js` -> `focusTextArea()`), while a drag scrolls
 * the view without touching focus. The problem is that a touch can still end up
 * focusing the editor, which pops the keyboard while you only wanted to scroll.
 *
 * The fix is the standard mobile-web technique: keep the editable element at
 * `inputmode="none"` so focus never summons the keyboard, and only switch to
 * `inputmode="text"` + focus once our own gesture check confirms a *tap*
 * (movement under ~10px, duration under ~300ms). A drag re-suppresses the
 * keyboard, so scrolling after hiding it (back button) never re-opens it.
 */

import { useEffect, useRef } from "react";

export interface TouchSample {
  x: number;
  y: number;
  t: number;
}

export type TouchKind = "tap" | "drag";

/** A touch that moves no more than this many pixels is still a tap. */
export const TAP_MAX_DISTANCE_PX = 10;
/** A touch that lasts no longer than this many ms is still a tap. */
export const TAP_MAX_DURATION_MS = 300;

/**
 * Pure decision rule: a touch is a tap when it barely moved and was brief,
 * otherwise it is a drag (scroll). Kept separate from the DOM so it can be
 * unit-tested without a browser.
 */
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

/** Distance between two touch samples, in CSS pixels. */
export function touchDistance(start: TouchSample, end: TouchSample): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True when the current device can fire touch events. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return navigator.maxTouchPoints > 0 || "ontouchstart" in window;
}

/**
 * Toggle the soft keyboard for an editable element. `inputmode="none"` tells
 * Android not to show a keyboard for this field even while it is focused.
 */
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

/**
 * Focus an editable element so the keyboard appears. If it is already focused
 * the `inputmode` change alone does not always re-open the keyboard on Android,
 * so we blur and re-focus inside the same user gesture.
 */
export function openKeyboard(el: HTMLElement | null): void {
  if (!el) return;
  setKeyboardSuppressed(el, false);
  if (targetOwnerDocument(el).activeElement === el) {
    el.blur();
  }
  el.focus();
}

/** Hide the keyboard without dropping the editor's model selection. */
export function closeKeyboard(el: HTMLElement | null): void {
  if (!el) return;
  setKeyboardSuppressed(el, true);
  if (targetOwnerDocument(el).activeElement === el) {
    el.blur();
  }
}

function targetOwnerDocument(el: HTMLElement): Document {
  return el.ownerDocument || document;
}

export interface TouchDragVsTapOptions {
  /** Horizontal/vertical movement (px) above which a touch is a drag. */
  thresholdPx?: number;
  /** Longest touch (ms) that can still count as a tap. */
  maxTapMs?: number;
  /** Called on a confirmed tap, before the keyboard opens. */
  onTap?: (x: number, y: number) => void;
  /** Master switch. */
  enabled?: boolean;
}

/**
 * Attach drag-vs-tap handling to `containerRef`; the keyboard is toggled on the
 * editable element in `targetRef` (which may be the container itself for a
 * plain textarea, or a hidden textarea inside Monaco).
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

    let start: TouchSample = { x: 0, y: 0, t: 0 };
    let dragged = false;
    let tracking = false;

    const suppressKeyboard = () => {
      const target = targetRef.current;
      if (!target) return;
      setKeyboardSuppressed(target, true);
      if (target.ownerDocument.activeElement === target) target.blur();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      dragged = false;
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const touch = event.touches[0];
      if (!touch) return;
      const current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      if (touchDistance(start, current) > thresholdPx) {
        dragged = true;
        // Scrolling must never keep or raise the keyboard.
        suppressKeyboard();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      const end: TouchSample = {
        x: touch ? touch.clientX : start.x,
        y: touch ? touch.clientY : start.y,
        t: Date.now(),
      };
      const moved = touchDistance(start, end);
      const isTap =
        !dragged && classifyTouch(start, end, thresholdPx, maxTapMs) === "tap";
      if (isTap) {
        optionsRef.current.onTap?.(end.x, end.y);
        openKeyboard(targetRef.current);
      } else if (moved > thresholdPx) {
        // A drag that ended before a touchmove was seen.
        suppressKeyboard();
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [containerRef, targetRef, enabled, thresholdPx, maxTapMs]);
}
