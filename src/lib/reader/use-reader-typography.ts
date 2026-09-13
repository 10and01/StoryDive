"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  READER_TYPOGRAPHY_DEFAULTS,
  applyReaderTypography,
  getReaderTypography,
  persistReaderTypography,
  sanitizeReaderTypography,
  type ReaderTypography,
} from "@/lib/reader/typography";

/**
 * 阅读页专属 hook：以模块级 store 订阅排版设置（useSyncExternalStore，
 * 避免 effect 内 setState），调整即时生效并双写持久化。
 */

let cached: ReaderTypography | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ReaderTypography {
  if (!cached) cached = getReaderTypography();
  return cached;
}

function getServerSnapshot(): ReaderTypography {
  return READER_TYPOGRAPHY_DEFAULTS;
}

export function useReaderTypography() {
  // 水合时按 SSR 快照（默认值）渲染，随后切到客户端快照，无水合错配
  const typography = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // cookie 提供的 SSR 变量与 localStorage 不一致时（cookie 被清理等），兜底校正
  useEffect(() => {
    applyReaderTypography(getSnapshot());
  }, []);

  const update = useCallback((patch: Partial<ReaderTypography>) => {
    const next = sanitizeReaderTypography({ ...getSnapshot(), ...patch });
    applyReaderTypography(next);
    persistReaderTypography(next);
    cached = next;
    notify();
  }, []);

  const reset = useCallback(() => {
    update(READER_TYPOGRAPHY_DEFAULTS);
  }, [update]);

  return { typography, update, reset };
}
