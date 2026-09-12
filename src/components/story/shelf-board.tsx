"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

export interface Relic {
  id: string;
  title: string;
  kind: "fiction" | "nonfiction";
  logline: string;
  author?: string;
  tags: string[];
  objectImage: string;
  objectAlt: string;
  href: string;
}

/**
 * 作品库：搜索 + 标签化管理。
 *  - 搜索框：按标题 / 作者 / 导语 / 标签 模糊匹配（不区分大小写）。
 *  - 标签条：聚合全部作品标签，点击可多选筛选（AND：需同时命中所有已选标签）。
 * 搜索与标签筛选组合生效，结果实时更新，并显示命中数量与「无结果」空态。
 */
export function ShelfBoard({ relics }: { relics: Relic[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // 聚合所有标签，按出现频次从高到低排序
  const allTags = useMemo(() => {
    const freq = new Map<string, number>();
    relics.forEach((r) => r.tags.forEach((tg) => freq.set(tg, (freq.get(tg) ?? 0) + 1)));
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([tg]) => tg);
  }, [relics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return relics.filter((r) => {
      // 标签：AND 命中
      if (activeTags.length && !activeTags.every((tg) => r.tags.includes(tg))) {
        return false;
      }
      if (!q) return true;
      const hay = [r.title, r.author ?? "", r.logline, r.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [relics, query, activeTags]);

  const toggleTag = (tg: string) =>
    setActiveTags((prev) =>
      prev.includes(tg) ? prev.filter((x) => x !== tg) : [...prev, tg],
    );

  const hasFilter = query.trim() !== "" || activeTags.length > 0;

  return (
    <div data-el="shelf-board-wrap">
      {/* 搜索框 */}
      <div className="relative mb-2.5" data-el="shelf-search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("shelf.searchPlaceholder")}
          aria-label={t("shelf.searchPlaceholder")}
          className="w-full border border-[color:var(--border)] bg-[#171817] py-2 pl-9 pr-9 text-sm text-[color:var(--rs-ink)] outline-none focus:border-[color:var(--primary)]"
          data-el="shelf-search-input"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label={t("common.close")}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[color:var(--muted-foreground)] hover:text-[color:var(--rs-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 标签筛选条 */}
      <div className="mb-3 flex items-center gap-2" data-el="shelf-tags">
        <Tag className="h-3.5 w-3.5 shrink-0 text-[color:var(--muted-foreground)]" aria-hidden />
        <div className="flex gap-1.5 overflow-x-auto no-native-scrollbar py-0.5">
          {allTags.map((tg) => {
            const on = activeTags.includes(tg);
            return (
              <button
                key={tg}
                onClick={() => toggleTag(tg)}
                data-el="shelf-tag"
                aria-pressed={on}
                className={cn(
                  "shrink-0 border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.16] text-[color:var(--primary)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--rs-ink)]",
                )}
              >
                {tg}
              </button>
            );
          })}
        </div>
      </div>

      {/* 结果计数 + 清除 */}
      <div className="mb-2.5 flex items-center justify-between text-xs text-[color:var(--muted-foreground)]">
        <span>{t("shelf.resultCount", { count: filtered.length })}</span>
        {hasFilter && (
          <button
            onClick={() => {
              setQuery("");
              setActiveTags([]);
            }}
            className="text-[color:var(--primary)] hover:underline"
            data-el="shelf-clear"
          >
            {t("shelf.clearFilters")}
          </button>
        )}
      </div>

      <section
        className="relative border border-[color:var(--border)] bg-gradient-to-b from-[#10110f]/95 to-[#211f18]/90 p-2.5 shadow-[0_16px_42px_rgba(0,0,0,.34)]"
        aria-label={t("shelf.title")}
        data-el="relic-board"
      >
        <div className="pointer-events-none absolute inset-[5px] border border-[color:rgba(237,227,193,.08)]" />

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
            {t("shelf.empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {filtered.map((relic) => (
              <li key={`${relic.kind}-${relic.id}`}>
                <Link
                  href={relic.href}
                  data-el="relic"
                  aria-label={relic.title}
                  className="group relative grid min-h-[142px] grid-rows-[1fr_auto] gap-1 p-2 transition-transform active:scale-[0.97] sm:min-h-[170px]"
                >
                  <span className="rs-pin absolute right-2 top-2 h-2.5 w-2.5" aria-hidden />
                  <span className="flex h-[88px] items-center justify-center sm:h-[112px]">
                    <Image
                      src={relic.objectImage}
                      alt={relic.objectAlt}
                      width={160}
                      height={160}
                      unoptimized
                      className="max-h-full max-w-full object-contain drop-shadow-[0_10px_8px_rgba(0,0,0,.36)] transition group-hover:drop-shadow-[0_12px_10px_rgba(0,0,0,.42)] group-hover:brightness-110"
                    />
                  </span>
                  <span className="grid gap-1">
                    <span
                      className="w-max max-w-full text-[10px] tracking-[0.12em]"
                      style={{
                        color:
                          relic.kind === "fiction"
                            ? "var(--primary)"
                            : "var(--rs-cool)",
                      }}
                    >
                      {relic.kind === "fiction"
                        ? t("shelf.fiction")
                        : t("shelf.nonfiction")}
                    </span>
                    <span className="font-heading text-sm font-medium leading-tight text-[color:var(--rs-ink)]">
                      {relic.title}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
