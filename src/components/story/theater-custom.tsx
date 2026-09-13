"use client";

// 定制剧场弹窗：上传长文/论文（≤20MB）或粘贴文本 → 盐灵改编成多结局学习剧场。
// 隐私约束在 UI 明示：<5000 字直接注入不上传；超限或文件将存入知乎知识库
// （平台无删除接口），必须勾选声明才可提交。processing 时自动轮询。

import { useRef, useState } from "react";
import { FileUp, GraduationCap, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { postCustomTheater, pollCustomTheater } from "@/lib/api/theater-custom";
import type { TheaterPlay } from "@/lib/theater/types";

const LOCAL_TEXT_LIMIT = 5000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const POLL_INTERVAL_MS = 3000;
const POLL_MAX = 20; // 约 1 分钟，超时提示稍后再试

type Phase = "idle" | "generating" | "polling" | "failed";

export function CustomTheaterModal({
  open,
  onClose,
  onPlay,
}: {
  open: boolean;
  onClose: () => void;
  onPlay: (play: TheaterPlay) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errKey, setErrKey] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const needsUpload = tab === "file" || text.length >= LOCAL_TEXT_LIMIT;
  const ready = tab === "file" ? Boolean(file) : text.trim().length > 0;

  async function pollLoop(p: { recallId: string; kbId?: string; hint?: string }) {
    for (let i = 0; i < POLL_MAX; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const res = await pollCustomTheater(p);
      if (res.status === "ready") {
        onPlay(res.play);
        onClose();
        return;
      }
      if (res.status === "failed") {
        setPhase("failed");
        setErrKey("theater.customFailed");
        return;
      }
    }
    setPhase("failed");
    setErrKey("theater.customFailed");
  }

  async function submit() {
    if (!ready || phase !== "idle") return;
    if (needsUpload && !agreed) {
      setErrKey("theater.customNeedDisclaimer");
      return;
    }
    setErrKey("");
    setPhase("generating");
    const form = new FormData();
    if (hint.trim()) form.append("hint", hint.trim());
    if (tab === "file" && file) {
      form.append("file", file);
    } else if (text.trim().length >= LOCAL_TEXT_LIMIT) {
      // 粘贴的超限长文包装成 md 文件走知识库上传路径
      form.append("file", new File([text.trim()], "pasted.md", { type: "text/markdown" }));
    } else {
      form.append("text", text.trim());
    }
    const res = await postCustomTheater(form);
    if (res.status === "ready") {
      onPlay(res.play);
      onClose();
      return;
    }
    if (res.status === "processing") {
      setPhase("polling");
      void pollLoop({
        recallId: res.recallContentId ?? "",
        kbId: res.kbId || undefined,
        hint: res.hint || hint.trim() || undefined,
      });
      return;
    }
    setPhase("failed");
    setErrKey(
      res.code === "file_too_large"
        ? "theater.customTooLarge"
        : res.code === "no_material"
          ? "theater.customNoMaterial"
          : "theater.customFailed",
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-el="theater-custom-modal"
    >
      <div
        className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-xl border border-[color:var(--primary)]/40 bg-[#211f18] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 className="flex items-center gap-2 font-heading text-lg text-[#f2ead0]">
            <GraduationCap className="h-5 w-5 text-[color:var(--primary)]" />
            {t("theater.customTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 p-1 text-[color:var(--muted-foreground)] hover:text-[#f2ead0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-[#d9ca9b]">
          {t("theater.customDesc")}
        </p>

        {/* 文本 / 文件 双入口 */}
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {(["text", "file"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`border px-2 py-1.5 text-xs transition-colors ${
                tab === k
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.14] text-[color:var(--primary)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
              }`}
            >
              {t(`theater.customTab.${k}`)}
            </button>
          ))}
        </div>

        {tab === "text" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={40000}
            placeholder={t("theater.customTextPlaceholder")}
            className="w-full resize-none border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
            data-el="custom-text"
          />
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 border border-dashed border-[color:var(--border)] px-3 py-6 text-sm text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/50"
            data-el="custom-file-btn"
          >
            <FileUp className="h-4 w-4" />
            {file ? file.name : t("theater.customFileLabel")}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,.markdown,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_FILE_BYTES) {
              setErrKey("theater.customTooLarge");
              return;
            }
            setFile(f);
            setErrKey("");
          }}
        />

        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={120}
          placeholder={t("theater.customHintLabel")}
          className="mt-2.5 w-full border border-[color:var(--border)] bg-[#171817] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
        />

        {needsUpload && (
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-[#d9ca9b]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[color:var(--primary)]"
            />
            {t("theater.customDisclaimer")}
          </label>
        )}

        {errKey && <p className="mt-2 text-xs text-red-400">{t(errKey)}</p>}

        {phase === "polling" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-[#d9ca9b]">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" />
            {t("theater.customPolling")}
          </p>
        ) : (
          <button
            onClick={() => void submit()}
            disabled={phase !== "idle" || !ready}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 bg-[color:var(--primary)] px-3 py-2.5 text-sm font-medium text-[#171817] disabled:opacity-50"
            data-el="custom-generate"
          >
            {phase === "generating" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            {phase === "generating" ? t("theater.customGenerating") : t("theater.customGenerate")}
          </button>
        )}
      </div>
    </div>
  );
}
