"use client";

import { HeroScene } from "@/components/hero-scene/hero-scene";
import { landingCopy } from "@/components/landing/landing-content";
import { LandingScrollChevron } from "@/components/landing/landing-scroll-chevron";
import { TextCycle } from "@/components/landing/text-cycle";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

const COMMAND = "npx create-airjam@latest";

function CopyCommand() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <button
      type="button"
      onClick={copy}
      className="group/copy flex cursor-pointer items-center gap-3 rounded-full border border-zinc-700/90 bg-zinc-900/75 px-5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-zinc-500 hover:bg-zinc-800/85"
    >
      <span className="font-mono text-sm text-zinc-300 select-all sm:text-[15px]">
        {COMMAND}
      </span>
      {copied ? (
        <Check className="text-airjam-cyan h-4 w-4 shrink-0" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover/copy:text-zinc-300" />
      )}
    </button>
  );
}

export const LandingHero = () => {
  const { hero } = landingCopy;

  return (
    <>
      <Navbar />
      <section className="relative flex min-h-[min(100dvh,900px)] items-center justify-center overflow-hidden pt-16">
        <HeroScene />

        <div className="relative z-10 mb-16 flex max-w-4xl flex-col items-center gap-6 px-4 pb-16 text-center sm:mb-24 sm:pb-42">
          <div className="from-airjam-cyan/12 via-airjam-cyan/6 absolute top-1/2 left-1/2 -z-10 h-72 w-full max-w-136 -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial to-transparent blur-3xl" />
          <div className="flex flex-col items-center gap-4">
            <Badge
              variant="outline"
              className="border-airjam-cyan/40 bg-background/80 text-airjam-cyan px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase shadow-[0_0_18px_rgba(0,211,243,0.18)] sm:text-[11px]"
            >
              {hero.badge}
            </Badge>
            <h1 className="text-5xl font-bold tracking-tight text-balance sm:text-6xl md:text-7xl lg:text-[5.5rem]">
              <span className="from-foreground to-foreground/75 bg-linear-to-r bg-clip-text text-transparent">
                {hero.title}
              </span>
            </h1>
          </div>
          <p className="text-foreground/95 relative z-20 flex min-h-12 w-full max-w-2xl items-center justify-center text-center text-base leading-relaxed font-medium [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] sm:text-lg md:text-[1.35rem]">
            <TextCycle phrases={hero.subtitles} holdDuration={3500} />
          </p>
          <div className="flex flex-row flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-10 bg-zinc-50 px-4 text-sm font-semibold text-zinc-900 shadow-[0_16px_40px_rgba(0,0,0,0.35)] hover:bg-zinc-100 sm:h-12 sm:px-6 sm:text-base"
            >
              <Link href={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-airjam-cyan/35 bg-background/45 hover:border-airjam-cyan/55 hover:bg-background/60 h-10 px-4 text-sm font-semibold shadow-[0_14px_32px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:h-12 sm:px-6 sm:text-base"
            >
              <Link href={hero.secondaryCta.href}>
                {hero.secondaryCta.label}
              </Link>
            </Button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <CopyCommand />
          </div>
        </div>
        <LandingScrollChevron />
      </section>
    </>
  );
};
