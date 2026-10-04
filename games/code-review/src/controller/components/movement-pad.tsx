import { useCallback, useEffect, useRef } from "react";

const directions = [
  {
    label: "Move up",
    glyph: "↑",
    x: 0,
    y: -1,
    cell: "col-start-2 row-start-1",
  },
  {
    label: "Move left",
    glyph: "←",
    x: -1,
    y: 0,
    cell: "col-start-1 row-start-2",
  },
  {
    label: "Move right",
    glyph: "→",
    x: 1,
    y: 0,
    cell: "col-start-3 row-start-2",
  },
  {
    label: "Move down",
    glyph: "↓",
    x: 0,
    y: 1,
    cell: "col-start-2 row-start-3",
  },
] as const;

/** Directional buttons use local meaning, so viewport rotation cannot swap axes. */
export function MovementPad({
  onMove,
}: {
  onMove: (vector: { x: number; y: number }) => void;
}) {
  const held = useRef<number | string | null>(null);
  const release = useCallback(() => {
    held.current = null;
    onMove({ x: 0, y: 0 });
  }, [onMove]);

  useEffect(() => {
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      release();
    };
  }, [release]);

  return (
    <div
      role="group"
      aria-label="Movement"
      className="grid aspect-square max-h-full w-full max-w-56 grid-cols-3 grid-rows-3 gap-1 self-center"
    >
      {directions.map(({ label, glyph, x, y, cell }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className={`${cell} min-h-0 touch-none border-2 border-zinc-500 bg-zinc-800 text-xl text-white select-none focus-visible:outline-2 focus-visible:outline-white active:bg-zinc-600`}
          onPointerDown={(event) => {
            if (held.current !== null || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            held.current = event.pointerId;
            onMove({ x, y });
          }}
          onPointerUp={(event) => {
            if (held.current === event.pointerId) release();
          }}
          onPointerCancel={(event) => {
            if (held.current === event.pointerId) release();
          }}
          onLostPointerCapture={(event) => {
            if (held.current === event.pointerId) release();
          }}
          onKeyDown={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            if (event.repeat || held.current !== null) return;
            held.current = `${label}:${event.key}`;
            onMove({ x, y });
          }}
          onKeyUp={(event) => {
            if (held.current === `${label}:${event.key}`) release();
          }}
          onBlur={() => {
            if (typeof held.current === "string") release();
          }}
        >
          <span aria-hidden="true" className="font-sans text-3xl font-bold">
            {glyph}
          </span>
        </button>
      ))}
    </div>
  );
}
