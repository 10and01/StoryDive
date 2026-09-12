"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { GraphNode, GraphEdge } from "@/lib/story/types";
import { cn } from "@/utils/utils";

const KIND_COLOR: Record<GraphNode["kind"], string> = {
  character: "var(--primary)",
  event: "var(--rs-cool)",
  choice: "var(--rs-warm)",
};

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

const emptySubscribe = () => () => {};
/** SSR 渲染空星空、客户端渲染星空，避免水合差异（lint 友好的挂载检测）。 */
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/** Deterministic starfield dots — stable per mount, no server/client float mismatch. */
function useStarfield(count: number) {
  const mounted = useMounted();
  const stars = useMemo(() => {
    const f = (n: number, p = 2) => Number(n.toFixed(p));
    return Array.from({ length: count }, (_, i) => {
      const r = (n: number) => {
        const x = Math.sin((i + 1) * n) * 10000;
        return x - Math.floor(x);
      };
      return {
        x: f(r(12.9898) * 100),
        y: f(r(78.233) * 100),
        size: f(0.6 + r(43.14) * 1.6),
        dur: f(2.6 + r(3.7) * 3.4),
        delay: f(-r(11.7) * 4),
        min: f(0.15 + r(9.1) * 0.2),
        max: f(0.6 + r(5.3) * 0.4),
      };
    });
  }, [count]);
  return mounted ? stars : [];
}

/**
 * Constellation-style story graph rendered as SVG over a deep-space
 * starfield. Nodes use normalized 0-100 coordinates.
 *
 * 交互契约：
 * - 轻点节点：聚焦放大并触发 `onNodeClick`（详情抽屉流程不变）
 * - 拖拽节点：改布局（会话内生效，不动原数据）；位移超过阈值视为拖拽、不触发点击
 * - 拖拽背景：平移镜头；聚焦时轻点空白处 / 按 Esc 退出聚焦
 */
export function StoryGraph({
  nodes,
  edges,
  compact = false,
  className,
  onNodeClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  branches?: { id: string; anchorId: string; label: string }[];
  compact?: boolean;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
  onBranchClick?: (branchId: string) => void;
}) {
  const { t } = useTranslation();
  const stars = useStarfield(46);
  const containerRef = useRef<HTMLDivElement>(null);
  const aspect = compact ? 16 / 9 : 4 / 3;

  // 用户拖拽后的节点位置（0-100），按节点 id 记录；换故事/换数据时重置
  // （渲染期比较引用重置，见 React「adjusting state when props change」模式）
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [prevNodes, setPrevNodes] = useState(nodes);
  if (prevNodes !== nodes) {
    setPrevNodes(nodes);
    setPositions({});
  }

  const effNodes = useMemo(
    () => nodes.map((n) => ({ ...n, ...(positions[n.id] ?? {}) })),
    [nodes, positions],
  );
  const byId = useMemo(() => new Map(effNodes.map((n) => [n.id, n])), [effNodes]);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const nodeDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const focusedNode = focusedId ? byId.get(focusedId) ?? null : null;
  const scale = focusedNode ? 1.65 : 1;
  const origin = focusedNode ? `${focusedNode.x}% ${focusedNode.y}%` : "50% 50%";

  // 容器实测尺寸：标签避让在真实像素空间做，跨屏宽都准确
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setBoxSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = boxSize?.w ?? aspect * 100;
  const H = boxSize?.h ?? 100;

  // 边标签布局：中点法线偏移避线 → 选远离节点的一侧 → 再做标签间/标签与节点的
  // 碰撞消解（重叠就竖向推开）。节点被拖动时整体实时重算，用户随便拖都不会糊成一团。
  const edgeLabels = useMemo(() => {
    const px = (xPct: number) => (xPct / 100) * W;
    const py = (yPct: number) => (yPct / 100) * H;
    const LABEL_H = 19; // 胶囊高度（px）
    const GAP = 13; // 离线的法向距离（px）
    const labelW = (text: string) => text.length * 10 + 16;
    const nodeHalfW = (n: { label: string }) => Math.max(10, n.label.length * 10 + 4) / 2;
    const NODE_H = 15; // 节点热区半高（dot+文字）

    interface Placed {
      key: string;
      relation: string;
      x: number; // px
      y: number; // px
      w: number;
      h: number;
    }
    const placed: Placed[] = [];

    const distToNodes = (x: number, y: number) => {
      let d = Infinity;
      for (const n of effNodes) {
        const cx = Math.max(px(n.x) - nodeHalfW(n), Math.min(x, px(n.x) + nodeHalfW(n)));
        const cy = Math.max(py(n.y) - NODE_H, Math.min(y, py(n.y) + NODE_H));
        d = Math.min(d, Math.hypot(x - cx, y - cy));
      }
      return d;
    };

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b || !e.relation) continue;
      const mx = (px(a.x) + px(b.x)) / 2;
      const my = (py(a.y) + py(b.y)) / 2;
      const dx = px(b.x) - px(a.x);
      const dy = py(b.y) - py(a.y);
      const len = Math.hypot(dx, dy) || 1;
      const ux = -dy / len;
      const uy = dx / len;

      // 先选离节点更远的一侧；仍太近则沿法线继续外推
      const cand = (sign: number) => ({ x: mx + ux * sign * GAP, y: my + uy * sign * GAP });
      let pos = cand(1);
      if (distToNodes(cand(-1).x, cand(-1).y) > distToNodes(pos.x, pos.y)) pos = cand(-1);
      for (let guard = 0; distToNodes(pos.x, pos.y) < 12 && guard < 4; guard++) {
        pos = { x: pos.x + ux * 9, y: pos.y + uy * 9 };
      }
      placed.push({
        key: `${e.from}-${e.to}-${i}`,
        relation: e.relation,
        x: pos.x,
        y: pos.y,
        w: labelW(e.relation),
        h: LABEL_H,
      });
    }

    // 碰撞消解：标签-标签、标签-节点，重叠就沿 y 推开（少量迭代即可收敛）
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const A = placed[i];
          const B = placed[j];
          const ox = (A.w + B.w) / 2 - Math.abs(A.x - B.x);
          const oy = (A.h + B.h) / 2 - Math.abs(A.y - B.y);
          if (ox > 0 && oy > 0) {
            B.y += (B.y >= A.y ? 1 : -1) * (oy + 2);
          }
        }
      }
      for (const L of placed) {
        for (const n of effNodes) {
          const ox = nodeHalfW(n) + L.w / 2 - Math.abs(L.x - px(n.x));
          const oy = NODE_H + L.h / 2 - Math.abs(L.y - py(n.y));
          if (ox > 0 && oy > 0) {
            L.y += (L.y >= py(n.y) ? 1 : -1) * (oy + 2);
          }
        }
      }
    }

    return placed.map((L) => ({
      key: L.key,
      relation: L.relation,
      x: Math.min(97, Math.max(3, (L.x / W) * 100)),
      y: Math.min(96, Math.max(4, (L.y / H) * 100)),
    }));
  }, [edges, byId, effNodes, W, H]);

  // 聚焦时按 Esc 退出
  useEffect(() => {
    if (!focusedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFocusedId(null);
        setPan({ x: 0, y: 0 });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId]);

  function onPointerDown(e: React.PointerEvent) {
    // Only the background starts a pan drag; node buttons handle their own click.
    if ((e.target as HTMLElement).closest("[data-el^='graph-node-']")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, dragging: true };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d?.dragging) return;
    const dx = (e.clientX - d.x) / scale;
    const dy = (e.clientY - d.y) / scale;
    dragRef.current = { x: e.clientX, y: e.clientY, dragging: true };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    // 轻点背景（几乎没移动）：聚焦状态下自然退出
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved < 5 && focusedId) {
      setFocusedId(null);
      setPan({ x: 0, y: 0 });
    }
  }

  function handleNodeClick(n: GraphNode) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setFocusedId((cur) => (cur === n.id ? null : n.id));
    setPan({ x: 0, y: 0 });
    onNodeClick?.(n.id);
  }

  // —— 节点拖拽：指针捕获 + 位移阈值区分「拖」与「点」 ——
  // 碰撞感知：目标位置落进其他节点的热区（dot + 文字）时沿边界推开，
  // 手感是节点会「绕着」别的节点滑，落点永不重叠、节点名互不遮挡。
  function nodeHalfW(label: string) {
    return Math.max(14, label.length * 10 + 6) / 2;
  }
  const NODE_HALF_H = 16;

  function onNodePointerDown(e: React.PointerEvent, n: GraphNode) {
    e.stopPropagation();
    const p = positions[n.id] ?? { x: n.x, y: n.y };
    nodeDragRef.current = {
      id: n.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onNodePointerMove(e: React.PointerEvent) {
    const d = nodeDragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    d.moved = true;
    suppressClickRef.current = true;

    // 指针位移 → 画布层像素坐标（聚焦缩放时除以 scale）
    let cx = (d.origX / 100) * rect.width + (e.clientX - d.startX) / scale;
    let cy = (d.origY / 100) * rect.height + (e.clientY - d.startY) / scale;

    const dragNode = effNodes.find((n) => n.id === d.id);
    if (dragNode) {
      const selfW = nodeHalfW(dragNode.label);
      for (let iter = 0; iter < 2; iter++) {
        for (const n of effNodes) {
          if (n.id === d.id) continue;
          const nx = (n.x / 100) * rect.width;
          const ny = (n.y / 100) * rect.height;
          const dx = cx - nx;
          const dy = cy - ny;
          const sx = selfW + nodeHalfW(n.label) - Math.abs(dx);
          const sy = NODE_HALF_H * 2 - Math.abs(dy);
          if (sx > 0 && sy > 0) {
            // 从重叠最浅的方向推出去（推 x 或推 y）
            if (sx / (selfW + nodeHalfW(n.label)) < sy / (NODE_HALF_H * 2)) {
              cx = nx + Math.sign(dx || 1) * (selfW + nodeHalfW(n.label));
            } else {
              cy = ny + Math.sign(dy || 1) * NODE_HALF_H * 2;
            }
          }
        }
      }
    }

    setPositions((prev) => ({
      ...prev,
      [d.id]: {
        x: clamp((cx / rect.width) * 100, 3, 97),
        y: clamp((cy / rect.height) * 100, 6, 94),
      },
    }));
  }
  function onNodePointerUp() {
    nodeDragRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full touch-none select-none overflow-hidden", className)}
      style={{ aspectRatio: compact ? "16 / 9" : "4 / 3" }}
      data-el="story-graph"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* deep-space backdrop + twinkling stars, independent of the pan/zoom camera */}
      <div className="rs-graph-space" aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            className="rs-star-dot"
            style={
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                "--rs-star-dur": `${s.dur}s`,
                "--rs-star-delay": `${s.delay}s`,
                "--rs-star-min": s.min,
                "--rs-star-max": s.max,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* the panned/zoomed camera layer holding the actual constellation */}
      <div
        className="rs-graph-canvas absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
          transformOrigin: origin,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-label={t("graph.title")}
        >
          {edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--rs-line)"
                strokeWidth={0.5}
                strokeDasharray="1.4 2"
                opacity={0.7}
              />
            );
          })}
        </svg>

        {/* 边标签：HTML 胶囊 + 法线避让，字体不随容器比例拉伸 */}
        {edgeLabels.map((l) => (
          <span
            key={l.key}
            aria-hidden
            className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[color:var(--rs-cool)]/25 bg-[#10110f]/80 px-1.5 py-[3px] text-[10px] font-normal leading-none tracking-[0.02em] text-[color:var(--rs-cool)] shadow-[0_1px_4px_rgba(0,0,0,0.5)] backdrop-blur-[2px]"
            style={{ left: `${l.x}%`, top: `${l.y}%` }}
          >
            {l.relation}
          </span>
        ))}

        {/* nodes as absolutely-positioned dots + labels (crisp text, unscaled) */}
        {effNodes.map((n) => {
          const clickable = !!onNodeClick;
          const Tag = clickable ? "button" : "div";
          const isFocused = focusedId === n.id;
          return (
            <Tag
              key={n.id}
              onClick={clickable ? () => handleNodeClick(n) : undefined}
              onPointerDown={clickable ? (e) => onNodePointerDown(e, n) : undefined}
              onPointerMove={clickable ? onNodePointerMove : undefined}
              onPointerUp={onNodePointerUp}
              data-el={clickable ? `graph-node-${n.kind}` : undefined}
              className={cn(
                "absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5",
                clickable && "cursor-grab active:scale-110 active:cursor-grabbing",
              )}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <span
                className={cn(
                  "rs-graph-node-glow h-2.5 w-2.5 rounded-full",
                  clickable && "ring-2 ring-offset-1 ring-offset-transparent",
                  isFocused && "scale-125",
                )}
                style={{
                  background: KIND_COLOR[n.kind],
                  color: KIND_COLOR[n.kind],
                  boxShadow: `0 0 10px ${KIND_COLOR[n.kind]}`,
                }}
              />
              <span className="whitespace-nowrap text-[10px] leading-none text-[color:var(--rs-ink)] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                {n.label}
              </span>
            </Tag>
          );
        })}
      </div>

      {/* cinematic vignette that deepens when a node is focused */}
      <div className="rs-graph-vignette" style={{ opacity: focusedNode ? 1 : 0.35 }} aria-hidden />

      {/* 聚焦提示：自动淡出，退出靠轻点空白处或 Esc，不再放常驻按钮 */}
      {focusedNode && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
          <span className="graph-focus-hint rounded-full border border-[color:var(--primary)]/30 bg-[#10110f]/80 px-3 py-1 text-[10px] tracking-[0.08em] text-[color:var(--primary)]/90 backdrop-blur-sm">
            {t("graph.tapEmptyToExit")}
          </span>
        </div>
      )}
    </div>
  );
}

export function GraphLegend() {
  const { t } = useTranslation();
  const items = [
    { c: "var(--primary)", k: "graph.legendCharacter" },
    { c: "var(--rs-cool)", k: "graph.legendEvent" },
    { c: "var(--rs-warm)", k: "graph.legendChoice" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--muted-foreground)]">
      {items.map((it) => (
        <span key={it.k} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: it.c, boxShadow: `0 0 8px ${it.c}` }}
          />
          {t(it.k)}
        </span>
      ))}
    </div>
  );
}
