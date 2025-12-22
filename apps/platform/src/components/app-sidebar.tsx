"use client";

import {
  BookOpen,
  ChevronLeft,
  Gamepad2,
  Globe,
  LayoutDashboard,
  LineChart,
  Settings,
  Variable,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import * as React from "react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { api } from "@/trpc/react";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const params = useParams();
  const gameId = params?.gameId as string | undefined;

  // Fetch game data when in game context
  const { data: game } = api.game.get.useQuery(
    { id: gameId! },
    { enabled: !!gameId },
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {gameId ? (
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard/games">
                  <div className="border-airjam-cyan/50 text-airjam-cyan flex aspect-square size-8 items-center justify-center rounded-lg border">
                    <ChevronLeft className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="text-airjam-cyan truncate font-semibold">
                      {game?.name || "Loading..."}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      Game Project
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard/games">
                  <Image
                    src="/images/air-jam-icon-new.png"
                    alt="Air Jam"
                    width={32}
                    height={32}
                    className="size-8 shrink-0 object-contain transition-all group-data-[collapsible=icon]:size-4"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Air Jam</span>
                    <span className="truncate text-xs">Developer Console</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {gameId ? (
          // GAME CONTEXT SIDEBAR
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Game Management</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/dashboard/games/${gameId}`}
                  >
                    <Link href={`/dashboard/games/${gameId}`}>
                      <LayoutDashboard />
                      <span>Overview</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.includes("/settings")}
                  >
                    <Link href={`/dashboard/games/${gameId}/settings`}>
                      <Settings />
                      <span>Configuration</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Variable />
                    <span>Variables</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Globe />
                    <span>Publishing</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <LineChart />
                    <span>Analytics</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : (
          // GLOBAL CONTEXT SIDEBAR
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/dashboard/games"}
                  >
                    <Link href="/dashboard/games">
                      <LayoutDashboard />
                      <span>Games Overview</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <LineChart />
                    <span>Global Analytics</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Resources</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/docs" target="_blank">
                      <BookOpen />
                      <span>Documentation</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
