# Agent Guide

「入局」是一个部署在 Cloudflare Workers 上的 Next.js 互动叙事应用（知乎黑客松参赛项目）。

## Scope

本文件约束生成代码质量：框架约定、目录结构、i18n、认证与 AI 接入边界、CSS 规则、组件结构与校验命令。

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Bun（包管理）。
- 部署：Cloudflare Workers（OpenNext，`@opennextjs/cloudflare`）；数据库为 Cloudflare D1（Drizzle SQLite 方言）。
- AI：OpenAI 兼容协议（`openai` SDK，见 `src/lib/ai-client.ts`），模型/网关由 `OPENAI_BASE_URL` / `OPENAI_MODEL` 环境变量驱动。服务端 AI 调用统一 import `appAi` from `@/lib/ai-client`，不要手写 fetch 或把密钥暴露到客户端。
- 认证：签名会话 Cookie（`src/lib/auth/session.ts`）+ 知乎黑客松 OAuth（`/api/auth/*`）。API 路由用 `await requireAuth(request)` 判权；不要自造鉴权。middleware 负责游客兜底。
- 知乎开放平台：热榜/用户数据 API 带 `Authorization: Bearer ${ZHIHU_ACCESS_SECRET}` + `X-Request-Timestamp`（秒级）；有日额度限制，必须在应用层做缓存/去重（参考 `src/lib/theater/hotlist.ts` 的「一天一取」）。
- shadcn/ui source components, lucide-react, framer-motion。
- App UI i18n：`i18next` + `react-i18next`，`en-US` 与 `zh-CN` 两份资源。

## Generated App Contract

- `src/` 内不要出现任何平台的硬编码密钥或第三方平台 SDK；密钥一律走环境变量（见 `.env.example`）。
- 服务端模块边界：API 路由只做参数校验 + 调 `src/lib/db/queries`（D1）与 `src/lib/ai-client`（AI）；业务逻辑放 `src/lib`。
- 数据库 schema 变更：改 `src/lib/db/schema/*.ts` → `bun run db:generate` 生成迁移 → `bun run db:migrate:local`（本地）验证。SQLite 方言：时间戳用 `integer({ mode: "timestamp" })`，无 `::int` 断言，无 pg 专有语法。
- 改 `wrangler.jsonc` 绑定后运行 `bun run cf-typegen` 更新 `cloudflare-env.d.ts`。
- D1 客户端 `src/lib/db/client.ts` 是惰性 Proxy：不要在模块顶层触碰 `getCloudflareContext()`。
- CSS：禁用内联安全区 hack；使用 `var(--safe-area-top/-bottom, env(safe-area-inset-*))`。
- 新 UI 文案必须同时补 `src/i18n/locales/zh-CN.json` 与 `en-US.json`。

## Validation

提交前依次通过：

```bash
./node_modules/.bin/tsc --noEmit   # 类型检查
./node_modules/.bin/next build     # 构建（standalone）
bun run lint                       # ESLint（历史遗留 4 处 set-state-in-effect 告警除外）
```

## Known Notes

- 故事配图引用 `cdn.eazo.ai` 公开 CDN（内容资产，非平台依赖）；海报 canvas 依赖 `/api/img-proxy` 同源代理。
- OpenNext 在 Windows 本机构建会有兼容性警告；部署请在 WSL/Linux/CI 或忽略警告执行 `bun run deploy`。
- 本机未装 bun 时，OpenNext CLI 内部调用 `bun` 会失败：可 `./node_modules/.bin/next build && ./node_modules/.bin/opennextjs-cloudflare build --skipNextBuild` 等价替代。
- **Windows 本地部署配方**（2026-09 实测）：
  1. `./node_modules/.bin/next build`
  2. `taskkill //F //IM workerd.exe`（`initOpenNextCloudflareForDev` 拉起的代理进程会锁住 `.open-next/assets`，导致 OpenNext 清目录 EPERM）
  3. `rm -rf .open-next && ./node_modules/.bin/opennextjs-cloudflare build --skipNextBuild`
  4. `mv open-next.config.ts open-next.config.ts.bak && npx wrangler deploy && mv open-next.config.ts.bak open-next.config.ts`
     （wrangler 检测到 open-next.config.ts 会委派给 opennextjs-cloudflare，后者在此环境因非 ASCII 路径/npx 解析失败，直接移开配置绕过）
- 线上：`https://storydive-10wtw01.org`（自定义域，workers.dev 在国内被墙）；Git push 自动构建部署。
