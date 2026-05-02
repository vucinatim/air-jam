"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Code2,
  Cpu,
  Info,
  Layers,
  Lightbulb,
  Network,
  Rocket,
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
import { getDocsSections, type DocsIcon } from "@/features/docs";

const ICONS: Record<DocsIcon, LucideIcon> = {
  info: Info,
  rocket: Rocket,
  lightbulb: Lightbulb,
  layers: Layers,
  cpu: Cpu,
  code: Code2,
  zap: Zap,
  network: Network,
  bot: Bot,
};

export function DocsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const docsSections = getDocsSections();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <Image
                  src="/images/airjam-logo.png"
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
        {docsSections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarMenu>
              {section.pages.map((page) => {
                const Icon = ICONS[page.icon];
                return (
                  <SidebarMenuItem key={page.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === page.href}
                      tooltip={page.title}
                    >
                      <Link href={page.href}>
                        <Icon />
                        <span>{page.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
