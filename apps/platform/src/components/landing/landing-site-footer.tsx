"use client";

import { useDashboardAccess } from "@/hooks/use-dashboard-access";
import { airJamDiscordInviteUrl } from "@/lib/social-links";
import { IconBrandDiscord } from "@tabler/icons-react";
import { Github } from "lucide-react";
import Link from "next/link";

export const LandingSiteFooter = () => {
  const { interceptDashboardNavigation } = useDashboardAccess();

  return (
    <footer className="border-border/30 bg-background border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="text-center md:text-left">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} Air Jam. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/docs"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Docs
              </Link>
              <Link
                href="/arcade"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Arcade
              </Link>
              <Link
                href="/dashboard/games"
                onClick={interceptDashboardNavigation}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/blog"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Blog
              </Link>
            </div>
            <div className="border-border/50 ml-2 flex items-center gap-4 border-l pl-6">
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
              <Link
                href={airJamDiscordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Discord community"
              >
                <IconBrandDiscord className="h-5 w-5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
