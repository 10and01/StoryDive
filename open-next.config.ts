import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext Cloudflare 适配配置。
// 本站为动态渲染（AI/数据库路由）+ 静态页面，无需额外的 R2/KV 增量缓存；
// 如后续启用 ISR，可在此挂载 incrementalCache / tagCache。
export default defineCloudflareConfig({});
