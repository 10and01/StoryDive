# 入局

知乎盐言故事的互动叙事游乐场：读者「入局」一个名场面，与角色对戏、推演分叉、改写剧情，走出自己的结局。围绕名场面的社交玩法包括：二创工坊（接力盖楼 + 点赞）、名场面法庭（红蓝对赌投票）、盐灵剧场（热榜话题驱动的每日一局）。

技术栈：Next.js 16（App Router）+ React 19 + TypeScript + Tailwind v4 + Drizzle ORM（Cloudflare D1 / SQLite）+ OpenAI 兼容协议 AI + 知乎开放平台 API。部署目标为 **Cloudflare Workers**（OpenNext 适配）。

## 本地开发

```bash
bun install            # 安装依赖
cp .env.example .env   # 填入密钥（见下）
bun run db:migrate:local  # 初始化本地 D1（miniflare 本地 SQLite）
bun run dev            # opennextjs-cloudflare dev，本地注入 CF 绑定
```

打开 http://localhost:3000。

## 环境变量（.env）

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | AI 网关密钥（必填，AI 功能由此驱动） |
| `OPENAI_BASE_URL` | 默认 `https://api.openai-next.com/v1`（OpenAI 兼容协议） |
| `OPENAI_MODEL` | 默认 `deepseek-v4-flash` |
| `SESSION_SECRET` | 会话 Cookie 的 HMAC 签名密钥（生产必填，随机 32+ 字节） |
| `ZHIHU_ACCESS_SECRET` | 知乎开放平台 Access Secret（热榜 + 用户数据 API） |
| `ZHIHU_OAUTH_APP_ID` / `ZHIHU_OAUTH_APP_KEY` | 知乎黑客松 OAuth 凭证（赛事页面分配） |
| `ZHIHU_OAUTH_REDIRECT_URI` | 可选，默认 `{站点}/api/auth/callback`，需与赛事页面登记值完全一致 |
| `NEXT_PUBLIC_APP_TITLE` / `NEXT_PUBLIC_APP_DESCRIPTION` | 站点元信息 |
| `NEXT_PUBLIC_SITE_URL` | 可选，分享卡片的规范域名 |

> 未配置 OAuth 时，站点自动进入游客会话模式（middleware 发放签名游客身份），全部玩法可用。

## 部署到 Cloudflare

```bash
# 1. 登录并创建 D1 数据库
npx wrangler login
npx wrangler d1 create ruju-db
# 把返回的 database_id 填入 wrangler.jsonc

# 2. 应用远程迁移
bun run db:migrate:remote

# 3. 配置生产密钥（Workers Secrets）
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ZHIHU_ACCESS_SECRET
npx wrangler secret put ZHIHU_OAUTH_APP_ID
npx wrangler secret put ZHIHU_OAUTH_APP_KEY

# 4. 首次部署时在 Cloudflare 控制台为 Worker 绑定自定义域名，并在赛事页面登记回调：
#    https://<你的域名>/api/auth/callback

# 5. 构建 + 部署
bun run deploy
```

## 架构速览

- `src/lib/ai-client.ts` — OpenAI 兼容协议客户端（openai SDK，`api.openai-next.com`，DeepSeek v4 flash），服务端所有 AI 能力（对戏/群像/分叉/改写/复盘/法庭/剧场）统一走这里。
- `src/lib/theater/hotlist.ts` — 知乎热榜（`developer.zhihu.com/api/v1/content/hot_list`）+ 「一天一取」缓存 + 按日确定性轮换；未配置密钥时降级本地话题池。
- `src/lib/auth/` — 知乎黑客松 OAuth 登录（`/api/auth/login` → `openapi.zhihu.com/authorize` → `/api/auth/callback` 换 token）+ 签名会话 Cookie + 游客兜底（middleware）。
- `src/lib/db/` — Drizzle（SQLite 方言）+ Cloudflare D1 绑定，惰性初始化。迁移用 `drizzle-kit generate` 生成、`wrangler d1 migrations apply` 应用。
- `wrangler.jsonc` — Workers 入口 `.open-next/worker.js`、D1 绑定、静态资源。
- `open-next.config.ts` — OpenNext 适配配置。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `bun run dev` | 本地开发（含 CF 绑定） |
| `bun run build` | OpenNext 构建 |
| `bun run deploy` | 构建 + 部署到 Cloudflare |
| `bun run db:generate` | 由 schema 生成迁移 SQL |
| `bun run db:migrate:local` / `db:migrate:remote` | 应用迁移（本地 / 远程 D1） |
| `bun run cf-typegen` | 变更 wrangler.jsonc 绑定后重新生成类型 |
| `bun run lint` | ESLint |

## 说明

- 故事配图仍托管于原 CDN（`cdn.eazo.ai`，公开可访问）；分享海报 canvas 需要同源像素，由 `/api/img-proxy` 代理。如需彻底迁移资产，将图片搬到 R2/自有存储后替换各 story 文件里的 `const P` / `const IMG` 基址即可。
- MCP 端点 `/api/mcp` 提供站内工具协议入口（需会话）。
