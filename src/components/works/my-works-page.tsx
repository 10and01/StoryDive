"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, PenLine } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WorkCard } from "./work-card";
import { fetchMyWorks, type WorkSummary } from "@/lib/api/works";
import { useUser } from "@/components/user-profile/user-provider";
import { useTranslation } from "react-i18next";

const FILTERS = [
  "all", "draft", "processing", "ready", "failed",
] as const;

export function MyWorksPage() {
  const { user, login, loading: userLoading } = useUser();
  const { t } = useTranslation();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setWorks(await fetchMyWorks());
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const filtered = useMemo(
    () => works.filter((work) => filter === "all" || work.status === filter),
    [filter, works],
  );

  if (!userLoading && !user) {
    return <AppShell><div className="grid min-h-[60svh] place-items-center text-center"><div><h1 className="font-heading text-4xl">{t("creator.works.loginTitle")}</h1><p className="mt-2 text-sm text-[#d9ca9b]">{t("creator.works.loginHint")}</p><button onClick={login} className="mt-5 bg-[color:var(--primary)] px-5 py-3 text-sm text-[color:var(--primary-foreground)]">{t("creator.common.signIn")}</button></div></div></AppShell>;
  }

  return (
    <AppShell>
      <header className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] tracking-[0.2em] text-[color:var(--muted-foreground)]">{t("creator.works.title")}</p><h1 className="mt-1 font-heading text-[clamp(34px,8vw,58px)]">{t("creator.works.title")}</h1><p className="mt-1 text-sm text-[#d9ca9b]">{t("creator.works.subtitle")}</p></div>
        <Link href="/create" className="inline-flex items-center justify-center gap-2 bg-[color:var(--primary)] px-4 py-3 text-sm text-[color:var(--primary-foreground)]"><PenLine className="size-4" /> {t("creator.works.new")}</Link>
      </header>
      <div className="my-4 flex gap-2 overflow-x-auto no-native-scrollbar">
        {FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={filter === item ? "shrink-0 border border-[color:var(--primary)] bg-[color:var(--primary)]/[0.1] px-3 py-1.5 text-xs text-[color:var(--primary)]" : "shrink-0 border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)]"}>{t(`creator.works.filters.${item}`)} · {item === "all" ? works.length : works.filter((work) => work.status === item).length}</button>)}
      </div>
      {loading ? <div className="flex min-h-56 items-center justify-center text-sm text-[color:var(--muted-foreground)]"><Loader2 className="mr-2 size-4 animate-spin" /> {t("creator.works.loading")}</div> : filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((work) => <WorkCard key={work.id} work={work} owner />)}</div> : <div className="grid min-h-56 place-items-center border border-dashed border-[color:var(--border)] text-center"><div><p className="font-heading text-xl">{t("creator.works.empty")}</p><Link href="/create" className="mt-3 inline-block text-sm text-[color:var(--primary)]">{t("creator.works.emptyAction")}</Link></div></div>}
    </AppShell>
  );
}
