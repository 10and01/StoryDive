import { defineConfig } from "drizzle-kit";

// D1 = SQLite 方言。只用于 `drizzle-kit generate` 生成迁移 SQL，
// 迁移应用走 `wrangler d1 migrations apply DB --local|--remote`。
export default defineConfig({
  schema: "./src/lib/db/schema",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
});
