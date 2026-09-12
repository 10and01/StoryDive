"use client";

import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "./user-provider";

// 体验类页面的登录门：游客可浏览书架与阅读，剧场 / 法庭等完整体验需知乎登录。
// OAuth 未开放时展示"即将开放"文案，不出现死按钮。
export function LoginGate() {
  const { t } = useTranslation();
  const { login, oauthConfigured } = useUser();

  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center gap-3 px-8 py-12 text-center"
      data-el="login-gate"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--primary)]/40 bg-[#1a1811] text-2xl shadow-[0_0_24px_rgba(231,193,91,0.15)]">
        🚪
      </div>
      <h3 className="font-heading text-lg text-[color:var(--foreground)]">
        {t("auth.gateTitle")}
      </h3>
      <p className="max-w-[300px] text-xs leading-relaxed text-[color:var(--muted-foreground)]">
        {t("auth.gateDesc")}
      </p>
      {oauthConfigured ? (
        <button
          onClick={login}
          className="mt-2 inline-flex items-center gap-2 border border-[color:var(--primary)] px-5 py-2 text-sm text-[color:var(--primary)] transition-shadow hover:shadow-md"
          data-el="login-gate-cta"
        >
          <LogIn className="h-4 w-4" />
          {t("auth.gateCta")}
        </button>
      ) : (
        <p className="mt-2 text-[11px] tracking-wide text-[color:var(--primary)]/60">
          {t("auth.gateComingSoon")}
        </p>
      )}
    </div>
  );
}
