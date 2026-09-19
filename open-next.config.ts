import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from "@opennextjs/cloudflare";

// OpenNext Cloudflare 适配配置。
// 本站为动态渲染（AI/数据库路由）+ 静态页面，无需额外的 R2/KV 增量缓存；
// 如后续启用 ISR，可在此挂载 incrementalCache / tagCache。
const config: OpenNextConfig = {
  ...defineCloudflareConfig({}),
  // Use a stable Node/npm build entry and force production guest permissions
  // to preview mode even when local .env enables the full guest experience.
  buildCommand: "node scripts/build-cloudflare.mjs",
};

export default config;
