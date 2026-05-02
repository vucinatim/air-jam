import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";

export const LandingAgentDemo = () => {
  const { agentDemo } = landingCopy;

  return (
    <section className="border-border/30 bg-background border-b py-20 sm:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <SectionHeader
          title={agentDemo.title}
          subtitle={agentDemo.subtitle}
        />

        <Reveal margin="-40px" className="mt-14">
          <div className="border-border/50 bg-card/20 overflow-hidden rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="border-border/50 bg-background/70 flex flex-wrap items-center gap-3 border-b px-4 py-3">
              {agentDemo.bullets.map((bullet) => (
                <span
                  key={bullet}
                  className="text-muted-foreground bg-background/70 rounded-full border px-3 py-1 text-xs tracking-[0.16em] uppercase"
                >
                  {bullet}
                </span>
              ))}
            </div>

            <div className="bg-black">
              <video
                className="aspect-video w-full"
                src={agentDemo.videoSrc}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
