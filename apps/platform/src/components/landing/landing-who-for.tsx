"use client";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";

export const LandingWhoFor = () => {
  const { whoFor } = landingCopy;

  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionHeader title={whoFor.title} />
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {whoFor.bullets.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 0.08}
              margin="-40px"
              className="border-border/40 bg-card/10 rounded-2xl border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <h3 className="text-lg font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-[15px]">
                {item.body}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.16} className="mt-8 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-[15px]">
            {"And of course, for any party of players :)"}
          </p>
        </Reveal>
      </div>
    </section>
  );
};
