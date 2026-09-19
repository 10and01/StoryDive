"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Loader2, PenLine, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import { WelcomeCover } from "@/components/onboarding/welcome-cover";
import { WorkCard } from "./work-card";
import { copyWork, fetchPublicWorks, type WorkSummary } from "@/lib/api/works";
import { STORIES } from "@/lib/story/library";
import { useUser } from "@/components/user-profile/user-provider";
import { useTranslation } from "react-i18next";

export function DiscoverPage() {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const featured = STORIES[0];

  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      setWorks(await fetchPublicWorks(search));
    } catch {
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    const timer = window.setTimeout(() => {
      try {
        setWelcomeVisible(localStorage.getItem("ruju:welcome-seen:v1") !== "1");
      } catch {
        setWelcomeVisible(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(timer);
    };
  }, [load]);

  async function handleCopy(work: WorkSummary) {
    if (!user) {
      login();
      return;
    }
    try {
      const copied = await copyWork(work.id);
      toast.success(t("creator.discover.copied", { title: copied.title }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creator.common.copyFailed"));
    }
  }

  return (
    <>
      <AppShell>
        <section className="grid min-h-[460px] items-center gap-8 border-b border-[color:var(--border)] py-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.3em] text-[color:var(--rs-warm)]">RU · JU</p>
            <h1 className="mt-3 font-heading text-[clamp(44px,9vw,82px)] leading-[0.98] tracking-[-0.04em]">
              {t("creator.discover.title")}
            </h1>
            <p className="mt-5 max-w-lg font-heading text-base leading-relaxed text-[#d9ca9b] sm:text-lg">
              {t("creator.discover.subtitle")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/create" className="inline-flex items-center gap-2 bg-[color:var(--primary)] px-5 py-3 text-sm font-medium text-[color:var(--primary-foreground)]">
                <PenLine className="size-4" /> {t("creator.discover.create")}
              </Link>
              <Link href="/shelf" className="inline-flex items-center gap-2 border border-[color:var(--border)] px-5 py-3 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]">
                <BookOpen className="size-4" /> {t("creator.discover.browseShelf")}
              </Link>
            </div>
          </div>
          <Link href={`/read/${featured.id}`} className="group relative min-h-[330px] overflow-hidden border border-[color:var(--border)] bg-[#10110f]">
            <Image src={featured.coverImage || featured.objectImage} alt={featured.objectAlt} fill priority unoptimized className="object-cover opacity-75 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10110f] via-[#10110f]/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-[10px] tracking-[0.2em] text-[color:var(--primary)]">{t("creator.discover.featured")}</p>
              <h2 className="mt-2 font-heading text-3xl sm:text-4xl">{featured.title}</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#d9ca9b]">{featured.logline}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-[color:var(--primary)]">{t("creator.discover.startReading")} <ArrowRight className="size-4" /></span>
            </div>
          </Link>
        </section>

        <section className="py-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] tracking-[0.2em] text-[color:var(--muted-foreground)]">{t("creator.discover.publicTitle")}</p>
              <h2 className="mt-1 font-heading text-3xl">{t("creator.discover.publicTitle")}</h2>
              <p className="mt-1 text-sm text-[#d9ca9b]">{t("creator.discover.publicSubtitle")}</p>
            </div>
            <form
              className="relative w-full sm:max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void load(query);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("creator.discover.search")} aria-label={t("creator.discover.search")} className="h-11 w-full border border-[color:var(--border)] bg-[#171817] pl-10 pr-3 text-sm outline-none focus:border-[color:var(--primary)]" />
            </form>
          </div>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-[color:var(--muted-foreground)]"><Loader2 className="mr-2 size-4 animate-spin" /> {t("creator.discover.loading")}</div>
          ) : works.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {works.map((work) => <WorkCard key={work.id} work={work} onCopy={handleCopy} />)}
            </div>
          ) : (
            <div className="mt-5 grid min-h-48 place-items-center border border-dashed border-[color:var(--border)] p-8 text-center">
              <div>
                <Sparkles className="mx-auto size-6 text-[color:var(--primary)]" />
                <p className="mt-3 font-heading text-lg">{t("creator.discover.empty")}</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("creator.discover.emptyHint")}</p>
              </div>
            </div>
          )}
        </section>
      </AppShell>
      {welcomeVisible && <WelcomeCover onEnter={() => setWelcomeVisible(false)} />}
    </>
  );
}
