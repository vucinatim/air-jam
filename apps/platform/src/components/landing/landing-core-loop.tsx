"use client";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";
import type { LucideIcon } from "lucide-react";
import { Monitor, QrCode, Zap } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  terminal: Monitor,
  qr: QrCode,
  zap: Zap,
};

export const LandingCoreLoop = () => {
  const { coreLoop } = landingCopy;

  return (
    <section className="border-border/30 relative border-y bg-zinc-950/40 py-20 sm:py-28">
      <div className="from-airjam-cyan/6 pointer-events-none absolute inset-0 bg-linear-to-b via-transparent to-transparent" />
      <div className="from-airjam-magenta/10 pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b to-transparent blur-3xl" />
      <div className="relative container mx-auto max-w-5xl px-4">
        <SectionHeader title={coreLoop.title} subtitle={coreLoop.subtitle} />

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {coreLoop.steps.map((step, i) => {
            const Icon = iconMap[step.icon] ?? Zap;
            return (
              <Reveal
                key={step.key}
                delay={i * 0.08}
                margin="-40px"
                className="border-border/40 from-card/30 to-card/10 relative flex min-h-60 flex-col gap-6 overflow-hidden rounded-3xl border bg-linear-to-b p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
              >
                <div className="from-airjam-cyan/10 pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r via-white/50 to-transparent" />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-airjam-cyan/10 text-airjam-cyan flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/15">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-muted-foreground/85 font-mono text-sm tracking-[0.22em] uppercase sm:text-[15px]">
                      0{i + 1}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed sm:text-[15px]">
                    {step.body}
                  </p>
                </div>
                <div className="mt-auto h-px w-full bg-linear-to-r from-white/10 via-white/5 to-transparent" />
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};
