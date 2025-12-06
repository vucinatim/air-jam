"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { api } from "@/trpc/react";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  games: "Games",
  new: "New Game",
  settings: "Configuration",
  variables: "Variables",
  publishing: "Publishing",
  analytics: "Analytics",
};

export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Extract gameId if we're in a game context
  const gameIndex = segments.indexOf("games");
  const gameId = gameIndex !== -1 && segments[gameIndex + 1] && segments[gameIndex + 1] !== "new" 
    ? segments[gameIndex + 1] 
    : null;

  // Fetch game name if we have a gameId
  const { data: game } = api.game.get.useQuery(
    { id: gameId! },
    { enabled: !!gameId }
  );

  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    
    // Special handling for game names
    let label = routeLabels[segment] || segment;
    if (segment === gameId && game) {
      label = game.name;
    } else if (segment === gameId && !game) {
      label = "Loading...";
    }

    // Capitalize first letter if not in routeLabels
    if (!routeLabels[segment] && segment !== gameId) {
      label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    }

    return {
      href,
      label,
      isLast,
    };
  });

  // If we're at root dashboard, just show "Dashboard"
  if (segments.length === 1 && segments[0] === "dashboard") {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

