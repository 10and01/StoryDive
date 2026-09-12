"use client";

import { useUser } from "@/components/user-profile/user-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  GitFork,
  PenLine,
  Share2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Play,
  CornerDownRight,
  Landmark,
  Loader2,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BranchKind } from "@/lib/story/types";
import { buildStoryForest, flattenTree } from "@/lib/story/branch-tree";
import type { StoryBranch } from "@/lib/story/types";
import { getStory } from "@/lib/story/library";
import { publishToWorkshop } from "@/lib/api/workshop";
import { SceneShareModal } from "./scene-share-modal";

const KIND_ICON: Record<BranchKind, typeof MessageCircle> = {
  dialogue: MessageCircle,
  fork: GitFork,
  rewrite: PenLine,
};

// 直接把某条支线一键发布到「名场面殿堂」（无需绕进分享弹窗）。
function PublishButton({ branch }: { branch: StoryBranch }) {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function publish() {
    if (!user) {
      login();
      return;
    }
    if (state !== "idle") return;
    setState("busy");
    try {
      const story = getStory(branch.storyId);
      const enterHint = story?.enterPoints.find(
        (e) => e.paragraphIndex === branch.anchorParagraph,
      )?.hint;
      await publishToWorkshop({
        storyId: branch.storyId,
        storyTitle: branch.storyTitle,
        anchorParagraph: branch.anchorParagraph,
        enterHint: enterHint ?? branch.title,
        kind: branch.kind,
        title: branch.title,
        body: branch.body,
      });
      setState("done");
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={() => void publish()}
      disabled={state !== "idle"}
      className="flex items-center gap-1.5 border border-[color:var(--primary)] bg-[color:var(--primary)]/12 px-3 py-1.5 text-xs text-[color:var(--primary)] disabled:opacity-70"
      data-el="branch-publish"
    >
      {state === "busy" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Landmark className="h-3.5 w-3.5" />
      )}
      {state === "done"
        ? t("branches.published")
        : user
          ? t("branches.publish")
          : t("branches.loginToPublish")}
    </button>
  );
}

export function BranchForest({ branches }: { branches: StoryBranch[] }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const forest = buildStoryForest(branches);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // 当前正在生成/分享名场面卡片的支线
  const [shareBranch, setShareBranch] = useState<StoryBranch | null>(null);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(
      i18n.language === "zh-CN" ? "zh-CN" : "en-US",
      { month: "short", day: "numeric" },
    );

  return (
    <div className="grid gap-5" data-el="branch-forest">
      {forest.map((tree) => {
        const isOpen = !collapsed.has(tree.storyId);
        const rows = flattenTree(tree.roots);
        return (
          <section
            key={tree.storyId}
            className="border border-[color:var(--border)] bg-[#211f18]"
            data-el="story-tree"
          >
            {/* 作品树标题条 */}
            <button
              onClick={() => toggle(tree.storyId)}
              className="flex w-full items-center gap-2 border-b border-[color:var(--sidebar-border)] px-3.5 py-3 text-left"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--primary)]" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--primary)]" />
              )}
              <BookOpen className="h-4 w-4 shrink-0 text-[color:var(--rs-cool)]" />
              <span className="min-w-0 flex-1 truncate font-heading text-base text-[color:var(--rs-ink)]">
                {tree.storyTitle}
              </span>
              <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)]">
                {t("branches.count", { n: tree.total })}
              </span>
            </button>

            {isOpen && (
              <ul className="grid gap-2.5 p-3" data-el="tree-nodes">
                {rows.map((node) => {
                  const b = node.branch;
                  const Icon = KIND_ICON[b.kind];
                  const isChild = node.depth > 0;
                  return (
                    <li
                      key={b.id}
                      style={{ marginLeft: node.depth * 16 }}
                      className="relative border border-[color:var(--border)] bg-[#1b1a14] p-3"
                      data-el="tree-node"
                    >
                      {isChild && (
                        <span
                          className="absolute -left-[11px] top-4 flex items-center gap-1 text-[color:var(--primary)]/60"
                          aria-hidden
                        >
                          <CornerDownRight className="h-3 w-3" />
                        </span>
                      )}
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
                          <Icon className="h-3.5 w-3.5" />
                          {t(`branches.kinds.${b.kind}`)}
                        </span>
                        <span className="text-[11px] text-[color:var(--muted-foreground)]">
                          {dateOf(b.createdAt)}
                        </span>
                      </div>
                      <div className="mb-1 text-[10px] text-[color:var(--muted-foreground)]">
                        {isChild
                          ? t("branches.continued")
                          : t("branches.root")}
                        {" · "}
                        {t("branches.anchor", { n: b.anchorParagraph + 1 })}
                      </div>
                      <h3 className="font-heading text-[15px] text-[color:var(--rs-ink)]">
                        {b.title}
                      </h3>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#d9ca9b]">
                        {b.body}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            router.push(
                              `/read/${b.storyId}?enter=1&at=${b.anchorParagraph}&from=${b.id}`,
                            )
                          }
                          className="flex items-center gap-1.5 border border-[color:var(--primary)] bg-[color:var(--primary)]/10 px-3 py-1.5 text-xs text-[color:var(--primary)]"
                          data-el="branch-continue"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {t("branches.continue")}
                        </button>
                        <button
                          onClick={() => setShareBranch(b)}
                          className="flex items-center gap-1.5 border border-[color:var(--primary)]/50 px-3 py-1.5 text-xs text-[color:var(--primary)]"
                          data-el="branch-share"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          {t("branches.share")}
                        </button>
                        <PublishButton branch={b} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {shareBranch && (
        <SceneShareModal branch={shareBranch} onClose={() => setShareBranch(null)} />
      )}
    </div>
  );
}
