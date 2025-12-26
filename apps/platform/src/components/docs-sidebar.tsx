"use client";

import {
  Code2,
  Cpu,
  Info,
  Layers,
  Lightbulb,
  Network,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { DocsSearch } from "@/components/docs/docs-search";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function DocsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <Image
                  src="/images/air-jam-icon-new.png"
                  alt="Air Jam"
                  width={32}
                  height={32}
                  className="size-8 shrink-0 object-contain transition-all group-data-[collapsible=icon]:size-4"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Air Jam</span>
                  <span className="truncate text-xs">Documentation</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
        <DocsSearch />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Getting Started</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/getting-started/introduction"}
              >
                <Link href="/docs/getting-started/introduction">
                  <Info />
                  <span>Introduction</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/getting-started/architecture"}
              >
                <Link href="/docs/getting-started/architecture">
                  <Layers />
                  <span>Architecture</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/getting-started/game-ideas"}
              >
                <Link href="/docs/getting-started/game-ideas">
                  <Lightbulb />
                  <span>Game Ideas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>How it Works</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/how-it-works/host-system"}
              >
                <Link href="/docs/how-it-works/host-system">
                  <Cpu />
                  <span>Host System</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>SDK</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/sdk/hooks"}
              >
                <Link href="/docs/sdk/hooks">
                  <Code2 />
                  <span>Hooks</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/sdk/input-system"}
              >
                <Link href="/docs/sdk/input-system">
                  <Zap />
                  <span>Input System</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/docs/sdk/networked-state"}
              >
                <Link href="/docs/sdk/networked-state">
                  <Network />
                  <span>Networked State</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
