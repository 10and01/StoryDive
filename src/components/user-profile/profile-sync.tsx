"use client";

// 画像同步 sheet：明示同意 → 同步知乎创作 → 展示画像结果。
// 三态：未同步（同意书）→ 已同步（画像概要 + 重新同步/清除）→ 需重新授权。
// 授权过期（OAuth token 1 小时失效且无刷新）引导重走登录。

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RefreshCw, Trash2, LogIn, Sparkles, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "./user-provider";
import {
  deleteSync,
  fetchSyncStatus,
  postSync,
  type SyncProfile,
  type SyncStatus,
} from "@/lib/api/user-sync";

export function ProfileSyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { login } = useUser();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [profile, setProfile] = useState<SyncProfile | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const [followeeCount, setFolloweeCount] = useState(0);
  const [followeesOptIn, setFolloweesOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needReauth, setNeedReauth] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchSyncStatus().then((s) => {
      if (cancelled) return;
      setNeedReauth(false);
      setError("");
      setStatus(s);
      setFolloweeCount(s?.followees?.length ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function sync() {    setBusy(true);
    setError("");
    const res = await postSync(true, { followees: followeesOptIn });
    setBusy(false);
    if (res.ok) {
      setProfile(res.profile);
      setCardCount(res.cards);
      setFolloweeCount(res.followees);
      setStatus((s) => ({
        hasProfile: Boolean(res.profile),
        hasCards: res.cards > 0,
        consent: true,
        consentFollowees: (s?.consentFollowees ?? false) || res.followees > 0,
        followees: s?.followees,
        syncedAt: res.syncedAt,
      }));
    } else if (res.code === "reauth_needed") {
      setNeedReauth(true);
    } else {
      setError(t(`profileSync.error.${res.code === "consent_required" ? "consent" : "failed"}`));
    }
  }

  async function clear() {
    setBusy(true);
    const ok = await deleteSync();
    setBusy(false);
    if (ok) {
      setStatus({ hasProfile: false, consent: false, syncedAt: null });
      setProfile(null);
    } else {
      setError(t("profileSync.error.failed"));
    }
  }

  // portal 到 body：本组件挂在底部 Tab 栏内，而 Tab 栏的 backdrop-blur 会劫持
  // 后代 fixed 定位（弹层被裁在底栏里、按钮不可见）——必须脱离其定位上下文。
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-el="profile-sync-sheet"
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("profileSync.title")}
        </h2>

        {needReauth ? (
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>{t("profileSync.reauth")}</p>
            <button
              onClick={() => {
                onClose();
                login();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" />
              {t("profileSync.reauthButton")}
            </button>
          </div>
        ) : status?.hasProfile || profile ? (
          <SyncedView
            profile={profile}
            cardCount={cardCount}
            followeeCount={followeeCount}
            syncedAt={status?.syncedAt ?? null}
            busy={busy}
            onResync={() => void sync()}
            onClear={() => void clear()}
          />
        ) : (
          <ConsentView
            busy={busy}
            error={error}
            followeesOptIn={followeesOptIn}
            onToggleFollowees={() => setFolloweesOptIn((v) => !v)}
            onAgree={() => void sync()}
          />
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          {t("common.close")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ConsentView({
  busy,
  error,
  followeesOptIn,
  onToggleFollowees,
  onAgree,
}: {
  busy: boolean;
  error: string;
  followeesOptIn: boolean;
  onToggleFollowees: () => void;
  onAgree: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
        <p className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t("profileSync.consentTitle")}
        </p>
        <p>{t("profileSync.consentBody")}</p>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={followeesOptIn}
          onChange={onToggleFollowees}
          className="mt-0.5 accent-[color:var(--primary)]"
        />
        {t("profileSync.followeesOptIn")}
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        onClick={onAgree}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {t("profileSync.agreeButton")}
      </button>
    </div>
  );
}

function SyncedView({
  profile,
  cardCount,
  followeeCount,
  syncedAt,
  busy,
  onResync,
  onClear,
}: {
  profile: SyncProfile | null;
  cardCount: number;
  followeeCount: number;
  syncedAt: string | null;
  busy: boolean;
  onResync: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 space-y-3">
      {profile && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" data-el="profile-sync-result">
          {profile.summary && (
            <p className="font-heading font-medium text-foreground">{profile.summary}</p>
          )}
          {profile.keywords?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {profile.keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
          {profile.tone && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("profileSync.tone")}: {profile.tone}
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("profileSync.syncedLine", {
          n: cardCount,
          time: syncedAt ? new Date(syncedAt).toLocaleString() : "—",
        })}
      </p>
      {followeeCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("profileSync.followeesLine", { n: followeeCount })}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onResync}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t("profileSync.resync")}
        </button>
        <button
          onClick={onClear}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {t("profileSync.clear")}
        </button>
      </div>
    </div>
  );
}
