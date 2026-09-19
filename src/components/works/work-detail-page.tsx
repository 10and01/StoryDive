"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy, Loader2, Play, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import { StatusBadge } from "./status-badge";
import { copyWork, fetchWork, type GenerationJob, type WorkSummary } from "@/lib/api/works";
import type { Story } from "@/lib/story/types";
import { useUser } from "@/components/user-profile/user-provider";
import { useTranslation } from "react-i18next";

export function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, login } = useUser();
  const [work, setWork] = useState<WorkSummary | null>(null);
  const [preview, setPreview] = useState<Story | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await fetchWork(id, token);
      setWork(result.work); setPreview(result.preview); setJob(result.job); setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("creator.detail.loadFailed"));
    } finally { setLoading(false); }
  }, [id, t, token]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function handleCopy() {
    if (!user) { login(); return; }
    try {
      const copied = await copyWork(id, token);
      toast.success(t("creator.detail.copied", { title: copied.title }));
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : t("creator.common.copyFailed")); }
  }

  if (loading) return <AppShell><div className="flex min-h-[60svh] items-center justify-center"><Loader2 className="size-5 animate-spin text-[color:var(--primary)]" /></div></AppShell>;
  if (!work || error) return <AppShell><div className="grid min-h-[60svh] place-items-center text-center"><div><h1 className="font-heading text-3xl">{t("creator.detail.openFailed")}</h1><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{error || t("creator.detail.invalidLink")}</p><Link href="/discover" className="mt-4 inline-block text-[color:var(--primary)]">{t("creator.common.backDiscover")}</Link></div></div></AppShell>;
  const owner = user?.id === work.ownerId;
  const playHref = `/play/${work.id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  return (
    <AppShell>
      <article className="mx-auto max-w-4xl py-4 sm:py-8">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge value={work.status} /><StatusBadge value={work.visibility} /><span className="text-[10px] tracking-[0.14em] text-[color:var(--muted-foreground)]">{t("creator.detail.label")}</span></div>
        <h1 className="mt-4 max-w-3xl font-heading text-[clamp(40px,9vw,76px)] leading-[1.02]">{work.title}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]"><UserRound className="size-4" /> {work.ownerName || t("creator.common.creatorFallback")}{work.sourceWorkTitle && <span>· {t("creator.detail.sourceCopy", { title: work.sourceWorkTitle })}</span>}</div>
        <p className="mt-6 max-w-2xl font-heading text-lg leading-relaxed text-[#d9ca9b]">{work.description || t("creator.detail.emptyDescription")}</p>
        <div className="mt-4 flex flex-wrap gap-2">{work.tags.map((tag) => <span key={tag} className="border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)]">#{tag}</span>)}</div>
        <div className="mt-8 flex flex-wrap gap-2">
          {work.status === "ready" && <Link href={playHref} className="inline-flex items-center gap-2 bg-[color:var(--primary)] px-6 py-3 text-sm font-medium text-[color:var(--primary-foreground)]"><Play className="size-4" /> {t("creator.card.playNow")}</Link>}
          {owner ? <Link href={`/create?workId=${work.id}`} className="inline-flex items-center gap-2 border border-[color:var(--border)] px-5 py-3 text-sm"><Share2 className="size-4" /> {t("creator.detail.continueEdit")}</Link> : <button type="button" onClick={() => void handleCopy()} className="inline-flex items-center gap-2 border border-[color:var(--border)] px-5 py-3 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]"><Copy className="size-4" /> {t("creator.detail.copyPrivate")}</button>}
        </div>
        {job && work.status !== "ready" && <div className="mt-8 border border-[color:var(--border)] p-4 text-sm"><p>{job.status === "failed" ? job.errorMessage : t("creator.detail.progress", { progress: job.progress, stage: job.stage })}</p></div>}
        {preview && <section className="mt-10 grid gap-6 border-t border-[color:var(--border)] pt-6 md:grid-cols-2"><div><h2 className="font-heading text-2xl">{t("creator.detail.chapters")}</h2><ol className="mt-3 grid gap-2 text-sm text-[#d9ca9b]">{preview.chapters.slice(0, 10).map((chapter) => <li key={chapter.index}>{String(chapter.index).padStart(2, "0")} · {chapter.title}</li>)}</ol></div><div><h2 className="font-heading text-2xl">{t("creator.detail.characters")}</h2><ul className="mt-3 grid gap-3">{preview.characters.slice(0, 8).map((character) => <li key={character.id} className="border-l border-[color:var(--primary)]/50 pl-3"><p>{character.name} · {character.role}</p><p className="mt-0.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{character.stance}</p></li>)}</ul></div></section>}
        <p className="mt-10 border-t border-[color:var(--border)] pt-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{t("creator.detail.notice")}</p>
      </article>
    </AppShell>
  );
}
