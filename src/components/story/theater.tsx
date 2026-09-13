"use client";

import { useUser } from "@/components/user-profile/user-provider";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Landmark,
  Check,
  RotateCcw,
  Flame,
  CalendarDays,
  Trophy,
  GraduationCap,
  History,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import { fetchTheaterPlay } from "@/lib/api/theater";
import { LoginGate } from "@/components/user-profile/login-gate";
import { publishToWorkshop } from "@/lib/api/workshop";
import { CustomTheaterModal } from "@/components/story/theater-custom";
import type {
  TheaterPlay,
  TheaterStep,
  TheaterEnding,
} from "@/lib/theater/types";

const TONE_RING: Record<TheaterEnding["tone"], string> = {
  good: "border-[color:var(--primary)] bg-[color:var(--primary)]/12",
  bad: "border-red-500/60 bg-red-500/10",
  twist: "border-purple-400/60 bg-purple-400/10",
  open: "border-[color:var(--border)] bg-[#1c1b15]",
};

// 结局收藏册：本地记录「话题 → 已解锁的结局标题」，鼓励重玩换结局。
const COLLECT_KEY = "theater_collection_v1";
type Collection = Record<string, string[]>;

function readCollection(): Collection {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(COLLECT_KEY) || "{}") as Collection;
  } catch {
    return {};
  }
}

function collectEnding(topic: string, endingTitle: string): Collection {
  const c = readCollection();
  const set = new Set(c[topic] || []);
  set.add(endingTitle);
  c[topic] = Array.from(set);
  try {
    localStorage.setItem(COLLECT_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota */
  }
  return c;
}

export function Theater() {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [play, setPlay] = useState<TheaterPlay | null>(null);
  const [dailyPlay, setDailyPlay] = useState<TheaterPlay | null>(null); // 今日热榜局（定制局可切回）
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string>(""); // 当前 step/ending id
  const [trail, setTrail] = useState<string[]>([]); // 选择足迹（选项文案）
  const [collection, setCollection] = useState<Collection>({});

  useEffect(() => {
    const id = setTimeout(() => setCollection(readCollection()), 0);
    return () => clearTimeout(id);
  }, []);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await fetchTheaterPlay();
      setPlay(p);
      setDailyPlay(p);
      setCursor(p.start);
      setTrail([]);
    } catch {
      setPlay(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const step: TheaterStep | undefined = play?.steps.find((s) => s.id === cursor);
  const ending: TheaterEnding | undefined = play?.endings.find(
    (e) => e.id === cursor,
  );

  if (!user) {
    return (
      <AppShell>
        <LoginGate />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-4 border-b border-[color:var(--sidebar-border)] pb-3">
        <h1 className="flex items-center gap-2 font-heading text-[clamp(26px,8vw,44px)] leading-tight">
          <Sparkles className="h-7 w-7 text-[color:var(--primary)]" />
          {t("theater.title")}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 font-heading text-sm text-[#d9ca9b]">
          <span>{t("theater.subtitle")}</span>
          {play && dailyPlay && play.id !== dailyPlay.id && (
            <button
              onClick={() => {
                if (!dailyPlay) return;
                setPlay(dailyPlay);
                setCursor(dailyPlay.start);
                setTrail([]);
              }}
              className="inline-flex items-center gap-1 border border-[color:var(--primary)]/50 px-2 py-0.5 text-[11px] text-[color:var(--primary)]"
              data-el="theater-back-daily"
            >
              <History className="h-3 w-3" />
              {t("theater.backToDaily")}
            </button>
          )}
          <button
            onClick={() => setCustomOpen(true)}
            className="inline-flex items-center gap-1 border border-[color:var(--primary)]/50 px-2 py-0.5 text-[11px] text-[color:var(--primary)]"
            data-el="theater-custom-entry"
          >
            <GraduationCap className="h-3 w-3" />
            {t("theater.customEntry")}
          </button>
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-[color:var(--muted-foreground)]">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--primary)]" />
          {t("theater.summoning")}
        </div>
      ) : !play ? (
        <div className="border border-dashed border-[color:var(--border)] p-8 text-center">
          <p className="mb-3 text-sm text-[color:var(--muted-foreground)]">
            {t("theater.failed")}
          </p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 border border-[color:var(--primary)] px-4 py-2 text-sm text-[color:var(--primary)]"
          >
            <RefreshCw className="h-4 w-4" />
            {t("theater.retry")}
          </button>
        </div>
      ) : (
        <div data-el="theater-play">
          {/* 水墨题图 + 今日话题日期徽章 */}
          <div className="relative mb-4 overflow-hidden border border-[color:var(--border)]">
            <Image
              src={play.cover}
              alt={play.topic}
              width={1024}
              height={540}
              className="h-40 w-full object-cover object-center"
              unoptimized
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#171817] via-[#171817]/40 to-transparent" />
            {play.dateLabel && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 border border-[color:var(--primary)]/60 bg-[#171817]/80 px-2 py-1 text-[11px] text-[color:var(--primary)]">
                <CalendarDays className="h-3 w-3" />
                {t("theater.todayBadge", { date: play.dateLabel })}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
                <Flame className="h-3.5 w-3.5" />
                {play.source === "hotlist"
                  ? t("theater.fromHot")
                  : t("theater.fromSpirit")}
              </div>
              <p className="font-heading text-xl leading-snug text-[#f2ead0]">
                {play.topic}
              </p>
            </div>
          </div>

          {/* 盐灵开场 + 你的身份 */}
          <div className="mb-4 border-l-2 border-[color:var(--primary)]/50 pl-3">
            <p className="text-[13px] leading-relaxed text-[#d9ca9b]">
              {play.hook}
            </p>
            <p className="mt-1.5 text-[11px] text-[#8c8570]">
              {t("theater.yourRole", { role: play.role })}
            </p>
          </div>

          {step && (
            <StepView
              step={step}
              trail={trail}
              stepIndex={play.steps.findIndex((s) => s.id === step.id)}
              totalSteps={play.steps.length}
              onChoose={(label, next) => {
                setTrail((tr) => [...tr, label]);
                setCursor(next);
                if (typeof window !== "undefined")
                  window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {ending && (
            <EndingView
              play={play}
              ending={ending}
              trail={trail}
              user={user}
              unlocked={collection[play.topic] ?? []}
              onReplay={() => {
                setCursor(play.start);
                setTrail([]);
              }}
              onNext={() => void load()}
              onCollect={() =>
                setCollection(collectEnding(play.topic, ending.title))
              }
            />
          )}
        </div>
      )}

      {/* 知识库 RAG 定制剧场：上传长文/论文 → 多结局学习剧场 */}
      <CustomTheaterModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onPlay={(p) => {
          setPlay(p);
          setCursor(p.start);
          setTrail([]);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </AppShell>
  );
}

function StepView({
  step,
  trail,
  stepIndex,
  totalSteps,
  onChoose,
}: {
  step: TheaterStep;
  trail: string[];
  stepIndex: number;
  totalSteps: number;
  onChoose: (label: string, next: string) => void;
}) {
  const { t } = useTranslation();
  const pct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
  return (
    <div className="space-y-3" data-el="theater-step">
      {/* 进度条：第 N 步 / 共 X 步 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-[#8c8570]">
          <span>{t("theater.progress", { n: stepIndex + 1, total: totalSteps })}</span>
        </div>
        <div className="h-1 w-full bg-[#2a281f]">
          <div
            className="h-full bg-[color:var(--primary)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {trail.length > 0 && (
        <p className="text-[11px] text-[#8c8570]">
          {t("theater.trail")}：{trail.join(" › ")}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#e6dcbb]">
        {step.narration}
      </p>
      <div className="space-y-2 pt-1">
        {step.choices.map((c, i) => (
          <button
            key={i}
            onClick={() => onChoose(c.label, c.next)}
            className="flex w-full items-center gap-2 border border-[color:var(--primary)]/45 bg-[#1b1a14] px-3.5 py-3 text-left text-sm text-[#f2ead0] transition-colors hover:border-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
            data-el="theater-choice"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[color:var(--primary)]/50 text-xs text-[color:var(--primary)]">
              {String.fromCharCode(65 + i)}
            </span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EndingView({
  play,
  ending,
  trail,
  user,
  unlocked,
  onReplay,
  onNext,
  onCollect,
}: {
  play: TheaterPlay;
  ending: TheaterEnding;
  trail: string[];
  user: unknown;
  unlocked: string[];
  onReplay: () => void;
  onNext: () => void;
  onCollect: () => void;
}) {
  const { t } = useTranslation();
  const { login } = useUser();
  const [pubState, setPubState] = useState<"idle" | "busy" | "done">("idle");

  // 抵达结局即收藏（本地记录），鼓励重玩换结局
  useEffect(() => {
    onCollect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending.id]);

  async function publish() {
    if (!user) {
      login();
      return;
    }
    if (pubState !== "idle") return;
    setPubState("busy");
    try {
      await publishToWorkshop({
        storyId: "theater",
        storyTitle: `盐灵剧场 · ${play.topic}`,
        anchorParagraph: 0,
        enterHint: play.hook,
        kind: "rewrite",
        title: ending.title,
        body: `【我扮演：${play.role}】\n我的选择：${trail.join(" › ") || "—"}\n\n${ending.body}\n\n盐灵：${ending.verdict}`,
      });
      setPubState("done");
    } catch {
      setPubState("idle");
    }
  }

  return (
    <div className={`border p-4 ${TONE_RING[ending.tone]}`} data-el="theater-ending">
      <p className="mb-1 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
        {t("theater.endingLabel")}
      </p>
      <h2 className="font-heading text-2xl text-[#f2ead0]">{ending.title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#e6dcbb]">
        {ending.body}
      </p>
      {ending.verdict && (
        <p className="mt-3 border-l-2 border-[color:var(--primary)]/50 pl-3 text-[13px] italic leading-relaxed text-[#d9ca9b]">
          {ending.verdict}
        </p>
      )}
      {trail.length > 0 && (
        <p className="mt-3 text-[11px] text-[#8c8570]">
          {t("theater.trail")}：{trail.join(" › ")}
        </p>
      )}

      {/* 结局收藏册：本话题已解锁的结局 */}
      {(() => {
        const all = Array.from(new Set([...unlocked, ending.title]));
        return (
          <div className="mt-3 border-t border-[color:var(--border)] pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--primary)]">
              <Trophy className="h-3.5 w-3.5" />
              {t("theater.collected", { n: all.length, total: play.endings.length })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {play.endings.map((e) => {
                const got = all.includes(e.title);
                return (
                  <span
                    key={e.id}
                    className={`border px-2 py-0.5 text-[11px] ${
                      got
                        ? "border-[color:var(--primary)]/60 text-[color:var(--primary)]"
                        : "border-[color:var(--border)] text-[#6b6553]"
                    }`}
                  >
                    {got ? e.title : "？？？"}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => void publish()}
          disabled={pubState !== "idle"}
          className="flex items-center gap-1.5 border border-[color:var(--primary)] bg-[color:var(--primary)]/12 px-3 py-2 text-xs text-[color:var(--primary)] disabled:opacity-70"
          data-el="theater-publish"
        >
          {pubState === "busy" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : pubState === "done" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Landmark className="h-3.5 w-3.5" />
          )}
          {pubState === "done"
            ? t("theater.published")
            : user
              ? t("theater.publish")
              : t("theater.loginToPublish")}
        </button>
        <button
          onClick={onReplay}
          className="flex items-center gap-1.5 border border-[color:var(--primary)]/45 px-3 py-2 text-xs text-[color:var(--primary)]"
          data-el="theater-replay"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("theater.replay")}
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 border border-[color:var(--primary)]/45 px-3 py-2 text-xs text-[color:var(--primary)]"
          data-el="theater-next"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("theater.next")}
        </button>
      </div>
    </div>
  );
}
