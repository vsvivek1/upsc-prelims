"use client";
import { useEffect, useRef, useState } from "react";

/** True while the tab is visible. The minimum-time timers only run while this is true. */
export function useVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/**
 * Seconds this screen has been seen (visible tab only), starting from `initial`.
 * Resets when `key` changes.
 */
export function useSeenSeconds(key: string, initial = 0): number {
  const visible = useVisible();
  const [state, setState] = useState({ key, secs: initial });
  const secs = state.key === key ? state.secs : initial;
  if (state.key !== key) setState({ key, secs: initial });
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setState((s) => (s.key === key ? { key, secs: s.secs + 0.25 } : { key, secs: initial + 0.25 })), 250);
    return () => clearInterval(id);
  }, [visible, key, initial]);
  return secs;
}

/** Calls `fn` every `ms` with the latest value, and once more on unmount. */
export function useEvery<T>(value: T, ms: number, fn: (v: T) => void) {
  const latest = useRef(value);
  const cb = useRef(fn);
  useEffect(() => {
    latest.current = value;
    cb.current = fn;
  });
  useEffect(() => {
    const id = setInterval(() => cb.current(latest.current), ms);
    return () => {
      clearInterval(id);
      cb.current(latest.current);
    };
  }, [ms]);
}

/** Reads text aloud with the device voice (Hindi or English). */
export function speak(text: string, lang: "en" | "hi") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "hi" ? "hi-IN" : "en-IN";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
