import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, setCsrfToken } from "../api/client";
import type { CurrentUser } from "../api/types";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ user: CurrentUser; csrfToken: string }>("/auth/me")
      .then((res) => {
        setUser(res.user);
        setCsrfToken(res.csrfToken);
      })
      .catch(() => {
        setUser(null);
        setCsrfToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const res = await api.post<{ user: CurrentUser; csrfToken: string }>("/auth/login", { email, password });
      setUser(res.user);
      setCsrfToken(res.csrfToken);
    } catch (err) {
      const message = err instanceof ApiError && err.status === 401 ? "Invalid email or password" : "Login failed";
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
