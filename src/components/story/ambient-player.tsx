"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import type { AmbientMoodName } from "@/lib/story/ambient";
import { AMBIENT_TRACKS } from "@/lib/story/ambient";

const STORAGE_KEY = "ruju-ambient-on";
const TARGET_VOLUME = 0.55;

export type AmbientMood = AmbientMoodName;

/**
 * 阅读器的环境背景音乐：按每篇作品的氛围基调播放一首免版权（CC-BY）氛围曲，
 * 同源存放于 /public/ambient，循环播放并带淡入淡出。默认关闭（尊重自动播放礼仪），
 * 开关状态存 localStorage。切换作品/基调时自动换曲。
 */
export function AmbientPlayer({
  mood = "calm",
  label,
  className,
}: {
  mood?: AmbientMood;
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearFade() {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }

  // 淡入/淡出音量
  function fadeTo(target: number, onDone?: () => void) {
    const el = audioRef.current;
    if (!el) return;
    clearFade();
    fadeRef.current = setInterval(() => {
      const step = 0.06;
      if (Math.abs(el.volume - target) <= step) {
        el.volume = target;
        clearFade();
        onDone?.();
        return;
      }
      el.volume = el.volume < target ? el.volume + step : el.volume - step;
    }, 60);
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (on) {
      el.volume = 0;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => fadeTo(TARGET_VOLUME)).catch(() => {
          // 自动播放被拦截（需用户手势）——回退到关闭态，等待再次点击
          setOn(false);
        });
      } else {
        fadeTo(TARGET_VOLUME);
      }
    } else {
      fadeTo(0, () => {
        try {
          el.pause();
        } catch {
          /* ignore */
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  // 切换作品/基调时，若正在播放则平滑换曲
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !on) return;
    el.load();
    el.volume = 0;
    el.play().then(() => fadeTo(TARGET_VOLUME)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      clearFade();
      try {
        el?.pause();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <>
      <audio ref={audioRef} src={AMBIENT_TRACKS[mood]} loop preload="none" />
      <button
        onClick={() => setOn((v) => !v)}
        data-el="ambient-toggle"
        aria-pressed={on}
        title={label}
        className={cn(
          "flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
          on
            ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.12] text-[color:var(--primary)]"
            : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
          className,
        )}
      >
        {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        {on ? t("ambient.on") : t("ambient.off")}
      </button>
    </>
  );
}
