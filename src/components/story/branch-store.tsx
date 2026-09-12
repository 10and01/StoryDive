"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useUser } from "@/components/user-profile/user-provider";
import type { StoryBranch } from "@/lib/story/types";
import { fetchBranches, saveBranch } from "@/lib/api/story";

interface BranchStore {
  branches: StoryBranch[];
  ready: boolean;
  authed: boolean;
  add: (input: {
    storyId: string;
    storyTitle: string;
    kind: StoryBranch["kind"];
    anchorParagraph: number;
    parentId?: string | null;
    title: string;
    body: string;
  }) => Promise<void>;
  forStory: (storyId: string) => StoryBranch[];
  refresh: () => Promise<void>;
}

const BranchContext = createContext<BranchStore | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const [branches, setBranches] = useState<StoryBranch[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBranches([]);
      setReady(true);
      return;
    }
    try {
      const rows = await fetchBranches();
      setBranches(rows);
    } catch {
      setBranches([]);
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [authLoading, refresh]);

  const add = useCallback<BranchStore["add"]>(
    async (input) => {
      if (!user) return;
      const saved = await saveBranch(input);
      setBranches((prev) => [saved, ...prev]);
    },
    [user],
  );

  const forStory = useCallback(
    (storyId: string) => branches.filter((b) => b.storyId === storyId),
    [branches],
  );

  return (
    <BranchContext.Provider
      value={{ branches, ready, authed: !!user, add, forStory, refresh }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranches(): BranchStore {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranches must be used within BranchProvider");
  return ctx;
}
