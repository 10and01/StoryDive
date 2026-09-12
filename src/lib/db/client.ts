import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let instance: DB | null = null;

function getDbInstance(): DB {
  if (!instance) {
    // Cloudflare Workers / 本地 miniflare（opennextjs-cloudflare dev）都经 wrangler 绑定取 D1
    instance = drizzle(getCloudflareContext().env.DB as D1Database, { schema });
  }
  return instance;
}

// 惰性代理：模块导入阶段不触碰 Cloudflare 上下文（next build 收集页面数据时它不存在），
// 首次真正查询时才初始化。调用方用法不变：import { db } from "@/lib/db/client"。
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDbInstance() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
