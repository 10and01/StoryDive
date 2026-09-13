# LXGW WenKai GB Screen（霞鹜文楷·GB 屏幕版）

- 来源：npm 包 `lxgw-wenkai-screen-webfont@1.7.0`（字体上游：LXGW WenKai GB，https://github.com/lxgw/LxgwWenKaiGB）
- 授权：SIL Open Font License 1.1（见 `OFL.txt` / `LICENSE`），可自由商用、嵌入、分发，无版权纠纷
- 结构：`lxgw-wenkai-gb-screen.css` 声明 97 个带 `unicode-range` 的 `@font-face` 分片，
  浏览器只下载页面实际用到的字形切片（全量约 4.7MB，单次首屏通常仅几十 KB）
- 引入方式：`src/app/layout.tsx` 直接 import 本目录 css，分片 woff2 由打包器（url() 重写 + content hash）托管，无需放 public
- `font-family` 名称：`LXGW WenKai Screen`（GB 版与原版同名，属官方 drop-in 设计，
  本项目只加载 GB 版以获得最全的简体字库覆盖，避免生僻字缺字回退混排）
- 在 `src/app/globals.css` 的 `--reader-font-wenkai` 中被阅读排版设置引用

其余阅读字体（均 OFL 开源授权，经 next/font/google 构建时自托管，无运行时第三方请求）：

- 思源宋体 Noto Serif SC（`--font-heading`）
- 思源黑体 Noto Sans SC（`--font-sans-sc`）
- Literata（`--font-serif-en`，Google Play Books 阅读衬线体）
- Geist（`--font-sans`）
