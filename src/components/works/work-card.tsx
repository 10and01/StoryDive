import Link from "next/link";
import { ArrowRight, Clock3, Copy, Play, Share2 } from "lucide-react";
import type { WorkSummary } from "@/lib/api/works";
import { StatusBadge } from "./status-badge";
import { useTranslation } from "react-i18next";

export function WorkCard({
  work,
  owner = false,
  onCopy,
}: {
  work: WorkSummary;
  owner?: boolean;
  onCopy?: (work: WorkSummary) => void;
}) {
  const { t } = useTranslation();
  const primaryHref = owner ? `/works/${work.id}` : `/works/${work.id}`;
  return (
    <article className="group relative grid min-h-56 overflow-hidden border border-[color:var(--border)] bg-[#171817]/80 p-4 transition-colors hover:border-[color:var(--primary)]/70">
      <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-[color:var(--primary)]/[0.07] blur-3xl" />
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge value={work.status} />
          <StatusBadge value={work.visibility} />
          <span className="ml-auto text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            {work.sourceFormat}
          </span>
        </div>
        <div>
          <h3 className="font-heading text-2xl leading-tight text-[color:var(--rs-ink)]">{work.title}</h3>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            {work.ownerName || t("creator.common.creatorFallback")}
          </p>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-[#d9ca9b]">
          {work.description || t("creator.card.emptyDescription")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {work.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] text-[color:var(--muted-foreground)]">#{tag}</span>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-1.5 bg-[color:var(--primary)] px-3 py-2 text-xs font-medium text-[color:var(--primary-foreground)]"
          >
            {work.status === "processing" ? <Clock3 className="size-3.5" /> : work.status === "ready" ? <Play className="size-3.5" /> : <ArrowRight className="size-3.5" />}
            {owner
              ? work.status === "processing"
                ? t("creator.card.viewStatus")
                : t("creator.card.continueEdit")
              : t("creator.card.playNow")}
          </Link>
          {!owner && onCopy && (
            <button
              type="button"
              onClick={() => onCopy(work)}
              className="inline-flex items-center gap-1.5 border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]"
            >
              <Copy className="size-3.5" /> {t("creator.card.copyDraft")}
            </button>
          )}
          {owner && work.publishedVersionId && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
              <Share2 className="size-3" /> {t("creator.card.shareable")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
