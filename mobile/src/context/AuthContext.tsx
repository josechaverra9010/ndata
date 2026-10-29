import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, clearToken, setToken } from '@/src/lib/api';
import type { PatientUser } from '@/src/lib/types';

const USER_KEY = 'userData';

interface AuthContextValue {
  user: PatientUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadStoredUser(): Promise<PatientUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatientUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PatientUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const persistUser = async (u: PatientUser | null) => {
    if (u) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{
      token: string;
      user: {
        id: number | string;
        name: string;
        role: string;
        altura?: number;
        peso_actual?: number;
        avatar?: string;
        nombres?: string;
      };
    }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.user.role !== 'patient') {
      await clearToken();
      throw new Error('Esta app es solo para pacientes. Usa la web para nutricionistas.');
    }

    await setToken(data.token);
    const patient: PatientUser = {
      id: String(data.user.id),
      name: data.user.name,
      nombres: data.user.nombres,
      email,
      role: 'patient',
      avatar: data.user.avatar,
      altura: data.user.altura,
      peso_actual: data.user.peso_actual,
    };
    await persistUser(patient);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    await persistUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const profile = await apiFetch<Record<string, unknown>>(`/patients/${user.id}`);
      const updated: PatientUser = {
        ...user,
        name: String(profile.nombre_completo ?? profile.name ?? user.name),
        peso_actual: Number(profile.peso_actual ?? user.peso_actual) || user.peso_actual,
        altura: Number(profile.altura ?? user.altura) || user.altura,
      };
      await persistUser(updated);
    } catch {
      /* ignore */
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth dentro de AuthProvider');
  return ctx;
}
