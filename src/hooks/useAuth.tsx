import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getRedirectPath, UserRole } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Al cargar, verificamos si hay una sesión guardada
    const savedUser = localStorage.getItem('userData');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);

    // Escuchar cambios en localStorage para actualizar el usuario
    const handleStorageChange = () => {
      const updatedUser = localStorage.getItem('userData');
      if (updatedUser) {
        setUser(JSON.parse(updatedUser));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // También escuchar eventos personalizados para cambios en la misma pestaña
    window.addEventListener('userUpdated', handleStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleStorageChange as EventListener);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUser(null);
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}