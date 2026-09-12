"use client";

import Image from "next/image";
import { X, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GraphNode, StoryCharacter } from "@/lib/story/types";
import { cn } from "@/utils/utils";

const KIND_LABEL: Record<GraphNode["kind"], string> = {
  character: "graph.legendCharacter",
  event: "graph.legendEvent",
  choice: "graph.legendChoice",
};
const KIND_COLOR: Record<GraphNode["kind"], string> = {
  character: "var(--primary)",
  event: "var(--rs-cool)",
  choice: "var(--rs-warm)",
};

/**
 * Unified node-detail sheet opened by tapping ANY node on the story graph.
 *  - character node → shows the generated portrait + role + persona + stance
 *  - event / choice node → shows the kind badge + label + brief description,
 *    plus (for a choice) a hint to open its enter point.
 * This makes every graph node interactive, not just characters.
 */
export function NodeSheet({
  node,
  character,
  open,
  onClose,
  onOpenEnter,
  onTalk,
  canTalk = false,
}: {
  node: GraphNode | null;
  character: StoryCharacter | null;
  open: boolean;
  onClose: () => void;
  // 抉择节点：点击后跳去对应入局点开启对戏/分叉/改写
  onOpenEnter?: () => void;
  // 人物节点：点击后直接开启与该人物的对戏面板
  onTalk?: () => void;
  // 该人物是否存在可对戏的入局点
  canTalk?: boolean;
}) {
  const { t } = useTranslation();
  if (!node) return null;

  const isCharacter = node.kind === "character" && character;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden />
      )}
      <section
        className={cn(
          "fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[480px] border border-[color:var(--primary)]/60 bg-[#211f18] shadow-[0_22px_60px_rgba(0,0,0,.58)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-[130%]",
        )}
        style={{
          marginBottom:
            "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
        }}
        aria-hidden={!open}
        data-el="node-sheet"
      >
        <div className="relative">
          {isCharacter && character?.portrait && (
            <div className="relative h-56 w-full overflow-hidden">
              <Image
                src={character.portrait}
                alt={character.name}
                fill
                unoptimized
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#211f18] via-transparent to-transparent" />
            </div>
          )}
          {!isCharacter && node.image && (
            <div className="relative h-48 w-full overflow-hidden">
              <Image
                src={node.image}
                alt={node.label}
                fill
                unoptimized
                className="scale-105 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#211f18] via-[#211f18]/30 to-transparent" />
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_50px_rgba(13,14,12,0.85)]" />
            </div>
          )}
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center border border-[color:var(--primary)]/60 bg-[#171817]/70"
          >
            <X className="h-4 w-4 text-[color:var(--rs-ink)]" />
          </button>
        </div>

        <div className="p-4">
          {/* kind badge for every node */}
          <span
            className="mb-2 inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] tracking-[0.08em]"
            style={{
              color: KIND_COLOR[node.kind],
              background: `color-mix(in srgb, ${KIND_COLOR[node.kind]} 16%, transparent)`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: KIND_COLOR[node.kind] }}
            />
            {t(KIND_LABEL[node.kind])}
          </span>

          {isCharacter && character ? (
            <>
              <h2 className="font-heading text-2xl text-[color:var(--rs-ink)]">
                {character.name}
              </h2>
              <p className="mt-0.5 text-xs tracking-[0.1em] text-[color:var(--primary)]">
                {character.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#d9ca9b]">
                {character.persona}
              </p>
              <p className="mt-2.5 border-l-2 border-[color:var(--rs-cool)] pl-2.5 text-xs leading-relaxed text-[color:var(--rs-cool)]">
                {character.stance}
              </p>
              {canTalk && onTalk && (
                <button
                  onClick={onTalk}
                  className="mt-3.5 flex w-full items-center justify-center gap-1.5 border border-[color:var(--primary)]/60 bg-[color:var(--primary)]/[0.12] px-3 py-2 text-sm text-[color:var(--primary)]"
                  data-el="node-talk"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("graph.talkTo", { name: character.name })}
                </button>
              )}
            </>
          ) : (
            <>
              <h2 className="font-heading text-xl text-[color:var(--rs-ink)]">
                {node.label}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#d9ca9b]">
                {node.brief || t("graph.nodeNoBrief")}
              </p>
              {node.kind === "choice" && onOpenEnter && (
                <button
                  onClick={onOpenEnter}
                  className="mt-3.5 w-full border border-[color:var(--rs-warm)]/60 bg-[color:var(--rs-warm)]/[0.12] px-3 py-2 text-sm text-[color:var(--rs-warm)]"
                  data-el="node-open-enter"
                >
                  {t("graph.openEnter")}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
