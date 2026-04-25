import { describe, expect, it } from "vitest";
import {
  advanceBall,
  applyPaddleBounce,
  getScoringTeam,
  reflectBallOffWalls,
} from "../../../src/game/engine/ball";
import {
  BALL_SIZE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
} from "../../../src/game/engine/constants";
import type { RuntimeState } from "../../../src/game/engine/types";

const TEST_STEP_SECONDS = 1 / 60;

const createRuntimeState = (
  overrides: Partial<RuntimeState> = {},
): RuntimeState => ({
  paddle1FrontY: 0,
  paddle1BackY: 0,
  paddle2FrontY: 0,
  paddle2BackY: 0,
  ballX: 50,
  ballY: 50,
  ballVX: 360,
  ballVY: 240,
  lastTouchedTeam: null,
  ...overrides,
});

describe("ball runtime helpers", () => {
  it("keeps countdown-gated movement outside the main step loop", () => {
    const state = createRuntimeState();

    advanceBall(state, 3, TEST_STEP_SECONDS);
    expect(state.ballX).toBe(50);
    expect(state.ballY).toBe(50);

    advanceBall(state, null, TEST_STEP_SECONDS);
    expect(state.ballX).toBe(56);
    expect(state.ballY).toBe(54);
  });

  it("reflects wall collisions and assigns the last touching team on paddle bounce", () => {
    const state = createRuntimeState({
      ballY: FIELD_HEIGHT - BALL_SIZE,
      ballVY: 4,
      ballVX: -5,
    });

    reflectBallOffWalls(state);
    applyPaddleBounce(state, "team1");

    expect(state.ballVY).toBe(-4);
    expect(state.ballVX).toBe(5);
    expect(state.lastTouchedTeam).toBe("team1");
  });

  it("returns the scoring team once the ball leaves the field bounds", () => {
    expect(getScoringTeam(createRuntimeState({ ballX: 0 }), null)).toBe(
      "team2",
    );
    expect(
      getScoringTeam(
        createRuntimeState({ ballX: FIELD_WIDTH - BALL_SIZE }),
        null,
      ),
    ).toBe("team1");
    expect(getScoringTeam(createRuntimeState({ ballX: 20 }), 2)).toBeNull();
  });
});
