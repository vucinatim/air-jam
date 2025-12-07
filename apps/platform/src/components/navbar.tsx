"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const Navbar = () => {
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
    checkAuth();
  }, []);

  const handleDashboardClick = (e: React.MouseEvent) => {
    if (isAuthenticated === false) {
      e.preventDefault();
      router.push("/?login=true");
    }
  };

  return (
    <nav className="border-border/40 bg-background/10 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-xs">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="text-xl font-bold transition-opacity hover:opacity-80"
        >
          Air Jam
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard/games"
            onClick={handleDashboardClick}
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/docs"
            target="_blank"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Docs
          </Link>
        </div>
      </div>
    </nav>
  );
};
