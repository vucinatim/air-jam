"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Tracks session for dashboard links and routes unauthenticated users to `/login`.
 */
export const useDashboardAccess = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession();
        setIsAuthenticated(!!session?.data?.session);
      } catch {
        setIsAuthenticated(false);
      }
    };
    void checkAuth();
  }, []);

  const interceptDashboardNavigation = (e: React.MouseEvent) => {
    if (isAuthenticated === false) {
      e.preventDefault();
      router.push("/login");
    }
  };

  return { interceptDashboardNavigation, isAuthenticated };
};
