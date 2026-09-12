"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Network, ListTree, GitBranch } from "lucide-react";
import type { GraphNode, GraphEdge, StoryChapter, EnterPoint } from "@/lib/story/types";
import { StoryGraph, GraphLegend } from "./story-graph";
import { cn } from "@/utils/utils";

export type GraphView = "relation" | "timeline" | "branch";

const KIND_COLOR: Record<GraphNode["kind"], string> = {
  character: "var(--primary)",
  event: "var(--rs-cool)",
  choice: "var(--rs-warm)",
};

interface Branch {
  id: string;
  anchorId: string;
  label: string;
  kind?: string;
}

/**
 * Three switchable graph views over the same story data:
 *  - relation : the star-link character/relationship network (existing StoryGraph)
 *  - timeline : key nodes laid out along chapters, left→right progression
 *  - branch   : enter points as a tree, with user-grown branches hanging off them
 * Every character and key event node is guaranteed a node in relation/timeline,
 * and every enter point a node in the branch tree, so nothing is orphaned.
 */
export function StoryGraphViews({
  nodes,
  edges,
  chapters,
  enterPoints,
  branches = [],
  compact = false,
  onNodeClick,
  onEnterClick,
  onBranchClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  chapters: StoryChapter[];
  enterPoints: EnterPoint[];
  branches?: Branch[];
  compact?: boolean;
  onNodeClick?: (nodeId: string) => void;
  // 点击时间线/分支树里的某个入局点时触发，回传该入局点在 enterPoints 中的下标
  onEnterClick?: (enterIndex: number) => void;
  // 点击用户长出的支线节点时触发，回传该支线 id
  onBranchClick?: (branchId: string) => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<GraphView>("relation");

  const tabs: { id: GraphView; icon: typeof Network; label: string }[] = [
    { id: "relation", icon: Network, label: t("graph.viewRelation") },
    { id: "timeline", icon: ListTree, label: t("graph.viewTimeline") },
    { id: "branch", icon: GitBranch, label: t("graph.viewBranch") },
  ];

  return (
    <div data-el="graph-views">
      {/* view switcher — segmented control that fills the row so it never
          needs a native scrollbar (which looked out of place on the dark theme) */}
      <div
        data-el="graph-view-switcher"
        className="mb-2 grid grid-cols-3 gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--card)]/60 p-1 backdrop-blur-sm"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              data-el="graph-view-tab"
              aria-pressed={active}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-[5px] px-1.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-[color:var(--primary)]/[0.16] text-[color:var(--primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {view === "relation" && (
        <>
          <StoryGraph
            nodes={nodes}
            edges={edges}
            branches={branches}
            compact={compact}
            className="mb-2"
            onNodeClick={onNodeClick}
            onBranchClick={onBranchClick}
          />
          <GraphLegend />
        </>
      )}

      {view === "timeline" && (
        <TimelineView
          nodes={nodes}
          chapters={chapters}
          enterPoints={enterPoints}
          onNodeClick={onNodeClick}
          onEnterClick={onEnterClick}
        />
      )}

      {view === "branch" && (
        <BranchTreeView
          enterPoints={enterPoints}
          branches={branches}
          onEnterClick={onEnterClick}
          onBranchClick={onBranchClick}
        />
      )}
    </div>
  );
}

/** 情节时间线：每章一列，节点按所属章节从左到右排布 */
function TimelineView({
  nodes,
  chapters,
  enterPoints,
  onNodeClick,
  onEnterClick,
}: {
  nodes: GraphNode[];
  chapters: StoryChapter[];
  enterPoints: EnterPoint[];
  onNodeClick?: (nodeId: string) => void;
  onEnterClick?: (enterIndex: number) => void;
}) {
  const { t } = useTranslation();
  // 计算每章展平后的起止全局段落 index，用于把没有 chapter 的事件节点也归入某章
  const chapterRanges = chapters.map((ch, i) => {
    const start = chapters.slice(0, i).reduce((s, c) => s + c.paragraphs.length, 0);
    return { ch, start, end: start + ch.paragraphs.length - 1 };
  });
  const enterChapter = (globalIdx: number) =>
    chapterRanges.find((r) => globalIdx >= r.start && globalIdx <= r.end)?.ch.index ?? 1;

  return (
    <div className="overflow-x-auto no-native-scrollbar" data-el="graph-timeline">
      <div className="flex min-w-max gap-3 pb-2">
        {chapters.map((ch) => {
          const chNodes = nodes.filter(
            (n) => n.kind !== "character" && n.chapter === ch.index,
          );
          const chEnters = enterPoints.filter((ep) => enterChapter(ep.paragraphIndex) === ch.index);
          return (
            <div
              key={ch.index}
              className="w-40 shrink-0 border-l-2 border-[color:var(--rs-cool)]/60 pl-2.5"
              data-el="timeline-chapter"
            >
              <div className="mb-1 text-[11px] font-medium text-[color:var(--rs-cool)]">
                {ch.title}
              </div>
              <div className="grid gap-1.5">
                {chNodes.length === 0 && chEnters.length === 0 && (
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">
                    {t("graph.timelineEmpty")}
                  </span>
                )}
                {chNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onNodeClick?.(n.id)}
                    disabled={!onNodeClick}
                    data-el="timeline-node"
                    className="flex items-center gap-1.5 text-left text-[12px] text-[color:var(--rs-ink)] enabled:cursor-pointer enabled:hover:text-[color:var(--primary)]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: KIND_COLOR[n.kind], boxShadow: `0 0 8px ${KIND_COLOR[n.kind]}` }}
                    />
                    {n.label}
                  </button>
                ))}
                {chEnters.map((ep) => {
                  const idx = enterPoints.indexOf(ep);
                  return (
                    <button
                      key={`ep-${ch.index}-${idx}`}
                      onClick={() => onEnterClick?.(idx)}
                      disabled={!onEnterClick}
                      data-el="timeline-enter"
                      title={t("graph.timelineEnterTap")}
                      className="flex items-start gap-1.5 text-left text-[11px] leading-snug text-[color:var(--rs-warm)] enabled:cursor-pointer enabled:hover:opacity-80"
                    >
                      <span className="rs-pin mt-0.5 h-2 w-2 shrink-0" aria-hidden />
                      {ep.hint.length > 22 ? ep.hint.slice(0, 22) + "…" : ep.hint}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 入局点 / 分支树：每个入局点是一个节点，用户长出的支线挂在其下 */
function BranchTreeView({
  enterPoints,
  branches,
  onEnterClick,
  onBranchClick,
}: {
  enterPoints: EnterPoint[];
  branches: Branch[];
  onEnterClick?: (enterIndex: number) => void;
  onBranchClick?: (branchId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2.5" data-el="graph-branch-tree">
      {enterPoints.map((ep, i) => {
        // 所有用户支线都挂在第一个入局点下展示（图谱为概览，不强绑定锚点）
        const grown = i === 0 ? branches : [];
        return (
          <div key={i} className="border-l-2 border-[color:var(--rs-warm)]/60 pl-2.5">
            <button
              onClick={() => onEnterClick?.(i)}
              disabled={!onEnterClick}
              data-el="branch-enter"
              title={t("graph.timelineEnterTap")}
              className="flex items-center gap-1.5 text-left enabled:cursor-pointer enabled:hover:opacity-80"
            >
              <span className="rs-pin h-2.5 w-2.5 shrink-0" aria-hidden />
              <span className="text-[13px] text-[color:var(--rs-ink)]">{ep.hint}</span>
            </button>
            {ep.branchOptions && ep.branchOptions.length > 0 && (
              <div className="mt-1 ml-4 grid gap-1">
                {ep.branchOptions.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => onEnterClick?.(i)}
                    disabled={!onEnterClick}
                    data-el="branch-option"
                    title={t("graph.optionTap")}
                    className="flex items-center gap-1.5 text-left text-[11px] text-[color:var(--muted-foreground)] enabled:cursor-pointer enabled:hover:text-[color:var(--rs-warm)]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--rs-warm)]/70" />
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {grown.length > 0 && (
              <div className="mt-1.5 ml-4 grid gap-1">
                {grown.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onBranchClick?.(b.id)}
                    disabled={!onBranchClick}
                    data-el="branch-grown"
                    title={t("graph.branchTap")}
                    className="flex items-center gap-1.5 text-left text-[11px] text-[color:var(--rs-cool)] enabled:cursor-pointer enabled:hover:opacity-80"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--rs-cool)]" style={{ boxShadow: "0 0 8px var(--rs-cool)" }} />
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {enterPoints.length === 0 && (
        <span className="text-[12px] text-[color:var(--muted-foreground)]">
          {t("graph.branchEmpty")}
        </span>
      )}
    </div>
  );
}
