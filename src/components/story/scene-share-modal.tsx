"use client";

import { useMemo, useState } from "react";
import { X, Share2, Download, Loader2, Landmark, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { composeShare } from "@/lib/share";
import { useUser } from "@/components/user-profile/user-provider";
import { getStory } from "@/lib/story/library";
import type { StoryBranch } from "@/lib/story/types";
import { publishToWorkshop } from "@/lib/api/workshop";
import {
  renderScenePoster,
  parseSceneBody,
  sceneImageAt,
  type SceneLine,
} from "@/lib/story/scene-poster";

// 支线 kind -> 场景类型标签的 i18n key
const KIND_KEY: Record<StoryBranch["kind"], string> = {
  dialogue: "branches.kinds.dialogue",
  fork: "branches.kinds.fork",
  rewrite: "branches.kinds.rewrite",
};

export function SceneShareModal({
  branch,
  onClose,
}: {
  branch: StoryBranch;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const { user, login } = useUser();

  const story = getStory(branch.storyId);
  const kindLabel = t(KIND_KEY[branch.kind]);

  // 预览与海报共用的数据（同步计算，无需异步、无需 canvas）
  const lines: SceneLine[] = useMemo(
    () => parseSceneBody(branch.body, story),
    [branch.body, story],
  );
  // 封面候选：旧物封面 → 该幕场景图 → 首章场景图 → 首个角色头像
  const coverCandidates = useMemo(
    () =>
      [
        story?.objectImage,
        sceneImageAt(story, branch.anchorParagraph),
        story?.chapters[0]?.sceneImage,
        story?.characters.find((c) => c.portrait)?.portrait,
      ].filter((u): u is string => !!u),
    [story, branch.anchorParagraph],
  );
  const cover = coverCandidates[0];

  function buildText() {
    return [
      t("share.brand"),
      `${t("share.fieldStory")}: ${branch.storyTitle}`,
      `${t("share.fieldKind")}: ${kindLabel}`,
      `${t("share.fieldScene")}: ${branch.title}`,
      t("share.angle"),
    ].join("\n");
  }

  // 仅在需要导出/分享图片时，才异步生成 canvas 海报
  async function buildPoster(): Promise<string | null> {
    return renderScenePoster({
      storyTitle: branch.storyTitle,
      author: story?.author ?? "",
      source: story?.source ?? t("share.sourceFallback"),
      kindLabel,
      cardTitle: branch.title,
      lines,
      coverImage: cover,
      coverCandidates,
      brand: t("share.brand"),
      readerLabel: t("share.reader"),
    });
  }

  async function doShare() {
    setFailed(false);
    setBusy(true);
    try {
      const poster = await buildPoster();
      const result = await composeShare({
        text: buildText(),
        poster,
        posterName: `${branch.title}.png`,
      });
      if (result === "copied") toast.success(t("share.copied"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setFailed(false);
    setBusy(true);
    try {
      const poster = await buildPoster();
      if (!poster) {
        setFailed(true);
        return;
      }
      const a = document.createElement("a");
      a.href = poster;
      a.download = `${branch.storyTitle}-${branch.title}.png`;
      a.click();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // 发布到工坊（需登录）：把这段改写送进「名场面殿堂」，成为可被接力/点赞的公共内容。
  async function publish() {
    if (!user) {
      login();
      return;
    }
    setFailed(false);
    setPublishing(true);
    try {
      const enterHint = story?.enterPoints.find(
        (e) => e.paragraphIndex === branch.anchorParagraph,
      )?.hint;
      const post = await publishToWorkshop({
        storyId: branch.storyId,
        storyTitle: branch.storyTitle,
        anchorParagraph: branch.anchorParagraph,
        enterHint: enterHint ?? branch.title,
        kind: branch.kind,
        title: branch.title,
        body: branch.body,
      });
      setPublishedId(post.id);
    } catch {
      setFailed(true);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70" onClick={onClose} aria-hidden />
      <div
        className="fixed inset-x-3 top-1/2 z-[70] mx-auto max-w-[440px] -translate-y-1/2 border border-[color:var(--primary)]/60 bg-[#211f18] p-4 shadow-[0_22px_60px_rgba(0,0,0,.6)]"
        data-el="scene-share-modal"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-heading text-base text-[color:var(--primary)]">
            <Share2 className="h-4 w-4" />
            {t("share.cardTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-8 w-8 items-center justify-center border border-[color:var(--primary)]/45"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 预览卡：纯 DOM 渲染，封面用 <img> 直接显示（浏览器显示图片无需 CORS，绝不会跨域失败） */}
        <div className="mb-3 flex justify-center">
          <div
            className="relative aspect-[9/16] w-[240px] overflow-hidden rounded-[2px] border border-[color:var(--border)] bg-[#171817]"
            data-el="scene-share-preview"
          >
            {/* 封面图铺满上半区 */}
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt=""
                className="absolute inset-x-0 top-0 h-[52%] w-full object-cover"
              />
            ) : (
              <div className="absolute inset-x-0 top-0 h-[52%] w-full bg-gradient-to-br from-[#2c2717] to-[#3a2f1a]" />
            )}
            {/* 封面向下渐隐到正文底色 */}
            <div className="absolute inset-x-0 top-0 h-[56%] bg-gradient-to-b from-transparent via-[#171817]/40 to-[#171817]" />

            {/* 文案层 */}
            <div className="absolute inset-0 flex flex-col p-3">
              <p className="font-heading text-[10px] tracking-wide text-[color:var(--primary)]">
                {t("share.brand")}
              </p>
              <div className="mt-auto">
                <h3 className="font-heading text-lg leading-tight text-[#f2ead0]">
                  {branch.storyTitle}
                </h3>
                <p className="mt-0.5 text-[10px] text-[#b7ad86]">
                  {kindLabel} · {story?.author}
                </p>
                <p className="mt-2 font-heading text-xs text-[color:var(--primary)]">
                  {branch.title}
                </p>
                <div className="mt-1.5 space-y-1.5 overflow-hidden">
                  {lines.slice(0, 4).map((ln, i) =>
                    ln.isUser ? (
                      <p
                        key={i}
                        className="text-right text-[10px] leading-snug text-[#f2ead0]"
                      >
                        {ln.text}
                      </p>
                    ) : (
                      <div key={i} className="flex gap-1.5">
                        {ln.portrait ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ln.portrait}
                            alt=""
                            className="mt-0.5 h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--primary)]/50"
                          />
                        ) : (
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)]/20 text-[8px] text-[color:var(--primary)]">
                            {(ln.speaker || "·").slice(0, 1)}
                          </span>
                        )}
                        <p className="text-[10px] leading-snug text-[#dcd0a6]">
                          <span className="text-[color:var(--primary)]">
                            {ln.speaker}
                          </span>
                          {ln.speaker ? "：" : ""}
                          {ln.text}
                        </p>
                      </div>
                    ),
                  )}
                  {lines.length > 4 && (
                    <p className="text-[10px] text-[#8c8570]">……</p>
                  )}
                </div>
                <p className="mt-2 text-[9px] text-[#8c8570]">
                  {t("share.fieldStory")} · {story?.source ?? t("share.sourceFallback")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 发布到工坊：把这段改写送进名场面殿堂，可被接力/点赞 */}
        <button
          onClick={() => void publish()}
          disabled={publishing || !!publishedId}
          className="mb-2 flex w-full items-center justify-center gap-1.5 border border-[color:var(--primary)] bg-[color:var(--primary)]/12 px-3 py-2.5 text-sm text-[color:var(--primary)] disabled:opacity-70"
          data-el="scene-share-publish"
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : publishedId ? (
            <Check className="h-4 w-4" />
          ) : (
            <Landmark className="h-4 w-4" />
          )}
          {publishedId
            ? t("workshop.published")
            : user
              ? t("workshop.publish")
              : t("workshop.loginToPublish")}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void doShare()}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 bg-[color:var(--primary)] px-3 py-2.5 text-sm text-[#171817] disabled:opacity-60"
            data-el="scene-share-go"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {t("share.openComposer")}
          </button>
          <button
            onClick={() => void download()}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2.5 text-sm text-[color:var(--primary)] disabled:opacity-50"
            data-el="scene-share-download"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("share.download")}
          </button>
        </div>
        {failed && (
          <p role="status" className="mt-2 text-center text-xs text-[color:var(--muted-foreground)]">
            {t("share.retry")}
          </p>
        )}
      </div>
    </>
  );
}
