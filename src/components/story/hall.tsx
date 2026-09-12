"use client";

import { useUser } from "@/components/user-profile/user-provider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Landmark,
  Loader2,
  Layers,
  ChevronRight,
  ChevronDown,
  BookOpen,
  LogIn,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/app-shell";
import {
  fetchHallTop,
  fetchChain,
  publishToWorkshop,
  toggleVote,
  type WorkshopPost,
} from "@/lib/api/workshop";

// 名场面殿堂：读者共写的平行走向。展示按热度排序的接力链，可展开盖楼、点赞、续写。
export function Hall() {
  const { t } = useTranslation();
  const { user, login } = useUser();
  const [posts, setPosts] = useState<WorkshopPost[]>([]);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchHallTop();
      setPosts(rows);
    } catch {
      setPosts([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <AppShell>
      <header className="mb-4 border-b border-[color:var(--sidebar-border)] pb-3">
        <h1 className="flex items-center gap-2 font-heading text-[clamp(26px,8vw,44px)] leading-tight">
          <Landmark className="h-7 w-7 text-[color:var(--primary)]" />
          {t("workshop.hallTitle")}
        </h1>
        <p className="mt-1 font-heading text-sm text-[#d9ca9b]">
          {t("workshop.hallSubtitle")}
        </p>
      </header>

      {!ready ? (
        <p className="p-8 text-center text-sm text-[color:var(--muted-foreground)]">
          {t("common.loading")}
        </p>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-[color:var(--border)] p-8 text-center" data-el="hall-empty">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {t("workshop.empty")}
          </p>
          <Link
            href="/branches"
            className="mt-3 inline-block border border-[color:var(--primary)] px-4 py-2 text-sm text-[color:var(--primary)]"
          >
            {t("nav.branches")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" data-el="hall-list">
          {posts.map((p, i) => (
            <HallCard
              key={p.id}
              post={p}
              rank={i + 1}
              open={openId === p.id}
              onToggleOpen={() =>
                setOpenId((cur) => (cur === p.id ? null : p.id))
              }
              user={user}
              onChanged={load}
            />
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function HallCard({
  post,
  rank,
  open,
  onToggleOpen,
  user,
  onChanged,
}: {
  post: WorkshopPost;
  rank: number;
  open: boolean;
  onToggleOpen: () => void;
  user: unknown;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [chain, setChain] = useState<WorkshopPost[] | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  const loadChain = useCallback(async () => {
    setLoadingChain(true);
    try {
      setChain(await fetchChain(post.rootPostId));
    } catch {
      setChain([]);
    } finally {
      setLoadingChain(false);
    }
  }, [post.rootPostId]);

  useEffect(() => {
    if (open && !chain) {
      const id = setTimeout(() => void loadChain(), 0);
      return () => clearTimeout(id);
    }
  }, [open, chain, loadChain]);

  const floors = chain?.length ?? 1;

  return (
    <li className="border border-[color:var(--border)] bg-[#1c1b15]" data-el="hall-card">
      <button
        onClick={onToggleOpen}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-[color:var(--primary)]/50 font-heading text-sm text-[color:var(--primary)]">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base leading-tight text-[#f2ead0]">
            {post.title}
          </span>
          <span className="mt-0.5 block text-xs text-[#b7ad86]">
            {post.storyTitle}
            {post.enterHint ? ` · ${post.enterHint}` : ""}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8c8570]">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {post.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {t("workshop.floors", { n: floors })}
            </span>
            <span>
              {t("workshop.byAuthor", {
                name: post.authorName || t("workshop.anonymous"),
              })}
            </span>
          </span>
        </span>
        {open ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#8c8570]" />
        )}
      </button>

      {open && (
        <div className="border-t border-[color:var(--border)] p-3">
          {loadingChain || !chain ? (
            <p className="py-4 text-center text-xs text-[color:var(--muted-foreground)]">
              {t("common.loading")}
            </p>
          ) : (
            <>
              <ol className="space-y-3">
                {chain.map((floor, idx) => (
                  <FloorItem
                    key={floor.id}
                    floor={floor}
                    index={idx}
                    user={user}
                  />
                ))}
              </ol>
              <RelayComposer
                chain={chain}
                user={user}
                onDone={() => {
                  void loadChain();
                  onChanged();
                }}
              />
              <Link
                href={`/read/${post.storyId}`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-[color:var(--primary)]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t("workshop.readOnStory")}
              </Link>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function FloorItem({
  floor,
  index,
  user,
}: {
  floor: WorkshopPost;
  index: number;
  user: unknown;
}) {
  const { t } = useTranslation();
  const { login } = useUser();
  const [liked, setLiked] = useState(!!floor.liked);
  const [count, setCount] = useState(floor.likeCount);
  const [pending, setPending] = useState(false);

  async function like() {
    if (!user) {
      login();
      return;
    }
    if (pending) return;
    setPending(true);
    // 乐观更新
    setLiked((v) => !v);
    setCount((c) => (liked ? c - 1 : c + 1));
    try {
      const res = await toggleVote(floor.id);
      setLiked(res.liked);
      setCount(res.likeCount);
    } catch {
      // 失败回滚
      setLiked((v) => !v);
      setCount(floor.likeCount);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="border-l-2 border-[color:var(--primary)]/30 pl-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-heading text-[11px] text-[color:var(--primary)]">
          {index === 0
            ? t("workshop.originalFloor")
            : t("workshop.floorLabel", { n: index })}
          <span className="ml-2 text-[#8c8570]">
            {floor.authorName || t("workshop.anonymous")}
          </span>
        </span>
        <button
          onClick={() => void like()}
          disabled={pending}
          className={`inline-flex items-center gap-1 text-[11px] ${
            liked ? "text-[color:var(--primary)]" : "text-[#8c8570]"
          }`}
          data-el="hall-like"
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          {count}
        </button>
      </div>
      {index === 0 && (
        <p className="mb-1 font-heading text-sm text-[#f2ead0]">{floor.title}</p>
      )}
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#dcd0a6]">
        {floor.body}
      </p>
    </li>
  );
}

function RelayComposer({
  chain,
  user,
  onDone,
}: {
  chain: WorkshopPost[];
  user: unknown;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { login } = useUser();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const last = chain[chain.length - 1];

  if (!user) {
    return (
      <button
        onClick={login}
        className="mt-3 inline-flex items-center gap-1.5 border border-[color:var(--primary)]/55 px-3 py-2 text-xs text-[color:var(--primary)]"
      >
        <LogIn className="h-3.5 w-3.5" />
        {t("workshop.loginToInteract")}
      </button>
    );
  }

  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await publishToWorkshop({
        storyId: last.storyId,
        storyTitle: last.storyTitle,
        anchorParagraph: last.anchorParagraph,
        enterHint: last.enterHint,
        kind: last.kind,
        title: last.title, // 接力沿用链首标题
        body: text.trim(),
        parentPostId: last.id,
      });
      setText("");
      onDone();
    } catch {
      // 忽略，保留输入
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 border-t border-dashed border-[color:var(--border)] pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 font-heading text-xs text-[color:var(--primary)]">
        <Layers className="h-3.5 w-3.5" />
        {t("workshop.relayTitle")}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("workshop.relayPlaceholder")}
        rows={3}
        className="w-full resize-none border border-[color:var(--border)] bg-[#171817] p-2 text-[13px] leading-relaxed text-[#f2ead0] outline-none focus:border-[color:var(--primary)]/60"
        data-el="hall-relay-input"
      />
      <button
        onClick={() => void submit()}
        disabled={sending || !text.trim()}
        className="mt-2 inline-flex items-center gap-1.5 bg-[color:var(--primary)] px-3 py-2 text-xs text-[#171817] disabled:opacity-50"
        data-el="hall-relay-submit"
      >
        {sending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {sending ? t("workshop.relaying") : t("workshop.relaySubmit")}
      </button>
    </div>
  );
}
