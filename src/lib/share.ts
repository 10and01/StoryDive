"use client";

// 分享工具：优先 Web Share API（可带图片文件），降级为复制文案到剪贴板。
// poster 是 canvas 导出的 PNG data URL（见 scene-poster.ts / court-poster.ts）。

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const [head, body] = dataUrl.split(",");
    const mime = head.match(/data:(.*?);/)?.[1] ?? "image/png";
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

export interface ComposeShareInput {
  text: string;
  /** PNG data URL 海报；平台支持时作为图片附件分享 */
  poster?: string | null;
  posterName?: string;
}

/**
 * 唤起系统分享。成功 resolve；平台不支持且剪贴板也失败时 throw（调用方自行兜底）。
 * 降级路径下文案已复制，返回 "copied" 供调用方提示。
 */
export async function composeShare(input: ComposeShareInput): Promise<"shared" | "copied"> {
  const { text, poster, posterName = "poster.png" } = input;

  if (poster && typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
    const file = dataUrlToFile(poster, posterName);
    if (file && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return "shared";
      } catch (err) {
        // 用户取消分享不算失败
        if (err instanceof DOMException && err.name === "AbortError") return "shared";
        // 继续走下面的降级
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.share && !poster) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }

  throw new Error("share unsupported");
}
