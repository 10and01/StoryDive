"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchUserProfile, type UserProfile } from "@/lib/api/user-profile";

interface UserStore {
  user: UserProfile | null;
  loading: boolean;
  /** 知乎 OAuth 是否已在服务端配置（决定是否显示「知乎登录」入口） */
  oauthConfigured: boolean;
  refresh: () => Promise<void>;
  /** 跳转知乎登录（未配置时服务端会带回错误参数并落回首页） */
  login: () => void;
  logout: () => void;
}

const UserContext = createContext<UserStore | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthConfigured, setOauthConfigured] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchUserProfile();
      setUser(result.user);
      setOauthConfigured(result.oauthConfigured);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.assign("/api/auth/login");
  }, []);

  const logout = useCallback(() => {
    window.location.assign("/api/auth/logout");
  }, []);

  const value = useMemo(
    () => ({ user, loading, oauthConfigured, refresh, login, logout }),
    [user, loading, oauthConfigured, refresh, login, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserStore {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
