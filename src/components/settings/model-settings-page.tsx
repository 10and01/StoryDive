"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Plus, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import { useUser } from "@/components/user-profile/user-provider";
import {
  createProvider,
  deleteProvider,
  fetchProviders,
  testProvider,
  type ModelProvider,
} from "@/lib/api/works";
import { useTranslation } from "react-i18next";

export function ModelSettingsPage() {
  const { user, login, loading: userLoading } = useUser();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { setProviders(await fetchProviders()); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    try {
      const provider = await createProvider({ name, baseUrl, model, apiKey, isDefault });
      setProviders((current) => [provider, ...current.map((item) => isDefault ? { ...item, isDefault: false } : item)]);
      setName(""); setModel(""); setApiKey(""); setIsDefault(false);
      toast.success(t("creator.models.saved"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("creator.models.saveFailed")); }
    finally { setBusy(""); }
  }

  async function test(provider: ModelProvider) {
    setBusy(`test-${provider.id}`);
    try {
      const updated = await testProvider(provider.id);
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success(t("creator.models.testSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creator.models.testFailed"));
      void load();
    } finally { setBusy(""); }
  }

  async function remove(provider: ModelProvider) {
    setBusy(`delete-${provider.id}`);
    try {
      await deleteProvider(provider.id);
      setProviders((current) => current.filter((item) => item.id !== provider.id));
      toast.success(t("creator.models.deleted"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("creator.models.deleteFailed")); }
    finally { setBusy(""); }
  }

  if (!userLoading && !user) return <AppShell><div className="grid min-h-[60svh] place-items-center text-center"><div><KeyRound className="mx-auto size-9 text-[color:var(--primary)]" /><h1 className="mt-4 font-heading text-4xl">{t("creator.models.loginTitle")}</h1><p className="mt-2 text-sm text-[#d9ca9b]">{t("creator.models.loginHint")}</p><button onClick={login} className="mt-5 bg-[color:var(--primary)] px-5 py-3 text-sm text-[color:var(--primary-foreground)]">{t("creator.common.signIn")}</button></div></div></AppShell>;

  return (
    <AppShell>
      <header className="border-b border-[color:var(--border)] pb-5"><p className="text-[10px] tracking-[0.2em] text-[color:var(--muted-foreground)]">{t("creator.models.title")}</p><h1 className="mt-1 font-heading text-[clamp(34px,8vw,58px)]">{t("creator.models.title")}</h1><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#d9ca9b]">{t("creator.models.subtitle")}</p></header>
      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submit} className="border border-[color:var(--border)] bg-[#171817]/70 p-5">
          <div className="flex items-center gap-2"><Plus className="size-5 text-[color:var(--primary)]" /><h2 className="font-heading text-xl">{t("creator.models.add")}</h2></div>
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-xs text-[color:var(--muted-foreground)]">{t("creator.models.name")}<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("creator.models.namePlaceholder")} className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#10110f] px-3 text-sm outline-none focus:border-[color:var(--primary)]" /></label>
            <label className="text-xs text-[color:var(--muted-foreground)]">Base URL<input required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#10110f] px-3 text-sm outline-none focus:border-[color:var(--primary)]" /><span className="mt-1 block text-[10px]">{t("creator.models.baseUrlHint")}</span></label>
            <label className="text-xs text-[color:var(--muted-foreground)]">{t("creator.models.model")}<input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={t("creator.models.modelPlaceholder")} className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#10110f] px-3 text-sm outline-none focus:border-[color:var(--primary)]" /></label>
            <label className="text-xs text-[color:var(--muted-foreground)]">API Key<input required type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("creator.models.keyHint")} className="mt-1 h-10 w-full border border-[color:var(--border)] bg-[#10110f] px-3 text-sm outline-none focus:border-[color:var(--primary)]" /></label>
            <label className="flex items-center gap-2 text-xs text-[#d9ca9b]"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />{t("creator.models.default")}</label>
            <button disabled={busy === "create"} className="mt-2 inline-flex h-11 items-center justify-center gap-2 bg-[color:var(--primary)] px-4 text-sm text-[color:var(--primary-foreground)] disabled:opacity-50">{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {t("creator.models.save")}</button>
          </div>
        </form>
        <section>
          <div className="flex items-center justify-between"><h2 className="font-heading text-2xl">{t("creator.models.savedTitle")}</h2><span className="text-xs text-[color:var(--muted-foreground)]">{t("creator.models.count", { count: providers.length })}</span></div>
          {loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-5 animate-spin text-[color:var(--primary)]" /></div> : providers.length ? <div className="mt-3 grid gap-3">{providers.map((provider) => <article key={provider.id} className="border border-[color:var(--border)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-heading text-lg">{provider.name}</h3>{provider.isDefault && <span className="border border-[color:var(--primary)] px-1.5 py-0.5 text-[9px] text-[color:var(--primary)]">{t("creator.models.defaultBadge")}</span>}</div><p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{provider.model} · {provider.maskedApiKey}</p><p className="mt-1 break-all text-[10px] text-[color:var(--muted-foreground)]">{provider.baseUrl}</p></div><div className="flex items-center gap-1.5 text-xs">{provider.status === "active" ? <><CheckCircle2 className="size-4 text-[color:var(--rs-cool)]" /> {t("creator.models.active")}</> : provider.status === "failed" ? <><XCircle className="size-4 text-red-200" /> {t("creator.models.failed")}</> : t("creator.models.untested")}</div></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => void test(provider)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 border border-[color:var(--primary)] px-3 py-2 text-xs text-[color:var(--primary)]">{busy === `test-${provider.id}` && <Loader2 className="size-3.5 animate-spin" />} {t("creator.models.test")}</button><button type="button" onClick={() => void remove(provider)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]"><Trash2 className="size-3.5" /> {t("creator.models.delete")}</button></div></article>)}</div> : <div className="mt-3 grid min-h-48 place-items-center border border-dashed border-[color:var(--border)] p-6 text-center text-sm text-[color:var(--muted-foreground)]">{t("creator.models.empty")}</div>}
        </section>
      </div>
      <div className="mt-5 flex gap-3 border border-[color:var(--rs-cool)]/40 bg-[color:var(--rs-cool)]/[0.05] p-4 text-xs leading-relaxed text-[#d9ca9b]"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[color:var(--rs-cool)]" /><p>{t("creator.models.security")}</p></div>
    </AppShell>
  );
}
