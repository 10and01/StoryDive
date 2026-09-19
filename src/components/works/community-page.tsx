"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, Landmark, Scale, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WorkCard } from "./work-card";
import { copyWork, fetchPublicWorks, type WorkSummary } from "@/lib/api/works";
import { useUser } from "@/components/user-profile/user-provider";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const LEGACY_SPACES = [
  { href: "/hall", icon: Landmark, key: "hall" },
  { href: "/theater", icon: Sparkles, key: "theater" },
  { href: "/court", icon: Scale, key: "court" },
  { href: "/branches", icon: GitBranch, key: "branches" },
];

export function CommunityPage() {
  const { user, login } = useUser();
  const { t } = useTranslation();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  useEffect(() => { void fetchPublicWorks().then(setWorks).catch(() => setWorks([])); }, []);
  async function copy(work: WorkSummary) {
    if (!user) { login(); return; }
    try { await copyWork(work.id); toast.success(t("creator.community.copied")); }
    catch (error) { toast.error(error instanceof Error ? error.message : t("creator.common.copyFailed")); }
  }
  return (
    <AppShell>
      <header className="border-b border-[color:var(--border)] pb-5"><p className="text-[10px] tracking-[0.2em] text-[color:var(--muted-foreground)]">{t("creator.community.title")}</p><h1 className="mt-1 font-heading text-[clamp(36px,8vw,62px)]">{t("creator.community.title")}</h1><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#d9ca9b]">{t("creator.community.subtitle")}</p></header>
      <section className="grid gap-px border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-4 mt-5">{LEGACY_SPACES.map((space) => { const Icon = space.icon; return <Link key={space.href} href={space.href} className="bg-[#171817] p-4 hover:bg-[#211f18]"><Icon className="size-5 text-[color:var(--primary)]" /><h2 className="mt-3 font-heading text-lg">{t(`creator.community.spaces.${space.key}.0`)}</h2><p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{t(`creator.community.spaces.${space.key}.1`)}</p></Link>; })}</section>
      <section className="mt-7"><div className="flex items-end justify-between"><div><h2 className="font-heading text-3xl">{t("creator.community.latest")}</h2><p className="mt-1 text-sm text-[#d9ca9b]">{t("creator.community.latestHint")}</p></div><Link href="/discover" className="text-xs text-[color:var(--primary)]">{t("creator.community.more")}</Link></div>{works.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{works.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} onCopy={copy} />)}</div> : <div className="mt-4 border border-dashed border-[color:var(--border)] p-10 text-center text-sm text-[color:var(--muted-foreground)]">{t("creator.community.empty")}</div>}</section>
    </AppShell>
  );
}
