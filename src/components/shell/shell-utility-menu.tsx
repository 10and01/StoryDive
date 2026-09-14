"use client";

import Link from "next/link";
import { BookOpenText, Ellipsis, GraduationCap, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { UserBadge } from "@/components/user-profile/user-badge";
import { useGuide } from "@/components/onboarding/guide-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function ShellUtilityMenu() {
  const { t } = useTranslation();
  const { startGuide } = useGuide();
  const [open, setOpen] = useState(false);

  function restartGuide() {
    setOpen(false);
    window.setTimeout(startGuide, 120);
  }

  return (
    <>
      <div
        className="pointer-events-none fixed right-3 z-40 flex items-center gap-2"
        style={{ top: "var(--safe-area-top, max(10px, env(safe-area-inset-top, 0px)))" }}
        data-guide="shell-utilities"
      >
        <div className="pointer-events-auto hidden items-center gap-2 md:flex">
          <UserBadge />
          <LanguageSwitcher />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[#171817]/90 px-2.5 py-1.5 text-xs text-[color:var(--muted-foreground)] shadow-[0_8px_22px_rgba(0,0,0,.2)] backdrop-blur transition-colors hover:border-[color:var(--primary)]/70 hover:text-[color:var(--primary)]"
          aria-label={t("shell.more")}
          data-guide="shell-more"
        >
          <Ellipsis className="h-4 w-4" />
          <span>{t("shell.more")}</span>
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[min(86vw,360px)] border-[color:var(--border)] bg-[#171817]"
          style={{ paddingTop: "calc(3.75rem + var(--safe-area-top, env(safe-area-inset-top, 0px)))" }}
          data-el="shell-utility-sheet"
        >
          <SheetHeader className="px-5 pb-2">
            <SheetTitle>{t("shell.moreTitle")}</SheetTitle>
            <SheetDescription>{t("shell.moreDescription")}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 px-5 pb-6">
            <Link
              href="/showcase"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border border-[color:var(--border)] px-3 py-3 text-sm text-[color:var(--rs-ink)] transition-colors hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)]"
            >
              <BookOpenText className="h-4 w-4 text-[color:var(--primary)]" />
              {t("shell.productIntro")}
            </Link>
            <button
              type="button"
              onClick={restartGuide}
              className="flex items-center gap-3 border border-[color:var(--border)] px-3 py-3 text-left text-sm text-[color:var(--rs-ink)] transition-colors hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)]"
            >
              <GraduationCap className="h-4 w-4 text-[color:var(--primary)]" />
              {t("shell.restartGuide")}
            </button>
            <div className="mt-2 grid gap-2 border-t border-[color:var(--border)]/60 pt-4">
              <p className="flex items-center gap-2 text-[11px] tracking-[0.12em] text-[color:var(--muted-foreground)]">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                {t("shell.accountTools")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <UserBadge />
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
