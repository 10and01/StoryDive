"use client";

import { I18nextProvider } from "react-i18next";
import i18n, { normalizeLocale, type LocaleCode } from "@/i18n";

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: LocaleCode;
}) {
  const activeLocale = normalizeLocale(i18n.resolvedLanguage || i18n.language);
  if (activeLocale !== initialLocale) {
    void i18n.changeLanguage(initialLocale);
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
