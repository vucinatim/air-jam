"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardAccess } from "@/hooks/use-dashboard-access";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type NavLink = {
  label: string;
  href: string;
  requiresAuth?: boolean;
  external?: boolean;
  badge?: string;
  disabled?: boolean;
  tooltip?: string;
};

const STUDIO_TOOLTIP = "AI-powered game creation, right from your browser.";
const ARCADE_TOOLTIP = "Play games. Instantly.";
const DASHBOARD_TOOLTIP = "Manage and publish games.";

const navLinks: NavLink[] = [
  { label: "Docs", href: "/docs" },
  { label: "Arcade", href: "/arcade", tooltip: ARCADE_TOOLTIP },
  {
    label: "Studio",
    href: "#",
    badge: "Soon",
    disabled: true,
    tooltip: STUDIO_TOOLTIP,
  },
  {
    label: "Dashboard",
    href: "/dashboard/games",
    requiresAuth: true,
    tooltip: DASHBOARD_TOOLTIP,
  },
  { label: "Blog", href: "/blog" },
  {
    label: "GitHub",
    href: "https://github.com/vucinatim/air-jam",
    external: true,
  },
];

export const Navbar = () => {
  const { interceptDashboardNavigation } = useDashboardAccess();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position to toggle navbar background
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll(); // check initial position
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <nav
      className={`fixed top-0 right-0 left-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? "border-border/40 bg-background/10 border-b backdrop-blur-sm"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <Image
            src="/images/airjam-logo.png"
            alt="Air Jam"
            width={28}
            height={28}
            priority
          />
          <span className="text-lg font-bold">Air Jam</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) =>
            link.disabled ? (
              <Tooltip key={link.label}>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground/50 flex cursor-default items-center gap-1.5 text-sm font-medium">
                    {link.label}
                    {link.badge ? (
                      <span className="border-airjam-cyan/40 text-airjam-cyan rounded-full border px-1.5 py-px text-[10px] leading-tight font-semibold">
                        {link.badge}
                      </span>
                    ) : null}
                  </span>
                </TooltipTrigger>
                {link.tooltip ? (
                  <TooltipContent side="bottom" sideOffset={8}>
                    {link.tooltip}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            ) : link.tooltip ? (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={link.href}
                    onClick={
                      link.requiresAuth
                        ? interceptDashboardNavigation
                        : undefined
                    }
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  {link.tooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={
                  link.requiresAuth ? interceptDashboardNavigation : undefined
                }
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open ? (
        <div className="bg-background/95 border-border/40 border-t backdrop-blur-md md:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-4">
            {navLinks.map((link) =>
              link.disabled ? (
                <div key={link.label} className="rounded-lg px-3 py-2.5">
                  <span className="text-muted-foreground/50 flex items-center gap-2 text-sm font-medium">
                    {link.label}
                    {link.badge ? (
                      <span className="border-airjam-cyan/40 text-airjam-cyan rounded-full border px-1.5 py-px text-[10px] leading-tight font-semibold">
                        {link.badge}
                      </span>
                    ) : null}
                  </span>
                  {link.tooltip ? (
                    <p className="text-muted-foreground/40 mt-1 text-xs leading-relaxed">
                      {link.tooltip}
                    </p>
                  ) : null}
                </div>
              ) : link.tooltip ? (
                <Tooltip key={link.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={link.href}
                      onClick={(e) => {
                        if (link.requiresAuth) interceptDashboardNavigation(e);
                        close();
                      }}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/20 block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                    >
                      {link.label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {link.tooltip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    if (link.requiresAuth) interceptDashboardNavigation(e);
                    close();
                  }}
                  {...(link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
};
