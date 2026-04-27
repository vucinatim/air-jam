export function OfficeHostPausedOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/45 p-4">
      <div className="w-full max-w-sm border border-[#fef3c7] bg-[#fef3c7] p-4 text-center text-[#5c4a2e] shadow-xl">
        <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
          Match Paused
        </p>
        <p className="mt-2 text-sm text-[#6b7280]">
          Waiting for runtime reconnect...
        </p>
      </div>
    </div>
  );
}
