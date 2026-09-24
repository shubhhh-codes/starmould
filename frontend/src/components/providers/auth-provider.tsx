"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UserSession {
  id?: number;
  name: string;
  email: string;
  role: string;
  initials: string;
  role_id?: number;
  username?: string;
}

interface AuthContextType {
  currentUser: UserSession | null;
  isSessionLoaded: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isSessionLoaded: false,
  refreshSession: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        setCurrentUser(null);
        setIsSessionLoaded(true);
        return;
      }
      const data = await res.json();
      if (data?.user) {
        setCurrentUser({
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
        });
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("Error loading session:", err);
    } finally {
      setIsSessionLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error logging out:", err);
    } finally {
      setCurrentUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isSessionLoaded,
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
