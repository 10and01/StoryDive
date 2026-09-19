"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Library, PenLine, Users, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import { ShellUtilityMenu } from "@/components/shell/shell-utility-menu";

const TABS = [
  {
    href: "/discover",
    key: "nav.discover",
    icon: Compass,
    match: (p: string) => p === "/" || p.startsWith("/discover"),
  },
  {
    href: "/shelf",
    key: "nav.shelf",
    icon: Library,
    match: (p: string) => p.startsWith("/shelf") || p.startsWith("/read") || p.startsWith("/reason"),
  },
  {
    href: "/create",
    key: "nav.create",
    icon: PenLine,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/works"),
  },
  {
    href: "/community",
    key: "nav.community",
    icon: Users,
    match: (p: string) => p.startsWith("/community") || p.startsWith("/hall") || p.startsWith("/theater") || p.startsWith("/court") || p.startsWith("/branches"),
  },
  {
    href: "/settings/models",
    key: "nav.settings",
    icon: Settings,
    match: (p: string) => p.startsWith("/settings"),
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
      <ShellUtilityMenu />
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
                <li key={tab.href} className="min-w-0 flex-1">
                  <Link
                    href={tab.href}
                    data-el={`nav-${tab.href.slice(1)}`}
                    data-guide={`nav-${tab.href.slice(1)}`}
                    className={cn(
                      "relative flex h-16 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[10px] leading-none transition-colors",
                      active
                        ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.06] text-[color:var(--primary)]"
                        : "text-[color:var(--muted-foreground)]",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="max-w-full truncate">{t(tab.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
