import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type AccountLevel = "superadmin" | "admin" | "user";

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  accountLevel: AccountLevel;
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Login failed");
    }
    const data: AdminUser = await r.json();
    setUser(data);
  }

  async function logout() {
    await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    setUser(null);
  }

  const isSuperAdmin = user?.accountLevel === "superadmin";
  const isAdmin = user?.accountLevel === "superadmin" || user?.accountLevel === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isSuperAdmin, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
