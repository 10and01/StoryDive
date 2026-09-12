// 「本庭判词」水墨分享卡：纯客户端 canvas 手绘，不依赖第三方库，不加载远程图（零跨域污染）。
// 竖版宣纸底 + 朱砂印 + 红蓝旗号对峙 + 票比条 + 盐官判词 + 拉票口号 + 预览域名。

export interface CourtPosterInput {
  caseTitle: string; // 案由
  redHeadline: string; // 红方旗号
  blueHeadline: string; // 蓝方旗号
  redVotes: number;
  blueVotes: number;
  verdict: string; // 盐官判词
  rally: string; // 拉票口号
  brand: string; // 品牌角标：名场面法庭
  seal: string; // 朱印字：判
  domain: string; // 预览域名（去协议）
}

const W = 720;
const H = 1280;
const PAD = 60;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

export function renderCourtPoster(input: CourtPosterInput): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const total = input.redVotes + input.blueVotes;
  const redPct = total > 0 ? Math.round((input.redVotes / total) * 100) : 50;
  const bluePct = 100 - redPct;
  const draw = total === 0 || input.redVotes === input.blueVotes;
  const redWin = input.redVotes > input.blueVotes;

  // ── 宣纸暖底 + 细纹晕染 ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#efe6cf");
  bg.addColorStop(1, "#e4d7b6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 随机墨点晕染（确定性伪随机，保证每次一致）
  let s = input.caseTitle.length * 97 + 13;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 20 + rnd() * 90;
    ctx.fillStyle = `rgba(60,50,30,${0.015 + rnd() * 0.02})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 双细边框
  ctx.strokeStyle = "rgba(60,40,20,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = "rgba(120,30,20,0.45)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  // ── 品牌角标 ──
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#8a2417";
  ctx.font = "600 26px 'Noto Serif SC', serif";
  ctx.fillText(input.brand, PAD, 84);

  // ── 大字「判」朱砂印（右上） ──
  ctx.save();
  ctx.fillStyle = "#9a2b1c";
  roundRectPath(ctx, W - PAD - 96, 44, 96, 96, 10);
  ctx.fill();
  ctx.fillStyle = "#f3e9d2";
  ctx.font = "700 64px 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.fillText(input.seal, W - PAD - 48, 116);
  ctx.restore();
  ctx.textAlign = "left";

  // ── 案由 ──
  ctx.fillStyle = "#2b2113";
  ctx.font = "700 44px 'Noto Serif SC', serif";
  const titleLines = wrap(ctx, input.caseTitle, W - PAD * 2).slice(0, 3);
  let ty = 200;
  for (const l of titleLines) {
    ctx.fillText(l, PAD, ty);
    ty += 58;
  }

  // ── 红蓝旗号对峙 ──
  let y = ty + 30;
  drawSide(ctx, "red", "红方", input.redHeadline, PAD, y, W - PAD * 2, redWin && !draw);
  y += 148;
  // 「VS」
  ctx.fillStyle = "#8a2417";
  ctx.font = "700 30px 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.fillText("· 对 ·", W / 2, y - 10);
  ctx.textAlign = "left";
  y += 18;
  drawSide(ctx, "blue", "蓝方", input.blueHeadline, PAD, y, W - PAD * 2, !redWin && !draw);
  y += 158;

  // ── 票比条 ──
  const barW = W - PAD * 2;
  const barH = 46;
  ctx.save();
  roundRectPath(ctx, PAD, y, barW, barH, 8);
  ctx.clip();
  const rw = Math.round((barW * redPct) / 100);
  ctx.fillStyle = "#b23a2a";
  ctx.fillRect(PAD, y, rw, barH);
  ctx.fillStyle = "#3f6c9c";
  ctx.fillRect(PAD + rw, y, barW - rw, barH);
  ctx.restore();
  ctx.fillStyle = "#f3e9d2";
  ctx.font = "700 22px 'Noto Serif SC', serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`红 ${redPct}%`, PAD + 14, y + barH / 2);
  ctx.textAlign = "right";
  ctx.fillText(`${bluePct}% 蓝`, W - PAD - 14, y + barH / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // 票数小字
  ctx.fillStyle = "#5c4a2c";
  ctx.font = "500 18px 'Noto Serif SC', serif";
  ctx.fillText(`红方 ${input.redVotes} 票 · 蓝方 ${input.blueVotes} 票`, PAD, y + barH + 30);
  y += barH + 62;

  // ── 盐官判词 ──
  ctx.fillStyle = "#8a2417";
  ctx.font = "600 22px 'Noto Serif SC', serif";
  ctx.fillText("盐官判词", PAD, y);
  y += 20;
  ctx.strokeStyle = "rgba(138,36,23,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + 4, y + 90);
  ctx.stroke();
  ctx.fillStyle = "#332714";
  ctx.font = "500 28px 'Noto Serif SC', serif";
  const vLines = wrap(ctx, input.verdict, W - PAD * 2 - 24).slice(0, 4);
  let vy = y + 34;
  for (const l of vLines) {
    ctx.fillText(l, PAD + 20, vy);
    vy += 42;
  }

  // ── 拉票口号（底部朱底条） ──
  const rallyY = H - 168;
  ctx.fillStyle = "rgba(154,43,28,0.92)";
  roundRectPath(ctx, PAD, rallyY, W - PAD * 2, 74, 10);
  ctx.fill();
  ctx.fillStyle = "#f6ecd6";
  ctx.font = "700 30px 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  const rallyLines = wrap(ctx, input.rally, W - PAD * 2 - 40).slice(0, 1);
  ctx.fillText(rallyLines[0] ?? input.rally, W / 2, rallyY + 47);

  // ── 预览域名 ──
  ctx.fillStyle = "#6b5636";
  ctx.font = "500 20px 'Noto Serif SC', serif";
  ctx.fillText(input.domain, W / 2, H - 62);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSide(
  ctx: CanvasRenderingContext2D,
  side: "red" | "blue",
  label: string,
  headline: string,
  x: number,
  y: number,
  w: number,
  win: boolean,
) {
  const accent = side === "red" ? "#b23a2a" : "#3f6c9c";
  // 旗号底
  ctx.fillStyle = side === "red" ? "rgba(178,58,42,0.10)" : "rgba(63,108,156,0.10)";
  roundRectPath(ctx, x, y, w, 128, 10);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = win ? 4 : 1.5;
  roundRectPath(ctx, x, y, w, 128, 10);
  ctx.stroke();

  // 标签 + 胜标
  ctx.fillStyle = accent;
  ctx.font = "600 22px 'Noto Serif SC', serif";
  ctx.fillText(label + (win ? " · 胜" : ""), x + 20, y + 38);

  // 旗号
  ctx.fillStyle = "#2b2113";
  ctx.font = "700 30px 'Noto Serif SC', serif";
  const lines = wrap(ctx, headline, w - 40).slice(0, 2);
  let ly = y + 76;
  for (const l of lines) {
    ctx.fillText(l, x + 20, ly);
    ly += 38;
  }
}
