"use client";
import { browserPrincipal, setBrowserPrincipal } from "@/lib/cache/principal";
import { clearLocalProjectsStore } from "@/lib/cache/projects-local-store";
import { clearStreamState } from "@/lib/cache/projects-stream-store";
import { setIdbCachedUsers } from "@/lib/realtime/subplate-sync";


import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createIDBPersister } from "@/lib/query/persister";
import { RealtimeSyncListener } from "@/lib/query/realtime";

export interface UserSession {
  id?: number;
  name: string;
  email: string | null;
  role: string;
  initials?: string | null;
  role_id?: number;
  username?: string;
  must_change_password?: boolean;
  permissions_version?: string;
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
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: UserSession | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Restore cached session synchronously on boot from initialUser (SSR verified cookie) or localStorage
  const [currentUser, setCurrentUserState] = useState<UserSession | null>(() => {
    return initialUser || getCachedSession();
  });
  const [isSessionLoaded, setIsSessionLoaded] = useState<boolean>(() => {
    return Boolean(initialUser || getCachedSession());
  });

  // Keep state synchronized if initialUser arrives from SSR navigation
  useEffect(() => {
    if (initialUser) {
      setCurrentUserState(initialUser);
      setIsSessionLoaded(true);
    }
  }, [initialUser]);

  const setUser = useCallback((user: UserSession | null) => {
    const nextKey = user?.id && user.permissions_version ? `${user.id}_${user.role_id ?? 0}_${user.permissions_version}` : null;
    const previous = browserPrincipal();
    if (previous.key !== nextKey) {
      if (previous.key) void createIDBPersister(previous.key)?.removeClient();
      void clearLocalProjectsStore();
      void queryClient.cancelQueries();
      queryClient.clear();
      clearStreamState();
      setIdbCachedUsers([]);
      setBrowserPrincipal(nextKey);
    }
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
  }, [queryClient]);

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
          permissions_version: data.user.permissions_version,
        };
        setUser(formattedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Session check deferred (waiting for server):", err instanceof Error ? err.message : err);
      } else {
        console.error("Error loading session:", err);
      }
    } finally {
      setIsSessionLoaded(true);
    }
  }, [setUser]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_STORAGE_KEY) return;
      void clearLocalProjectsStore();
      setBrowserPrincipal(null);
      void queryClient.cancelQueries();
      queryClient.clear();
      clearStreamState();
      setIdbCachedUsers([]);
      setCurrentUserState(null);
      if (event.newValue) void fetchSession();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fetchSession, queryClient]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void fetchSession(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("starmould:permissions-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("starmould:permissions-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchSession]);

  // A signed cookie or localStorage identity alone cannot authorize cache restoration.
  useEffect(() => {
    fetchSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSession]);

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
    const previousPrincipal = browserPrincipal().key;
    setUser(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error logging out:", err);
    } finally {
      try {
        const userSuffix = previousPrincipal || "anon";
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
      <React.Fragment key={`${currentUser?.id ?? "anon"}_${currentUser?.role_id ?? "none"}_${currentUser?.permissions_version ?? "unverified"}`}>
        <RealtimeSyncListener isAuthenticated={Boolean(currentUser)} />
        {children}
      </React.Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
