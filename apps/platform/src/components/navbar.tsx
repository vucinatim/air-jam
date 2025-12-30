"use client";

import { authClient } from "@/lib/auth-client";
import { Github } from "lucide-react";
import Image from "next/image";
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
          className="flex items-center gap-4 transition-opacity hover:opacity-80"
        >
          <Image
            src="/images/airjam-logo.png"
            alt="Air Jam"
            width={32}
            height={32}
            priority
          />
          <span className="text-xl font-bold">Air Jam</span>
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
          <div className="flex items-center gap-4">
            <Link
              href="https://www.npmjs.com/package/@air-jam/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="NPM Package"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 18 7"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0 0h18v6H9v1H5V6H0V0zm1 5h2V2h1v3h1V1H1v4zm5-4v5h2V5h2V1H6zm2 1h1v2H8V2zm3-1v4h2V2h1v3h1V2h1v3h1V1h-6z" />
              </svg>
            </Link>
            <Link
              href="https://github.com/vucinatim/air-jam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub Repository"
            >
              <Github className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
