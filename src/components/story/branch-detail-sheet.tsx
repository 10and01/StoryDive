"use client";

import { X, MessageCircle, GitFork, PenLine, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StoryBranch, BranchKind } from "@/lib/story/types";
import { cn } from "@/utils/utils";

const KIND_ICON: Record<BranchKind, typeof MessageCircle> = {
  dialogue: MessageCircle,
  fork: GitFork,
  rewrite: PenLine,
};

/**
 * 图谱里点击用户长出的支线节点后弹出的详情面板：回看该支线的完整内容，
 * 并可「接着往下玩」跳回阅读页从那一幕继续。
 */
export function BranchDetailSheet({
  branch,
  open,
  onClose,
  onContinue,
}: {
  branch: StoryBranch | null;
  open: boolean;
  onClose: () => void;
  onContinue: (branch: StoryBranch) => void;
}) {
  const { t } = useTranslation();
  if (!branch) return null;
  const Icon = KIND_ICON[branch.kind];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden />
      )}
      <section
        className={cn(
          "fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[480px] border border-[color:var(--rs-cool)]/60 bg-[#211f18] shadow-[0_22px_60px_rgba(0,0,0,.58)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-[130%]",
        )}
        style={{
          marginBottom: "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
        }}
        aria-hidden={!open}
        data-el="branch-detail-sheet"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[color:var(--sidebar-border)] p-4">
          <div className="min-w-0">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--rs-cool)]">
              <Icon className="h-3.5 w-3.5" />
              {t(`branches.kinds.${branch.kind}`)}
              {" · "}
              {t("branches.anchor", { n: branch.anchorParagraph + 1 })}
            </span>
            <h2 className="font-heading text-lg text-[color:var(--rs-ink)]">
              {branch.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-[color:var(--rs-cool)]/55 bg-[#171817]/70"
          >
            <X className="h-4 w-4 text-[color:var(--rs-ink)]" />
          </button>
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#d9ca9b]">
            {branch.body}
          </p>
        </div>

        <div className="border-t border-[color:var(--sidebar-border)] p-4">
          <button
            onClick={() => onContinue(branch)}
            className="flex w-full items-center justify-center gap-1.5 border border-[color:var(--primary)] bg-[color:var(--primary)]/[0.12] px-3 py-2.5 text-sm text-[color:var(--primary)]"
            data-el="branch-detail-continue"
          >
            <Play className="h-4 w-4" />
            {t("branches.continue")}
          </button>
        </div>
      </section>
    </>
  );
}
