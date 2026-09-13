"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, GitBranch, Landmark, Sparkles, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { UserBadge } from "@/components/user-profile/user-badge";

const TABS = [
  { href: "/", key: "nav.shelf", icon: Library, match: (p: string) => p === "/" },
  {
    href: "/theater",
    key: "nav.theater",
    icon: Sparkles,
    match: (p: string) => p.startsWith("/theater"),
  },
  {
    href: "/court",
    key: "nav.court",
    icon: Scale,
    match: (p: string) => p.startsWith("/court"),
  },
  {
    href: "/branches",
    key: "nav.branches",
    icon: GitBranch,
    match: (p: string) => p.startsWith("/branches"),
  },
  {
    href: "/hall",
    key: "nav.hall",
    icon: Landmark,
    match: (p: string) => p.startsWith("/hall"),
  },
];

/**
 * App shell: near-black painted-board ground with warm grain, plus a bottom
 * tab bar. Reader / graph / reason routes hide the tab bar (fullscreen).
 */
export function AppShell({
  children,
  showTabs = true,
}: {
  children: React.ReactNode;
  showTabs?: boolean;
}) {
  const { t } = useTranslation();
  const pathname = usePathname() || "/";

  return (
    <div
      className="relative isolate flex min-h-[100svh] w-full flex-col"
      style={{
        paddingTop: "var(--safe-area-top, max(56px, env(safe-area-inset-top, 0px)))",
      }}
      data-el="app-shell"
    >
      <div className="rs-grain" aria-hidden />
      <div
        className="mx-auto w-full max-w-[1060px] flex-1 px-3.5"
        style={{
          paddingBottom: showTabs
            ? "calc(64px + var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px))))"
            : "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
        }}
      >
        {children}
      </div>

      {showTabs && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-[#10110f]/95 backdrop-blur"
          style={{
            paddingBottom: "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
          }}
          data-el="tab-bar"
        >
          <ul className="mx-auto flex max-w-[1060px] items-stretch">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              const Icon = tab.icon;
              return (
                <li key={tab.href} className="flex-1">
                  <Link
                    href={tab.href}
                    data-el={`nav-${tab.href === "/" ? "shelf" : "branches"}`}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[11px] tracking-wide transition-colors",
                      active
                        ? "text-[color:var(--primary)]"
                        : "text-[color:var(--muted-foreground)]",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {t(tab.key)}
                  </Link>
                </li>
              );
            })}
            <li className="flex items-center px-2">
              <UserBadge />
            </li>
            <li className="flex items-center px-2">
              <LanguageSwitcher />
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
