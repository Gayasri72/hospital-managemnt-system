"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/api/auth';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, setAuth, clearAuth } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // If we don't have token in store, try to fetch it via /auth/me
      // which will trigger the refresh interceptor if the cookie exists
      if (!isAuthenticated) {
        try {
          const res = await authApi.getMe();
          if (res.success && res.data) {
            // Note: getMe does not return the accessToken, but the interceptor handles silent refresh
            // If getMe succeeds, we assume the interceptor will retry the original request
            // Actually, we just need to verify the user is logged in
            // For a complete flow, we usually use the interceptor to catch 401s
            setAuth(res.data, useAuthStore.getState().accessToken || '');
          }
        } catch (error) {
          clearAuth();
          if (pathname !== '/login') {
            router.push('/login');
          }
        }
      }
      setIsInitializing(false);
    };

    initAuth();
  }, [isAuthenticated, setAuth, clearAuth, router, pathname]);

  if (isInitializing || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== '/login') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
