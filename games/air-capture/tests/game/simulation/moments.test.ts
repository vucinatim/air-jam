import { expect, it } from "vitest";
import { airCaptureSimulation } from "../../../src/game/simulation/air-capture-simulation";

it("declares only match starts, scores and wins as room moments", () => {
  const moment = airCaptureSimulation.moment!;
  expect(moment({ type: "match-started" })).toBe("Match started");
  expect(
    moment({
      type: "team-scored",
      teamId: "solaris",
      scores: { solaris: 2, nebulon: 1 },
    }),
  ).toBe("Solaris scored, 2 to 1");
  expect(moment({ type: "match-won", teamId: "nebulon" })).toBe(
    "Nebulon won the match",
  );
  expect(moment({ type: "sound", sound: "score_point" })).toBeNull();
  expect(
    moment({ type: "haptic", controllerId: "phone", pattern: "success" }),
  ).toBeNull();
  expect(moment({ type: "ship-destroyed", position: [0, 0, 0] })).toBeNull();
});
