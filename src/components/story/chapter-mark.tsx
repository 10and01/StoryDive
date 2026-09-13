"use client";

import { useTranslation } from "react-i18next";
import type { StoryChapter } from "@/lib/story/types";

/**
 * A ceremonial chapter heading used inline in the reading flow. Instead of a
 * plain <h2>, a new chapter arrives with an ornamental act mark, twin rules,
 * and a serif title — giving each chapter a small sense of curtain-rise.
 *
 * Rendered inline (not an overlay) so it never interrupts scrolling; the
 * one-shot letter-spacing animation plays as the block reveals.
 */
export function ChapterMark({ chapter }: { chapter: StoryChapter }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 mt-6 flex flex-col items-center text-center" data-el="chapter-head">
      <span className="rs-chapter-mark text-[11px] font-medium tracking-[0.22em] text-[color:var(--primary)]/70">
        {t("reader.chapterMark", { index: chapter.index })}
      </span>
      <div className="mt-3 flex w-full items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[color:var(--primary)]/40" />
        <h2 className="reader-chapter-title text-[color:var(--primary)]">{chapter.title}</h2>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[color:var(--primary)]/40" />
      </div>
    </div>
  );
}
