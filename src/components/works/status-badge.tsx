"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

export function StatusBadge({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-[10px] tracking-[0.08em]",
        value === "failed"
          ? "border-red-400/50 text-red-200"
          : value === "processing"
            ? "border-[color:var(--rs-cool)]/60 text-[color:var(--rs-cool)]"
            : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
      )}
    >
      {t(`creator.status.${value}`, { defaultValue: value })}
    </span>
  );
}
