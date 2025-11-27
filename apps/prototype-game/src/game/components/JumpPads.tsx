import { useMemo } from "react";
import { JumpPad } from "./JumpPad";

export function JumpPads() {
  // Generate jump pads positioned around the arena
  const jumpPads = useMemo(
    () => [
      // Center area jump pads
      {
        id: "jump-pad-1",
        position: [20, 0, 15] as [number, number, number],
      },
      {
        id: "jump-pad-2",
        position: [-15, 0, 25] as [number, number, number],
      },
      {
        id: "jump-pad-3",
        position: [30, 0, -15] as [number, number, number],
      },
      {
        id: "jump-pad-4",
        position: [-25, 0, -20] as [number, number, number],
      },

      // Mid-range jump pads
      {
        id: "jump-pad-5",
        position: [50, 0, 40] as [number, number, number],
      },
      {
        id: "jump-pad-6",
        position: [-40, 0, 50] as [number, number, number],
      },
      {
        id: "jump-pad-7",
        position: [60, 0, -30] as [number, number, number],
      },
      {
        id: "jump-pad-8",
        position: [-50, 0, -40] as [number, number, number],
      },

      // Outer area jump pads
      {
        id: "jump-pad-9",
        position: [80, 0, 70] as [number, number, number],
      },
      {
        id: "jump-pad-10",
        position: [-70, 0, 80] as [number, number, number],
      },
      {
        id: "jump-pad-11",
        position: [90, 0, -60] as [number, number, number],
      },
      {
        id: "jump-pad-12",
        position: [-80, 0, -70] as [number, number, number],
      },

      // Additional scattered jump pads
      {
        id: "jump-pad-13",
        position: [0, 0, 40] as [number, number, number],
      },
      {
        id: "jump-pad-14",
        position: [40, 0, 0] as [number, number, number],
      },
      {
        id: "jump-pad-15",
        position: [-40, 0, 0] as [number, number, number],
      },
      {
        id: "jump-pad-16",
        position: [0, 0, -40] as [number, number, number],
      },
    ],
    []
  );

  return (
    <>
      {jumpPads.map((pad) => (
        <JumpPad key={pad.id} id={pad.id} position={pad.position} />
      ))}
    </>
  );
}

