"use client";

import { useEffect, useRef, useState } from "react";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";

export const LandingAgentDemo = () => {
  const { agentDemo } = landingCopy;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.duration > 0) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, []);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
  };

  return (
    <section className="border-border/30 bg-background border-b py-20 sm:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <SectionHeader
          title={agentDemo.title}
          subtitle={agentDemo.subtitle}
        />

        <Reveal margin="-40px" className="mt-14">
          <div className="border-border/50 bg-card/20 overflow-hidden rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="group relative bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full"
                src={agentDemo.videoSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
              <div
                onClick={seek}
                className="absolute right-0 bottom-0 left-0 flex h-6 cursor-pointer items-end opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                <div className="relative h-[2px] w-full bg-white/15">
                  <div
                    className="absolute inset-y-0 left-0 bg-white/80"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
