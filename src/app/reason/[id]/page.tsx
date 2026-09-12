"use client";

import { useUser } from "@/components/user-profile/user-provider";
import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, Swords, Sparkles, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getReasonBoard } from "@/lib/story/reason";
import { generateStoryAi } from "@/lib/api/story";
import type { ReasonNode } from "@/lib/story/types";
import { CharacterSheet } from "@/components/story/character-sheet";
import { cn } from "@/utils/utils";

const KIND_COLOR: Record<ReasonNode["kind"], string> = {
  force: "var(--rs-warm)",
  terrain: "var(--rs-cool)",
  decision: "var(--primary)",
  clue: "var(--rs-cool)",
};

export default function ReasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const board = getReasonBoard(id);
  const [activeNode, setActiveNode] = useState<ReasonNode | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [activeCharId, setActiveCharId] = useState<string | null>(null);

  if (!board) notFound();

  const byId = new Map(board.nodes.map((n) => [n.id, n]));

  return (
    <div
      className="relative isolate min-h-[100svh] w-full"
      style={{
        paddingTop: "var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px)))",
      }}
      data-el="reason-shell"
    >
      <div className="rs-grain" aria-hidden />
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16">
        <div className="mb-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-[color:var(--muted-foreground)]"
            data-el="reason-back"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </div>

        <header className="mb-4 border-b border-[color:var(--sidebar-border)] pb-3">
          <div className="mb-1 flex items-center gap-2 text-[color:var(--rs-cool)]">
            <Swords className="h-4 w-4" />
            <span className="text-[11px] tracking-[0.16em]">{t("shelf.nonfiction")}</span>
          </div>
          <h1 className="font-heading text-[clamp(26px,8vw,44px)] leading-tight">
            {board.title}
          </h1>
          <p className="mt-1 text-xs text-[color:var(--rs-cool)]">{board.subtitle}</p>
          <p className="mt-2 font-heading text-sm leading-relaxed text-[#d9ca9b]">
            {board.intro}
          </p>
          {board.characters && board.characters.length > 0 && (
            <div className="mt-3 flex gap-3" data-el="reason-cast">
              {board.characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCharId(c.id)}
                  className="flex flex-col items-center gap-1"
                  data-el="reason-cast-item"
                >
                  {c.portrait && (
                    <span className="relative block h-14 w-14 overflow-hidden rounded-full border border-[color:var(--primary)]/50">
                      <Image src={c.portrait} alt={c.name} fill unoptimized className="object-cover" />
                    </span>
                  )}
                  <span className="text-[11px] text-[color:var(--rs-ink)]">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </header>

        {/* chapters: nonfiction pieces read like a chaptered account, each with a scene image */}
        {board.chapters && board.chapters.length > 0 && (
          <article className="mb-6 grid gap-4" data-el="reason-chapters">
            {board.chapters.map((ch) => (
              <div key={ch.index}>
                <h2 className="font-heading text-xl text-[color:var(--primary)]">{ch.title}</h2>
                {ch.sceneImage && (
                  <div className="relative mt-2 aspect-[3/2] w-full overflow-hidden border border-[color:var(--border)]">
                    <Image src={ch.sceneImage} alt={ch.title} fill unoptimized className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#10110f]/50 to-transparent" />
                  </div>
                )}
                <div className="mt-2.5 grid gap-2">
                  {ch.paragraphs.map((p, pi) => (
                    <p key={pi} className="font-heading text-[16px] leading-[1.9] text-[color:var(--rs-ink)]">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </article>
        )}

        {/* cause-effect board */}
        <section
          className="relative border border-[color:var(--border)] bg-gradient-to-b from-[#10110f]/95 to-[#211f18]/90 p-3 shadow-[0_16px_42px_rgba(0,0,0,.34)]"
          data-el="reason-board"
        >
          <p className="mb-2 text-[11px] text-[color:var(--muted-foreground)]">
            {t("reason.nodeTip")}
          </p>
          <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              {board.edges.map((e, i) => {
                const a = byId.get(e.from);
                const b = byId.get(e.to);
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--rs-line)"
                    strokeWidth={0.5}
                    strokeDasharray="1.4 2"
                    opacity={0.7}
                  />
                );
              })}
            </svg>
            {board.nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveNode(n)}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                data-el="reason-node"
              >
                <span
                  className={cn(
                    "rounded-full transition-transform",
                    activeNode?.id === n.id ? "h-3.5 w-3.5" : "h-3 w-3",
                  )}
                  style={{
                    background: KIND_COLOR[n.kind],
                    boxShadow: `0 0 12px ${KIND_COLOR[n.kind]}`,
                  }}
                />
                <span className="whitespace-nowrap text-[10px] leading-none text-[color:var(--rs-ink)]">
                  {n.label}
                </span>
              </button>
            ))}
          </div>
          {activeNode && (
            <p className="mt-3 border-l-2 border-[color:var(--primary)] bg-[#171817] p-2.5 text-sm leading-relaxed text-[#d9ca9b]">
              <span className="font-heading text-[color:var(--primary)]">
                {activeNode.label}：
              </span>
              {activeNode.brief}
            </p>
          )}
        </section>

        {/* decision points */}
        <section className="mt-5 grid gap-4" data-el="reason-decisions">
          {board.decisions.map((d, di) => {
            const picked = picks[d.id];
            return (
              <div key={d.id} className="border border-[color:var(--border)] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rs-pin h-2.5 w-2.5" aria-hidden />
                  <span className="text-[11px] tracking-[0.14em] text-[color:var(--primary)]">
                    {t("reason.decisionTitle")} {di + 1}
                  </span>
                </div>
                <p className="mb-2.5 font-heading text-[15px] leading-relaxed text-[color:var(--rs-ink)]">
                  {d.question}
                </p>
                <div className="grid gap-1.5">
                  {d.options.map((o, oi) => (
                    <button
                      key={oi}
                      onClick={() =>
                        setPicks((p) => ({ ...p, [d.id]: oi }))
                      }
                      className={cn(
                        "border px-3 py-2 text-left text-sm",
                        picked === oi
                          ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                          : "border-[color:var(--border)] text-[color:var(--rs-ink)]",
                      )}
                      data-el="reason-option"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {picked !== undefined && (
                  <div className="mt-2.5 border-l-2 border-[color:var(--rs-cool)] bg-[#171817] p-2.5">
                    <span className="mb-1 inline-block text-[10px] tracking-[0.14em] text-[color:var(--rs-cool)]">
                      {t("reason.verdict")}
                    </span>
                    <p className="text-sm leading-relaxed text-[#d9ca9b]">
                      {d.options[picked].verdict}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <ReasonAiReview
          storyId={board.storyId}
          decisions={board.decisions}
          picks={picks}
        />
      </div>
      <CharacterSheet
        character={board.characters?.find((c) => c.id === activeCharId) ?? null}
        open={!!activeCharId}
        onClose={() => setActiveCharId(null)}
      />
    </div>
  );
}

function ReasonAiReview({
  storyId,
  decisions,
  picks,
}: {
  storyId: string;
  decisions: { id: string; question: string; options: { label: string }[] }[];
  picks: Record<string, number>;
}) {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [running, setRunning] = useState(false);
  const [review, setReview] = useState<string | null>(null);

  const pickedList = decisions
    .filter((d) => picks[d.id] !== undefined)
    .map((d) => `${d.question} → ${d.options[picks[d.id]].label}`);

  async function run() {
    if (running) return;
    setRunning(true);
    setReview(null);
    try {
      const choice = pickedList.length
        ? pickedList.join("；")
        : "请概述这场复盘的关键点。";
      const text = await generateStoryAi({
        mode: "reason",
        storyId,
        choice,
      });
      setReview(text || null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-5 border border-[color:var(--rs-cool)]/40 p-3.5" data-el="reason-ai-review">
      <div className="mb-2 flex items-center gap-2 text-[color:var(--rs-cool)]">
        <Sparkles className="h-4 w-4" />
        <span className="text-[11px] tracking-[0.14em]">{t("reason.verdict")} · AI</span>
      </div>
      {!user ? (
        <button
          onClick={login}
          className="flex items-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2 text-xs text-[color:var(--primary)]"
        >
          <LogIn className="h-3.5 w-3.5" />
          {t("common.signIn")}
        </button>
      ) : (
        <button
          onClick={() => void run()}
          disabled={running}
          className="flex items-center gap-1.5 bg-[color:var(--primary)] px-3 py-2 text-sm text-[#171817] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {running ? t("reader.fork.running") : t("reason.decisionTitle") + " · AI"}
        </button>
      )}
      {review && (
        <p className="mt-2.5 whitespace-pre-line border-l-2 border-[color:var(--rs-cool)] bg-[#171817] p-2.5 text-sm leading-relaxed text-[#d9ca9b]">
          {review}
        </p>
      )}
    </section>
  );
}
