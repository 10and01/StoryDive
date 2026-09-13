// 知乎开放平台共享鉴权：Bearer Access Secret + 秒级 X-Request-Timestamp。
// 额度按自然日计（见 zhihu skill references/open-platform.md），
// 每个调用方必须自带缓存/去重；未配置密钥时返回 null，调用方静默降级。

export function hasZhihuSecret(): boolean {
  return Boolean(process.env.ZHIHU_ACCESS_SECRET);
}

export function zhihuHeaders(): Record<string, string> | null {
  const secret = process.env.ZHIHU_ACCESS_SECRET;
  if (!secret) return null;
  return {
    Authorization: `Bearer ${secret}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    "Content-Type": "application/json",
  };
}
