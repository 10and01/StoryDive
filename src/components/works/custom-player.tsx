"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { request } from "@/lib/api/request";
import { fetchPlayableWork, type WorkSummary } from "@/lib/api/works";
import type { Story } from "@/lib/story/types";
import { useUser } from "@/components/user-profile/user-provider";
import { cn } from "@/utils/utils";
import { useTranslation } from "react-i18next";

export function CustomPlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user } = useUser();
  const [story, setStory] = useState<Story | null>(null);
  const [work, setWork] = useState<WorkSummary | null>(null);
  const [versionId, setVersionId] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetchPlayableWork(id, token).then((result) => {
      setStory(result.story); setWork(result.work); setVersionId(result.versionId);
      if (user) {
        const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
        void request(`/api/works/${id}/progress${suffix}`).then(async (response) => {
          if (!response.ok) return;
          const data = await response.json() as { progress?: { currentChapter?: number; currentParagraph?: number } };
          setChapterIndex(Math.max(0, data.progress?.currentChapter ?? 0));
          setParagraphIndex(Math.max(0, data.progress?.currentParagraph ?? 0));
        });
      }
    }).catch((caught) => setError(caught instanceof Error ? caught.message : t("creator.player.loadFailed")));
  }, [id, t, token, user]);
  const flat = useMemo(() => story?.chapters.flatMap((chapter, ci) => chapter.paragraphs.map((text, pi) => ({ text, ci, pi, chapter }))) ?? [], [story]);
  const currentGlobal = useMemo(() => {
    const index = flat.findIndex((item) => item.ci === chapterIndex && item.pi === paragraphIndex);
    return index < 0 ? 0 : index;
  }, [chapterIndex, flat, paragraphIndex]);
  const current = flat[currentGlobal];
  const enterPoint = story?.enterPoints.find((point) => point.paragraphIndex === currentGlobal);

  function save(nextIndex: number, eventKind?: string, eventPayload?: Record<string, unknown>) {
    const next = flat[nextIndex];
    if (!next) return;
    setChapterIndex(next.ci); setParagraphIndex(next.pi); setChoice(null);
    if (!user) return;
    const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
    void request(`/api/works/${id}/progress${suffix}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, currentChapter: next.ci, currentParagraph: next.pi, progress: { globalIndex: nextIndex }, state: { lastChoice: choice }, eventKind, eventPayload }),
    });
  }

  if (error) return <div className="grid min-h-[100svh] place-items-center bg-[#10110f] p-6 text-center"><div><h1 className="font-heading text-3xl">{t("creator.player.openFailed")}</h1><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{error}</p><Link href="/discover" className="mt-4 inline-block text-[color:var(--primary)]">{t("creator.common.backDiscover")}</Link></div></div>;
  if (!story || !work || !current) return <div className="grid min-h-[100svh] place-items-center bg-[#10110f]"><Loader2 className="size-6 animate-spin text-[color:var(--primary)]" /></div>;
  return (
    <main className="relative isolate min-h-[100svh] overflow-hidden bg-[#10110f] px-4 pb-12 pt-5 sm:px-8 sm:pt-8">
      <div className="rs-grain" aria-hidden />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3">
          <Link href={`/works/${work.id}${token ? `?token=${encodeURIComponent(token)}` : ""}`} className="inline-flex items-center gap-1 text-xs text-[color:var(--muted-foreground)]"><ChevronLeft className="size-4" /> {t("creator.player.workPage")}</Link>
          <div className="text-right"><p className="font-heading text-lg">{story.title}</p><p className="text-[10px] text-[color:var(--muted-foreground)]">{current.chapter.title} · {currentGlobal + 1}/{flat.length}</p></div>
        </header>
        <div className="h-px bg-[color:var(--border)]/30"><div className="h-px bg-[color:var(--primary)] transition-[width]" style={{ width: `${((currentGlobal + 1) / flat.length) * 100}%` }} /></div>
        <section className="flex flex-1 flex-col justify-center py-10">
          <p className="text-center text-[10px] tracking-[0.26em] text-[color:var(--muted-foreground)]">{String(current.chapter.index).padStart(2, "0")} · {current.chapter.title}</p>
          <p className="mx-auto mt-6 max-w-2xl font-heading text-[clamp(20px,4vw,28px)] leading-[1.95] text-[#ede3c1]">{current.text}</p>
          {enterPoint && (
            <div className="mx-auto mt-8 w-full max-w-2xl border border-[color:var(--primary)]/50 bg-[color:var(--primary)]/[0.05] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs tracking-[0.12em] text-[color:var(--primary)]"><MessageCircle className="size-4" /> {t("creator.player.enterPoint")}</div>
              <h2 className="mt-2 font-heading text-xl">{enterPoint.branchPrompt || enterPoint.hint}</h2>
              <div className="mt-4 grid gap-2">{enterPoint.branchOptions?.map((option) => <button type="button" key={option} onClick={() => setChoice(option)} className={cn("border px-4 py-3 text-left text-sm", choice === option ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.12] text-[color:var(--primary)]" : "border-[color:var(--border)] text-[#d9ca9b]")}>{option}</button>)}</div>
            </div>
          )}
        </section>
        <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
          <button type="button" disabled={currentGlobal === 0} onClick={() => save(currentGlobal - 1)} className="inline-flex items-center gap-1.5 border border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--muted-foreground)] disabled:opacity-30"><ChevronLeft className="size-4" /> {t("creator.player.previous")}</button>
          {currentGlobal < flat.length - 1 ? <button type="button" disabled={Boolean(enterPoint?.branchOptions?.length) && !choice} onClick={() => save(currentGlobal + 1, choice ? "choice" : "advance", choice ? { choice, paragraphIndex: currentGlobal } : undefined)} className="inline-flex items-center gap-1.5 bg-[color:var(--primary)] px-5 py-2.5 text-sm text-[color:var(--primary-foreground)] disabled:opacity-35">{t("creator.player.continue")} <ChevronRight className="size-4" /></button> : <button type="button" onClick={() => save(0, "restart")} className="inline-flex items-center gap-1.5 bg-[color:var(--primary)] px-5 py-2.5 text-sm text-[color:var(--primary-foreground)]"><RotateCcw className="size-4" /> {t("creator.player.restart")}</button>}
        </footer>
        {!user && <p className="mt-3 text-center text-[10px] text-[color:var(--muted-foreground)]">{t("creator.player.guestHint")}</p>}
      </div>
    </main>
  );
}
