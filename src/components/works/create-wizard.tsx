"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import { useUser } from "@/components/user-profile/user-provider";
import {
  createWork,
  fetchGenerationJob,
  fetchProviders,
  fetchWork,
  publishWork,
  retryGeneration,
  type GenerationJob,
  type ModelProvider,
  type WorkSummary,
} from "@/lib/api/works";
import type { Story } from "@/lib/story/types";
import { cn } from "@/utils/utils";
import { useTranslation } from "react-i18next";

export function CreateWizard() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, loading: userLoading } = useUser();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [themePrompt, setThemePrompt] = useState("");
  const [providerId, setProviderId] = useState("");
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [work, setWork] = useState<WorkSummary | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [preview, setPreview] = useState<Story | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState<WorkSummary["visibility"]>("private");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resumeWorkId = searchParams.get("workId");

  useEffect(() => {
    if (!user) return;
    void fetchProviders().then(setProviders).catch(() => setProviders([]));
  }, [user]);

  useEffect(() => {
    if (!user || !resumeWorkId) return;
    void fetchWork(resumeWorkId)
      .then((result) => {
        setWork(result.work);
        setJob(result.job);
        setPreview(result.preview);
        setStep(result.preview ? 2 : 1);
        setTitle(result.work.title);
        setDescription(result.work.description);
        setTags(result.work.tags.join("，"));
        setVisibility(result.work.visibility);
      })
      .catch(() => toast.error(t("creator.create.resumeFailed")));
  }, [resumeWorkId, t, user]);

  useEffect(() => {
    if (!job || job.status === "ready" || job.status === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchGenerationJob(job.id);
        setJob(next);
        if (next.status === "ready") {
          window.clearInterval(timer);
          const result = await fetchWork(next.workId);
          setWork(result.work);
          setPreview(result.preview);
          setTitle(result.work.title);
          setDescription(result.work.description);
          setTags(result.work.tags.join("，"));
          setStep(2);
        }
      } catch {
        // A transient poll failure should not erase the resumable job.
      }
    }, 2200);
    return () => window.clearInterval(timer);
  }, [job]);

  const canUpload = useMemo(() => Boolean(file && file.size <= 20 * 1024 * 1024), [file]);

  async function submitUpload() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (title) form.set("title", title);
      if (description) form.set("description", description);
      if (tags) form.set("tags", tags);
      if (themePrompt) form.set("themePrompt", themePrompt);
      if (providerId) form.set("providerId", providerId);
      const result = await createWork(form);
      setWork(result.work);
      setJob(result.job);
      setStep(1);
      router.replace(`/create?workId=${result.work.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creator.create.uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function retry(usePlatformDefault = false) {
    if (!job) return;
    setBusy(true);
    try {
      const next = await retryGeneration(job.id, usePlatformDefault);
      setJob(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creator.create.retryFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!work || !rightsConfirmed) return;
    setBusy(true);
    try {
      const published = await publishWork(work.id, visibility);
      setWork(published);
      setStep(3);
      toast.success(t("creator.create.publishSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creator.create.publishFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!userLoading && !user) {
    return (
      <AppShell>
        <div className="mx-auto grid min-h-[65svh] max-w-xl place-items-center text-center">
          <div>
            <UploadCloud className="mx-auto size-10 text-[color:var(--primary)]" />
            <h1 className="mt-4 font-heading text-4xl">{t("creator.create.loginTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#d9ca9b]">{t("creator.create.loginHint")}</p>
            <button type="button" onClick={login} className="mt-6 bg-[color:var(--primary)] px-5 py-3 text-sm text-[color:var(--primary-foreground)]">{t("creator.create.loginAction")}</button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="border-b border-[color:var(--border)] pb-5">
        <p className="text-[10px] tracking-[0.24em] text-[color:var(--muted-foreground)]">{t("creator.create.title")}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-[clamp(34px,8vw,62px)] leading-tight">{t("creator.create.title")}</h1>
            <p className="mt-1 text-sm text-[#d9ca9b]">{t("creator.create.subtitle")}</p>
          </div>
          <Link href="/works" className="text-xs text-[color:var(--primary)] hover:underline">{t("creator.common.works")}</Link>
        </div>
      </header>

      <ol className="my-5 grid grid-cols-4 border border-[color:var(--border)]">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className={cn("flex min-w-0 items-center gap-2 border-r border-[color:var(--border)] px-2 py-3 text-xs last:border-r-0 sm:px-4", index <= step ? "text-[color:var(--primary)]" : "text-[color:var(--muted-foreground)]")}>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px]", index < step && "border-[color:var(--primary)] bg-[color:var(--primary)] text-[#171817]")}>{index < step ? <Check className="size-3" /> : index + 1}</span>
            <span className="truncate">{t(`creator.create.steps.${index}`)}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <button type="button" onClick={() => fileInput.current?.click()} className="grid min-h-64 place-items-center border border-dashed border-[color:var(--primary)]/55 bg-[color:var(--primary)]/[0.04] p-8 text-center hover:bg-[color:var(--primary)]/[0.08]" data-el="work-upload">
            <span>
              {file ? <FileText className="mx-auto size-10 text-[color:var(--primary)]" /> : <UploadCloud className="mx-auto size-10 text-[color:var(--primary)]" />}
              <span className="mt-4 block font-heading text-xl">{file ? file.name : t("creator.create.selectFile")}</span>
              <span className="mt-2 block text-xs leading-relaxed text-[color:var(--muted-foreground)]">{t("creator.create.fileLimits")}<br />{t("creator.create.textLimits")}</span>
            </span>
            <input ref={fileInput} type="file" accept=".txt,.md,.markdown,.epub,text/plain,text/markdown,application/epub+zip" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </button>
          <div className="flex flex-col gap-3">
            <label className="text-xs text-[color:var(--muted-foreground)]">{t("creator.create.optionalTitle")}<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder={t("creator.create.titlePlaceholder")} className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#171817] px-3 text-sm outline-none focus:border-[color:var(--primary)]" /></label>
            <label className="text-xs text-[color:var(--muted-foreground)]">{t("creator.create.optionalDescription")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder={t("creator.create.descriptionPlaceholder")} className="mt-1 min-h-20 w-full border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]" /></label>
            <label className="text-xs text-[color:var(--muted-foreground)]">{t("creator.create.optionalTags")}<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("creator.create.tagsPlaceholder")} className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#171817] px-3 text-sm outline-none focus:border-[color:var(--primary)]" /></label>
            <details className="border border-[color:var(--border)] px-3 py-2">
              <summary className="flex cursor-pointer items-center justify-between text-xs text-[color:var(--muted-foreground)]">{t("creator.create.advanced")} <ChevronDown className="size-3.5" /></summary>
              <div className="mt-3 flex flex-col gap-3">
                <label className="text-xs">{t("creator.create.themePrompt")}<textarea value={themePrompt} onChange={(event) => setThemePrompt(event.target.value)} maxLength={1000} placeholder={t("creator.create.themePlaceholder")} className="mt-1 min-h-20 w-full border border-[color:var(--border)] bg-[#10110f] px-3 py-2 text-sm" /></label>
                <label className="text-xs">{t("creator.create.model")}<select value={providerId} onChange={(event) => setProviderId(event.target.value)} className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#10110f] px-3 text-sm"><option value="">{t("creator.common.platformModel")}</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select></label>
              </div>
            </details>
            <button type="button" onClick={() => void submitUpload()} disabled={!canUpload || busy} className="mt-auto inline-flex h-12 items-center justify-center gap-2 bg-[color:var(--primary)] px-5 text-sm font-medium text-[color:var(--primary-foreground)] disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} {t("creator.create.uploadAction")}</button>
          </div>
        </section>
      )}

      {step === 1 && job && (
        <section className="mx-auto max-w-2xl border border-[color:var(--border)] bg-[#171817]/75 p-6 sm:p-8">
          {job.status === "failed" ? (
            <>
              <RotateCcw className="size-8 text-red-200" />
              <h2 className="mt-4 font-heading text-2xl">{t("creator.create.failedTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#d9ca9b]">{job.errorMessage || t("creator.create.failedHint")}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void retry(false)} className="bg-[color:var(--primary)] px-4 py-2.5 text-sm text-[color:var(--primary-foreground)]">{t("creator.create.retry")}</button>
                {job.providerName !== t("creator.common.platformModel") && <button type="button" disabled={busy} onClick={() => void retry(true)} className="border border-[color:var(--border)] px-4 py-2.5 text-sm">{t("creator.create.retryPlatform")}</button>}
                <button type="button" onClick={() => { setStep(0); router.replace("/create"); }} className="border border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--muted-foreground)]">{t("creator.create.changeFile")}</button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="size-8 animate-spin text-[color:var(--primary)]" />
              <h2 className="mt-4 font-heading text-2xl">{t(`creator.create.stages.${job.stage}`, { defaultValue: t("creator.create.stages.fallback") })}</h2>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{t("creator.create.usingModel", { model: job.providerName })}</p>
              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[color:var(--border)]/30"><div className="h-full bg-[color:var(--primary)] transition-[width] duration-500" style={{ width: `${job.progress}%` }} /></div>
              <div className="mt-2 flex justify-between text-[10px] tracking-[0.12em] text-[color:var(--muted-foreground)]"><span>{job.stage}</span><span>{job.progress}%</span></div>
            </>
          )}
        </section>
      )}

      {step === 2 && work && preview && (
        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="border border-[color:var(--border)] bg-[#171817]/65 p-5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[color:var(--muted-foreground)]"><span>{t("creator.create.chapters", { count: preview.chapters.length })}</span><span>·</span><span>{t("creator.create.characters", { count: preview.characters.length })}</span><span>·</span><span>{t("creator.create.enterPoints", { count: preview.enterPoints.length })}</span></div>
            <h2 className="mt-3 font-heading text-4xl">{preview.title}</h2>
            <p className="mt-3 leading-relaxed text-[#d9ca9b]">{preview.logline}</p>
            <div className="mt-5 flex flex-wrap gap-2">{preview.tags.map((tag) => <span key={tag} className="border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)]">#{tag}</span>)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div><h3 className="text-xs tracking-[0.16em] text-[color:var(--primary)]">{t("creator.create.charactersTitle")}</h3><ul className="mt-2 grid gap-2">{preview.characters.slice(0, 8).map((character) => <li key={character.id} className="border-l border-[color:var(--border)] pl-3"><p className="font-heading">{character.name}</p><p className="text-xs text-[color:var(--muted-foreground)]">{character.role}</p></li>)}</ul></div>
              <div><h3 className="text-xs tracking-[0.16em] text-[color:var(--primary)]">{t("creator.create.outlineTitle")}</h3><ul className="mt-2 grid gap-2">{preview.chapters.slice(0, 8).map((chapter) => <li key={chapter.index} className="text-sm text-[#d9ca9b]">{chapter.title}</li>)}</ul></div>
            </div>
          </div>
          <aside className="border border-[color:var(--border)] p-5">
            <BookOpenCheck className="size-6 text-[color:var(--primary)]" />
            <h3 className="mt-3 font-heading text-xl">{t("creator.create.publishSettings")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{t("creator.create.visibilityHint")}</p>
            <div className="mt-4 grid gap-2">{(["private", "unlisted", "public"] as const).map((value) => <label key={value} className={cn("flex cursor-pointer items-center gap-3 border px-3 py-3 text-sm", visibility === value ? "border-[color:var(--primary)] text-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--muted-foreground)]")}><input type="radio" name="visibility" checked={visibility === value} onChange={() => setVisibility(value)} />{t(`creator.create.visibility${value[0].toUpperCase()}${value.slice(1)}`)}</label>)}</div>
            <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#d9ca9b]"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5" />{t("creator.create.rights")}</label>
            <div className="mt-5 grid gap-2"><button type="button" onClick={() => void publish()} disabled={!rightsConfirmed || busy} className="inline-flex h-11 items-center justify-center gap-2 bg-[color:var(--primary)] px-4 text-sm text-[color:var(--primary-foreground)] disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t("creator.create.publish")}</button><Link href={`/play/${work.id}`} className="border border-[color:var(--border)] px-4 py-3 text-center text-sm text-[color:var(--muted-foreground)]">{t("creator.create.preview")}</Link></div>
          </aside>
        </section>
      )}

      {step === 3 && work && (
        <section className="mx-auto grid min-h-[50svh] max-w-xl place-items-center text-center">
          <div><Check className="mx-auto size-10 text-[color:var(--primary)]" /><h2 className="mt-4 font-heading text-4xl">{t("creator.create.doneTitle")}</h2><p className="mt-3 text-sm leading-relaxed text-[#d9ca9b]">{t("creator.create.doneHint", { title: work.title, visibility: t(`creator.status.${work.visibility}`) })}</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Link href={`/play/${work.id}`} className="bg-[color:var(--primary)] px-5 py-3 text-sm text-[color:var(--primary-foreground)]">{t("creator.card.playNow")}</Link><Link href={`/works/${work.id}`} className="border border-[color:var(--border)] px-5 py-3 text-sm">{t("creator.create.workPage")}</Link></div></div>
        </section>
      )}
    </AppShell>
  );
}
