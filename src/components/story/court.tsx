"use client";

// 名场面法庭 · 双 Agent 对抗版：
// 盐官出开庭陈词 → 烈盐（故事党）/析盐（逻辑党）各自立论 → 3 回合逐轮真实交锋
// （每回合红蓝两次实时生成，各自能看到对方已说出口的话）→ 观众投票 → 盐官总评。
// 难度与立场钩子由观众历史投票画像自适应（court_votes 聚合，服务端算好随开局返回）。

import { useUser } from "@/components/user-profile/user-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Scale,
  Loader2,
  RefreshCw,
  Gavel,
  Swords,
  ChevronDown,
  Megaphone,
  Sparkles,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import { LoginGate } from "@/components/user-profile/login-gate";
import {
  openDuel,
  rebutDuel,
  fetchTally,
  castCourtVote,
  fetchVerdict,
  deepDiveQuestion,
  type CourtTally,
  type ZhihuCitation,
} from "@/lib/api/court";
import type { CourtDuel, CourtProfile, EvidenceItem, Side } from "@/lib/court/types";
import { COURT_AGENTS } from "@/lib/court/types";
import { CourtVerdictModal } from "@/components/story/court-verdict-modal";
import { ZhihuCitations } from "@/components/story/zhihu-citations";
import { cn } from "@/utils/utils";

const TOTAL_ROUNDS = 3;

interface RoundLine {
  side: Side;
  text: string;
}

// 从发言文本里抠出引用编号 [n]，映射成可展开的引用卡（论据战可验证）。
function citedCitations(text: string, evidence?: EvidenceItem[]): ZhihuCitation[] {
  if (!evidence || evidence.length === 0) return [];
  const ns = new Set<number>();
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (evidence.some((e) => e.n === n)) ns.add(n);
  }
  return [...ns]
    .sort((a, b) => a - b)
    .map((n) => {
      const e = evidence.find((x) => x.n === n)!;
      return {
        n,
        title:
          e.summary.length > 20 ? `${e.summary.slice(0, 20)}…` : e.summary,
        contentText: e.summary,
        url: e.url,
        voteUpCount: e.voteUpCount ?? 0,
        authorName: "知乎",
      };
    });
}

export function Court() {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [duel, setDuel] = useState<CourtDuel | null>(null);
  const [profile, setProfile] = useState<CourtProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // 交锋记录：红蓝按回合交错（偶数位红、奇数位蓝），客户端持有并回传
  const [transcript, setTranscript] = useState<RoundLine[]>([]);
  const [pendingSide, setPendingSide] = useState<Side | null>(null);
  const [tally, setTally] = useState<CourtTally>({ red: 0, blue: 0, mine: null });
  const [voting, setVoting] = useState(false);
  const [verdict, setVerdict] = useState<string>("");
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // 当前案 id 走 ref：load 若依赖 duel，换案后 effect 会用空参重跑覆盖掉换案结果
  const duelIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    duelIdRef.current = duel?.id;
  }, [duel]);

  // reroll=true 为「换一桩」：排除当前案由，从池里现取另一桩开庭
  const load = useCallback(
    async (opts?: { reroll?: boolean }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setTranscript([]);
      setPendingSide(null);
      setVerdict("");
      setShareOpen(false);
      try {
        const data = await openDuel({
          reroll: opts?.reroll,
          // 服务端剥日期后缀得到池内 id，排除当前案避免换到同一个
          excludeCaseId: opts?.reroll ? duelIdRef.current : undefined,
        });
        setDuel(data.case);
        setProfile(data.profile ?? null);
        try {
          setTally(await fetchTally(data.case.id));
        } catch {
          setTally({ red: 0, blue: 0, mine: null });
        }
      } catch {
        setDuel(null);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  // 下一回合：红 → 蓝两次实时生成（蓝方能看到红方刚说的话）
  async function nextRound() {
    if (!duel || pendingSide || transcript.length >= TOTAL_ROUNDS * 2) return;
    const roundNo = Math.floor(transcript.length / 2) + 1;
    const base = {
      caseId: duel.id,
      caseTitle: duel.caseTitle,
      brief: duel.brief,
      redHeadline: duel.red.headline,
      blueHeadline: duel.blue.headline,
      difficulty: duel.difficulty,
      lean: profile?.lean ?? null,
    };
    try {
      setPendingSide("red");
      const red = await rebutDuel({ ...base, transcript, side: "red", roundNo });
      const withRed = [...transcript, { side: "red" as const, text: red.text }];
      setTranscript(withRed);

      setPendingSide("blue");
      const blue = await rebutDuel({
        ...base,
        transcript: withRed,
        side: "blue",
        roundNo,
      });
      setTranscript([...withRed, { side: "blue" as const, text: blue.text }]);
    } catch {
      // 网络层失败：停在当前进度，可再点继续
    } finally {
      setPendingSide(null);
    }
  }

  async function vote(side: "red" | "blue") {
    if (!user) {
      login();
      return;
    }
    if (!duel || voting) return;
    setVoting(true);
    try {
      const next = await castCourtVote(duel.id, side);
      setTally(next);
      // 首次投票后拉盐官总评
      setVerdictLoading(true);
      try {
        const v = await fetchVerdict({
          caseTitle: duel.caseTitle,
          redHeadline: duel.red.headline,
          blueHeadline: duel.blue.headline,
          redVotes: next.red,
          blueVotes: next.blue,
        });
        setVerdict(v);
      } catch {
        setVerdict("");
      } finally {
        setVerdictLoading(false);
      }
    } catch {
      /* ignore */
    } finally {
      setVoting(false);
    }
  }

  const total = tally.red + tally.blue;
  const redPct = total > 0 ? Math.round((tally.red / total) * 100) : 50;
  const bluePct = 100 - redPct;
  const allRevealed = transcript.length >= TOTAL_ROUNDS * 2;

  if (!user) {
    return (
      <AppShell>
        <LoginGate />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-4 border-b border-[color:var(--sidebar-border)] pb-3" data-guide="court-page">
        <h1 className="flex items-center gap-2 font-heading text-[clamp(26px,8vw,44px)] leading-tight">
          <Scale className="h-7 w-7 text-[color:var(--primary)]" />
          {t("court.title")}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-sm text-[#d9ca9b]">
          <span>{t("court.subtitle")}</span>
          {duel && (
            <span
              className="border border-[color:var(--primary)]/50 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-[color:var(--primary)]"
              data-el="court-difficulty"
            >
              {t(`court.difficulty.${duel.difficulty}`)}
            </span>
          )}
        </p>
        {profile && profile.totalVotes > 0 && (
          <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
            {t("court.profileLine", { n: profile.totalVotes + 1, votes: profile.totalVotes })}
            {profile.lean && (
              <span>
                {" · "}
                {t("court.leanHint", {
                  side: t(profile.lean === "red" ? "court.sideRed" : "court.sideBlue"),
                })}
              </span>
            )}
          </p>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-[color:var(--muted-foreground)]">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--primary)]" />
          {t("court.opening")}
        </div>
      ) : !duel ? (
        <div className="border border-dashed border-[color:var(--border)] p-8 text-center">
          <p className="mb-3 text-sm text-[color:var(--muted-foreground)]">
            {t("court.failed")}
          </p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 border border-[color:var(--primary)] px-4 py-2 text-sm text-[color:var(--primary)]"
          >
            <RefreshCw className="h-4 w-4" />
            {t("court.retry")}
          </button>
        </div>
      ) : (
        <div className="space-y-4" data-el="court-trial">
          {/* 案由 + 盐官开庭陈词（+ 论据战：看山深挖入口） */}
          <div className="border border-[color:var(--border)] bg-[#211f18] p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
              <Gavel className="h-3.5 w-3.5" />
              {t("court.caseLabel")}
              {duel.personalized && (
                <span
                  className="ml-auto inline-flex items-center gap-1 border border-[#d9ca9b]/50 px-1.5 py-0.5 text-[10px] text-[#d9ca9b]"
                  data-el="court-personalized"
                >
                  <Sparkles className="h-3 w-3" />
                  {t("court.personalized")}
                </span>
              )}
            </div>
            <p className="font-heading text-lg leading-snug text-[#f2ead0]">
              {duel.caseTitle}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#d9ca9b]">
              {duel.brief}
            </p>
            <DeepDivePanel
              questionUrl={duel.questionUrl}
              topic={duel.caseTitle}
              evidenceCount={duel.evidence?.length ?? 0}
            />
          </div>

          {/* 烈盐 / 析盐 各自立论 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ClaimCard side="red" headline={duel.red.headline} argument={duel.red.argument} evidence={duel.evidence} />
            <ClaimCard side="blue" headline={duel.blue.headline} argument={duel.blue.argument} evidence={duel.evidence} />
          </div>

          {/* 逐轮交锋：每回合红→蓝实时生成 */}
          <div className="border border-[color:var(--border)] bg-[#1c1b15] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
              <Swords className="h-3.5 w-3.5" />
              {t("court.clash")}
            </div>
            <div className="space-y-3">
              {transcript.map((line, i) => (
                <RoundLineView
                  key={i}
                  line={line}
                  roundNo={Math.floor(i / 2) + 1}
                  showRound={line.side === "red"}
                  evidence={duel.evidence}
                />
              ))}
              {pendingSide && (
                <p className="flex items-center gap-1.5 text-xs italic text-[color:var(--muted-foreground)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {pendingSide === "red" ? t("court.turnRed") : t("court.turnBlue")}
                </p>
              )}
            </div>
            {!allRevealed && !pendingSide && (
              <button
                onClick={() => void nextRound()}
                className="mt-3 inline-flex items-center gap-1.5 border border-[color:var(--primary)]/50 px-3 py-2 text-xs text-[color:var(--primary)]"
                data-el="court-next-round"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {transcript.length === 0 ? t("court.startClash") : t("court.nextRound")}
              </button>
            )}
          </div>

          {/* 投票 + 票条（交锋看完才开放） */}
          {allRevealed && (
            <VotePanel
              tally={tally}
              redPct={redPct}
              bluePct={bluePct}
              redHeadline={duel.red.headline}
              blueHeadline={duel.blue.headline}
              voting={voting}
              user={user}
              onVote={(s) => void vote(s)}
            />
          )}

          {/* 盐官总评 */}
          {(verdict || verdictLoading) && (
            <div className="border border-[color:var(--primary)]/50 bg-[color:var(--primary)]/8 p-3.5" data-el="court-verdict">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
                <Gavel className="h-3.5 w-3.5" />
                {t("court.judge")}
              </div>
              {verdictLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" />
              ) : (
                <p className="text-sm leading-relaxed text-[#f2ead0]">{verdict}</p>
              )}
              {!verdictLoading && verdict && (
                <button
                  onClick={() => setShareOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 bg-[color:var(--primary)] px-3 py-2 text-xs text-[#171817]"
                  data-el="court-rally-share"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  {t("court.rallyShare")}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => void load({ reroll: true })}
            className="inline-flex items-center gap-1.5 border border-[color:var(--primary)]/45 px-3 py-2 text-xs text-[color:var(--primary)]"
            data-el="court-next-case"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("court.nextCase")}
          </button>
        </div>
      )}

      {shareOpen && duel && (
        <CourtVerdictModal
          data={{
            caseTitle: duel.caseTitle,
            redHeadline: duel.red.headline,
            blueHeadline: duel.blue.headline,
            redVotes: tally.red,
            blueVotes: tally.blue,
            verdict,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </AppShell>
  );
}

// 庭辩 Agent 头像：public/court/agents/red|blue.png（未放置图片时优雅回落为首字徽章）
export function AgentAvatar({
  side,
  name,
  size = 26,
}: {
  side: Side;
  name: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const src = side === "red" ? "/court/agents/red.png" : "/court/agents/blue.png";
  if (broken) {
    return (
      <span
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border font-heading",
          side === "red"
            ? "border-red-500/60 bg-red-500/15 text-red-300"
            : "border-sky-400/60 bg-sky-400/15 text-sky-300",
        )}
      >
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="relative inline-block shrink-0 overflow-hidden rounded-full border border-[color:var(--border)] bg-[#171817]"
    >
      <Image
        src={src}
        alt={name}
        fill
        unoptimized
        onError={() => setBroken(true)}
        className="object-cover"
      />
    </span>
  );
}

function agentNameOf(side: Side): string {
  return COURT_AGENTS[side].name;
}

function RoundLineView({
  line,
  roundNo,
  showRound,
  evidence,
}: {
  line: RoundLine;
  roundNo: number;
  showRound: boolean;
  evidence?: EvidenceItem[];
}) {
  const { t } = useTranslation();
  const name = agentNameOf(line.side);
  const isRed = line.side === "red";
  const citations = citedCitations(line.text, evidence);
  return (
    <div className="flex items-start gap-2" data-el={`court-line-${line.side}`}>
      <AgentAvatar side={line.side} name={name} size={24} />
      <div className="min-w-0">
        <p className="mb-0.5 text-[11px] text-[#8c8570]">
          {showRound && <span className="mr-1.5">{t("court.round", { n: roundNo })}</span>}
          <span className={isRed ? "text-red-300" : "text-sky-300"}>{name}</span>
          <span className="ml-1 opacity-80">
            · {t(isRed ? "court.agentTitleRed" : "court.agentTitleBlue")}
          </span>
        </p>
        <p
          className={cn(
            "border-l-2 pl-2.5 text-[13px] leading-relaxed",
            isRed ? "border-red-500/60 text-[#f0d5cf]" : "border-sky-400/60 text-[#cfe0f0]",
          )}
        >
          {line.text}
        </p>
        {citations.length > 0 && (
          <ZhihuCitations items={citations} label={t("court.evidenceLabel")} />
        )}
      </div>
    </div>
  );
}

function ClaimCard({
  side,
  headline,
  argument,
  evidence,
}: {
  side: "red" | "blue";
  headline: string;
  argument: string;
  evidence?: EvidenceItem[];
}) {
  const { t } = useTranslation();
  const isRed = side === "red";
  const name = agentNameOf(side);
  const citations = citedCitations(argument, evidence);
  return (
    <div
      className={`border p-3 ${
        isRed ? "border-red-500/60 bg-red-500/8" : "border-sky-400/60 bg-sky-400/8"
      }`}
      data-el={`court-claim-${side}`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <AgentAvatar side={side} name={name} size={22} />
        <p className={`text-[11px] tracking-[0.12em] ${isRed ? "text-red-300" : "text-sky-300"}`}>
          {name} · {t(isRed ? "court.agentTitleRed" : "court.agentTitleBlue")}
          <span className="ml-1.5 opacity-70">{t(isRed ? "court.red" : "court.blue")}</span>
        </p>
      </div>
      <h3 className="font-heading text-base leading-snug text-[#f2ead0]">{headline}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#dcd0a6]">{argument}</p>
      {citations.length > 0 && (
        <ZhihuCitations items={citations} label={t("court.evidenceLabel")} />
      )}
    </div>
  );
}

// 看山「深挖这个问题」：把当日辩题下的真实知乎回答挖开看（论据战的可验证面）。
function DeepDivePanel({
  questionUrl,
  topic,
  evidenceCount,
}: {
  questionUrl?: string;
  topic: string;
  evidenceCount: number;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [reply, setReply] = useState("");
  const [citations, setCitations] = useState<ZhihuCitation[]>([]);

  if (state === "idle" && evidenceCount === 0 && !questionUrl) return null;

  async function run() {
    setState("loading");
    try {
      const data = await deepDiveQuestion({ questionUrl, topic });
      if (!data.reply) {
        setState("error");
        return;
      }
      setReply(data.reply);
      setCitations(data.citations ?? []);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-2.5" data-el="court-deepdive">
      {state === "idle" && (
        <button
          onClick={() => void run()}
          className="inline-flex items-center gap-1.5 border border-[color:var(--primary)]/50 px-2.5 py-1.5 text-[11px] text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/10"
        >
          <Search className="h-3 w-3" />
          {t("court.deepDive")}
        </button>
      )}
      {state === "loading" && (
        <p className="flex items-center gap-1.5 text-[11px] italic text-[color:var(--muted-foreground)]">
          <Loader2 className="h-3 w-3 animate-spin text-[color:var(--primary)]" />
          {t("court.deepDiveLoading")}
        </p>
      )}
      {state === "error" && (
        <p className="text-[11px] text-[color:var(--muted-foreground)]">
          {t("court.deepDiveFailed")}
        </p>
      )}
      {state === "done" && (
        <div className="border border-[color:var(--primary)]/30 bg-[#1c1b15] p-2.5">
          <p className="mb-1 text-[10px] tracking-[0.12em] text-[color:var(--primary)]">
            {t("court.deepDiveTitle")}
          </p>
          <p className="text-[12px] leading-relaxed text-[#dcd0a6]">{reply}</p>
          <ZhihuCitations items={citations} label={t("court.evidenceLabel")} />
        </div>
      )}
    </div>
  );
}

function VotePanel({
  tally,
  redPct,
  bluePct,
  redHeadline,
  blueHeadline,
  voting,
  user,
  onVote,
}: {
  tally: CourtTally;
  redPct: number;
  bluePct: number;
  redHeadline: string;
  blueHeadline: string;
  voting: boolean;
  user: unknown;
  onVote: (side: "red" | "blue") => void;
}) {
  const { t } = useTranslation();
  const total = tally.red + tally.blue;
  return (
    <div className="border border-[color:var(--border)] bg-[#211f18] p-3.5" data-el="court-vote">
      <p className="mb-2 text-center text-sm text-[#d9ca9b]">
        {user ? t("court.voteHint") : t("court.loginToVote")}
      </p>

      {/* 票条 */}
      <div className="mb-1 flex h-7 w-full overflow-hidden border border-[color:var(--border)]">
        <div
          className="flex items-center justify-start bg-red-500/40 px-2 text-[11px] text-red-100 transition-all duration-500"
          style={{ width: `${redPct}%` }}
        >
          {total > 0 ? `${redPct}%` : ""}
        </div>
        <div
          className="flex flex-1 items-center justify-end bg-sky-500/40 px-2 text-[11px] text-sky-100 transition-all duration-500"
          style={{ width: `${bluePct}%` }}
        >
          {total > 0 ? `${bluePct}%` : ""}
        </div>
      </div>
      <div className="mb-3 flex justify-between text-[11px] text-[#8c8570]">
        <span>{t("court.redVotes", { n: tally.red })}</span>
        <span>{t("court.blueVotes", { n: tally.blue })}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onVote("red")}
          disabled={voting}
          className={`flex flex-col items-center gap-0.5 border px-3 py-2.5 text-xs disabled:opacity-60 ${
            tally.mine === "red"
              ? "border-red-500 bg-red-500/20 text-red-100"
              : "border-red-500/50 text-red-200"
          }`}
          data-el="court-vote-red"
        >
          <span className="font-heading">{t("court.voteRed")}</span>
          <span className="line-clamp-1 text-[10px] opacity-80">{redHeadline}</span>
        </button>
        <button
          onClick={() => onVote("blue")}
          disabled={voting}
          className={`flex flex-col items-center gap-0.5 border px-3 py-2.5 text-xs disabled:opacity-60 ${
            tally.mine === "blue"
              ? "border-sky-400 bg-sky-400/20 text-sky-100"
              : "border-sky-400/50 text-sky-200"
          }`}
          data-el="court-vote-blue"
        >
          <span className="font-heading">{t("court.voteBlue")}</span>
          <span className="line-clamp-1 text-[10px] opacity-80">{blueHeadline}</span>
        </button>
      </div>
    </div>
  );
}
