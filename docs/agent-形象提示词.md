# 法庭双 Agent 形象生成提示词

> 用法：把下面的提示词喂给你常用的生图工具（Midjourney / SD / 即梦 / 可灵等），
> 生成后裁成**正方形头像**，命名为 `red.png`（烈盐）与 `blue.png`（析盐），
> 放入 `入局/public/court/agents/` 即可自动生效；放图前前端会显示首字徽章兜底。
> 若想生成全身立绘，用同一套提示词 + 「三视图」变体段（见文末），再自行裁头像。

## 风格总纲（两图务必保持一致）

- 世界观锚点：知乎吉祥物**刘看山**（白色北极狐）的同族宇宙；水墨 + 法庭红蓝对赌的东方公堂气质。
- 画面基调：深墨背景（#1c1b15 暖黑），一盏暖黄灯笼光从侧上方打光；笔触带水墨晕染，边缘利落。
- 构图：胸像 / 半身，正面对镜头微侧 15°，眼神坚定看向观众——这是要上法庭海报的角色。
- 两图除配色与服饰符号外，**脸型、体型、画法、光源方向必须一致**（同一角色世界观的对立双生）。
- 建议负面词（Negative prompt）：`realistic photo, 3d render, cute chibi, oversaturated, neon, text, watermark, extra limbs, blurry`

---

## 红方 · 烈盐（故事党）

**中文描述**

> 一只赤红色皮毛的拟人化北极狐辩士，胸像正面像。狐狸长而蓬动的眉毛，赤金色竖瞳眼里燃着不服输的光，嘴角扬起一个"我讲的故事你一定会哭"的自信弧度。颈间围一条如晚霞渐变的绯红围巾，肩头披一件水墨晕染的赤红短褂，褂上一枚白色印章纹样。一缕狐尾毛从画面边缘扫入。背景是暖黑宣纸质感，右上角一点朱红印章光斑，侧上方暖黄灯笼光。水墨插画风格，笔触豪放，颜色克制（绯红+暖黑+米白三色）。

**英文 Prompt（Midjourney / SD 通用）**

```text
anthropomorphic arctic fox advocate, crimson-red fur, half-body portrait facing viewer,
long expressive eyebrows, blazing amber eyes full of conviction, confident smirk of a storyteller,
scarf with sunset-red gradient around neck, ink-wash crimson haori jacket with a white seal emblem,
fluffy tail sweeping into frame, warm dark ink-paper background (#1c1b15), warm lantern light
from upper side, chinese ink painting style, bold expressive brush strokes, restrained palette
(crimson / warm black / cream), dignified courtroom atmosphere, storybook advocate of empathy
--ar 1:1 --style raw
```

## 蓝方 · 析盐（逻辑党）

**中文描述**

> 一只月白偏青灰皮毛的拟人化北极狐辩士，胸像正面像，与烈盐同脸型同画法。狐狸眉形细而平直，冰蓝色细长眼睛半眯，是"我已经看穿三步棋"的冷静眼神，嘴角几不可察地向下一压。颈间系一条靛蓝方巾打得一丝不苟，肩头披一件青灰水墨长褂，褂上用细线绣着一张星图/棋盘纹样。胸前可挂一枚小小的青铜天平坠饰。背景是暖黑宣纸质感，左上角一点靛蓝月光光斑，与烈盐同方向的暖黄灯笼光。水墨插画风格，笔触工整内敛，颜色克制（靛蓝+青灰+暖黑+米白）。

**英文 Prompt（Midjourney / SD 通用）**

```text
anthropomorphic arctic fox advocate, moon-white fur with blue-grey tint, half-body portrait facing viewer,
same fox face structure as companion piece, narrow ice-blue eyes half-lidded, calm piercing gaze of a strategist,
perfectly knotted indigo neck cloth, blue-grey ink-wash robe embroidered with a subtle constellation chessboard pattern,
small bronze scale pendant, warm dark ink-paper background (#1c1b15), same warm lantern light direction,
indigo moonlight accent in corner, chinese ink painting style, precise restrained brush strokes,
limited palette (indigo / slate grey / warm black / cream), dignified courtroom atmosphere, advocate of logic
--ar 1:1 --style raw
```

---

## 一致性技巧

1. **先生成烈盐**，选中满意的一张后，用 Midjourney `--cref <图URL>`（或 SD 的 IP-Adapter/参考图）把脸型锁定，再换配色描述生成析盐。
2. 两图共用同一个 seed（SD）或同一会话参考（即梦/可灵的"角色一致性"功能）。
3. 关键对立只在三处：**配色**（绯红 vs 靛蓝青灰）、**眼神**（燃 vs 半眯）、**服饰纹样**（印章 vs 星图棋盘），其余描述词保持逐字一致。
4. 裁头像时让眼睛落在画面上 1/3 线上，小尺寸（24px）下依然能读出表情。

## 全身立绘 / 三视图变体（可选）

在英文 Prompt 末尾追加：

```text
full body, character turnaround, front view side view back view, standing pose holding a traditional chinese scroll,
plain light background for reference sheet
```

## 兜底说明

图片未放置时，前端 `AgentAvatar` 组件自动以「烈 / 析」首字徽章显示（红蓝配色），
不阻塞任何流程；放入 `public/court/agents/red.png|blue.png` 后刷新即生效。
