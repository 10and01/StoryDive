// 「我的平行结局」——把扁平的用户支线组织成按作品分组的可视化叙事森林。
// 每条支线（对戏/分叉/改写）是一个节点；parentId 指向它「接着往下玩」的来源支线，
// 为空则挂在原著入局点上，成为该作品叙事树的一条根。
import type { StoryBranch } from "./types";

export interface TreeNode {
  branch: StoryBranch;
  depth: number; // 0 = 根支线
  children: TreeNode[];
}

export interface StoryTree {
  storyId: string;
  storyTitle: string;
  roots: TreeNode[];
  total: number; // 该作品下的支线总数
  latestAt: string; // 最近一次生长时间，用于作品间排序
}

/**
 * 将某作品的支线数组构建为父子森林。
 * - 按 createdAt 升序摆放子节点（时间线自上而下），根节点同理。
 * - parentId 指向的父节点若不在集合内（被删除/跨作品脏数据），该节点降级为根。
 * - 环检测：任何回指祖先的节点都被当作根，避免无限递归。
 */
export function buildStoryForest(branches: StoryBranch[]): StoryTree[] {
  const byStory = new Map<string, StoryBranch[]>();
  for (const b of branches) {
    const arr = byStory.get(b.storyId) ?? [];
    arr.push(b);
    byStory.set(b.storyId, arr);
  }

  const trees: StoryTree[] = [];
  for (const [storyId, list] of byStory) {
    const asc = [...list].sort(
      (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
    );
    const nodeById = new Map<string, TreeNode>();
    for (const b of asc) nodeById.set(b.id, { branch: b, depth: 0, children: [] });

    const roots: TreeNode[] = [];
    for (const b of asc) {
      const node = nodeById.get(b.id)!;
      const parent = b.parentId ? nodeById.get(b.parentId) : undefined;
      if (parent && !createsCycle(parent, b.id, nodeById)) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // 计算 depth（BFS）
    const queue: TreeNode[] = roots.map((r) => {
      r.depth = 0;
      return r;
    });
    while (queue.length) {
      const n = queue.shift()!;
      for (const c of n.children) {
        c.depth = n.depth + 1;
        queue.push(c);
      }
    }

    const latestAt = asc.reduce(
      (acc, b) => (b.createdAt > acc ? b.createdAt : acc),
      asc[0]?.createdAt ?? "",
    );
    trees.push({
      storyId,
      storyTitle: asc[asc.length - 1]?.storyTitle ?? storyId,
      roots,
      total: asc.length,
      latestAt,
    });
  }

  // 作品间：最近生长的排在最前
  trees.sort((a, b) => +new Date(b.latestAt) - +new Date(a.latestAt));
  return trees;
}

// 若把 childId 挂到 candidateParent 下会形成环（candidateParent 本身是 childId 的后代），返回 true。
function createsCycle(
  candidateParent: TreeNode,
  childId: string,
  nodeById: Map<string, TreeNode>,
): boolean {
  let cur: TreeNode | undefined = candidateParent;
  const seen = new Set<string>();
  while (cur) {
    if (cur.branch.id === childId) return true;
    if (seen.has(cur.branch.id)) return true;
    seen.add(cur.branch.id);
    const pid: string | null = cur.branch.parentId;
    cur = pid ? nodeById.get(pid) : undefined;
  }
  return false;
}

/** 展平成带层级的线性列表，供缩进式渲染使用（保持父子相邻的深度优先顺序）。 */
export function flattenTree(roots: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    out.push(n);
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}
