export function OfficeHostPausedOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--airjam-color-text-dark)]/45 p-4">
      <div className="w-full max-w-sm border border-[var(--airjam-color-paper-pale-gold)] bg-[var(--airjam-color-paper-pale-gold)] p-4 text-center text-[var(--airjam-color-text-paper)] shadow-xl">
        <p className="text-xs tracking-[0.2em] text-[var(--airjam-color-button)] uppercase">
          Match Paused
        </p>
        <p className="mt-2 text-sm text-[var(--airjam-color-text-gray)]">
          Waiting for runtime reconnect...
        </p>
      </div>
    </div>
  );
}
