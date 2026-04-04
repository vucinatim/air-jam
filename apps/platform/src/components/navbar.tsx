"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardAccess } from "@/hooks/use-dashboard-access";
import {
  airJamGithubDiscussionsUrl,
  airJamGithubRepoUrl,
} from "@/lib/social-links";
import { IconBrandGithub } from "@tabler/icons-react";
import { Menu, MessagesSquare, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const MENU_EASE = [0.22, 1, 0.36, 1] as const;

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

const mainNavLinks: NavLink[] = [
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
];

const socialNavItems = [
  {
    key: "github",
    label: "GitHub",
    href: airJamGithubRepoUrl,
    Icon: IconBrandGithub,
  },
  {
    key: "discussions",
    label: "GitHub Discussions",
    href: airJamGithubDiscussionsUrl,
    Icon: MessagesSquare,
  },
];

export const Navbar = () => {
  const { interceptDashboardNavigation } = useDashboardAccess();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();

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

  const menuDuration = reduceMotion ? 0 : 0.22;
  const menuTransition = {
    duration: menuDuration,
    ease: MENU_EASE,
  } as const;

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="mobile-nav-backdrop"
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: menuDuration }}
            onClick={close}
          />
        ) : null}
        {open ? (
          <motion.div
            key="mobile-nav-sheet"
            className="bg-background/95 fixed inset-0 z-45 flex flex-col overflow-y-auto backdrop-blur-md md:hidden"
            role="dialog"
            aria-label="Mobile navigation"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            transition={menuTransition}
            onClick={close}
          >
            <div
              className="container mx-auto flex flex-col gap-1 px-4 pt-20 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              {mainNavLinks.map((link) =>
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
                          if (link.requiresAuth)
                            interceptDashboardNavigation(e);
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
              <div className="border-border/40 mt-4 flex flex-col gap-1 border-t pt-4">
                {socialNavItems.map(({ key, label, href, Icon }) => (
                  <Link
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/20 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

          {/* Desktop links + social */}
          <div className="hidden items-center gap-6 md:flex">
            {mainNavLinks.map((link) =>
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
            <div className="border-border/50 ml-2 flex items-center gap-0.5 border-l pl-4">
              {socialNavItems.map(({ key, label, href, Icon }) => (
                <Link
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-md p-2 transition-colors"
                  aria-label={label}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </Link>
              ))}
            </div>
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
      </nav>
    </>
  );
};
