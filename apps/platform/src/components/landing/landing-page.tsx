import { LandingBatteries } from "@/components/landing/landing-batteries";
import { LandingCoreLoop } from "@/components/landing/landing-core-loop";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { LandingGameShowcase } from "@/components/landing/landing-game-showcase";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingSdkProofs } from "@/components/landing/landing-sdk-proofs";
import { LandingSiteFooter } from "@/components/landing/landing-site-footer";
import { LandingWhoFor } from "@/components/landing/landing-who-for";
import type { ReactNode } from "react";

type LandingPageProps = {
  sdkProofCodes: ReactNode[];
  equationCodeBlock: ReactNode;
};

export const LandingPage = ({
  sdkProofCodes,
  equationCodeBlock,
}: LandingPageProps) => {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <LandingHero />
      <main>
        <LandingCoreLoop />
        <LandingGameShowcase />
        <LandingBatteries />
        <LandingSdkProofs proofCodes={sdkProofCodes} />
        <LandingWhoFor equationCodeBlock={equationCodeBlock} />
        <LandingFinalCta />
      </main>
      <LandingSiteFooter />
    </div>
  );
};
