export const PausedPanel = () => (
  <div className="flex min-h-0 w-full flex-1 items-center justify-center p-4">
    <div className="w-full max-w-sm rounded-none border-4 border-zinc-600 bg-zinc-900/90 p-4 text-center">
      <p className="text-sm tracking-[0.18em] text-zinc-400 uppercase">
        Match Paused
      </p>
      <p className="mt-2 text-xs text-zinc-300">
        Waiting for host runtime sync...
      </p>
    </div>
  </div>
);
