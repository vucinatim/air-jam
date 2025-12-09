"use client";

import { useEffect, useState } from "react";

export function ArcadeLoader() {
  const [dots, setDots] = useState("");
  const [text, setText] = useState("INITIALIZING");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    const textInterval = setInterval(() => {
      setText((prev) => {
        if (prev === "INITIALIZING") return "LOADING ASSETS";
        if (prev === "LOADING ASSETS") return "CONNECTING";
        if (prev === "CONNECTING") return "STARTING";
        return "INITIALIZING";
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(textInterval);
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black font-mono">
      <div className="relative">
        {/* Retro CRT Scanline Effect */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%] opacity-20" />

        <div className="flex flex-col items-center gap-6">
          <div className="relative h-16 w-16">
            <div className="bg-airjam-cyan/20 absolute inset-0 animate-ping rounded-full" />
            <div className="bg-airjam-magenta/40 absolute inset-2 animate-pulse rounded-full" />
            <div className="from-airjam-cyan to-airjam-magenta absolute inset-4 rounded-full bg-linear-to-r shadow-[0_0_20px_var(--color-airjam-cyan)]" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <h1 className="from-airjam-cyan to-airjam-magenta bg-linear-to-r bg-clip-text text-2xl font-black tracking-[0.2em] text-transparent drop-shadow-[0_0_10px_var(--color-airjam-cyan)]">
              AIR JAM
            </h1>
            <div className="text-airjam-cyan/80 text-sm font-bold tracking-widest">
              {text}
              {dots}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
