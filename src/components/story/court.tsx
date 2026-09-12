"use client";

import { useUser } from "@/components/user-profile/user-provider";
import { useCallback, useEffect, useState } from "react";
import {
  Scale,
  Loader2,
  RefreshCw,
  Gavel,
  Swords,
  ChevronDown,
  Megaphone,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import { LoginGate } from "@/components/user-profile/login-gate";
import {
  fetchCourtCase,
  fetchTally,
  castCourtVote,
  fetchVerdict,
  type CourtTally,
} from "@/lib/api/court";
import type { CourtCase } from "@/lib/court/types";
import { CourtVerdictModal } from "@/components/story/court-verdict-modal";

export function Court() {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [trial, setTrial] = useState<CourtCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(0); // 已揭开的交锋回合数
  const [tally, setTally] = useState<CourtTally>({ red: 0, blue: 0, mine: null });
  const [voting, setVoting] = useState(false);
  const [verdict, setVerdict] = useState<string>("");
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(
    async (seed?: number) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setRevealed(0);
      setVerdict("");
      try {
        const c = await fetchCourtCase(seed);
        setTrial(c);
        try {
          setTally(await fetchTally(c.id));
        } catch {
          setTally({ red: 0, blue: 0, mine: null });
        }
      } catch {
        setTrial(null);
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

  async function vote(side: "red" | "blue") {
    if (!user) {
      login();
      return;
    }
    if (!trial || voting) return;
    setVoting(true);
    try {
      const next = await castCourtVote(trial.id, side);
      setTally(next);
      // 首次投票后拉盐官总评
      setVerdictLoading(true);
      try {
        const v = await fetchVerdict({
          caseTitle: trial.caseTitle,
          redHeadline: trial.red.headline,
          blueHeadline: trial.blue.headline,
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
  const allRevealed = trial ? revealed >= trial.rounds.length : false;

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
          <Scale className="h-7 w-7 text-[color:var(--primary)]" />
          {t("court.title")}
        </h1>
        <p className="mt-1 font-heading text-sm text-[#d9ca9b]">
          {t("court.subtitle")}
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-[color:var(--muted-foreground)]">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--primary)]" />
          {t("court.opening")}
        </div>
      ) : !trial ? (
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
          {/* 案由 */}
          <div className="border border-[color:var(--border)] bg-[#211f18] p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
              <Gavel className="h-3.5 w-3.5" />
              {t("court.caseLabel")}
            </div>
            <p className="font-heading text-lg leading-snug text-[#f2ead0]">
              {trial.caseTitle}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#d9ca9b]">
              {trial.brief}
            </p>
          </div>

          {/* 红蓝两造主张 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ClaimCard side="red" headline={trial.red.headline} argument={trial.red.argument} />
            <ClaimCard side="blue" headline={trial.blue.headline} argument={trial.blue.argument} />
          </div>

          {/* 交锋回合（逐条揭开） */}
          <div className="border border-[color:var(--border)] bg-[#1c1b15] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-[color:var(--primary)]">
              <Swords className="h-3.5 w-3.5" />
              {t("court.clash")}
            </div>
            <div className="space-y-3">
              {trial.rounds.slice(0, revealed).map((r, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-[11px] text-[#8c8570]">
                    {t("court.round", { n: i + 1 })}
                  </p>
                  <p className="border-l-2 border-red-500/60 pl-2.5 text-[13px] leading-relaxed text-[#f0d5cf]">
                    {r.red}
                  </p>
                  <p className="border-l-2 border-sky-400/60 pl-2.5 text-[13px] leading-relaxed text-[#cfe0f0]">
                    {r.blue}
                  </p>
                </div>
              ))}
            </div>
            {!allRevealed && (
              <button
                onClick={() => setRevealed((n) => n + 1)}
                className="mt-3 inline-flex items-center gap-1.5 border border-[color:var(--primary)]/50 px-3 py-2 text-xs text-[color:var(--primary)]"
                data-el="court-next-round"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {revealed === 0 ? t("court.startClash") : t("court.nextRound")}
              </button>
            )}
          </div>

          {/* 投票 + 票条（交锋看完才开放） */}
          {allRevealed && (
            <VotePanel
              tally={tally}
              redPct={redPct}
              bluePct={bluePct}
              redHeadline={trial.red.headline}
              blueHeadline={trial.blue.headline}
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
            onClick={() => void load(Date.now())}
            className="inline-flex items-center gap-1.5 border border-[color:var(--primary)]/45 px-3 py-2 text-xs text-[color:var(--primary)]"
            data-el="court-next-case"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("court.nextCase")}
          </button>
        </div>
      )}

      {shareOpen && trial && (
        <CourtVerdictModal
          data={{
            caseTitle: trial.caseTitle,
            redHeadline: trial.red.headline,
            blueHeadline: trial.blue.headline,
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

function ClaimCard({
  side,
  headline,
  argument,
}: {
  side: "red" | "blue";
  headline: string;
  argument: string;
}) {
  const { t } = useTranslation();
  const isRed = side === "red";
  return (
    <div
      className={`border p-3 ${
        isRed
          ? "border-red-500/60 bg-red-500/8"
          : "border-sky-400/60 bg-sky-400/8"
      }`}
      data-el={`court-claim-${side}`}
    >
      <p className={`mb-1 text-[11px] tracking-[0.12em] ${isRed ? "text-red-300" : "text-sky-300"}`}>
        {isRed ? t("court.red") : t("court.blue")}
      </p>
      <h3 className="font-heading text-base leading-snug text-[#f2ead0]">{headline}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#dcd0a6]">{argument}</p>
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
