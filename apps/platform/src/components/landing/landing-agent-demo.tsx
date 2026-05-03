"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";

const TYPING_INTERVAL_MS = 42;
const PROMPT_HOLD_MS = 1800;
const PROMPT_RESET_MS = 420;

export const LandingAgentDemo = () => {
  const { agentDemo } = landingCopy;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const prompt = useMemo(
    () => agentDemo.prompts[promptIndex] ?? "",
    [agentDemo.prompts, promptIndex],
  );

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

  useEffect(() => {
    if (visibleChars < prompt.length) {
      const timeout = setTimeout(() => {
        setVisibleChars((current) => current + 1);
      }, TYPING_INTERVAL_MS);
      return () => clearTimeout(timeout);
    }

    const holdTimeout = setTimeout(() => {
      setVisibleChars(0);
      setPromptIndex((current) => (current + 1) % agentDemo.prompts.length);
    }, PROMPT_HOLD_MS + PROMPT_RESET_MS);

    return () => clearTimeout(holdTimeout);
  }, [agentDemo.prompts.length, prompt.length, visibleChars]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
  };

  return (
    <section className="border-border/30 bg-background border-b py-20 sm:py-28">
      <style jsx>{`
        @keyframes airjam-caret-blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
      <div className="container mx-auto max-w-6xl px-4">
        <SectionHeader
          title={agentDemo.title}
          subtitle={agentDemo.subtitle}
        />

        <div className="mt-6 flex justify-center">
          <div className="border-border/50 bg-background/75 flex w-full max-w-xl items-center gap-3 rounded-[24px] border px-4 py-2.5 font-mono text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
            <span className="flex min-w-0 flex-1 items-center overflow-hidden text-left text-[14px] leading-6 sm:text-[15px]">
              <span className="truncate">{prompt.slice(0, visibleChars)}</span>
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-[1.05em] w-[2px] shrink-0 self-center rounded-full bg-cyan-300/90"
                style={{
                  animation: "airjam-caret-blink 1s steps(1, end) infinite",
                }}
              />
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_8px_20px_rgba(255,255,255,0.16)]">
              <ArrowUp className="h-4.5 w-4.5" />
            </span>
          </div>
        </div>

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
