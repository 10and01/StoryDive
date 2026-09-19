import { cookies } from "next/headers";
import { headers } from "next/headers";
import {
  LOCALE_STORAGE_KEY,
  parseLocalePreference,
  resolveLocalePreference,
} from "@/lib/i18n/preference";
import type { LocaleCode } from "@/lib/i18n/locale";
import { normalizeLocale } from "@/lib/i18n/locale";

/** Resolved locale for SSR (cookie → default en-US). */
export async function getServerLocale(): Promise<LocaleCode> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
  const preference = parseLocalePreference(
    raw ? decodeURIComponent(raw) : null,
  );
  if (preference === "system") {
    const acceptLanguage = (await headers()).get("accept-language");
    const preferred = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim();
    return normalizeLocale(preferred) ?? "en-US";
  }
  return resolveLocalePreference(preference);
}
