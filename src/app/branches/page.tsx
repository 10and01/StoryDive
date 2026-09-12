"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import { useUser } from "@/components/user-profile/user-provider";
import { useBranches } from "@/components/story/branch-store";
import { BranchForest } from "@/components/story/branch-forest";

export default function BranchesPage() {
  const { t } = useTranslation();
  const { branches, ready, authed } = useBranches();
  const { login } = useUser();

  return (
    <AppShell>
      <header className="mb-4 border-b border-[color:var(--sidebar-border)] pb-3">
        <h1 className="font-heading text-[clamp(28px,9vw,48px)] leading-tight">
          {t("branches.title")}
        </h1>
        <p className="mt-1 font-heading text-sm text-[#d9ca9b]">
          {t("branches.sub")}
        </p>
      </header>

      {!authed ? (
        <div className="border border-dashed border-[color:var(--border)] p-8 text-center" data-el="branches-login">
          <p className="mb-3 text-sm text-[color:var(--muted-foreground)]">
            {t("branches.empty")}
          </p>
          <button
            onClick={login}
            className="inline-flex items-center gap-1.5 border border-[color:var(--primary)] px-4 py-2 text-sm text-[color:var(--primary)]"
          >
            <LogIn className="h-4 w-4" />
            {t("common.signIn")}
          </button>
        </div>
      ) : !ready ? (
        <p className="p-8 text-center text-sm text-[color:var(--muted-foreground)]">
          {t("common.loading")}
        </p>
      ) : branches.length === 0 ? (
        <div className="border border-dashed border-[color:var(--border)] p-8 text-center" data-el="branches-empty">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {t("branches.empty")}
          </p>
          <Link
            href="/"
            className="mt-3 inline-block border border-[color:var(--primary)] px-4 py-2 text-sm text-[color:var(--primary)]"
          >
            {t("nav.shelf")}
          </Link>
        </div>
      ) : (
        <BranchForest branches={branches} />
      )}
    </AppShell>
  );
}
