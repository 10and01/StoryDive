"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * A restrained, painterly immersion layer that sits behind the reading
 * column: a slowly breathing warm-gold halo plus a handful of slow-drifting
 * dust motes / embers. Purely decorative (aria-hidden, pointer-events none)
 * and fully disabled under prefers-reduced-motion via globals.css.
 *
 * The mote geometry is derived deterministically from the index so a given
 * story renders a stable, non-janky field. The motes are mounted only on the
 * client (after hydration) — the field is purely decorative, and rendering it
 * client-side avoids any float-precision hydration mismatch between the SSR
 * markup and the client. All numeric style values are also rounded to a fixed
 * precision so they serialize to identical strings.
 */
export function AmbientLayer({ count = 14 }: { count?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const motes = useMemo(() => {
    // Round helper keeps serialized style strings stable/identical.
    const f = (n: number, p = 2) => Number(n.toFixed(p));
    return Array.from({ length: count }, (_, i) => {
      // Deterministic pseudo-random spread using a cheap hash of the index.
      const r = (n: number) => {
        const x = Math.sin((i + 1) * n) * 10000;
        return x - Math.floor(x);
      };
      const size = f(1.5 + r(12.9898) * 3.5); // 1.5 - 5px
      const left = f(r(78.233) * 100); // vw
      const dur = f(18 + r(43.14) * 20); // 18 - 38s
      const delay = f(-r(11.7) * dur); // negative so the field starts mid-flight
      const sway = f((r(3.7) - 0.5) * 80); // -40 - 40px lateral drift
      const opacity = f(0.4 + r(9.1) * 0.5);
      return { size, left, dur, delay, sway, opacity };
    });
  }, [count]);

  return (
    <div className="rs-ambient" aria-hidden>
      <div className="rs-ambient__halo" />
      {mounted &&
        motes.map((m, i) => (
          <span
            key={i}
            className="rs-mote"
            style={
              {
                left: `${m.left}vw`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.opacity,
                "--rs-mote-dur": `${m.dur}s`,
                "--rs-mote-delay": `${m.delay}s`,
                "--rs-mote-sway": `${m.sway}px`,
              } as React.CSSProperties
            }
          />
        ))}
    </div>
  );
}
