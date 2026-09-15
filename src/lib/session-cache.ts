// 会话级当日缓存：localStorage + 当天日期戳，隔天自动失效。
// 用途：剧场/法庭这类「现生成」内容在路由切换、页面刷新后直接恢复，
// 不再重复触发 AI 生成；生成期间也可先落一版彩排内容占位。

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DayCache<T> {
  day: string;
  data: T;
}

// 读取当日缓存：日期不是今天一律视为未命中（返回 null 并顺手清掉）。
export function readDayCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DayCache<T>;
    if (parsed?.day !== todayKey() || parsed.data == null) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

// 写入当日缓存；quota 满等原因失败时静默放弃（缓存只是加速，不是数据源）。
export function writeDayCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const payload: DayCache<T> = { day: todayKey(), data };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function clearDayCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
