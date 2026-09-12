"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Story } from "@/lib/story/types";

/**
 * A cinematic, cover-style entrance that plays once when the reader opens a
 * story. It fades a full-bleed title card in over the page, and on tap (or
 * after an idle beat) dissolves away to reveal the text — echoing the
 * "tap anywhere to continue" ritual of an interactive literary intro.
 *
 * It is purely presentational: it renders on top of the already-mounted
 * reader, so no functionality is gated behind it. Dismissing simply removes
 * the overlay. It does not persist, so returning readers still get the
 * atmospheric opening (kept lightweight so it never feels like a barrier).
 */
export function StoryCover({ story, onDone }: { story: Story; onDone?: () => void }) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  // Auto-dissolve after a calm beat if the reader doesn't tap first.
  useEffect(() => {
    const auto = window.setTimeout(() => dismiss(), 4200);
    return () => window.clearTimeout(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      setGone(true);
      onDone?.();
    }, 720);
  }

  if (gone) return null;

  const cover = story.coverImage;
  const fallbackBackdrop = story.chapters[0]?.sceneImage ?? story.objectImage;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("reader.cover.begin")}
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") dismiss();
      }}
      data-el="story-cover"
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-end overflow-hidden bg-[#0d0e0c] px-8 pb-16 text-center ${
        leaving ? "rs-cover-leaving" : ""
      }`}
      style={{
        paddingTop: "var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px)))",
      }}
    >
      {/* Full-bleed dedicated cover art, kept sharp and legible; a purpose-made
          portrait rather than a blurred scene still, echoing a real book cover. */}
      {cover ? (
        <div className="absolute inset-0" aria-hidden>
          <Image src={cover} alt="" fill unoptimized priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0e0c]/55 via-transparent to-[#0d0e0c]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e0c] via-[#0d0e0c]/10 to-transparent" />
        </div>
      ) : fallbackBackdrop ? (
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={fallbackBackdrop}
            alt=""
            fill
            unoptimized
            className="scale-105 object-cover opacity-30 blur-[2px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0e0c]/70 via-[#0d0e0c]/85 to-[#0d0e0c]" />
        </div>
      ) : null}
      <div className="rs-ambient__halo" aria-hidden style={{ position: "absolute" }} />

      <div className="rs-cover-enter relative z-10 flex max-w-[560px] flex-col items-center">
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {story.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] tracking-[0.24em] text-[color:var(--primary)]/80"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="font-heading text-[clamp(30px,9vw,52px)] leading-tight text-[color:var(--rs-ink)] drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)]">
          {story.title}
        </h1>

        <span
          className="rs-cover-line mt-5 block h-px w-24 bg-gradient-to-r from-transparent via-[color:var(--primary)] to-transparent"
          aria-hidden
        />

        <p className="mt-5 font-heading text-[15px] leading-relaxed text-[#d9ca9b] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {story.logline}
        </p>
        <p className="mt-3 text-xs tracking-[0.14em] text-[color:var(--muted-foreground)]">
          {story.author} · {t("reader.cover.chapters", { count: story.chapters.length })}
        </p>

        <span className="rs-prompt mt-12 text-xs tracking-[0.3em] text-[color:var(--primary)]">
          {t("reader.cover.begin")}
        </span>
      </div>
    </div>
  );
}
