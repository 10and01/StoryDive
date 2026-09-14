"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, GitBranch, MessageCircle, Scale, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STORIES } from "@/lib/story/library";
import { useGuide } from "@/components/onboarding/guide-provider";

const FEATURE_ICONS = [BookOpen, Sparkles, MessageCircle, GitBranch, Scale];

export function WelcomeCover({ onEnter }: { onEnter: () => void }) {
  const { t } = useTranslation();
  const { startGuide } = useGuide();
  const covers = STORIES.filter((s) => s.objectImage).slice(0, 7);

  function enter() {
    try {
      localStorage.setItem("ruju:welcome-seen:v1", "1");
    } catch {
      // Continue even when storage is unavailable.
    }
    onEnter();
    window.setTimeout(startGuide, 280);
  }

  function explore() {
    try {
      localStorage.setItem("ruju:welcome-seen:v1", "1");
    } catch {
      // Ignore storage errors.
    }
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#10110f] text-[color:var(--rs-ink)]">
      <div className="rs-grain" aria-hidden />
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1120px] flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <header className="flex items-center justify-between gap-4 text-[10px] tracking-[0.22em] text-[color:var(--muted-foreground)] sm:text-xs">
          <span>{t("welcome.eyebrow")}</span>
          <span className="border border-[color:var(--primary)]/60 px-2.5 py-1 text-[color:var(--primary)]">
            {t("welcome.mark")}
          </span>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:py-16">
          <section className="max-w-xl">
            <p className="text-xs tracking-[0.34em] text-[color:var(--rs-warm)]">RU · JU</p>
            <h1 className="mt-3 font-heading text-[clamp(68px,14vw,144px)] leading-[0.88] tracking-[-0.05em]">
              {t("welcome.title")}
            </h1>
            <p className="mt-6 max-w-lg font-heading text-[clamp(18px,2.4vw,27px)] leading-relaxed text-[#d9ca9b]">
              {t("welcome.subtitle")}
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[color:var(--muted-foreground)] sm:text-base">
              {t("welcome.description")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enter}
                className="inline-flex items-center gap-2 bg-[color:var(--primary)] px-5 py-3 font-heading text-sm tracking-[0.12em] text-[color:var(--primary-foreground)] transition-transform hover:-translate-y-0.5"
                data-el="welcome-enter"
              >
                {t("welcome.enter")}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                href="/showcase"
                onClick={explore}
                className="inline-flex items-center gap-2 border border-[color:var(--border)] px-5 py-3 text-sm text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)]/70 hover:text-[color:var(--primary)]"
                data-el="welcome-explore"
              >
                {t("welcome.explore")}
              </Link>
            </div>
          </section>

          <section className="relative min-h-[360px] sm:min-h-[500px]" aria-label={t("welcome.visualLabel")}>
            <div className="absolute inset-0 border border-[color:var(--border)]/70 bg-[#151611]/70 p-3 sm:p-5">
              <div className="grid h-full grid-cols-4 grid-rows-3 gap-2 sm:gap-3">
                {covers.map((story, index) => (
                  <div
                    key={story.id}
                    className={`relative overflow-hidden border border-[color:var(--border)]/70 bg-[#211f18] ${
                      index === 0 ? "col-span-2 row-span-2" : index === 5 ? "col-span-2" : ""
                    }`}
                  >
                    <Image
                      src={story.objectImage}
                      alt={story.objectAlt}
                      fill
                      unoptimized
                      className="object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#10110f]/80 via-transparent to-transparent" />
                    {index === 0 && (
                      <div className="absolute inset-x-3 bottom-3 sm:inset-x-5 sm:bottom-5">
                        <p className="font-heading text-base leading-tight text-[#f2ead0] sm:text-2xl">
                          {story.title}
                        </p>
                        <p className="mt-1 text-[10px] tracking-[0.1em] text-[color:var(--primary)] sm:text-xs">
                          {t("welcome.heroCaption")}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-4 -left-3 border border-[color:var(--primary)]/50 bg-[#171817]/95 px-3 py-2 text-[11px] tracking-[0.12em] text-[color:var(--primary)] shadow-[0_10px_28px_rgba(0,0,0,.3)] sm:-left-5">
              {t("welcome.visualStamp")}
            </div>
          </section>
        </main>

        <section className="grid border-y border-[color:var(--border)]/70 sm:grid-cols-5" aria-label={t("welcome.featuresLabel")}>
          {FEATURE_ICONS.map((Icon, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-[color:var(--border)]/50 px-1 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:py-4 sm:last:border-r-0">
              <Icon className="h-4 w-4 shrink-0 text-[color:var(--primary)]" aria-hidden />
              <span className="text-xs leading-relaxed text-[#d9ca9b]">{t(`welcome.features.${index}`)}</span>
            </div>
          ))}
        </section>

        <p className="pt-6 text-center text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
          {t("welcome.footer")}
        </p>
      </div>
    </div>
  );
}
