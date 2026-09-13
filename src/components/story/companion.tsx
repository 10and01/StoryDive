"use client";

// 刘看山伴读：阅读页右下角的悬浮向导。
// - 可拖拽（松手记住位置），可在抽屉里一键隐藏（屏幕角落留小唤回钮）；
// - 知道当前书与阅读进度：翻到新的一章会「晃悠」过来打招呼（悬浮气泡 + 入列消息）；
// - 60s 无操作进入瞌睡（头顶冒 Zzz）；任意交互唤醒；
// - 后端接知乎直答 + 站内搜索，回复引用真实高赞回答（[n] 编号 → 引用 chip）；
//   无密钥时后端自动降级为应用内 LLM（气泡带「离线闲聊」小标）。

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, Send, Loader2, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStory } from "@/lib/story/library";
import {
  askCompanion,
  type CompanionTurn,
} from "@/lib/api/companion";
import type { ZhihuCitation } from "@/lib/api/zhihu-citation";
import { ZhihuCitations } from "./zhihu-citations";

const GIF = {
  idle: "/lookshan/idle.gif",
  greet: "/lookshan/greet.gif",
  sleep: "/lookshan/sleep.gif",
  walk: "/lookshan/walk.gif",
};

const POS_KEY = "lookshan_pos_v1";
const HIDDEN_KEY = "lookshan_hidden_v1";
const FAB_SIZE = 72; // 悬浮球直径（与样式保持一致）
const IDLE_SLEEP_MS = 60_000;
const MSG_CAP = 30; // 消息历史上限，章节播报多了也不无限膨胀

interface CompanionMsg {
  from: "user" | "lookshan";
  text: string;
  citations?: ZhihuCitation[];
  offline?: boolean;
}

interface Pos {
  right: number;
  bottom: number;
}

const DEFAULT_POS: Pos = { right: 12, bottom: 64 };

function clampPos(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  return {
    right: Math.max(0, Math.min(p.right, window.innerWidth - FAB_SIZE)),
    bottom: Math.max(0, Math.min(p.bottom, window.innerHeight - FAB_SIZE)),
  };
}

export function Companion({
  storyId,
  paragraph,
}: {
  storyId: string;
  paragraph: number;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<CompanionMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [greeting, setGreeting] = useState(false); // 打开抽屉后 4s 播打招呼 GIF
  const [hidden, setHidden] = useState(false);
  const [pos, setPos] = useState<Pos>(DEFAULT_POS);
  const [mood, setMood] = useState<"idle" | "walk">("idle"); // 新章节时的动作
  const [bubble, setBubble] = useState<string | null>(null); // 悬浮播报气泡
  const [chapterEvent, setChapterEvent] = useState<string | null>(null); // 抽屉内的翻章事件线（单条，自动消失）
  const [leaving, setLeaving] = useState(false); // 退场动画进行中
  const [entered, setEntered] = useState(true); // 入场动画是否完成（页面首载不播动画）
  const lastActiveRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<
    { x: number; y: number; right: number; bottom: number; moved: boolean } | null
  >(null);
  const story = getStory(storyId);

  const chapterTitle = useMemo(() => {
    if (!story) return "";
    let start = 0;
    const idx = Math.max(0, paragraph);
    for (const ch of story.chapters) {
      const end = start + ch.paragraphs.length - 1;
      if (idx >= start && idx <= end) return ch.title;
      start = end + 1;
    }
    return story.chapters[0]?.title ?? "";
  }, [story, paragraph]);

  function wake() {
    lastActiveRef.current = Date.now();
    setSleeping(false);
  }

  // 恢复位置 / 隐藏偏好（延迟一拍，避开渲染期副作用）
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(POS_KEY);
        if (raw) {
          const v = JSON.parse(raw) as Pos;
          if (typeof v?.right === "number" && typeof v?.bottom === "number") {
            setPos(clampPos(v));
          }
        }
        if (localStorage.getItem(HIDDEN_KEY) === "1") setHidden(true);
      } catch {
        /* 忽略坏数据 */
      }
      lastActiveRef.current = Date.now();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // 60s 无操作进入瞌睡
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastActiveRef.current > IDLE_SLEEP_MS) setSleeping(true);
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  // 新章节互动：晃悠过来打招呼。播报是「事件」不是对话——只保留最新一条、
  // 9 秒后消失、不进聊天历史（也就不会污染发给后端的对话上下文）。
  const prevChapterRef = useRef<string | null>(null);
  const moodTimerRef = useRef<number | null>(null);
  const eventTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevChapterRef.current;
    prevChapterRef.current = chapterTitle;
    if (!chapterTitle || prev === null || prev === chapterTitle) return;
    const id = setTimeout(() => {
      wake();
      setMood("walk");
      const line = t("companion.newChapter", { chapter: chapterTitle });
      setChapterEvent(line);
      if (!hidden) setBubble(line);
      if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
      if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
      moodTimerRef.current = window.setTimeout(() => setMood("idle"), 4500);
      eventTimerRef.current = window.setTimeout(() => {
        setChapterEvent(null);
        setBubble(null);
      }, 9000);
      setTimeout(() => setBubble(null), 6000);
    }, 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterTitle]);

  // 新消息滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking, open, chapterEvent]);

  function toggle() {
    wake();
    if (!open) {
      setOpen(true);
      setGreeting(true);
      window.setTimeout(() => setGreeting(false), 4000);
    } else {
      setOpen(false);
    }
  }

  // --- 拖拽（未超过位移阈值视为点击） ---
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      right: pos.right,
      bottom: pos.bottom,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    d.moved = true;
    setPos(clampPos({ right: d.right - dx, bottom: d.bottom - dy }));
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    } else {
      toggle();
    }
  }

  function hide() {
    if (leaving) return;
    setOpen(false);
    setLeaving(true);
    setBubble(t("companion.farewell"));
    // 退场动画播完再真正卸载
    window.setTimeout(() => {
      setHidden(true);
      setLeaving(false);
      setEntered(false);
      window.setTimeout(() => setEntered(true), 30);
      setBubble(null);
      try {
        localStorage.setItem(HIDDEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 1400);
  }

  function unhide() {
    setHidden(false);
    setEntered(false); // 先落到屏下，下一帧弹回原位 → 上滑入场
    wake();
    try {
      localStorage.removeItem(HIDDEN_KEY);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setEntered(true), 30);
    setBubble(t("companion.back"));
    window.setTimeout(() => setBubble(null), 2500);
  }

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    wake();
    setInput("");
    const withUser = [...msgs, { from: "user" as const, text }];
    setMsgs(withUser);
    setThinking(true);
    try {
      const history: CompanionTurn[] = withUser
        .slice(-7, -1)
        .map((m) => ({
          role: m.from === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        }));
      const data = await askCompanion({ storyId, paragraph, message: text, history });
      setMsgs((m) => [
        ...m.slice(-(MSG_CAP - 1)),
        {
          from: "lookshan",
          text: data.reply || t("companion.failed"),
          citations: data.citations,
          offline: data.source !== "zhida",
        },
      ]);
    } catch {
      setMsgs((m) => [...m.slice(-(MSG_CAP - 1)), { from: "lookshan", text: t("companion.failed") }]);
    } finally {
      setThinking(false);
    }
  }

  if (hidden) {
    // 隐藏态：屏幕角落留一个小药丸唤回钮（入场动画 + 名字，保证找得到）
    return (
      <button
        onClick={unhide}
        aria-label={t("companion.show")}
        title={t("companion.show")}
        className={`fixed bottom-4 right-3 z-30 flex items-center gap-1.5 rounded-full border border-[color:var(--primary)]/50 bg-[#171817]/90 py-1 pl-1 pr-3 shadow-[0_4px_16px_rgba(0,0,0,.45)] transition-[opacity,transform] duration-500 ease-out ${
          entered ? "" : "translate-y-[150%] opacity-0"
        }`}
        data-el="companion-peek"
      >
        <Image src={GIF.idle} alt="" width={30} height={30} unoptimized />
        <span className="text-xs leading-none text-[color:var(--primary)]">
          {t("companion.short")}
        </span>
      </button>
    );
  }

  const fabSrc = sleeping ? GIF.sleep : mood === "walk" ? GIF.walk : GIF.idle;
  const headerSrc = greeting ? GIF.greet : GIF.idle;

  return (
    <>
      {/* 悬浮播报气泡（新章节 / 退场告别 / 唤回招呼） */}
      {bubble && !open && (
        <button
          onClick={toggle}
          disabled={leaving}
          className="fixed z-30 max-w-[240px] rounded-xl border border-[color:var(--primary)]/40 bg-[#211f18] px-3 py-2 text-left text-xs leading-relaxed text-[#d9ca9b] shadow-[0_6px_20px_rgba(0,0,0,.45)]"
          style={{ right: pos.right, bottom: pos.bottom + FAB_SIZE + 8 }}
          data-el="companion-bubble"
        >
          {bubble}
        </button>
      )}

      {/* 悬浮球：待机 / 晃悠 / 瞌睡（可拖拽，点击展开；隐藏时下滑退场） */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        disabled={leaving}
        aria-label={t("companion.fab")}
        title={sleeping ? t("companion.sleep") : t("companion.fab")}
        className={`fixed z-30 flex items-center justify-center rounded-full transition-[opacity,transform] duration-500 ease-in hover:drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)] ${
          entered && !leaving ? "" : "translate-y-[140%] opacity-0"
        }`}
        style={{
          right: pos.right,
          bottom: pos.bottom,
          width: FAB_SIZE,
          height: FAB_SIZE,
          touchAction: "none",
          cursor: "grab",
        }}
        data-el="companion-fab"
      >
        {sleeping && (
          <span className="absolute -top-2 right-0 rounded-full border border-[color:var(--primary)]/40 bg-[#171817] px-1.5 py-0.5 text-[10px] leading-none text-[color:var(--primary)]">
            Zzz
          </span>
        )}
        <Image
          src={fabSrc}
          alt={t("companion.fab")}
          width={FAB_SIZE}
          height={FAB_SIZE}
          unoptimized
          className="pointer-events-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
        />
      </button>

      {/* 聊天抽屉 */}
      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50" onClick={toggle} aria-hidden />
          <div
            className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col rounded-t-2xl border border-[color:var(--primary)]/40 bg-[#1c1b15] shadow-[0_-14px_50px_rgba(0,0,0,.5)]"
            style={{
              paddingBottom: "var(--safe-area-bottom, max(12px, env(safe-area-inset-bottom, 0px)))",
            }}
            data-el="companion-drawer"
          >
            {/* 头部：打招呼 4s 后回到待机；阅读进度实时更新 */}
            <div className="flex items-center gap-2.5 border-b border-[color:var(--border)] px-3 py-2.5">
              <Image
                src={headerSrc}
                alt="刘看山"
                width={44}
                height={44}
                unoptimized
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm text-[#f2ead0]">
                  {t("companion.title")}
                </p>
                <p className="truncate text-[11px] text-[color:var(--muted-foreground)]">
                  {t("companion.reading", { title: story?.title ?? "", chapter: chapterTitle })}
                </p>
              </div>
              <button
                onClick={hide}
                aria-label={t("companion.hide")}
                title={t("companion.hide")}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-[#8c8570] hover:text-[color:var(--primary)]"
                data-el="companion-hide"
              >
                <EyeOff className="h-4 w-4" />
              </button>
              <button
                onClick={toggle}
                aria-label={t("common.close")}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-[#8c8570]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 消息流（开场白按当前进度实时渲染；翻章播报是单条事件线，不堆积） */}
            <div ref={scrollRef} className="max-h-[46vh] min-h-[180px] overflow-y-auto px-3 py-3">
              <div className="grid gap-2.5">
                {chapterEvent && (
                  <p
                    className="text-center text-[11px] leading-relaxed text-[color:var(--primary)]/85"
                    data-el="companion-chapter-event"
                  >
                    —— {chapterEvent} ——
                  </p>
                )}
                {msgs.length === 0 && !chapterEvent && (
                  <div className="mr-6">
                    <p className="whitespace-pre-line rounded-lg border border-[color:var(--primary)]/25 bg-[#211f18] px-2.5 py-2 text-sm leading-relaxed text-[#d9ca9b]">
                      {t("companion.greeting", {
                        title: story?.title ?? "",
                        chapter: chapterTitle,
                      })}
                    </p>
                  </div>
                )}
                {msgs.map((m, i) =>
                  m.from === "user" ? (
                    <p
                      key={i}
                      className="ml-8 text-right text-sm leading-relaxed text-[color:var(--rs-ink)]"
                    >
                      {m.text}
                    </p>
                  ) : (
                    <div key={i} className="mr-6">
                      <p className="whitespace-pre-line rounded-lg border border-[color:var(--primary)]/25 bg-[#211f18] px-2.5 py-2 text-sm leading-relaxed text-[#d9ca9b]">
                        {m.text}
                      </p>
                      {m.offline && (
                        <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                          {t("companion.offline")}
                        </p>
                      )}
                      <ZhihuCitations items={m.citations} label={t("companion.sources")} />
                    </div>
                  ),
                )}
                {thinking && (
                  <p className="flex items-center gap-1.5 text-xs italic text-[color:var(--muted-foreground)]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("companion.thinking")}
                  </p>
                )}
              </div>
            </div>

            {/* 输入行 */}
            <div className="flex gap-1.5 px-3 pb-1 pt-2">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  wake();
                }}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                placeholder={t("companion.placeholder")}
                className="min-w-0 flex-1 border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
                data-el="companion-input"
              />
              <button
                onClick={() => void send()}
                disabled={thinking}
                aria-label={t("companion.send")}
                className="flex w-11 items-center justify-center bg-[color:var(--primary)] text-[#171817] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
