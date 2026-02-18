import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, InsertUser } from '@shared/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginMutation: any;
  logoutMutation: any;
  registerMutation: any;
  forgotPasswordMutation: any;
  resetPasswordMutation: any;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user from session
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ['/api/user'],
    retry: false, // Don't retry 401s
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Login failed');
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      toast({ title: 'Welcome back!', description: `Signed in as ${user.name}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Registration failed');
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      toast({ title: 'Account created', description: 'You have been registered successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Registration failed', description: error.message, variant: 'destructive' });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/logout', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
      toast({ title: 'Signed out', description: 'Session ended safely.' });
    }
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: string | { email: string, method?: string }) => {
      const body = typeof data === 'string' ? { email: data } : data;
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(err.message || 'Request failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Request failed', description: error.message, variant: 'destructive' });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Reset failed' }));
        throw new Error(err.message || 'Reset failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      loginMutation,
      logoutMutation,
      registerMutation,
      forgotPasswordMutation,
      resetPasswordMutation
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
