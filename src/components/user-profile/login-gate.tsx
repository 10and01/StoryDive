"use client";

import Image from "next/image";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "./user-provider";

// 体验类页面的登录门：游客可浏览书架与阅读，剧场 / 法庭等完整体验需知乎登录。
// 看山在门口打招呼；按钮沿用全站统一的"暗金实底"CTA 样式。
// OAuth 未开放时展示"即将开放"文案，不出现死按钮。
export function LoginGate() {
  const { t } = useTranslation();
  const { login, oauthConfigured } = useUser();

  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-2.5 px-8 py-12 text-center"
      data-el="login-gate"
    >
      <Image
        src="/lookshan/greet.gif"
        alt=""
        width={104}
        height={104}
        unoptimized
        className="drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
      />
      <h3 className="font-heading text-lg text-[color:var(--foreground)]">
        {t("auth.gateTitle")}
      </h3>
      <p className="max-w-[300px] text-xs leading-relaxed text-[color:var(--muted-foreground)]">
        {t("auth.gateDesc")}
      </p>
      {oauthConfigured ? (
        <button
          onClick={login}
          className="mt-2 inline-flex items-center gap-2 bg-[color:var(--primary)] px-6 py-2.5 text-sm text-[#171817] shadow-[0_0_24px_rgba(231,193,91,0.2)] transition-shadow hover:shadow-[0_0_36px_rgba(231,193,91,0.38)]"
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
