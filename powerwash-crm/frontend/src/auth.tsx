import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosInstance } from "axios";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Default account used when "no login" mode is on. The app auto-creates and
// auto-signs in this user on first launch.
const DEFAULT_EMAIL = "owner@clearview.app";
const DEFAULT_PASSWORD = "ClearView!2026";
const DEFAULT_NAME = "Window Cleaning Pro";

type User = { id: string; email: string; full_name: string; business_name?: string };

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  api: AxiosInstance;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};

const api = axios.create({ baseURL: `${BACKEND_URL}/api`, timeout: 15000 });

async function ensureSession(): Promise<{ token: string; user: User }> {
  // Try login; if user doesn't exist yet, register.
  try {
    const { data } = await api.post("/auth/login", { email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD });
    return { token: data.token, user: data.user };
  } catch {
    const { data } = await api.post("/auth/register", {
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      full_name: DEFAULT_NAME,
      business_name: "ClearView CRM",
    });
    return { token: data.token, user: data.user };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem("token");
        const u = await AsyncStorage.getItem("user");
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u));
          api.defaults.headers.common.Authorization = `Bearer ${t}`;
          setLoading(false);
          return;
        }
        // No stored session — auto sign-in default user
        const session = await ensureSession();
        await AsyncStorage.setItem("token", session.token);
        await AsyncStorage.setItem("user", JSON.stringify(session.user));
        setToken(session.token);
        setUser(session.user);
        api.defaults.headers.common.Authorization = `Bearer ${session.token}`;
      } catch (e) {
        console.log("auto-auth failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signOut = async () => {
    await AsyncStorage.multiRemove(["token", "user"]);
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common.Authorization;
    // Re-auth immediately so user stays inside the app
    try {
      const session = await ensureSession();
      await AsyncStorage.setItem("token", session.token);
      await AsyncStorage.setItem("user", JSON.stringify(session.user));
      setToken(session.token);
      setUser(session.user);
      api.defaults.headers.common.Authorization = `Bearer ${session.token}`;
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, api, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export { api };
