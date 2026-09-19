"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import { STORIES } from "@/lib/story/library";
import { NONFICTION_SHELF } from "@/lib/story/reason";
import { ShelfBoard, type Relic } from "@/components/story/shelf-board";

const NONFICTION_TAGS: Record<string, string[]> = {
  yancheng: ["纪实", "历史", "战役", "推理"],
  changzheng: ["纪实", "历史", "长征", "推理"],
  medical: ["纪实", "医疗", "科普", "推理"],
  persona: ["纪实", "媒体素养", "事实核查", "推理"],
};

export function ShelfPageContent() {
  const { t } = useTranslation();
  const relics: Relic[] = [
    ...STORIES.map((story) => ({
      id: story.id,
      title: story.title,
      kind: "fiction" as const,
      logline: story.logline,
      author: story.author,
      tags: story.tags ?? [],
      objectImage: story.objectImage,
      objectAlt: story.objectAlt,
      href: `/read/${story.id}`,
    })),
    ...NONFICTION_SHELF.map((item) => ({
      id: item.id,
      title: item.title,
      kind: "nonfiction" as const,
      logline: item.logline,
      tags: NONFICTION_TAGS[item.id] ?? ["纪实"],
      objectImage: item.objectImage,
      objectAlt: item.objectAlt,
      href: `/reason/${item.id}`,
    })),
  ];
  return (
    <AppShell>
      <header className="mb-3 grid grid-cols-[1fr_auto] items-end gap-3 border-b border-[color:var(--sidebar-border)] pb-2.5" data-el="shelf-masthead">
        <div>
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted-foreground)]">{t("shelf.kicker")}</div>
          <h1 className="mt-0.5 font-heading text-[clamp(32px,10vw,60px)] leading-[1.1] tracking-[-0.02em]">{t("shelf.title")}</h1>
        </div>
        <div className="rotate-2 border border-[color:var(--primary)] bg-[#171817]/70 px-2.5 py-1.5 text-xs leading-none text-[color:var(--primary)]">{t("shelf.stamp")}</div>
      </header>
      <p className="mb-3.5 font-heading text-[15px] leading-relaxed text-[#d9ca9b]">{t("shelf.sub", { count: relics.length })}</p>
      <ShelfBoard relics={relics} />
    </AppShell>
  );
}
