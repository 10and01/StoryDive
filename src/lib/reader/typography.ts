/**
 * 阅读排版设置：字体、字号、行距、字间距、段间距（纯共享模块，无 React）。
 *
 * 持久化双写 localStorage + cookie：cookie 由根布局（服务端）读取后直接
 * 渲染在 <html> 上（data-reader-font + --reader-* 变量），首帧即正确、
 * 全页面（含未挂 hook 的页面）无闪烁；localStorage 为客户端事实源。
 * 消费方见 globals.css 的 `.reader-typography` / `.reader-flow` /
 * `.reader-chapter-title`。hook 见 use-reader-typography.ts（client），
 * 服务端读取见 server-typography.ts。
 */

export const TYPOGRAPHY_STORAGE_KEY = "ruju.reader.typography.v1";

export type ReaderFontId = "noto-serif" | "wenkai" | "noto-sans";

export const READER_FONT_IDS: ReaderFontId[] = ["noto-serif", "wenkai", "noto-sans"];

export interface ReaderTypography {
  font: ReaderFontId;
  /** 正文字号，px */
  fontSize: number;
  /** 行距倍数（无单位） */
  lineHeight: number;
  /** 字间距，em（随字号缩放） */
  letterSpacing: number;
  /** 段间距，em（随字号缩放） */
  paraGap: number;
}

/** 各参数的可调范围与步进（步进刻意做细，覆盖低视力到小屏的连续体感） */
export const READER_TYPOGRAPHY_RANGES = {
  fontSize: { min: 12, max: 32, step: 1 },
  lineHeight: { min: 1.5, max: 2.4, step: 0.1 },
  letterSpacing: { min: -0.02, max: 0.2, step: 0.01 },
  paraGap: { min: 0.3, max: 1.8, step: 0.1 },
} as const;

/** 默认值与当前线上视觉一致：思源宋体 17px / 1.9 行距 / 无字间距 */
export const READER_TYPOGRAPHY_DEFAULTS: ReaderTypography = {
  font: "noto-serif",
  fontSize: 17,
  lineHeight: 1.9,
  letterSpacing: 0,
  paraGap: 0.9,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 对齐到步进网格并消除浮点噪声（1.7000000000000002 → 1.7） */
function snapToStep(value: number, min: number, step: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.round(snapped * 1000) / 1000;
}

function coerceNumber(raw: unknown, range: { min: number; max: number; step: number }, fallback: number): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return snapToStep(clamp(value, range.min, range.max), range.min, range.step);
}

/** 把任意来源（localStorage / 旧版本数据）修正为合法的排版设置 */
export function sanitizeReaderTypography(raw: unknown): ReaderTypography {
  if (!raw || typeof raw !== "object") return { ...READER_TYPOGRAPHY_DEFAULTS };
  const r = raw as Record<string, unknown>;
  const d = READER_TYPOGRAPHY_DEFAULTS;
  const range = READER_TYPOGRAPHY_RANGES;
  return {
    font: READER_FONT_IDS.includes(r.font as ReaderFontId)
      ? (r.font as ReaderFontId)
      : d.font,
    fontSize: coerceNumber(r.fontSize, range.fontSize, d.fontSize),
    lineHeight: coerceNumber(r.lineHeight, range.lineHeight, d.lineHeight),
    letterSpacing: coerceNumber(r.letterSpacing, range.letterSpacing, d.letterSpacing),
    paraGap: coerceNumber(r.paraGap, range.paraGap, d.paraGap),
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

/** 读取已保存的排版设置（仅客户端；损坏数据回退默认值） */
export function getReaderTypography(): ReaderTypography {
  try {
    const raw = getBrowserStorage()?.getItem(TYPOGRAPHY_STORAGE_KEY);
    return sanitizeReaderTypography(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...READER_TYPOGRAPHY_DEFAULTS };
  }
}

export function persistReaderTypography(typography: ReaderTypography): void {
  try {
    const raw = JSON.stringify(typography);
    getBrowserStorage()?.setItem(TYPOGRAPHY_STORAGE_KEY, raw);
    // 双写 cookie：下次 SSR 时根布局读取，首帧直接渲染正确排版
    if (typeof document !== "undefined") {
      document.cookie = `${TYPOGRAPHY_STORAGE_KEY}=${encodeURIComponent(raw)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  } catch {
    // 隐私模式等场景下写入失败可接受：设置仅在当前会话生效
  }
}

/** 把设置写成 <html> 上的 CSS 变量与字体标记，即时生效 */
export function applyReaderTypography(typography: ReaderTypography): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.readerFont = typography.font;
  root.style.setProperty("--reader-font-size", `${typography.fontSize}px`);
  root.style.setProperty("--reader-line-height", `${typography.lineHeight}`);
  root.style.setProperty("--reader-letter-spacing", `${typography.letterSpacing}em`);
  root.style.setProperty("--reader-para-gap", `${typography.paraGap}`);
}
