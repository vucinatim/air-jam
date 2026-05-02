export const PausedOverlay = () => (
  <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/45">
    <div className="pixel-font rounded-none border-4 border-zinc-600 bg-zinc-900/90 px-6 py-4 text-center text-zinc-100">
      <p className="text-sm tracking-[0.18em] uppercase">Match Paused</p>
      <p className="mt-2 text-xs text-zinc-300">
        Waiting for runtime reconnect...
      </p>
    </div>
  </div>
);
