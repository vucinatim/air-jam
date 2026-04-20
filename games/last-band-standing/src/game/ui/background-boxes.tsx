import { cn } from "@/game/ui/classes";
import React, { useEffect, useRef } from "react";

const COLORS = [
  "color-mix(in srgb, var(--primary) 28%, transparent)",
  "color-mix(in srgb, var(--accent) 28%, transparent)",
  "color-mix(in srgb, var(--primary) 20%, transparent)",
  "color-mix(in srgb, var(--accent) 20%, transparent)",
];

const ROWS = 150;
const COLS = 80;
const RIPPLE_RADIUS = 10;
const RING_DELAY_MS = 45;
const RIPPLE_SPAWN_INTERVAL_MS = 380;
const PEAK_GLOW_MS = 180;
const FADE_OUT_MS = 1400;

/** Euclidean distance for circular ripple rings */
const getRingIndex = (r1: number, c1: number, r2: number, c2: number) =>
  Math.round(Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2));

/** Get cell index from row/col for flat cell array */
const getCellIndex = (row: number, col: number) => row * COLS + col;

const BoxesCore = ({ className, ...rest }: { className?: string }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cells = grid.querySelectorAll<HTMLDivElement>("[data-cell]");
    if (cells.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const spawnRipple = () => {
      const centerRow = Math.floor(Math.random() * ROWS);
      const centerCol = Math.floor(Math.random() * COLS);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      for (let d = 0; d <= RIPPLE_RADIUS; d++) {
        const ringDelay = d * RING_DELAY_MS;
        for (
          let r = Math.max(0, centerRow - RIPPLE_RADIUS);
          r <= Math.min(ROWS - 1, centerRow + RIPPLE_RADIUS);
          r++
        ) {
          for (
            let c = Math.max(0, centerCol - RIPPLE_RADIUS);
            c <= Math.min(COLS - 1, centerCol + RIPPLE_RADIUS);
            c++
          ) {
            if (getRingIndex(r, c, centerRow, centerCol) !== d) continue;
            const idx = getCellIndex(r, c);
            const cell = cells[idx];
            if (!cell) continue;

            timers.push(
              setTimeout(() => {
                cell.style.backgroundColor = color;
                cell.style.transition = `background-color ${FADE_OUT_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
              }, ringDelay),
            );

            timers.push(
              setTimeout(
                () => {
                  cell.style.backgroundColor = "";
                },
                ringDelay + PEAK_GLOW_MS + FADE_OUT_MS,
              ),
            );
          }
        }
      }
    };

    for (let i = 0; i < 8; i++) {
      timers.push(setTimeout(spawnRipple, i * 120));
    }
    const interval = setInterval(() => {
      spawnRipple();
      spawnRipple();
    }, RIPPLE_SPAWN_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      ref={gridRef}
      style={{
        transform:
          "translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.675) rotate(0deg) translateZ(0)",
      }}
      className={cn("absolute -top-1/4 left-1/4 z-0 flex p-4", className)}
      {...rest}
    >
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="border-border/20 relative h-8 w-16 border-l">
          {Array.from({ length: COLS }, (_, j) => (
            <div
              key={j}
              data-cell=""
              className="border-border/20 relative h-8 w-16 border-t border-r transition-[background-color] duration-1000 ease-out"
            >
              {j % 2 === 0 && i % 2 === 0 ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="text-border/30 pointer-events-none absolute -top-[14px] -left-[22px] h-6 w-10 stroke-[1px]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m6-6H6"
                  />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const Boxes = React.memo(BoxesCore);
