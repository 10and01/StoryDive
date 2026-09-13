"use client";

// 知乎真实回答引用 chip：NPC/刘看山气泡与法庭辩词下方的小卡片。
// 带 contentText（回答摘要）时点击原地展开摘要 + 「查看原回答」外链（论据战可验证）；
// 不带 contentText 时保持旧行为：点击直接跳转真实回答。
// 数据来自服务端注入 prompt 的检索结果（citations），链接永远是平台返回的真实 URL。

import { useState } from "react";
import { ThumbsUp, ExternalLink, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ZhihuCitation } from "@/lib/api/zhihu-citation";

function CitationChip({ c }: { c: ZhihuCitation }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const hasSummary = Boolean(c.contentText && c.contentText.trim());

  if (!hasSummary) {
    return (
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`[${c.n}] ${c.title} · ${c.authorName}`}
        className="inline-flex max-w-[210px] items-center gap-1 border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/[0.08] px-1.5 py-0.5 text-[10px] leading-tight text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/[0.16]"
      >
        <span className="shrink-0 opacity-80">[{c.n}]</span>
        <span className="truncate">{c.title}</span>
        {c.voteUpCount > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-80">
            <ThumbsUp className="h-2.5 w-2.5" />
            {c.voteUpCount}
          </span>
        )}
      </a>
    );
  }

  return (
    <span className="inline-flex flex-col" data-el="zhihu-citation-expandable">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`[${c.n}] ${c.title}`}
        aria-expanded={open}
        className="inline-flex max-w-[240px] items-center gap-1 border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/[0.08] px-1.5 py-0.5 text-left text-[10px] leading-tight text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/[0.16]"
      >
        <span className="shrink-0 opacity-80">[{c.n}]</span>
        <span className="truncate">{c.title}</span>
        {c.voteUpCount > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-80">
            <ThumbsUp className="h-2.5 w-2.5" />
            {c.voteUpCount}
          </span>
        )}
        <ChevronDown
          className={`h-2.5 w-2.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <span className="mt-1 max-w-[280px] border border-[color:var(--border)] bg-[#211f18] p-2 text-[11px] leading-relaxed text-[#dcd0a6]">
          <span className="mb-1 block text-[10px] tracking-[0.08em] text-[color:var(--muted-foreground)]">
            {c.authorName} · {t("citations.realAnswer")}
          </span>
          {c.contentText}
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[color:var(--primary)] hover:underline"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {t("citations.viewOriginal")}
          </a>
        </span>
      )}
    </span>
  );
}

export function ZhihuCitations({
  items,
  label,
}: {
  items?: ZhihuCitation[];
  label?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1.5" data-el="zhihu-citations">
      {label && (
        <p className="mb-1 text-[10px] tracking-[0.1em] text-[color:var(--muted-foreground)]">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {items.map((c) => (
          <CitationChip key={c.n} c={c} />
        ))}
      </div>
    </div>
  );
}
