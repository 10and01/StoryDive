"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Send, Sparkles, Bookmark, Check, LogIn, Users, Quote, Feather, Ghost, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Story, EnterPoint, BranchKind } from "@/lib/story/types";
import { useBranches } from "./branch-store";
import { generateStoryAi, generateStoryAiDetail } from "@/lib/api/story";
import { fetchSyncStatus, fetchShadowGuests, type FolloweeCardDTO } from "@/lib/api/user-sync";
import type { ZhihuCitation } from "@/lib/api/zhihu-citation";
import { ZhihuCitations } from "./zhihu-citations";
import { cn } from "@/utils/utils";
import { useUser } from "@/components/user-profile/user-provider";

type Mode = BranchKind;

interface Msg {
  from: "user" | "character";
  text: string;
  citations?: ZhihuCitation[];
}

type KeepFn = (title: string, body: string) => void;

// 群像对戏里 AI 一轮可能有多个角色发言，解析成带说话者的分条
interface EnsembleLine {
  charId: string;
  name: string;
  portrait?: string;
  text: string;
}

// 把「角色名：台词」格式的多行回复解析成按角色归属的分条；解析不出说话者时整段兜底。
function parseEnsemble(
  raw: string,
  cast: Array<{ id: string; name: string; portrait?: string }>,
): EnsembleLine[] {
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: EnsembleLine[] = [];
  for (const line of lines) {
    const m = line.match(/^([^：:]{1,16})[：:]\s*(.+)$/);
    if (m) {
      const spoken = m[1].trim();
      const c =
        cast.find((x) => x.name === spoken) ??
        cast.find((x) => spoken.includes(x.name) || x.name.includes(spoken));
      if (c) {
        out.push({ charId: c.id, name: c.name, portrait: c.portrait, text: m[2].trim() });
        continue;
      }
    }
    // 无法归属：并入上一条，或作为旁白挂到第一个角色名下
    if (out.length) out[out.length - 1].text += "\n" + line;
    else out.push({ charId: "", name: "", portrait: undefined, text: line });
  }
  return out;
}

export function EnterSheet({
  story,
  point,
  open,
  onClose,
  onGrew,
  initialCharacterId,
  parentBranchId,
  allPoints,
}: {
  story: Story;
  point: EnterPoint | null;
  open: boolean;
  onClose: () => void;
  onGrew: () => void;
  // 从图谱人物节点「找 TA 对戏」进入时，默认选中的角色
  initialCharacterId?: string;
  // 从「我的平行结局」某条支线「接着往下玩」进入时，新支线挂到它下面
  parentBranchId?: string;
  // 全部入局点，用于面板内「换个情节开聊」——传入后顶部出现情节位置选择器
  allPoints?: EnterPoint[];
}) {
  const { t } = useTranslation();
  const { add, authed } = useBranches();
  const [mode, setMode] = useState<Mode>("dialogue");
  // 面板内当前选中的情节位置（初始为外部传入的入局点）
  const [activePoint, setActivePoint] = useState<EnterPoint | null>(point);

  // 外部传入的入局点变化时（重新打开面板），同步内部选中位置
  useEffect(() => {
    setActivePoint(point);
  }, [point]);

  const active = activePoint ?? point;
  if (!active) return null;

  const present = story.characters.filter((c) =>
    active.presentCharacterIds.includes(c.id),
  );

  // 该入局点所在章节的场景图，作为面板顶部氛围背景
  const sceneImage = (() => {
    let start = 0;
    for (const ch of story.chapters) {
      const end = start + ch.paragraphs.length - 1;
      if (active.paragraphIndex >= start && active.paragraphIndex <= end) {
        return ch.sceneImage;
      }
      start = end + 1;
    }
    return story.chapters[0]?.sceneImage;
  })();

  // 由段落 index 反查所属章节标题（供情节位置选择器显示）
  const chapterTitleOf = (globalIdx: number): string => {
    let start = 0;
    for (const ch of story.chapters) {
      const end = start + ch.paragraphs.length - 1;
      if (globalIdx >= start && globalIdx <= end) return ch.title;
      start = end + 1;
    }
    return story.chapters[0]?.title ?? "";
  };

  const keep = (kind: BranchKind): KeepFn => (title, body) => {
    void add({
      storyId: story.id,
      storyTitle: story.title,
      kind,
      anchorParagraph: active.paragraphIndex,
      parentId: parentBranchId ?? null,
      title,
      body,
    });
    onGrew();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden
        />
      )}
      <section
        className={cn(
          "fixed inset-0 z-50 mx-auto flex w-full max-w-[620px] flex-col border-x border-[color:var(--primary)]/40 bg-[#211f18] shadow-[0_22px_60px_rgba(0,0,0,.58)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          paddingTop: "var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px)))",
          paddingBottom: "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
        }}
        aria-hidden={!open}
        data-el="enter-sheet"
      >
        {/* 场景氛围背景：该入局点所在章节的场景图，铺满面板顶部作沉浸背景 */}
        {sceneImage && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden" aria-hidden>
            <Image
              src={sceneImage}
              alt=""
              fill
              unoptimized
              className="object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#211f18]/20 to-[#211f18]" />
          </div>
        )}
        {/* 可滚动内容区：内容多时（群戏/长入局点）也能完整展开 */}
        <div className="relative flex-1 overflow-y-auto px-4 pb-6 pt-4" data-el="enter-sheet-scroll">
        <div className="relative mb-2 flex items-start justify-between gap-2">
          <p className="font-heading text-base leading-snug text-[#e7dcae]">
            {active.hint}
          </p>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[color:var(--primary)]/55 bg-[#171817]/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 情节位置选择器：在本篇任意入局点之间切换，「想在哪里开聊就在哪里聊」 */}
        {allPoints && allPoints.length > 1 && (
          <div className="relative mb-3" data-el="enter-scene-picker">
            <p className="mb-1 text-[11px] text-[color:var(--muted-foreground)]">
              {t("reader.scenePicker")}
            </p>
            <div className="flex gap-1.5 overflow-x-auto no-native-scrollbar pb-1">
              {allPoints.map((p, i) => {
                const on = p.paragraphIndex === active.paragraphIndex;
                return (
                  <button
                    key={i}
                    onClick={() => setActivePoint(p)}
                    data-el="enter-scene-option"
                    aria-pressed={on}
                    className={cn(
                      "flex shrink-0 flex-col items-start gap-0.5 border px-2.5 py-1.5 text-left transition-colors",
                      on
                        ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                        : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--rs-ink)]",
                    )}
                  >
                    <span className="text-[10px] opacity-80">
                      {chapterTitleOf(p.paragraphIndex)}
                    </span>
                    <span className="max-w-[150px] truncate text-[12px]">
                      {p.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative mb-3 grid grid-cols-3 gap-1.5" data-el="enter-actions" data-guide="enter-actions">
          {(["dialogue", "fork", "rewrite"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              data-el={`enter-action-${m}`}
              className={cn(
                "border px-1.5 py-2.5 text-[13px] transition-colors",
                mode === m
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[#171817]"
                  : "border-[color:var(--primary)]/55 bg-[color:var(--primary)]/[0.08] text-[color:var(--rs-ink)]",
              )}
            >
              {t(`reader.actions.${m}`)}
            </button>
          ))}
        </div>

        {mode === "dialogue" && (
          <DialogueMode
            key={active.paragraphIndex}
            story={story}
            point={active}
            present={present}
            authed={authed}
            onKeep={keep("dialogue")}
            initialCharacterId={initialCharacterId}
          />
        )}
        {mode === "fork" && (
          <ForkMode
            key={active.paragraphIndex}
            story={story}
            point={active}
            authed={authed}
            onKeep={keep("fork")}
          />
        )}
        {mode === "rewrite" && (
          <RewriteMode
            key={active.paragraphIndex}
            story={story}
            point={active}
            authed={authed}
            onKeep={keep("rewrite")}
          />
        )}
        </div>
      </section>
    </>
  );
}

/* --- 对戏（单独 / 群像同台） --- */
function DialogueMode({
  story,
  point,
  present,
  authed,
  onKeep,
  initialCharacterId,
}: {
  story: Story;
  point: EnterPoint;
  present: Story["characters"];
  authed: boolean;
  onKeep: KeepFn;
  initialCharacterId?: string;
}) {
  const { t } = useTranslation();
  const canEnsemble = present.length >= 2;
  // 单独对戏 or 群像同台（在场角色 >= 2 时才可切到群像）
  const [scene, setScene] = useState<"solo" | "ensemble">("solo");
  const defaultCharId =
    (initialCharacterId && present.some((c) => c.id === initialCharacterId)
      ? initialCharacterId
      : present[0]?.id) ?? "";
  const [charId, setCharId] = useState(defaultCharId);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // 群像模式的对话流：user 行是读者，ensemble 行是一轮多角色发言
  const [ensembleTurns, setEnsembleTurns] = useState<
    ({ from: "user"; text: string } | { from: "ensemble"; lines: EnsembleLine[] })[]
  >([]);
  const [thinking, setThinking] = useState(false);
  const [kept, setKept] = useState(false);
  // 「引经据典」：开启后角色会化用知乎站内真实高赞回答（[n] 编号 → 引用 chip）
  const [grounded, setGrounded] = useState(false);
  // 「知乎灵魂」：开启后角色能“看见”读者自己授权同步的知乎回答（可点破）
  const [soulOn, setSoulOn] = useState(false);
  const [hasSoulCards, setHasSoulCards] = useState(false);
  // 「影子客人」：群像同台时，关注列表里的人（公开资料）由 AI 想象演绎入席
  const [shadowOn, setShadowOn] = useState(false);
  const [shadowPool, setShadowPool] = useState<FolloweeCardDTO[]>([]);
  const [shadowSel, setShadowSel] = useState<string[]>([]);
  const character = present.find((c) => c.id === charId) ?? present[0];

  // 画像同步状态（判例卡可用性 + 影子卡池）：面板挂载时拉一次即可
  useEffect(() => {
    let cancelled = false;
    void fetchSyncStatus().then((s) => {
      if (cancelled) return;
      setHasSoulCards(Boolean(s?.hasCards));
      setShadowPool(s?.followees ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleShadow(name: string) {
    setShadowSel((sel) =>
      sel.includes(name)
        ? sel.filter((n) => n !== name)
        : sel.length >= 2
          ? sel
          : [...sel, name],
    );
  }

  // 影子冷启动：没有关注卡时，用话题下的知乎高赞旅人（公开资料）当客人
  const [shadowLoading, setShadowLoading] = useState(false);
  async function loadShadowGuests() {
    if (shadowLoading) return;
    setShadowLoading(true);
    try {
      const guests = await fetchShadowGuests(story.title);
      setShadowPool((pool) => {
        const existing = new Set(pool.map((p) => p.name));
        return [...pool, ...guests.filter((g) => !existing.has(g.name))];
      });
    } finally {
      setShadowLoading(false);
    }
  }

  async function sendSolo() {
    if (!input.trim() || !character || thinking) return;
    const userText = input.trim();
    setMsgs((m) => [...m, { from: "user", text: userText }]);
    setInput("");
    setThinking(true);
    try {
      const { text, citations } = await generateStoryAiDetail({
        mode: "dialogue",
        storyId: story.id,
        characterId: character.id,
        anchorParagraph: point.paragraphIndex,
        userText,
        grounding: grounded,
        soul: soulOn && hasSoulCards,
      });
      if (text) {
        setMsgs((m) => [
          ...m,
          {
            from: "character",
            text,
            citations: grounded || (soulOn && hasSoulCards) ? citations : undefined,
          },
        ]);
      }
    } finally {
      setThinking(false);
    }
  }

  async function sendEnsemble() {
    if (!input.trim() || thinking) return;
    const userText = input.trim();
    setEnsembleTurns((t) => [...t, { from: "user", text: userText }]);
    setInput("");
    setThinking(true);
    const shadows = shadowPool
      .filter((s) => shadowSel.includes(s.name))
      .map((s) => ({ name: s.name, headline: s.headline }));
    try {
      const text = await generateStoryAi({
        mode: "ensemble",
        storyId: story.id,
        characterIds: present.map((c) => c.id),
        anchorParagraph: point.paragraphIndex,
        userText,
        shadows: shadowOn && shadows.length > 0 ? shadows : undefined,
      });
      if (text) {
        // 影子客人作为伪角色参与解析（名字与台词行首的「影子·X」对应）
        const castForParse: Array<{ id: string; name: string; portrait?: string }> = [
          ...present.map((c) => ({ id: c.id, name: c.name, portrait: c.portrait })),
          ...shadows.map((s, i) => ({
            id: `shadow-${i}`,
            name: `影子·${s.name}`,
            portrait: shadowPool.find((p) => p.name === s.name)?.avatarUrl,
          })),
        ];
        const lines = parseEnsemble(text, castForParse);
        setEnsembleTurns((t) => [...t, { from: "ensemble", lines }]);
      }
    } finally {
      setThinking(false);
    }
  }

  const send = () => (scene === "ensemble" ? void sendEnsemble() : void sendSolo());

  if (!character) return null;

  const hasSoloReply = msgs.some((m) => m.from === "character");
  const hasEnsembleReply = ensembleTurns.some((tn) => tn.from === "ensemble");

  return (
    <div className="grid gap-2.5" data-el="dialogue-mode">
      {/* 单独 / 群像 场景切换 */}
      {canEnsemble && (
        <div className="grid grid-cols-2 gap-1.5" data-el="scene-toggle">
          {(["solo", "ensemble"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScene(s)}
              aria-pressed={scene === s}
              data-el={`scene-${s}`}
              className={cn(
                "flex items-center justify-center gap-1.5 border px-2 py-1.5 text-xs transition-colors",
                scene === s
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
              )}
            >
              {s === "ensemble" && <Users className="h-3.5 w-3.5" />}
              {t(`reader.dialogue.scene.${s}`)}
            </button>
          ))}
        </div>
      )}

      {scene === "ensemble" ? (
        <>
          {/* 在场群像：头像叠列，点明同台的是谁 */}
          <div className="flex items-center gap-2" data-el="ensemble-cast">
            <div className="flex -space-x-2">
              {present.slice(0, 5).map((c) =>
                c.portrait ? (
                  <span
                    key={c.id}
                    className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--primary)]/50 bg-[#171817]"
                  >
                    <Image src={c.portrait} alt={c.name} fill unoptimized className="object-cover object-top" />
                  </span>
                ) : (
                  <span
                    key={c.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)]/50 bg-[#171817] text-[10px] text-[color:var(--primary)]"
                  >
                    {c.name.slice(0, 1)}
                  </span>
                ),
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--muted-foreground)]">
              {t("reader.dialogue.scene.onStage", {
                names: [
                  ...present.map((c) => c.name),
                  ...(shadowOn && shadowSel.length > 0
                    ? shadowSel.map((n) => `影子·${n}`)
                    : []),
                ].join("、"),
              })}
            </p>
          </div>

          {/* 影子客人：关注列表里的真人（AI 想象演绎）以特邀观众身份入席 */}
          <div className="grid gap-1.5" data-el="ensemble-shadow">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShadowOn((v) => !v)}
                aria-pressed={shadowOn}
                title={t("reader.dialogue.scene.shadowHint")}
                data-el="ensemble-shadow-toggle"
                className={cn(
                  "flex shrink-0 items-center gap-1 border px-2 py-1 text-[11px] transition-colors",
                  shadowOn
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                )}
              >
                <Ghost className="h-3 w-3" />
                {t("reader.dialogue.scene.shadow")}
              </button>
              {shadowOn && shadowPool.length > 0 && (
                <p className="min-w-0 flex-1 truncate text-[10px] text-[color:var(--muted-foreground)]">
                  {t("reader.dialogue.scene.shadowPick")}
                </p>
              )}
            </div>
            {shadowOn && shadowPool.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-native-scrollbar pb-1">
                {shadowPool.slice(0, 12).map((s) => {
                  const on = shadowSel.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      onClick={() => toggleShadow(s.name)}
                      aria-pressed={on}
                      data-el="ensemble-shadow-option"
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 border px-2 py-1 text-[11px] transition-colors",
                        on
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                          : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                      )}
                    >
                      {s.avatarUrl ? (
                        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
                          <Image
                            src={s.avatarUrl.startsWith("//") ? `https:${s.avatarUrl}` : s.avatarUrl}
                            alt={s.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[9px]">
                          {s.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="max-w-[90px] truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {shadowOn && shadowPool.length === 0 && (
              <div className="grid gap-1.5" data-el="ensemble-shadow-empty">
                <p className="text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
                  {t("reader.dialogue.scene.shadowEmpty")}
                </p>
                <button
                  onClick={() => void loadShadowGuests()}
                  disabled={shadowLoading}
                  className="inline-flex w-fit items-center gap-1.5 border border-[color:var(--primary)]/50 px-2 py-1 text-[11px] text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/10 disabled:opacity-60"
                  data-el="ensemble-shadow-guests-btn"
                >
                  {shadowLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Ghost className="h-3 w-3" />
                  )}
                  {t("reader.dialogue.scene.shadowGuests")}
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[46vh] overflow-y-auto border border-[color:var(--border)] bg-[#171817] p-2.5">
            {ensembleTurns.length === 0 && (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {t("reader.dialogue.scene.ensembleHint")}
              </p>
            )}
            <div className="grid gap-3">
              {ensembleTurns.map((tn, i) =>
                tn.from === "user" ? (
                  <p key={i} className="text-right text-sm leading-relaxed text-[color:var(--rs-ink)]">
                    {tn.text}
                  </p>
                ) : (
                  <div key={i} className="grid gap-2">
                    {tn.lines.map((ln, j) => (
                      <div key={j} className="flex items-start gap-2">
                        {ln.portrait ? (
                          <span className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[color:var(--primary)]/40">
                            <Image src={ln.portrait} alt={ln.name} fill unoptimized className="object-cover object-top" />
                          </span>
                        ) : (
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)]/40 text-[10px] text-[color:var(--primary)]">
                            {ln.name.slice(0, 1) || "·"}
                          </span>
                        )}
                        <div className="min-w-0">
                          {ln.name && (
                            <p className="text-[11px] text-[color:var(--primary)]">{ln.name}</p>
                          )}
                          <p className="whitespace-pre-line text-sm leading-relaxed text-[#d9ca9b]">
                            {ln.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              )}
              {thinking && (
                <p className="text-xs italic text-[color:var(--muted-foreground)]">
                  {t("reader.dialogue.scene.ensembleThinking")}
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {present.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-native-scrollbar pb-1">
              {present.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCharId(c.id);
                    setMsgs([]);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border px-2 py-1 text-xs",
                    c.id === charId
                      ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                      : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                  )}
                >
                  {c.portrait && (
                    <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
                      <Image src={c.portrait} alt="" fill unoptimized className="object-cover object-top" />
                    </span>
                  )}
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {character.portrait && (
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[color:var(--primary)]/50">
                <Image src={character.portrait} alt={character.name} fill unoptimized className="object-cover object-top" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#d9ca9b]">{character.name}</p>
              <p className="truncate text-[11px] text-[color:var(--muted-foreground)]">
                {character.role}
              </p>
            </div>
            {/* 引经据典开关：角色会化用知乎真实高赞回答 */}
            <button
              onClick={() => setGrounded((v) => !v)}
              aria-pressed={grounded}
              title={t("reader.dialogue.groundedHint", { name: character.name })}
              data-el="dialogue-grounded"
              className={cn(
                "flex shrink-0 items-center gap-1 border px-2 py-1 text-[11px] transition-colors",
                grounded
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
              )}
            >
              <Quote className="h-3 w-3" />
              {t("reader.dialogue.grounded")}
            </button>
            {/* 知乎灵魂开关：角色能“看见”读者自己授权同步的知乎回答 */}
            {hasSoulCards && (
              <button
                onClick={() => setSoulOn((v) => !v)}
                aria-pressed={soulOn}
                title={t("reader.dialogue.soulHint", { name: character.name })}
                data-el="dialogue-soul"
                className={cn(
                  "flex shrink-0 items-center gap-1 border px-2 py-1 text-[11px] transition-colors",
                  soulOn
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                )}
              >
                <Feather className="h-3 w-3" />
                {t("reader.dialogue.soul")}
              </button>
            )}
          </div>
          <div className="max-h-[38vh] overflow-y-auto border border-[color:var(--border)] bg-[#171817] p-2.5">
            {msgs.length === 0 && (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {t("reader.dialogue.title", { name: character.name })}
              </p>
            )}
            <div className="grid gap-2">
              {msgs.map((m, i) =>
                m.from === "user" ? (
                  <p key={i} className="text-right text-sm leading-relaxed text-[color:var(--rs-ink)]">
                    {m.text}
                  </p>
                ) : (
                  <div key={i}>
                    <p className="text-sm leading-relaxed text-[#d9ca9b]">{m.text}</p>
                    <ZhihuCitations items={m.citations} />
                  </div>
                ),
              )}
              {thinking && (
                <p className="text-xs italic text-[color:var(--muted-foreground)]">
                  {t("reader.dialogue.thinking", { name: character.name })}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={
            scene === "ensemble"
              ? t("reader.dialogue.scene.ensemblePlaceholder")
              : t("reader.dialogue.placeholder", { name: character.name })
          }
          className="min-w-0 flex-1 border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
          data-el="dialogue-input"
        />
        <button
          onClick={send}
          disabled={thinking}
          aria-label={t("reader.dialogue.send")}
          className="flex w-11 items-center justify-center bg-[color:var(--primary)] text-[#171817] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {scene === "ensemble"
        ? hasEnsembleReply && (
            <KeepOrLogin
              authed={authed}
              kept={kept}
              labelKeep={t("reader.dialogue.scene.ensembleKeep")}
              labelKept={t("reader.dialogue.kept")}
              onKeep={() => {
                const body = ensembleTurns
                  .map((tn) =>
                    tn.from === "user"
                      ? `我：${tn.text}`
                      : tn.lines.map((l) => `${l.name}：${l.text}`).join("\n"),
                  )
                  .join("\n");
                onKeep(t("reader.dialogue.scene.ensembleTitle"), body);
                setKept(true);
              }}
            />
          )
        : hasSoloReply && (
            <KeepOrLogin
              authed={authed}
              kept={kept}
              labelKeep={t("reader.dialogue.keep")}
              labelKept={t("reader.dialogue.kept")}
              onKeep={() => {
                const body = msgs
                  .map((m) => (m.from === "user" ? `我：${m.text}` : m.text))
                  .join("\n");
                onKeep(`与${character.name}的对戏`, body);
                setKept(true);
              }}
            />
          )}
    </div>
  );
}

/* --- 分叉 --- */
function ForkMode({
  story,
  point,
  authed,
  onKeep,
}: {
  story: Story;
  point: EnterPoint;
  authed: boolean;
  onKeep: KeepFn;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const options = point.branchOptions ?? [];

  async function run(picked: string) {
    if (running) return;
    setChoice(picked);
    setRunning(true);
    setOutcome(null);
    setKept(false);
    try {
      const text = await generateStoryAi({
        mode: "fork",
        storyId: story.id,
        anchorParagraph: point.paragraphIndex,
        choice: picked,
      });
      setOutcome(text || null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-2.5" data-el="fork-mode">
      <p className="text-sm text-[#d9ca9b]">{point.branchPrompt}</p>
      <div className="grid gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => void run(o)}
            className={cn(
              "border px-3 py-2 text-left text-sm",
              choice === o
                ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                : "border-[color:var(--border)] text-[color:var(--rs-ink)]",
            )}
          >
            {o}
          </button>
        ))}
        <div className="flex gap-1.5">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t("reader.fork.custom")}
            className="min-w-0 flex-1 border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
          />
          <button
            onClick={() => custom.trim() && void run(custom.trim())}
            className="flex items-center gap-1 border border-[color:var(--primary)]/55 px-2.5 text-xs text-[color:var(--primary)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("reader.fork.run")}
          </button>
        </div>
      </div>
      {running && (
        <p className="text-xs italic text-[color:var(--muted-foreground)]">
          {t("reader.fork.running")}
        </p>
      )}
      {outcome && (
        <>
          <p className="whitespace-pre-line border-l-2 border-[color:var(--rs-cool)] bg-[#171817] p-2.5 text-sm leading-relaxed text-[#d9ca9b]">
            {outcome}
          </p>
          <KeepOrLogin
            authed={authed}
            kept={kept}
            labelKeep={t("reader.fork.keep")}
            labelKept={t("reader.fork.kept")}
            onKeep={() => {
              onKeep(choice ?? "分叉", outcome);
              setKept(true);
            }}
          />
        </>
      )}
    </div>
  );
}

/* --- 改写 --- */
function RewriteMode({
  story,
  point,
  authed,
  onKeep,
}: {
  story: Story;
  point: EnterPoint;
  authed: boolean;
  onKeep: KeepFn;
}) {
  const { t } = useTranslation();
  const [idea, setIdea] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [kept, setKept] = useState(false);

  async function run() {
    if (!idea.trim() || running) return;
    setRunning(true);
    setResult(null);
    setKept(false);
    try {
      const text = await generateStoryAi({
        mode: "rewrite",
        storyId: story.id,
        anchorParagraph: point.paragraphIndex,
        userText: idea.trim(),
      });
      setResult(text || null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-2.5" data-el="rewrite-mode">
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder={t("reader.rewrite.placeholder")}
        rows={3}
        className="w-full resize-none border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
        data-el="rewrite-input"
      />
      <button
        onClick={() => void run()}
        disabled={running}
        className="flex items-center justify-center gap-1.5 bg-[color:var(--primary)] px-3 py-2 text-sm text-[#171817] disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {t("reader.rewrite.run")}
      </button>
      {running && (
        <p className="text-xs italic text-[color:var(--muted-foreground)]">
          {t("reader.rewrite.running")}
        </p>
      )}
      {result && (
        <>
          <div className="border border-[color:var(--rs-cool)]/50 bg-[#171817] p-2.5">
            <span className="mb-1.5 inline-block bg-[color:var(--rs-cool)]/20 px-1.5 py-0.5 text-[10px] text-[color:var(--rs-cool)]">
              {t("reader.rewrite.badge")}
            </span>
            <p className="whitespace-pre-line font-heading text-sm leading-relaxed text-[#d9ca9b]">
              {result}
            </p>
          </div>
          <KeepOrLogin
            authed={authed}
            kept={kept}
            labelKeep={t("reader.rewrite.keep")}
            labelKept={t("reader.rewrite.kept")}
            onKeep={() => {
              onKeep("读者脑洞版", result);
              setKept(true);
            }}
          />
        </>
      )}
    </div>
  );
}

function KeepOrLogin({
  authed,
  kept,
  labelKeep,
  labelKept,
  onKeep,
}: {
  authed: boolean;
  kept: boolean;
  labelKeep: string;
  labelKept: string;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const { login } = useUser();
  if (!authed) {
    return (
      <button
        onClick={login}
        className="flex items-center justify-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2 text-xs text-[color:var(--primary)]"
        data-el="keep-login"
      >
        <LogIn className="h-3.5 w-3.5" />
        {t("common.signIn")}
      </button>
    );
  }
  return (
    <button
      onClick={onKeep}
      disabled={kept}
      className={cn(
        "flex items-center justify-center gap-1.5 border px-3 py-2 text-xs",
        kept
          ? "border-[color:var(--rs-cool)] text-[color:var(--rs-cool)]"
          : "border-[color:var(--primary)]/55 text-[color:var(--primary)]",
      )}
      data-el="keep-branch"
    >
      {kept ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {kept ? labelKept : labelKeep}
    </button>
  );
}
