import { request } from "./request";
import type { TheaterPlay } from "@/lib/theater/types";

// 拉取一局盐灵剧场（服务端生成/兜底）。
export async function fetchTheaterPlay(): Promise<TheaterPlay> {
  const res = await request("/api/theater", { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { play: TheaterPlay };
  return data.play;
}
