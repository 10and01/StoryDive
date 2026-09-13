"use client";

// 知乎真实回答引用 chip：NPC/刘看山气泡下方的小卡片，点击跳转真实回答。
// 数据来自服务端注入 prompt 的检索结果（citations），不是 LLM 自己生成的链接。

import { ThumbsUp } from "lucide-react";
import type { ZhihuCitation } from "@/lib/api/zhihu-citation";

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
          <a
            key={c.n}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`[${c.n}] ${c.title} · ${c.authorName}`}
            className="inline-flex max-w-[210px] items-center gap-1 border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/[0.08] px-1.5 py-0.5 text-[10px] leading-tight text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/[0.16]"
          >
            <span className="shrink-0 opacity-80">[{c.n}]</span>
            <span className="truncate">{c.title}</span>
            <span className="flex shrink-0 items-center gap-0.5 opacity-80">
              <ThumbsUp className="h-2.5 w-2.5" />
              {c.voteUpCount}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
