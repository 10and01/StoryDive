"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStory } from "@/lib/story/library";
import { StoryGraphViews } from "@/components/story/story-graph-views";
import { NodeSheet } from "@/components/story/node-sheet";
import { BranchDetailSheet } from "@/components/story/branch-detail-sheet";
import { AmbientPlayer } from "@/components/story/ambient-player";
import { useBranches } from "@/components/story/branch-store";

export default function GraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const story = getStory(id);
  const { forStory } = useBranches();
  // 图谱上被点开的节点（人物 / 事件 / 抉择）
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  // 图谱上被点开的用户支线（回看内容）
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  if (!story) notFound();

  const storyBranches = forStory(story.id);
  const activeBranch =
    storyBranches.find((b) => b.id === activeBranchId) ?? null;
  const branches = storyBranches.map((b) => ({
    id: b.id,
    anchorId:
      story.nodes.find((n) => n.kind === "choice")?.id ?? story.nodes[0]?.id ?? "",
    label: b.title.length > 6 ? b.title.slice(0, 6) + "…" : b.title,
  }));

  const activeNodeRaw = story.nodes.find((n) => n.id === activeNodeId) ?? null;
  const activeNode = activeNodeRaw
    ? {
        ...activeNodeRaw,
        brief:
          activeNodeRaw.brief ??
          (activeNodeRaw.kind === "character"
            ? undefined
            : story.chapters
                .find((ch) => ch.index === activeNodeRaw.chapter)
                ?.paragraphs.slice(0, 2)
                .join("\n")),
      }
    : null;
  const activeNodeCharacter =
    activeNode?.kind === "character"
      ? story.characters.find((c) => c.id === activeNode.id) ?? null
      : null;

  // 图谱页里点击入局点 → 跳到阅读页并自动定位/开启该入局点
  function openEnterByIndex(idx: number) {
    router.push(`/read/${story!.id}?enter=${idx}`);
  }

  return (
    <div
      className="relative isolate min-h-[100svh] w-full"
      style={{
        paddingTop: "var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px)))",
      }}
      data-el="graph-shell"
    >
      <div className="rs-grain" aria-hidden />
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/read/${story.id}`}
            className="flex items-center gap-1 text-sm text-[color:var(--muted-foreground)]"
            data-el="graph-back"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <AmbientPlayer mood={story.ambientMood ?? "calm"} label={story.title} />
        </div>

        <header className="mb-4">
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted-foreground)]">
            {story.title}
          </div>
          <h1 className="font-heading text-[clamp(26px,8vw,44px)] leading-tight">
            {t("graph.title")}
          </h1>
        </header>

        <section
          className="relative border border-[color:var(--border)] bg-gradient-to-b from-[#10110f]/95 to-[#211f18]/90 p-3 shadow-[0_16px_42px_rgba(0,0,0,.34)]"
          data-el="graph-canvas"
        >
          <StoryGraphViews
            nodes={story.nodes}
            edges={story.edges}
            chapters={story.chapters}
            enterPoints={story.enterPoints}
            branches={branches}
            onNodeClick={(nodeId) => setActiveNodeId(nodeId)}
            onEnterClick={openEnterByIndex}
            onBranchClick={(branchId) => setActiveBranchId(branchId)}
          />
        </section>

        {/* branch list grown on this graph */}
        <section className="mt-5">
          <h2 className="mb-2 font-heading text-lg">
            {t("graph.branchesGrown", { count: storyBranches.length })}
          </h2>
          <ul className="grid gap-2">
            {storyBranches.map((b) => (
              <li
                key={b.id}
                className="border-l-2 border-[color:var(--rs-cool)] bg-[#211f18] p-3"
                data-el="graph-branch-item"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="bg-[color:var(--primary)]/15 px-1.5 py-0.5 text-[10px] text-[color:var(--primary)]">
                    {t(`branches.kinds.${b.kind}`)}
                  </span>
                  <span className="font-heading text-sm text-[color:var(--rs-ink)]">
                    {b.title}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                  {b.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <NodeSheet
        node={activeNode}
        character={activeNodeCharacter}
        open={!!activeNodeId}
        onClose={() => setActiveNodeId(null)}
        canTalk={
          !!activeNodeCharacter &&
          story.enterPoints.some((p) =>
            p.presentCharacterIds.includes(activeNodeCharacter.id),
          )
        }
        onTalk={() => {
          if (!activeNodeCharacter) return;
          setActiveNodeId(null);
          router.push(`/read/${story.id}?talk=${activeNodeCharacter.id}`);
        }}
        onOpenEnter={() => {
          setActiveNodeId(null);
          router.push(`/read/${story.id}`);
        }}
      />
      <BranchDetailSheet
        branch={activeBranch}
        open={!!activeBranchId}
        onClose={() => setActiveBranchId(null)}
        onContinue={(b) => {
          setActiveBranchId(null);
          router.push(`/read/${b.storyId}?enter=1&at=${b.anchorParagraph}&from=${b.id}`);
        }}
      />
    </div>
  );
}
