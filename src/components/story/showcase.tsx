"use client";

import Image from "next/image";
import Link from "next/link";
import { STORIES } from "@/lib/story/library";

// 精美作品封面/截图页：整屏海报式展示，适合投稿封面与分享截图。
// 纯静态、无需登录；沿用 App 的墨金质感（近黑底 + 暖金 #d6c08e + 衬线标题）。

const FEATURES: { k: string; title: string; desc: string }[] = [
  { k: "读", title: "逐段沉浸阅读", desc: "下拉即淡入下一段，行至「入局点」自然驻足" },
  { k: "谱", title: "关系图谱入局", desc: "点开人物星链，从任一名场面切入互动" },
  { k: "戏", title: "群像对戏", desc: "多角色同台，既回应你、也彼此接话" },
  { k: "叉", title: "我的平行结局", desc: "按故事聚合分支森林，从任意节点续写" },
  { k: "享", title: "分享名场面", desc: "把你的专属结局，一键生成封面海报" },
];

export function Showcase() {
  // 取若干封面插画拼贴（有 objectImage 的前若干篇）
  const covers = STORIES.filter((s) => s.objectImage).slice(0, 8);
  const hero = covers[0];

  return (
    <div className="relative isolate min-h-[100svh] w-full overflow-hidden">
      <div className="rs-grain" aria-hidden />

      <div
        data-el="showcase-poster"
        className="mx-auto flex min-h-[100svh] w-full max-w-[520px] flex-col px-6 py-10"
      >
        {/* 顶部：出品标识 */}
        <div className="flex items-center justify-between text-[11px] tracking-[0.22em] text-[color:var(--muted-foreground)]">
          <span>入局 · 互动叙事</span>
          <span className="rotate-2 border border-[color:var(--primary)] px-2 py-1 leading-none text-[color:var(--primary)]">
            盐选故事 · 互动改编
          </span>
        </div>

        {/* 主标题 */}
        <header className="mt-8">
          <div className="text-[13px] tracking-[0.3em] text-[color:var(--rs-warm)]">
            RU · SHI
          </div>
          <h1 className="mt-1 font-heading text-[clamp(56px,20vw,96px)] leading-[0.95] tracking-[-0.03em] text-[color:var(--rs-ink)]">
            入局
          </h1>
          <p className="mt-3 font-heading text-[17px] leading-relaxed text-[#d9ca9b]">
            不止是读故事——走进书里，与人物对戏，改写属于你的平行结局。
          </p>
        </header>

        {/* 主视觉：封面拼贴 */}
        <div className="relative mt-8">
          <div className="grid grid-cols-4 gap-1.5">
            {covers.map((s, i) => (
              <div
                key={s.id}
                className={
                  "relative aspect-[3/4] overflow-hidden border border-[color:var(--border)]" +
                  (i === 0 ? " col-span-2 row-span-2 aspect-auto" : "")
                }
              >
                <Image
                  src={s.objectImage}
                  alt={s.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10110f]/70 via-transparent to-transparent" />
              </div>
            ))}
          </div>
          {hero && (
            <div className="pointer-events-none absolute bottom-2 left-2 max-w-[52%]">
              <div className="font-heading text-[15px] leading-tight text-[color:var(--rs-ink)] drop-shadow">
                {hero.title}
              </div>
              <div className="mt-0.5 text-[10px] text-[#d9ca9b]/90">
                {hero.author} · {hero.source ?? "盐选故事"}
              </div>
            </div>
          )}
        </div>

        {/* 玩法亮点 */}
        <ul className="mt-8 grid gap-2.5">
          {FEATURES.map((f) => (
            <li
              key={f.k}
              className="flex items-center gap-3 border border-[color:var(--border)]/70 bg-[color:var(--rs-surface)]/60 px-3 py-2.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center border border-[color:var(--primary)]/50 font-heading text-[17px] text-[color:var(--primary)]">
                {f.k}
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-[15px] text-[color:var(--rs-ink)]">
                  {f.title}
                </span>
                <span className="block truncate text-[12px] text-[color:var(--muted-foreground)]">
                  {f.desc}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/* 数据条 */}
        <div className="mt-8 grid grid-cols-3 border border-[color:var(--border)] text-center">
          <Stat n={`${STORIES.length}+`} label="精选故事" />
          <Stat n="∞" label="平行结局" border />
          <Stat n="AI" label="角色对戏" />
        </div>

        {/* 底部行动 */}
        <div className="mt-auto pt-9">
          <Link
            href="/"
            data-el="showcase-enter"
            className="flex w-full items-center justify-center gap-2 bg-[color:var(--primary)] py-3.5 font-heading text-[16px] tracking-[0.12em] text-[color:var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            进入书架，开始入局 →
          </Link>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
            互动叙事 / 内容赛道 · 正文为原创复述，版权归各原作者所有
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label, border }: { n: string; label: string; border?: boolean }) {
  return (
    <div
      className={
        "px-2 py-3" +
        (border
          ? " border-x border-[color:var(--border)]"
          : "")
      }
    >
      <div className="font-heading text-[28px] leading-none text-[color:var(--primary)]">
        {n}
      </div>
      <div className="mt-1 text-[11px] tracking-[0.14em] text-[color:var(--muted-foreground)]">
        {label}
      </div>
    </div>
  );
}
