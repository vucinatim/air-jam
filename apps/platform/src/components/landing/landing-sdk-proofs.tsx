"use client";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import Link from "next/link";
import type { ReactNode } from "react";

type SdkProofCopy = (typeof landingCopy.sdkProofs)[number];

type LandingSdkProofsProps = {
  /** Highlighted code blocks in the same order as `landingCopy.sdkProofs`. */
  proofCodes: ReactNode[];
};

const ProofText = ({ proof }: { proof: SdkProofCopy }) => (
  <div>
    <p className="text-airjam-cyan text-xs font-semibold tracking-[0.2em] uppercase">
      {proof.filename}
    </p>
    <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
      {proof.title}
    </h2>
    <p className="text-muted-foreground/90 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
      {proof.subtitle}
    </p>
    <p className="text-muted-foreground mt-6 max-w-lg text-sm leading-relaxed">
      {proof.footnote}
    </p>
    <p className="mt-2">
      <Link
        href={proof.footnoteLink.href}
        className="text-airjam-cyan text-sm font-medium hover:underline"
      >
        {proof.footnoteLink.label}
      </Link>
    </p>
  </div>
);

const ProofCode = ({
  proof,
  code,
}: {
  proof: SdkProofCopy;
  code: ReactNode;
}) => (
  <div className="border-border/50 min-w-0 overflow-hidden rounded-3xl border bg-zinc-950/85 shadow-[0_22px_50px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]">
    <div className="border-border/40 border-b bg-zinc-900/80 px-4 py-2.5">
      <span className="text-muted-foreground font-mono text-xs">
        {proof.filename}
      </span>
    </div>
    <div className="min-w-0 overflow-x-hidden">{code}</div>
  </div>
);

export const LandingSdkProofs = ({ proofCodes }: LandingSdkProofsProps) => {
  const { sdkProofs } = landingCopy;

  return (
    <section className="border-border/30 relative border-y bg-zinc-950/30 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 w-full max-w-176 rounded-full bg-cyan-500/6 blur-3xl" />
      <div className="container mx-auto max-w-5xl px-4">
        <div className="flex flex-col gap-20 lg:gap-24">
          {sdkProofs.map((proof, index) => {
            const code = proofCodes[index];
            const codeOnRight = proof.layout === "textLeft";

            return (
              <Reveal key={proof.title} delay={index * 0.04}>
                {/*
                 * On mobile: text always comes first, code below.
                 * On desktop (lg+): layout alternates via `lg:order-*`.
                 */}
                <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={codeOnRight ? "" : "lg:order-2"}>
                    <ProofText proof={proof} />
                  </div>
                  <div className={codeOnRight ? "lg:order-2" : ""}>
                    <ProofCode proof={proof} code={code} />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};
