"use client";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Bot, Bug, Gamepad2, QrCode, Server } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  server: Server,
  qr: QrCode,
  arcade: Gamepad2,
  chart: BarChart3,
  bug: Bug,
  bot: Bot,
};

export const LandingBatteries = () => {
  const { batteries } = landingCopy;

  return (
    <section className="relative py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-40 w-[40rem] rounded-full bg-cyan-500/6 blur-3xl" />
      <div className="container mx-auto max-w-5xl px-4">
        <SectionHeader title={batteries.title} />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {batteries.items.map((item, i) => {
            const Icon = iconMap[item.icon] ?? Server;
            return (
              <Reveal
                key={item.title}
                delay={i * 0.05}
                margin="-40px"
                className="border-border/40 bg-card/12 relative flex gap-4 rounded-2xl border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/12"
              >
                <div className="bg-airjam-cyan/10 text-airjam-cyan mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/10">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-[15px]">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};
