import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing auth token on app load
    let token = localStorage.getItem('auth_token');
    let userData = localStorage.getItem('user_data');

    // Auto-login for demo purposes if no user found or if data is incomplete
    const isValidUser = (data: any) => {
      return data && typeof data === 'object' && data.id && data.username && data.role;
    };

    if (!token || !userData) {
      console.log('No auth found, setting up demo user for first load');
      setupDemoUser();
    } else {
      try {
        const parsedUser = JSON.parse(userData);
        if (isValidUser(parsedUser)) {
          setUser(parsedUser);
          setIsAuthenticated(true);
        } else {
          console.log('Incomplete user data found, resetting to demo user');
          setupDemoUser();
        }
      } catch (error) {
        setupDemoUser();
      }
    }

    function setupDemoUser() {
      const demoUser = {
        id: 'demo-admin-id',
        username: 'admin',
        password: 'demo-password',
        role: 'admin',
        name: 'Demo Administrator',
        email: 'admin@example.com',
        createdAt: new Date()
      };
      const demoToken = 'mock-token-demo-admin-id';

      localStorage.setItem('auth_token', demoToken);
      localStorage.setItem('user_data', JSON.stringify(demoUser));

      setUser(demoUser);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const fullUser: User = await response.json();
        setUser(fullUser);
        setIsAuthenticated(true);
        localStorage.setItem('auth_token', `real-token-${username}`);
        localStorage.setItem('user_data', JSON.stringify(fullUser));
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  };

  const switchRole = (role: string) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchRole, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
