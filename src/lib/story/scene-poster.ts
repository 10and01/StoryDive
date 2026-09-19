// 「名场面分享卡」——把一段对戏/群戏 + 角色头像绘制成竖版海报（PNG data URL）。
// 纯客户端 canvas 绘制；远程头像跨域失败时静默跳过头像，海报仍可导出。
import type { Story } from "@/lib/story/types";

export interface SceneLine {
  speaker: string; // 说话者名；"我" 表示读者
  isUser: boolean;
  text: string;
  portrait?: string; // 角色头像 URL（读者行无）
}

// 把保存的支线正文（每行 "名字：内容" 或 "我：内容"）解析成带头像的台词行。
export function parseSceneBody(body: string, story: Story | undefined): SceneLine[] {
  const chars = story?.characters ?? [];
  return body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): SceneLine => {
      const m = line.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
      if (!m) return { speaker: "", isUser: false, text: line };
      const name = m[1].trim();
      const text = m[2].trim();
      if (name === "我") return { speaker: "我", isUser: true, text };
      const c = chars.find((x) => x.name === name || name.includes(x.name));
      return { speaker: name, isUser: false, text, portrait: c?.portrait };
    });
}

// 该锚点所在章节的场景图（作海报背景）
export function sceneImageAt(story: Story | undefined, anchor: number): string | undefined {
  if (!story) return undefined;
  let start = 0;
  for (const ch of story.chapters) {
    const end = start + ch.paragraphs.length - 1;
    if (anchor >= start && anchor <= end) return ch.sceneImage;
    start = end + 1;
  }
  return story.chapters[0]?.sceneImage;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // 远程 CDN 图不返回 CORS 头；统一走同源图片代理。
  const isRemote =
    /^https?:\/\//i.test(url) && !url.startsWith(window.location.origin);
  const src = isRemote ? `/api/img-proxy?url=${encodeURIComponent(url)}` : url;

  // 首选：fetch 成 blob（同源）再用 objectURL 加载。blob: 同源，画进 canvas 不会污染，最稳。
  try {
    const resp = await fetch(src, { cache: "force-cache" });
    if (resp.ok) {
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const im = new Image();
        const timer = setTimeout(() => resolve(null), 8000);
        im.onload = () => {
          clearTimeout(timer);
          resolve(im);
        };
        im.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        im.src = objUrl;
      });
      URL.revokeObjectURL(objUrl);
      if (img) return img;
    }
  } catch {
    // 落到下面的直接加载兜底
  }

  // 兜底：直接用 <img> 加载同源代理地址（不设 crossOrigin，同源不污染）
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: HTMLImageElement | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      finish(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = src;
  });
}

// 简易自动换行
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") {
      out.push(line);
      line = "";
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      out.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

export interface PosterInput {
  storyTitle: string;
  author: string;
  source: string;
  kindLabel: string; // 对戏 / 群像 / 分叉 / 改写
  cardTitle: string; // 支线标题
  lines: SceneLine[];
  coverImage?: string; // 小说封面/旧物插画，作海报整体背景
  coverCandidates?: string[]; // 备用封面候选（主封面加载失败时依次尝试）
  brand: string; // 「入局 · 名场面」
  readerLabel: string; // 「我」在海报里的显示名
}

const W = 720;
const H = 1280;
const PAD = 56;

// 生成竖版海报 PNG data URL；跨域污染导致导出失败时返回 null。
export async function renderScenePoster(input: PosterInput): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 背景底色
  ctx.fillStyle = "#171817";
  ctx.fillRect(0, 0, W, H);

  // 封面图：占上半部作主视觉（明亮可见），无图时用暖色底衬托
  const coverH = Math.round(H * 0.5);
  let hasCover = false;
  const candidates = [
    input.coverImage,
    ...(input.coverCandidates ?? []),
  ].filter((u): u is string => !!u);
  for (const url of candidates) {
    const img = await loadImage(url);
    if (img) {
      hasCover = true;
      const scale = Math.max(W / img.width, coverH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, coverH);
      ctx.clip();
      ctx.drawImage(img, (W - dw) / 2, (coverH - dh) / 2, dw, dh);
      ctx.restore();
      break;
    }
  }
  if (!hasCover) {
    // 无封面兜底：暖色斜向渐变，避免纯黑
    const warm = ctx.createLinearGradient(0, 0, W, coverH);
    warm.addColorStop(0, "#2c2717");
    warm.addColorStop(1, "#3a2f1a");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, coverH);
  }
  // 顶部轻微压暗让品牌/标题字清晰；封面下缘平滑过渡到正文底色
  const topScrim = ctx.createLinearGradient(0, 0, 0, 140);
  topScrim.addColorStop(0, "rgba(23,24,23,0.55)");
  topScrim.addColorStop(1, "rgba(23,24,23,0)");
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, W, 140);

  const fade = ctx.createLinearGradient(0, coverH - 200, 0, coverH + 40);
  fade.addColorStop(0, "rgba(23,24,23,0)");
  fade.addColorStop(0.7, "rgba(23,24,23,0.85)");
  fade.addColorStop(1, "#171817");
  ctx.fillStyle = fade;
  ctx.fillRect(0, coverH - 200, W, 240);
  // 正文区实底
  ctx.fillStyle = "#171817";
  ctx.fillRect(0, coverH + 40, W, H - coverH - 40);

  // 暖金细边框氛围
  ctx.strokeStyle = "rgba(231,193,91,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  const sceneH = coverH - 20; // 标题基线锚点

  // 标题底部渐暗衬底，保证标题压在封面上也清晰
  const titleScrim = ctx.createLinearGradient(0, sceneH - 150, 0, sceneH + 60);
  titleScrim.addColorStop(0, "rgba(23,24,23,0)");
  titleScrim.addColorStop(1, "rgba(23,24,23,0.8)");
  ctx.fillStyle = titleScrim;
  ctx.fillRect(0, sceneH - 150, W, 210);

  // 品牌角标
  ctx.fillStyle = "#e7c15b";
  ctx.font = "600 26px 'Noto Serif SC', serif";
  ctx.fillText(input.brand, PAD, 60);

  // 作品标题
  ctx.fillStyle = "#f2ead0";
  ctx.font = "700 52px 'Noto Serif SC', serif";
  const titleLines = wrap(ctx, input.storyTitle, W - PAD * 2).slice(0, 2);
  let ty = sceneH - 96;
  for (const l of titleLines) {
    ctx.fillText(l, PAD, ty);
    ty += 58;
  }
  ctx.fillStyle = "#b7ad86";
  ctx.font = "400 24px 'Noto Serif SC', serif";
  ctx.fillText(`${input.kindLabel} · ${input.author}`, PAD, ty + 4);

  // 支线标题
  ctx.fillStyle = "#e7c15b";
  ctx.font = "600 30px 'Noto Serif SC', serif";
  let y = sceneH + 64;
  for (const l of wrap(ctx, input.cardTitle, W - PAD * 2).slice(0, 2)) {
    ctx.fillText(l, PAD, y);
    y += 40;
  }
  y += 18;

  // 台词区
  const avatars = new Map<string, HTMLImageElement | null>();
  for (const ln of input.lines) {
    if (ln.portrait && !avatars.has(ln.portrait)) {
      avatars.set(ln.portrait, await loadImage(ln.portrait));
    }
  }

  const bottomLimit = H - 120;
  ctx.textBaseline = "alphabetic";
  for (const ln of input.lines) {
    if (y > bottomLimit) {
      ctx.fillStyle = "#8c8570";
      ctx.font = "400 22px 'Noto Serif SC', serif";
      ctx.fillText("……", PAD, y);
      break;
    }
    const av = ln.portrait ? avatars.get(ln.portrait) : null;
    const avSize = 52;
    const textX = PAD + avSize + 16;
    const textW = W - textX - PAD;

    // 头像圆形
    if (!ln.isUser) {
      if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(PAD + avSize / 2, y + avSize / 2 - 8, avSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const s = Math.max(avSize / av.width, avSize / av.height);
        ctx.drawImage(
          av,
          PAD + avSize / 2 - (av.width * s) / 2,
          y + avSize / 2 - 8 - (av.height * s) / 2,
          av.width * s,
          av.height * s,
        );
        ctx.restore();
        ctx.strokeStyle = "rgba(231,193,91,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(PAD + avSize / 2, y + avSize / 2 - 8, avSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(231,193,91,0.16)";
        ctx.beginPath();
        ctx.arc(PAD + avSize / 2, y + avSize / 2 - 8, avSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e7c15b";
        ctx.font = "600 24px 'Noto Serif SC', serif";
        ctx.fillText((ln.speaker || "·").slice(0, 1), PAD + avSize / 2 - 12, y + avSize / 2 + 2);
      }
      // 名字
      ctx.fillStyle = "#e7c15b";
      ctx.font = "600 22px 'Noto Serif SC', serif";
      ctx.fillText(ln.speaker, textX, y);
      y += 30;
      // 台词
      ctx.fillStyle = "#dcd0a6";
      ctx.font = "400 26px 'Noto Serif SC', serif";
      for (const l of wrap(ctx, ln.text, textW)) {
        ctx.fillText(l, textX, y);
        y += 36;
      }
      y += 20;
    } else {
      // 读者行：右对齐
      ctx.fillStyle = "#8c8570";
      ctx.font = "600 20px 'Noto Serif SC', serif";
      ctx.textAlign = "right";
      ctx.fillText(input.readerLabel, W - PAD, y);
      y += 28;
      ctx.fillStyle = "#f2ead0";
      ctx.font = "400 25px 'Noto Serif SC', serif";
      for (const l of wrap(ctx, ln.text, W - PAD * 2 - 40)) {
        ctx.fillText(l, W - PAD, y);
        y += 34;
      }
      ctx.textAlign = "left";
      y += 20;
    }
  }

  // 底部版权归属
  ctx.fillStyle = "rgba(140,133,112,0.9)";
  ctx.font = "400 20px 'Noto Serif SC', serif";
  ctx.fillText(`来源 · ${input.source}`, PAD, H - 56);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null; // 跨域污染，改走纯文本分享
  }
}
