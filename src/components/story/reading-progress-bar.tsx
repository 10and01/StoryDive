"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A self-drawn vertical reading-progress bar pinned to the right edge.
 *
 * Why not just style the native scrollbar? On iOS Safari / in-app WebViews
 * the system uses an overlay scrollbar that ignores ::-webkit-scrollbar, so
 * a CSS-only approach cannot be made to match the warm-gold ink theme on
 * mobile. This component tracks the window scroll position directly and
 * renders a themed thumb + track, giving one consistent look on desktop and
 * mobile alike.
 *
 * It listens to the document (window) scroll, since the reader page uses
 * normal page scrolling rather than an inner overflow container.
 */
export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0); // 0..1 scrolled fraction
  const [thumb, setThumb] = useState(0.15); // thumb height as fraction of track
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const doc = document.documentElement;

    const compute = () => {
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 4) {
        // Page fits on screen — nothing to indicate.
        setThumb(1);
        setProgress(0);
        setVisible(false);
        return;
      }
      const frac = Math.min(1, Math.max(0, window.scrollY / scrollable));
      // Thumb size mirrors the viewport-to-content ratio, clamped for usability.
      const ratio = Math.min(1, doc.clientHeight / doc.scrollHeight);
      setThumb(Math.min(0.9, Math.max(0.08, ratio)));
      setProgress(frac);
    };

    const onScroll = () => {
      compute();
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      // Fade out after the reader pauses, like an overlay scrollbar.
      hideTimer.current = setTimeout(() => setVisible(false), 1100);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", compute);
    // Recompute after images/layout settle.
    const settle = setTimeout(compute, 400);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", compute);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      clearTimeout(settle);
    };
  }, []);

  // Available travel for the thumb inside the track (as a fraction).
  const travel = Math.max(0, 1 - thumb);
  const topPct = progress * travel * 100;
  const heightPct = thumb * 100;

  if (thumb >= 1) return null;

  return (
    <div
      aria-hidden
      data-el="reading-progress"
      className="pointer-events-none fixed right-[3px] z-40 w-[6px] rounded-full transition-opacity duration-500"
      style={{
        top: "calc(var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px))) + 8px)",
        bottom: "calc(var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px))) + 8px)",
        opacity: visible ? 1 : 0,
        // faint ink track so the thumb has something to ride on
        background: "rgba(214, 192, 142, 0.08)",
      }}
    >
      <span
        className="absolute left-0 w-full rounded-full"
        style={{
          top: `${topPct}%`,
          height: `${heightPct}%`,
          background:
            "linear-gradient(180deg, rgba(214,192,142,0.9), rgba(200,119,69,0.85))",
          boxShadow:
            "0 0 8px rgba(214,192,142,0.45), inset 0 0 0 1px rgba(237,227,193,0.35)",
        }}
      />
    </div>
  );
}
