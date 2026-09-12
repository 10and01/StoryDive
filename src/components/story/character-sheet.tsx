"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StoryCharacter } from "@/lib/story/types";
import { cn } from "@/utils/utils";

/**
 * Character detail sheet opened by tapping a character node on the story
 * graph. Shows the generated portrait plus persona/stance so the graph
 * doubles as a cast index, not just a relationship diagram.
 */
export function CharacterSheet({
  character,
  open,
  onClose,
}: {
  character: StoryCharacter | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!character) return null;

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
          marginBottom: "var(--safe-area-bottom, max(34px, env(safe-area-inset-bottom, 0px)))",
        }}
        aria-hidden={!open}
        data-el="character-sheet"
      >
        <div className="relative">
          {character.portrait && (
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
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center border border-[color:var(--primary)]/60 bg-[#171817]/70"
          >
            <X className="h-4 w-4 text-[color:var(--rs-ink)]" />
          </button>
        </div>
        <div className="p-4">
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
        </div>
      </section>
    </>
  );
}
