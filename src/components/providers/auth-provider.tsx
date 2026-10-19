"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createIDBPersister } from "@/lib/query/persister";

export interface UserSession {
  id?: number;
  name: string;
  email: string | null;
  role: string;
  initials?: string | null;
  role_id?: number;
  username?: string;
  must_change_password?: boolean;
}

interface AuthContextType {
  currentUser: UserSession | null;
  isSessionLoaded: boolean;
  setUser: (user: UserSession | null) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isSessionLoaded: false,
  setUser: () => {},
  refreshSession: async () => {},
  logout: async () => {},
});

const SESSION_STORAGE_KEY = "starmould_user_session";

export function getCachedSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed.role_id !== undefined || parsed.role)) {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: UserSession | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Synchronous initial state resolution: SSR initialUser -> LocalStorage cached session -> null
  const [currentUser, setCurrentUserState] = useState<UserSession | null>(() => {
    if (initialUser) return initialUser;
    return getCachedSession();
  });
  const [isSessionLoaded, setIsSessionLoaded] = useState<boolean>(() => {
    return Boolean(initialUser || getCachedSession());
  });

  const setUser = useCallback((user: UserSession | null) => {
    setCurrentUserState(user);
    setIsSessionLoaded(true);
    if (typeof window !== "undefined") {
      try {
        if (user) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        // Only wipe session if server explicitly returned 401 Unauthorized
        setUser(null);
        return;
      }
      if (!res.ok) {
        // Transient server/network error (500, 502, timeout) — retain existing cached session
        setIsSessionLoaded(true);
        return;
      }
      const data = await res.json();
      if (data?.user) {
        const formattedUser: UserSession = {
          id: data.user.id,
          name: data.user.name || data.user.username || "User",
          username: data.user.username,
          email: data.user.email || "",
          role: data.user.role || "Worker",
          initials:
            data.user.initials ||
            data.user.name?.slice(0, 2).toUpperCase() ||
            "SM",
          role_id: data.user.role_id,
          must_change_password: data.user.must_change_password === true,
        };
        // Update state and cache only if data has changed to prevent UI re-render flickers
        setCurrentUserState((prev) => {
          if (
            prev &&
            prev.id === formattedUser.id &&
            prev.role_id === formattedUser.role_id &&
            prev.name === formattedUser.name &&
            prev.role === formattedUser.role &&
            prev.must_change_password === formattedUser.must_change_password
          ) {
            return prev;
          }
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(formattedUser));
            } catch {}
          }
          return formattedUser;
        });
      }
    } catch (err) {
      console.error("Error loading session:", err);
    } finally {
      setIsSessionLoaded(true);
    }
  }, [setUser]);

  // Hydrate from localStorage immediately on mount if state wasn't populated yet, then verify in background
  useEffect(() => {
    if (!currentUser) {
      const cached = getCachedSession();
      if (cached) {
        setCurrentUserState(cached);
        setIsSessionLoaded(true);
      }
    }
    fetchSession();
  }, [fetchSession, currentUser]);

  // Handle mandatory password reset redirect
  useEffect(() => {
    if (
      isSessionLoaded &&
      currentUser?.must_change_password &&
      pathname &&
      pathname !== "/change-password" &&
      pathname !== "/login"
    ) {
      router.push("/change-password");
    }
  }, [isSessionLoaded, currentUser?.must_change_password, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error logging out:", err);
    } finally {
      try {
        const cached = getCachedSession();
        const userSuffix = cached?.id ? `${cached.id}_${cached.role_id ?? 0}` : "anon";
        const persister = createIDBPersister(userSuffix);
        await persister?.removeClient();
      } catch (e) {
        // Ignore persister removal error
      }
      queryClient.clear();
      setUser(null);
      router.push("/login");
    }
  }, [queryClient, router, setUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isSessionLoaded,
        setUser,
        refreshSession: fetchSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
