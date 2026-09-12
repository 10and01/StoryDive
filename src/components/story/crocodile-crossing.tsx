"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";

/**
 * A bespoke signature-gesture set piece for shuituzhuo's viral turning
 * point: the reader drags the capybara across the water onto the
 * crocodile's back, re-enacting the scene rather than just reading past it —
 * in the spirit of the reference site's tap/trace rituals (a portal sigil,
 * a mirror wipe, a constellation trace).
 *
 * Purely presentational and non-blocking: it renders inline in the normal
 * paced reading flow. Whether or not the reader drags it to completion, the
 * existing "continue" / auto-reveal flow beneath it still advances the
 * story — no core functionality is gated behind this gesture.
 */
export function CrocodileCrossing() {
  const { t } = useTranslation();
  const [landed, setLanded] = useState(false);
  const x = useMotionValue(0);
  const trackWidth = 220; // px of horizontal travel available to the drag
  const rippleScale = useTransform(x, [0, trackWidth], [0.4, 1]);

  return (
    <div
      data-el="scene-crocodile-crossing"
      className="relative mt-1 overflow-hidden border border-[color:var(--primary)]/30"
    >
      <div className="rs-croc-water relative h-[168px] w-full overflow-hidden">
        {/* ripples emanating from the crocodile's back, more insistent before landing */}
        {!landed && (
          <>
            <span
              className="rs-croc-ripple"
              style={{ left: "76%", top: "50%", width: 26, height: 26, marginLeft: -13, marginTop: -13 }}
              aria-hidden
            />
            <span
              className="rs-croc-ripple"
              style={{
                left: "76%",
                top: "50%",
                width: 26,
                height: 26,
                marginLeft: -13,
                marginTop: -13,
                animationDelay: "0.8s",
              }}
              aria-hidden
            />
          </>
        )}

        {/* crocodile medallion, resting at the far bank */}
        <div className="absolute right-4 top-1/2 h-16 w-16 -translate-y-1/2 overflow-hidden rounded-full ring-2 ring-[color:var(--primary)]/50">
          <Image
            src="/scenes/crocodile-medallion.png"
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        </div>

        {/* draggable capybara — the reader performs the gesture */}
        <motion.div
          drag={landed ? false : "x"}
          dragConstraints={{ left: 0, right: trackWidth }}
          dragElastic={0.06}
          dragMomentum={false}
          style={{ x, left: 16, top: "50%", y: "-50%" }}
          className="absolute h-16 w-16 cursor-grab touch-none overflow-hidden rounded-full ring-2 ring-[color:var(--rs-warm)]/70 active:cursor-grabbing"
          onDragEnd={(_, info) => {
            if (info.point.x - info.offset.x + info.offset.x >= 0 && x.get() > trackWidth * 0.72) {
              setLanded(true);
            }
          }}
          animate={landed ? { x: trackWidth - 6 } : undefined}
          data-el="scene-crocodile-drag"
          aria-label={t("scene.crocodile.drag")}
        >
          <Image
            src="/scenes/capybara-medallion.png"
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        </motion.div>

        {/* subtle progress rail so the gesture reads as "cross the river" */}
        <div className="absolute inset-x-4 top-[calc(50%+40px)] h-px bg-[color:var(--primary)]/20" aria-hidden />
        <motion.div
          className="absolute top-[calc(50%+40px)] h-px bg-[color:var(--primary)]/70"
          style={{ left: 16, width: x, scaleX: rippleScale }}
          aria-hidden
        />
      </div>

      {!landed ? (
        <p className="rs-prompt bg-[#0d0e0c] px-3 py-2 text-center text-[11px] tracking-[0.14em] text-[color:var(--primary)]">
          {t("scene.crocodile.hint")}
        </p>
      ) : (
        <div className="rs-viral-burst bg-[#0d0e0c] px-3 py-3 text-center">
          <p className="font-heading text-sm text-[color:var(--rs-ink)]">
            {t("scene.crocodile.landed")}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="rs-viral-tag border border-[color:var(--rs-warm)]/50 bg-[color:var(--rs-warm)]/10 px-2 py-0.5 text-[10px] tracking-[0.06em] text-[color:var(--rs-warm)]"
                style={{ animationDelay: `${0.1 + i * 0.12}s` }}
              >
                {t(`scene.crocodile.tag${i}`)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
