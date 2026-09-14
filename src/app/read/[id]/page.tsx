"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound, useSearchParams } from "next/navigation";
import { ChevronLeft, Share2, ChevronDown, ScrollText, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStory } from "@/lib/story/library";
import type { EnterPoint, StoryChapter } from "@/lib/story/types";
import { StoryGraphViews } from "@/components/story/story-graph-views";
import { EnterSheet } from "@/components/story/enter-sheet";
import { NodeSheet } from "@/components/story/node-sheet";
import { TypographySheet } from "@/components/story/typography-sheet";
import { useReaderTypography } from "@/lib/reader/use-reader-typography";
import { AmbientPlayer } from "@/components/story/ambient-player";
import { AmbientLayer } from "@/components/story/ambient-layer";
import { StoryCover } from "@/components/story/story-cover";
import { ChapterMark } from "@/components/story/chapter-mark";
import { CrocodileCrossing } from "@/components/story/crocodile-crossing";
import { ReadingProgressBar } from "@/components/story/reading-progress-bar";
import { Companion } from "@/components/story/companion";
import { useBranches } from "@/components/story/branch-store";
import { cn } from "@/utils/utils";

export default function ReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const story = getStory(id);
  const { forStory } = useBranches();

  const searchParams = useSearchParams();

  const [activePoint, setActivePoint] = useState<EnterPoint | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(true);
  // 图谱上被点开的节点（人物 / 事件 / 抉择），null 表示未打开详情面板
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  // 从图谱人物节点「找 TA 对戏」时，对戏面板默认选中的角色
  const [talkCharId, setTalkCharId] = useState<string | undefined>(undefined);
  // 从「我的平行结局」某条支线「接着往下玩」进入时，新长出的支线挂在它下面（parentId）
  const [parentBranchId, setParentBranchId] = useState<string | undefined>(undefined);
  // 逐段推进式阅读：paced=true 时逐段淡入推进；顶部「全文展开」可切回传统整页
  const [paced, setPaced] = useState(true);
  const [revealed, setRevealed] = useState(1);
  // 排版设置面板（字体 / 字号 / 行距 / 字间距 / 段间距）
  const [typoOpen, setTypoOpen] = useState(false);
  const { typography, update, reset } = useReaderTypography();
  // 封面式入场：首次进入时铺满一层电影感标题幕，轻点或稍候后淡出显露正文
  const [coverDone, setCoverDone] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const enterByParagraph = useMemo(() => {
    const map = new Map<number, EnterPoint>();
    story?.enterPoints.forEach((p) => map.set(p.paragraphIndex, p));
    return map;
  }, [story]);

  // 将分章正文展平为全局段落流，记录每章首段用于插入章节标题与配图
  const flat = useMemo(() => {
    const rows: {
      text: string;
      globalIndex: number;
      chapterStart?: StoryChapter;
    }[] = [];
    if (!story) return rows;
    let gi = 0;
    for (const ch of story.chapters) {
      ch.paragraphs.forEach((text, pi) => {
        rows.push({ text, globalIndex: gi, chapterStart: pi === 0 ? ch : undefined });
        gi += 1;
      });
    }
    return rows;
  }, [story]);

  // 沉浸模式：滚动到底部哨兵自动淡入下一段；停在入局点处等待互动
  const atEnterPoint = enterByParagraph.has(revealed - 1);
  const canAutoReveal = paced && revealed < flat.length && !atEnterPoint;
  useEffect(() => {
    if (!canAutoReveal) return;
    const el = sentinelRef.current;
    if (!el) return;
    let cooling = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || cooling) return;
        cooling = true;
        // 轻微延时，贴合“下拉到底自然浮现下一段”的体感
        window.setTimeout(() => {
          setRevealed((n) => Math.min(flat.length, n + 1));
        }, 130);
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canAutoReveal, revealed, flat.length]);

  if (!story) notFound();

  const branches = forStory(story.id).map((b) => ({
    id: b.id,
    anchorId:
      story.enterPoints.find((p) => p.paragraphIndex === b.anchorParagraph) &&
      story.nodes.find((n) => n.kind === "choice")
        ? story.nodes.find((n) => n.kind === "choice")!.id
        : story.nodes[0]?.id ?? "",
    label: b.title.length > 6 ? b.title.slice(0, 6) + "…" : b.title,
  }));

  function openPoint(p: EnterPoint) {
    // 逐段模式下，确保正文已推进到该入局点，避免直接跳到面板却看不到前文
    setRevealed((n) => Math.max(n, p.paragraphIndex + 1));
    setActivePoint(p);
    setSheetOpen(true);
  }

  // 从图谱（时间线 / 分支树 / 抉择节点）打开对应入局点的对戏面板
  function openEnterByIndex(idx: number) {
    const p = story?.enterPoints[idx];
    if (p) openPoint(p);
  }

  // 图谱人物节点「找 TA 对戏」：找一个该角色在场的入局点，选中该角色并开对戏
  function talkToCharacter(charId: string) {
    if (!story) return;
    const ep =
      story.enterPoints.find((p) => p.presentCharacterIds.includes(charId)) ??
      story.enterPoints[0];
    if (!ep) return;
    setActiveNodeId(null);
    setTalkCharId(charId);
    openPoint(ep);
  }

  // 该人物是否有可对戏的入局点（用于决定是否显示「找 TA 对戏」按钮）
  function characterCanTalk(charId: string): boolean {
    return !!story?.enterPoints.some((p) => p.presentCharacterIds.includes(charId));
  }

  // 从图谱页跳转过来时（/read/[id]?enter=N 或 ?talk=charId 或 ?enter=1&at=N&from=branchId）自动开启对应面板
  useEffect(() => {
    if (!story) return;
    const rawEnter = searchParams.get("enter");
    const rawTalk = searchParams.get("talk");
    const rawAt = searchParams.get("at");
    const rawFrom = searchParams.get("from");
    if (rawTalk) {
      const ep =
        story.enterPoints.find((p) => p.presentCharacterIds.includes(rawTalk)) ??
        story.enterPoints[0];
      if (ep) {
        setTalkCharId(rawTalk);
        setParentBranchId(undefined);
        setRevealed((n) => Math.max(n, ep.paragraphIndex + 1));
        setActivePoint(ep);
        setSheetOpen(true);
      }
      return;
    }
    if (rawEnter == null) return;
    // 「接着往下玩」：at 指定回到哪一段，from 指定新支线要挂到哪条父支线下
    if (rawFrom) {
      const at = Number(rawAt);
      // 选中 <= at 的最近入局点，回到那一幕继续
      const candidates = story.enterPoints
        .filter((p) => !Number.isFinite(at) || p.paragraphIndex <= at)
        .sort((a, b) => b.paragraphIndex - a.paragraphIndex);
      const ep = candidates[0] ?? story.enterPoints[0];
      if (ep) {
        setParentBranchId(rawFrom);
        setTalkCharId(undefined);
        setRevealed((n) => Math.max(n, ep.paragraphIndex + 1));
        setActivePoint(ep);
        setSheetOpen(true);
      }
      return;
    }
    const idx = Number(rawEnter);
    const p = story.enterPoints[idx];
    if (p) {
      setParentBranchId(undefined);
      setRevealed((n) => Math.max(n, p.paragraphIndex + 1));
      setActivePoint(p);
      setSheetOpen(true);
    }
    // 仅在 enter/talk/at/from 参数或故事变化时执行
  }, [searchParams, story]);

  // 由全局段落 index 反查所属章节序号（供抉择节点定位其入局点）
  function enterChapterOf(globalIdx: number): number {
    if (!story) return 1;
    let start = 0;
    for (const ch of story.chapters) {
      const end = start + ch.paragraphs.length - 1;
      if (globalIdx >= start && globalIdx <= end) return ch.index;
      start = end + 1;
    }
    return story.chapters[0]?.index ?? 1;
  }

  // 点击图谱节点：人物/事件/抉择都打开详情面板；事件/抉择自动补充章节上下文
  const activeNodeRaw = story?.nodes.find((n) => n.id === activeNodeId) ?? null;
  const activeNode = activeNodeRaw
    ? {
        ...activeNodeRaw,
        brief:
          activeNodeRaw.brief ??
          (activeNodeRaw.kind === "character"
            ? undefined
            : story?.chapters
                .find((ch) => ch.index === activeNodeRaw.chapter)
                ?.paragraphs.slice(0, 2)
                .join("\n")),
      }
    : null;
  const activeNodeCharacter =
    activeNode?.kind === "character"
      ? story?.characters.find((c) => c.id === activeNode.id) ?? null
      : null;

  return (
    <div
      className="relative isolate min-h-[100svh] w-full"
      style={{
        paddingTop: "var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px)))",
      }}
      data-el="reader-shell"
    >
      <div className="rs-grain" aria-hidden />
      <AmbientLayer />
      <ReadingProgressBar />
      <div className="mx-auto w-full max-w-[680px] px-4 pb-24">
        {/* top bar：窄屏时按钮组自动换行，避免溢出 */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1 text-sm text-[color:var(--muted-foreground)]"
            data-el="reader-back"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2" data-guide="reader-controls">
            <AmbientPlayer mood={story.ambientMood ?? "calm"} label={story.title} />
            <button
              onClick={() => setTypoOpen(true)}
              data-el="reader-typography"
              aria-label={t("reader.typography.title")}
              className="flex items-center gap-1.5 border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)]"
            >
              <Type className="h-3.5 w-3.5" />
              {t("reader.typography.open")}
            </button>
            <button
              onClick={() => setPaced((v) => !v)}
              aria-pressed={!paced}
              data-el="reader-pace-toggle"
              className={cn(
                "flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
                paced
                  ? "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
                  : "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.12] text-[color:var(--primary)]",
              )}
            >
              <ScrollText className="h-3.5 w-3.5" />
              {paced ? t("reader.pace.expand") : t("reader.pace.paced")}
            </button>
            <Link
              href={`/graph/${story.id}`}
              className="flex items-center gap-1.5 border border-[color:var(--primary)]/50 px-2.5 py-1 text-xs text-[color:var(--primary)]"
              data-el="reader-graph-link"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t("reader.graphToggle")}
            </Link>
          </div>
        </div>

        {/* title */}
        <header className="mb-4 border-b border-[color:var(--sidebar-border)] pb-3">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {story.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] tracking-[0.12em] text-[color:var(--muted-foreground)]"
              >
                #{tag}
              </span>
            ))}
          </div>
          <h1 className="font-heading text-[clamp(26px,7vw,40px)] leading-tight">
            {story.title}
          </h1>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            {story.author}
          </p>
          <p className="mt-2 font-heading text-sm leading-relaxed text-[#d9ca9b]">
            {story.logline}
          </p>
          {/* 版权归属：保留作者、作品名、work_id、来源（知乎盐言故事要求，不可删除） */}
          <div
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border border-[color:var(--border)]/60 bg-[color:var(--card)]/40 px-2.5 py-1.5 text-[10px] leading-relaxed text-[color:var(--muted-foreground)]"
            data-el="attribution"
          >
            <span>{t("reader.source")} · {story.source}</span>
            <span aria-hidden>·</span>
            <span>{t("reader.author")} · {story.author}</span>
            {story.workId && story.workId !== "pending" && (
              <>
                <span aria-hidden>·</span>
                <span>work_id · {story.workId}</span>
              </>
            )}
          </div>
        </header>

        {/* body flow with chapters, inline scene images, and enter points */}
        <article className="reader-flow" data-el="reader-body">
          {flat
            .filter((row) => !paced || row.globalIndex < revealed)
            .map((row) => {
            const ep = enterByParagraph.get(row.globalIndex);
            const isNewest = paced && row.globalIndex === revealed - 1;
            return (
              <div key={row.globalIndex} className={isNewest ? "rs-fade-up" : undefined}>
                {row.chapterStart && (
                  <div className="mb-3 mt-2">
                    <ChapterMark chapter={row.chapterStart} />
                    {row.chapterStart.sceneImage && (
                      <div className="relative mt-1 aspect-[3/2] w-full overflow-hidden border border-[color:var(--border)]">
                        <Image
                          src={row.chapterStart.sceneImage}
                          alt={row.chapterStart.title}
                          fill
                          unoptimized
                          className="scale-105 object-cover transition-transform duration-[3000ms] ease-out"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#10110f] via-[#10110f]/40 to-transparent" />
                        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(13,14,12,0.9)]" />
                      </div>
                    )}
                  </div>
                )}
                <p className="reader-typography text-[color:var(--rs-ink)]">
                  {row.text}
                </p>
                {story.id === "shuituzhuo" && row.globalIndex === 16 && (
                  <div className="mt-2.5">
                    <CrocodileCrossing />
                  </div>
                )}
                {ep && (
                  <button
                    onClick={() => openPoint(ep)}
                    data-el="enter-point"
                    className="mt-2.5 flex w-full items-center gap-2.5 border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--primary)]/[0.12]"
                  >
                    <span className="rs-pin h-3 w-3 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[10px] tracking-[0.14em] text-[color:var(--primary)]">
                        {t("reader.enterHint")}
                      </span>
                      <span className="block truncate text-[13px] text-[#d9ca9b]">
                        {ep.hint}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            );
          })}

          {/* 沉浸模式：滚动到底自动淡入下一段；停在入局点处保留手动继续 */}
          {paced && revealed < flat.length && (
            <>
              <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
              {atEnterPoint ? (
                <button
                  onClick={() => setRevealed((n) => Math.min(flat.length, n + 1))}
                  data-el="reader-continue"
                  className="mt-1 flex w-full flex-col items-center gap-1 border border-dashed border-[color:var(--primary)]/40 py-3 text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/[0.06]"
                >
                  <ChevronDown className="h-4 w-4 animate-bounce" />
                  <span className="text-xs tracking-[0.14em]">
                    {t("reader.pace.continueAfterEnter")}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setRevealed((n) => Math.min(flat.length, n + 1))}
                  data-el="reader-continue"
                  className="mt-1 flex w-full flex-col items-center gap-1 py-3 text-[color:var(--muted-foreground)] transition-opacity"
                >
                  <ChevronDown className="h-4 w-4 animate-pulse opacity-60" />
                  <span className="text-[10px] tracking-[0.16em] opacity-70">
                    {t("reader.pace.scrollHint")}
                  </span>
                </button>
              )}
            </>
          )}

          {/* 完整版权/改编声明（知乎盐言故事要求，不可删除） */}
          {(!paced || revealed >= flat.length) && story.attribution && (
            <p
              className="mt-4 border-t border-[color:var(--border)]/50 pt-3 text-[10px] leading-relaxed text-[color:var(--muted-foreground)]"
              data-el="attribution-notice"
            >
              {story.attribution}
            </p>
          )}
        </article>
      </div>

      {/* persistent collapsible graph dock */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[#10110f]/96 backdrop-blur"
        style={{
          paddingBottom: "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
        }}
        data-el="graph-dock"
      >
        <button
          onClick={() => setGraphOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5"
        >
          <span className="flex items-center gap-2 text-sm text-[color:var(--primary)]">
            <Share2 className="h-4 w-4" />
            {t("graph.title")}
            {branches.length > 0 && (
              <span className="text-[11px] text-[color:var(--rs-cool)]">
                · {t("graph.branchesGrown", { count: branches.length })}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", graphOpen && "rotate-180")}
          />
        </button>
        {graphOpen && (
          <div className="max-w-[680px] px-4 pb-3 mx-auto">
            <StoryGraphViews
              nodes={story.nodes}
              edges={story.edges}
              chapters={story.chapters}
              enterPoints={story.enterPoints}
              branches={branches}
              compact
              onNodeClick={(nodeId) => setActiveNodeId(nodeId)}
              onEnterClick={openEnterByIndex}
              onBranchClick={(branchId) => {
                const b = forStory(story.id).find((x) => x.id === branchId);
                if (!b) return;
                const candidates = story.enterPoints
                  .filter((p) => p.paragraphIndex <= b.anchorParagraph)
                  .sort((x, y) => y.paragraphIndex - x.paragraphIndex);
                const ep = candidates[0] ?? story.enterPoints[0];
                if (ep) {
                  setParentBranchId(b.id);
                  setTalkCharId(undefined);
                  setActivePoint(ep);
                  setSheetOpen(true);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* 刘看山伴读：知道当前书与阅读进度；放在 dock 之后以浮于其上 */}
      <Companion storyId={story.id} paragraph={Math.max(0, revealed - 1)} />

      <EnterSheet
        key={`${activePoint?.paragraphIndex ?? "none"}-${talkCharId ?? ""}-${parentBranchId ?? ""}`}
        story={story}
        point={activePoint}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setTalkCharId(undefined);
          setParentBranchId(undefined);
        }}
        onGrew={() => setGraphOpen(true)}
        initialCharacterId={talkCharId}
        parentBranchId={parentBranchId}
        allPoints={story.enterPoints}
      />
      <NodeSheet
        node={activeNode}
        character={activeNodeCharacter}
        open={!!activeNodeId}
        onClose={() => setActiveNodeId(null)}
        canTalk={!!activeNodeCharacter && characterCanTalk(activeNodeCharacter.id)}
        onTalk={() => {
          if (activeNodeCharacter) talkToCharacter(activeNodeCharacter.id);
        }}
        onOpenEnter={() => {
          // 抉择节点 → 找到 chapter 对应的入局点并开启
          const ep =
            story.enterPoints.find(
              (p) =>
                activeNode?.chapter !== undefined &&
                enterChapterOf(p.paragraphIndex) === activeNode.chapter,
            ) ?? story.enterPoints[0];
          setActiveNodeId(null);
          if (ep) openPoint(ep);
        }}
      />

      <TypographySheet
        open={typoOpen}
        onOpenChange={setTypoOpen}
        typography={typography}
        onChange={update}
        onReset={reset}
      />

      {!coverDone && <StoryCover story={story} onDone={() => setCoverDone(true)} />}
    </div>
  );
}
