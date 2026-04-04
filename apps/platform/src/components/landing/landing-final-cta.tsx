"use client";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const LandingFinalCta = () => {
  const { finalCta } = landingCopy;

  return (
    <section className="border-border/30 relative border-t bg-zinc-950/25 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-8 mx-auto h-40 w-full max-w-120 rounded-full bg-cyan-500/6 blur-3xl" />
      <div className="container mx-auto max-w-3xl px-4">
        <Reveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {finalCta.title}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
            {finalCta.subtitle}
          </p>
          <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-10 bg-zinc-50 px-4 text-sm font-semibold text-zinc-900 shadow-md hover:bg-zinc-100 sm:h-12 sm:px-8 sm:text-base"
            >
              <Link href={finalCta.primary.href}>{finalCta.primary.label}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-10 px-4 text-sm font-semibold sm:h-12 sm:px-8 sm:text-base"
            >
              <Link href={finalCta.secondary.href}>
                {finalCta.secondary.label}
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
