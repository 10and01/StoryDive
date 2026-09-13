"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/utils/utils";
import {
  READER_TYPOGRAPHY_RANGES,
  type ReaderFontId,
  type ReaderTypography,
} from "@/lib/reader/typography";

/**
 * 阅读排版设置面板（微信读书式「Aa」底部面板）：字体按衬线/无衬线分组，
 * 字号、行距、字间距、段间距实时生效并持久化。预览区与正文共用同一组
 * CSS 变量，调整即刻可见。
 */

const FONT_OPTIONS: {
  id: ReaderFontId;
  group: "serif" | "sans";
  labelKey: string;
  sampleClass: string;
}[] = [
  {
    id: "noto-serif",
    group: "serif",
    labelKey: "reader.typography.fontNotoSerif",
    sampleClass: "font-sample-noto-serif",
  },
  {
    id: "wenkai",
    group: "serif",
    labelKey: "reader.typography.fontWenkai",
    sampleClass: "font-sample-wenkai",
  },
  {
    id: "noto-sans",
    group: "sans",
    labelKey: "reader.typography.fontNotoSans",
    sampleClass: "font-sample-noto-sans",
  },
];

function SliderRow({
  label,
  ariaLabel,
  display,
  min,
  max,
  step,
  value,
  onChange,
  children,
}: {
  label: ReactNode;
  /** label 为 ReactNode（带徽标）时提供纯文本给 aria-label */
  ariaLabel?: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  children?: ReactNode;
}) {
  return (
    <div className="py-2.5" data-el="typography-slider">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted-foreground)]">
          {label}
        </span>
        <span className="flex items-center gap-2 text-xs text-[color:var(--primary)]">
          {children}
          <span className="tabular-nums">{display}</span>
        </span>
      </div>
      <input
        type="range"
        className="reader-slider"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function TypographySheet({
  open,
  onOpenChange,
  typography,
  onChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typography: ReaderTypography;
  onChange: (patch: Partial<ReaderTypography>) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const range = READER_TYPOGRAPHY_RANGES;

  const fontSizeDisplay = `${typography.fontSize}px`;
  const lineHeightDisplay = typography.lineHeight.toFixed(1);
  const letterSpacingDisplay = `${typography.letterSpacing >= 0 ? "+" : ""}${typography.letterSpacing.toFixed(2)}em`;
  const paraGapDisplay = `${typography.paraGap.toFixed(1)}em`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88svh] gap-0 overflow-y-auto border-[color:var(--border)] bg-[#171817]"
        style={{
          paddingBottom:
            "var(--safe-area-bottom, max(20px, env(safe-area-inset-bottom, 0px)))",
        }}
        data-el="typography-sheet"
      >
        <SheetHeader className="pb-1">
          <SheetTitle>{t("reader.typography.title")}</SheetTitle>
          <SheetDescription>{t("reader.typography.description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* 实时预览：与正文共用同一组排版变量 */}
          <div
            className="border border-[color:var(--border)]/70 bg-[color:var(--card)]/40 px-3.5 py-3"
            data-el="typography-preview"
          >
            <p className="reader-typography line-clamp-4 text-[color:var(--rs-ink)]">
              {t("reader.typography.preview")}
            </p>
          </div>

          {/* 字体：衬线 / 无衬线分组 */}
          <section data-el="typography-fonts">
            <p className="mb-2 text-[11px] tracking-[0.14em] text-[color:var(--muted-foreground)]">
              {t("reader.typography.font")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {FONT_OPTIONS.map((opt) => {
                const selected = typography.font === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onChange({ font: opt.id })}
                    data-el={`typography-font-${opt.id}`}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-center gap-1.5 border px-1 py-3 transition-colors",
                      selected
                        ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.08]"
                        : "border-[color:var(--border)]/70 hover:border-[color:var(--primary)]/50",
                    )}
                  >
                    <span className={cn("text-xl leading-none", opt.sampleClass)}>
                      {t("reader.typography.sample")}
                    </span>
                    <span className="text-[11px] text-[color:var(--foreground)]">
                      {t(opt.labelKey)}
                    </span>
                    <span className="text-[9px] tracking-[0.12em] text-[color:var(--muted-foreground)]">
                      {opt.group === "serif"
                        ? t("reader.typography.serifTag")
                        : t("reader.typography.sansTag")}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 字号：A− / 滑杆 / A+，步进 1px 覆盖低视力到小屏 */}
          <SliderRow
            label={t("reader.typography.fontSize")}
            display={fontSizeDisplay}
            min={range.fontSize.min}
            max={range.fontSize.max}
            step={range.fontSize.step}
            value={typography.fontSize}
            onChange={(v) => onChange({ fontSize: v })}
          >
            <button
              onClick={() => onChange({ fontSize: typography.fontSize - 1 })}
              aria-label={t("reader.typography.fontSizeSmaller")}
              className="h-6 w-6 border border-[color:var(--border)] text-[10px] leading-none text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)]"
            >
              A
            </button>
            <button
              onClick={() => onChange({ fontSize: typography.fontSize + 1 })}
              aria-label={t("reader.typography.fontSizeLarger")}
              className="h-6 w-6 border border-[color:var(--border)] text-[13px] leading-none text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)]"
            >
              A
            </button>
          </SliderRow>

          {/* 行距：过密致疲劳、过疏断连贯，多档细调 */}
          <SliderRow
            label={t("reader.typography.lineHeight")}
            display={lineHeightDisplay}
            min={range.lineHeight.min}
            max={range.lineHeight.max}
            step={range.lineHeight.step}
            value={typography.lineHeight}
            onChange={(v) => onChange({ lineHeight: v })}
          />

          {/* 字间距：高级排版项，em 随字号缩放 */}
          <SliderRow
            label={
              <>
                {t("reader.typography.letterSpacing")}
                <span className="ml-1.5 border border-[color:var(--primary)]/40 px-1 py-px text-[9px] tracking-[0.1em] text-[color:var(--primary)]/80">
                  {t("reader.typography.advanced")}
                </span>
              </>
            }
            ariaLabel={t("reader.typography.letterSpacing")}
            display={letterSpacingDisplay}
            min={range.letterSpacing.min}
            max={range.letterSpacing.max}
            step={range.letterSpacing.step}
            value={typography.letterSpacing}
            onChange={(v) => onChange({ letterSpacing: v })}
          />

          {/* 段间距：段落层次分明，长文阅读的节奏感 */}
          <SliderRow
            label={t("reader.typography.paraGap")}
            display={paraGapDisplay}
            min={range.paraGap.min}
            max={range.paraGap.max}
            step={range.paraGap.step}
            value={typography.paraGap}
            onChange={(v) => onChange({ paraGap: v })}
          />

          <div className="mt-1 flex items-center justify-between gap-3 border-t border-[color:var(--border)]/50 pt-3">
            <span className="text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
              {t("reader.typography.licenseNote")}
            </span>
            <button
              onClick={onReset}
              data-el="typography-reset"
              className="shrink-0 border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)]"
            >
              {t("reader.typography.reset")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
