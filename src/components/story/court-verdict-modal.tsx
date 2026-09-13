"use client";

// 判词分享弹窗：水墨判词海报 + 知乎原生「想法」回流。
// 平台无发布/存草稿 API，回流形态为：LLM 起草知乎原生文案（话题标签+钩子+链接）
// → 用户可编辑 → 一键复制并打开知乎 / 系统分享（移动端可在分享面板选知乎 App）。

import { useEffect, useRef, useState } from "react";
import { X, Share2, Download, Loader2, Sparkles, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { composeShare } from "@/lib/share";
import { generateCourtIdea } from "@/lib/api/court";
import { renderCourtPoster } from "@/lib/court/court-poster";

export interface CourtVerdictShareData {
  caseTitle: string;
  redHeadline: string;
  blueHeadline: string;
  redVotes: number;
  blueVotes: number;
  verdict: string;
}

export function CourtVerdictModal({
  data,
  onClose,
}: {
  data: CourtVerdictShareData;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const built = useRef(false);

  // 知乎想法回流
  const [ideaText, setIdeaText] = useState<string | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(false);

  function domain() {
    if (typeof window === "undefined") return "";
    return window.location.host;
  }

  function build(): string | null {
    return renderCourtPoster({
      caseTitle: data.caseTitle,
      redHeadline: data.redHeadline,
      blueHeadline: data.blueHeadline,
      redVotes: data.redVotes,
      blueVotes: data.blueVotes,
      verdict: data.verdict,
      rally: t("court.rally"),
      brand: t("court.title"),
      seal: t("court.seal"),
      domain: domain(),
    });
  }

  // 打开即生成预览（延迟一拍，避开渲染期 setState）
  useEffect(() => {
    if (built.current) return;
    built.current = true;
    const id = setTimeout(() => {
      try {
        setPreview(build());
      } catch {
        setPreview(null);
      }
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shareText() {
    return [
      t("court.title"),
      `${t("court.caseLabel")}：${data.caseTitle}`,
      t("court.rally"),
    ].join("\n");
  }

  async function doShare() {
    setFailed(false);
    setBusy(true);
    try {
      const poster = preview ?? build();
      const result = await composeShare({
        text: shareText(),
        poster,
        posterName: "court-verdict.png",
      });
      if (result === "copied") toast.success(t("court.copied"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    setFailed(false);
    const poster = preview ?? build();
    if (!poster) {
      setFailed(true);
      return;
    }
    const a = document.createElement("a");
    a.href = poster;
    a.download = `court-verdict-${Date.now()}.png`;
    a.click();
  }

  async function generateIdea() {
    if (ideaLoading) return;
    setIdeaLoading(true);
    try {
      const text = await generateCourtIdea(data);
      setIdeaText(text || "");
    } catch {
      toast.error(t("court.idea.failed"));
    } finally {
      setIdeaLoading(false);
    }
  }

  // 复制文案并打开知乎（平台无发布 API，粘贴发布由用户完成）
  async function copyIdeaAndGo() {
    if (!ideaText) return;
    try {
      await navigator.clipboard.writeText(ideaText);
      toast.success(t("court.idea.copied"));
      window.open("https://www.zhihu.com/", "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("court.idea.copyFailed"));
    }
  }

  async function shareIdea() {
    if (!ideaText) return;
    try {
      await composeShare({ text: ideaText });
    } catch {
      toast.error(t("court.idea.copyFailed"));
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92svh] max-w-md overflow-y-auto rounded-t-2xl border border-[color:var(--border)] bg-[#1c1b15] p-4 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg text-[#f2ead0]">
            {t("court.shareTitle")}
          </h2>
          <button onClick={onClose} aria-label="close" className="text-[#8c8570]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 判词卡预览 */}
        <div className="mb-4 flex justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={t("court.shareTitle")}
              className="max-h-[38vh] w-auto rounded-lg border border-[color:var(--border)]"
              data-el="court-poster-preview"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center text-[color:var(--muted-foreground)]">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--primary)]" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void doShare()}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 bg-[color:var(--primary)] px-3 py-2.5 text-sm text-[#171817] disabled:opacity-60"
            data-el="court-share-go"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {t("court.shareGo")}
          </button>
          <button
            onClick={() => download()}
            disabled={busy || !preview}
            className="flex items-center justify-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2.5 text-sm text-[color:var(--primary)] disabled:opacity-50"
            data-el="court-share-download"
          >
            <Download className="h-4 w-4" />
            {t("court.shareDownload")}
          </button>
        </div>
        {failed && (
          <p role="status" className="mt-2 text-center text-xs text-[color:var(--muted-foreground)]">
            {t("court.shareRetry")}
          </p>
        )}

        {/* 知乎想法原生回流 */}
        <div className="mt-4 border-t border-[color:var(--border)] pt-3" data-el="court-idea">
          {ideaText === null ? (
            <button
              onClick={() => void generateIdea()}
              disabled={ideaLoading}
              className="flex w-full items-center justify-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2.5 text-sm text-[color:var(--primary)] disabled:opacity-60"
              data-el="court-idea-generate"
            >
              {ideaLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {ideaLoading ? t("court.idea.generating") : t("court.idea.generate")}
            </button>
          ) : (
            <div className="grid gap-2">
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                {t("court.idea.edit")}
              </p>
              <textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                rows={7}
                className="w-full resize-none border border-[color:var(--border)] bg-[#171817] px-2.5 py-2 text-[13px] leading-relaxed text-[#d9ca9b] outline-none focus:border-[color:var(--primary)]"
                data-el="court-idea-text"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void copyIdeaAndGo()}
                  className="flex items-center justify-center gap-1.5 bg-[color:var(--primary)] px-3 py-2.5 text-sm text-[#171817]"
                  data-el="court-idea-copy-go"
                >
                  <Copy className="h-4 w-4" />
                  {t("court.idea.copyGo")}
                </button>
                <button
                  onClick={() => void shareIdea()}
                  className="flex items-center justify-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2.5 text-sm text-[color:var(--primary)]"
                  data-el="court-idea-share"
                >
                  <Share2 className="h-4 w-4" />
                  {t("court.idea.share")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
