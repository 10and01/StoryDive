"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import { STORIES } from "@/lib/story/library";
import { NONFICTION_SHELF } from "@/lib/story/reason";
import { ShelfBoard, type Relic } from "@/components/story/shelf-board";
import { WelcomeCover } from "@/components/onboarding/welcome-cover";

// 非虚构作品的标签（原数据无 tags，这里按题材补充，用于标签化管理）
const NONFICTION_TAGS: Record<string, string[]> = {
  yancheng: ["纪实", "历史", "战役", "推理"],
  changzheng: ["纪实", "历史", "长征", "推理"],
  medical: ["纪实", "医疗", "科普", "推理"],
  persona: ["纪实", "媒体素养", "事实核查", "推理"],
};

export default function ShelfPage() {
  const { t } = useTranslation();
  const [welcomeVisible, setWelcomeVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
    try {
      setWelcomeVisible(localStorage.getItem("ruju:welcome-seen:v1") !== "1");
    } catch {
      setWelcomeVisible(false);
    }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const relics: Relic[] = [
    ...STORIES.map((s) => ({
      id: s.id,
      title: s.title,
      kind: "fiction" as const,
      logline: s.logline,
      author: s.author,
      tags: s.tags ?? [],
      objectImage: s.objectImage,
      objectAlt: s.objectAlt,
      href: `/read/${s.id}`,
    })),
    ...NONFICTION_SHELF.map((n) => ({
      id: n.id,
      title: n.title,
      kind: "nonfiction" as const,
      logline: n.logline,
      tags: NONFICTION_TAGS[n.id] ?? ["纪实"],
      objectImage: n.objectImage,
      objectAlt: n.objectAlt,
      href: `/reason/${n.id}`,
    })),
  ];

  return (
    <>
      <AppShell>
      <header
        className="mb-3 grid grid-cols-[1fr_auto] items-end gap-3 border-b border-[color:var(--sidebar-border)] pb-2.5"
        data-el="shelf-masthead"
      >
        <div>
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted-foreground)]">
            {t("shelf.kicker")}
          </div>
          <h1 className="mt-0.5 font-heading text-[clamp(32px,10vw,60px)] leading-[1.1] tracking-[-0.02em]">
            {t("shelf.title")}
          </h1>
        </div>
        <div className="rotate-2 border border-[color:var(--primary)] bg-[#171817]/70 px-2.5 py-1.5 text-xs leading-none text-[color:var(--primary)]">
          {t("shelf.stamp")}
        </div>
      </header>

      <p className="mb-3.5 font-heading text-[15px] leading-relaxed text-[#d9ca9b]">
        {t("shelf.sub", { count: relics.length })}
      </p>

      <ShelfBoard relics={relics} />
      </AppShell>
      {welcomeVisible && <WelcomeCover onEnter={() => setWelcomeVisible(false)} />}
    </>
  );
}
