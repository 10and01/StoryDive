"use client";

// 定制剧场 API：上传/粘贴学习材料 → 知识剧场。
// POST 为一次性请求（短文直注或文件上传+首次检索）；平台解析文件是异步的，
// 返回 processing 时用 recallId 轮询 GET，直至 ready / failed。

import { request } from "./request";
import type { TheaterPlay } from "@/lib/theater/types";

export type CustomTheaterResponse =
  | { status: "ready"; play: TheaterPlay }
  | {
      status: "processing";
      recallContentId?: string;
      kbId?: string;
      hint?: string;
    }
  | { status: "failed"; code?: string; message?: string };

export async function postCustomTheater(form: FormData): Promise<CustomTheaterResponse> {
  try {
    const res = await request("/api/theater/custom", { method: "POST", body: form });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: "failed", code: String(data.code ?? `http_${res.status}`) };
    }
    return (await res.json()) as CustomTheaterResponse;
  } catch {
    return { status: "failed", code: "network" };
  }
}

export async function pollCustomTheater(params: {
  recallId: string;
  kbId?: string;
  hint?: string;
}): Promise<CustomTheaterResponse> {
  try {
    const qs = new URLSearchParams({ recallId: params.recallId });
    if (params.kbId) qs.set("kbId", params.kbId);
    if (params.hint) qs.set("hint", params.hint);
    const res = await request(`/api/theater/custom?${qs.toString()}`);
    if (!res.ok) return { status: "failed", code: `http_${res.status}` };
    return (await res.json()) as CustomTheaterResponse;
  } catch {
    return { status: "failed", code: "network" };
  }
}
