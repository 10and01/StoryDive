"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { LogIn, LogOut, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "./user-provider";
import type { UserProfile } from "@/lib/api/user-profile";

export function UserBadge() {
  const { t } = useTranslation();
  const { user, loading, login, logout, oauthConfigured } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (loading) {
    return (
      <div className="flex h-9 items-center rounded-full border border-border bg-background px-3 shadow-sm">
        <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    if (!oauthConfigured) return null;
    return (
      <button
        onClick={login}
        className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-shadow hover:shadow-md"
      >
        <LogIn className="h-4 w-4 text-muted-foreground" />
        {t("common.signIn")}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <BadgeTrigger user={user} onClick={() => setOpen((v) => !v)} />
      {open && (
        <DropdownPanel user={user} onClose={() => setOpen(false)} userIdLabel={t("common.userId")}>
          {user.guest && oauthConfigured && (
            <button
              onClick={login}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("common.signIn")}
            </button>
          )}
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("common.signOut")}
          </button>
        </DropdownPanel>
      )}
    </div>
  );
}

function BadgeTrigger({ user, onClick }: { user: UserProfile; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1.5 text-sm shadow-sm transition-shadow hover:shadow-md"
    >
      <Avatar user={user} size={24} />
      <span className="hidden max-w-[120px] truncate font-medium text-foreground sm:inline">
        {user.name ?? user.email ?? user.id}
      </span>
    </button>
  );
}

function DropdownPanel({
  user,
  onClose,
  userIdLabel,
  children,
}: {
  user: UserProfile;
  onClose: () => void;
  userIdLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="absolute bottom-full right-0 z-50 mb-3 w-64 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar user={user} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name ?? "—"}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5">
        <Row label={userIdLabel} value={user.id} mono />
      </div>

      {children && <div className="border-t border-border px-4 py-2">{children}</div>}
    </div>
  );
}

function Avatar({ user, size }: { user: UserProfile; size: number }) {
  if (user.avatarUrl) {
    const avatarSrc = user.avatarUrl.startsWith("//")
      ? `https:${user.avatarUrl}`
      : user.avatarUrl;
    return (
      <Image
        src={avatarSrc}
        alt={user.name ?? "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(user.name ?? user.email ?? "?")[0].toUpperCase()}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground/70">{label}</span>
      <span className={`truncate text-right text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
