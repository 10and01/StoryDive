"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share2, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { composeShare } from "@/lib/share";
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border border-[color:var(--border)] bg-[#1c1b15] p-4 pb-6">
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
              className="max-h-[46vh] w-auto rounded-lg border border-[color:var(--border)]"
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
      </div>
    </>
  );
}
