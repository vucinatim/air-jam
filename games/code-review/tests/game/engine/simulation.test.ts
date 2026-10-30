import { describe, expect, it, vi } from "vitest";
import {
  codeReviewSettings,
  type CodeReviewSettings,
} from "../../../src/game/contracts/settings";
import {
  BOT_PUNCH_DISTANCE,
  PLAYER_SIZE,
} from "../../../src/game/engine/constants";
import {
  createHpState,
  createKoState,
  createRuntimePlayerState,
} from "../../../src/game/engine/runtime-state";
import { stepMatchFrame } from "../../../src/game/engine/simulation";
import type { SlotParticipant } from "../../../src/game/engine/types";

const makeParticipants = (): SlotParticipant[] => [
  {
    id: "alpha",
    label: "Alpha",
    slotKey: "player1Front",
    team: "team1",
    position: "front",
    isBot: false,
  },
  {
    id: "beta",
    label: "Beta",
    slotKey: "player2Front",
    team: "team2",
    position: "front",
    isBot: false,
  },
];

describe("stepMatchFrame", () => {
  it("lands a punch when fighters are within melee reach", () => {
    const state = createRuntimePlayerState(0);
    const hpState = createHpState(codeReviewSettings.maxHp.default);
    const koState = createKoState();
    const participants = makeParticipants();
    const participantBySlot = {
      player1Front: participants[0],
      player2Front: participants[1],
    } as const;

    state.player1Front.x = 100;
    state.player1Front.y = 100;
    state.player2Front.x = 180;
    state.player2Front.y = 100;
    state.player1Front.punchingRight = true;
    state.player1Front.punchEndRight =
      codeReviewSettings.punchDurationMs.default;

    stepMatchFrame({
      settings: Object.fromEntries(
        Object.entries(codeReviewSettings).map(([key, definition]) => [
          key,
          definition.default,
        ]),
      ) as CodeReviewSettings,
      state,
      participants,
      participantBySlot,
      hpState,
      koState,
      dt: 16,
      timestamp: 16,
      getInput: () => ({
        vertical: 0,
        horizontal: 0,
        leftPunch: false,
        rightPunch: false,
        defend: false,
      }),
      onMiss: vi.fn(),
      onHit: vi.fn(),
      onBell: vi.fn(),
      onScore: vi.fn(),
      onHeavyHit: vi.fn(),
    });

    expect(hpState.team2).toBe(
      codeReviewSettings.maxHp.default - codeReviewSettings.punchDamage.default,
    );
    expect(state.player1Front.punchLandedRight).toBe(true);
  });

  it("lets bots start a punch when they enter attack range", () => {
    const state = createRuntimePlayerState(0);
    const hpState = createHpState(codeReviewSettings.maxHp.default);
    const koState = createKoState();
    const participants: SlotParticipant[] = [
      {
        id: "bot-team1-front",
        label: "Coder Bot α",
        slotKey: "player1Front",
        team: "team1",
        position: "front",
        isBot: true,
      },
      {
        id: "beta",
        label: "Beta",
        slotKey: "player2Front",
        team: "team2",
        position: "front",
        isBot: false,
      },
    ];
    const participantBySlot = {
      player1Front: participants[0],
      player2Front: participants[1],
    } as const;

    state.player1Front.x = 100;
    state.player1Front.y = 100;
    state.player2Front.x = 100 + BOT_PUNCH_DISTANCE - PLAYER_SIZE / 2;
    state.player2Front.y = 100;

    stepMatchFrame({
      settings: Object.fromEntries(
        Object.entries(codeReviewSettings).map(([key, definition]) => [
          key,
          definition.default,
        ]),
      ) as CodeReviewSettings,
      state,
      participants,
      participantBySlot,
      hpState,
      koState,
      dt: 16,
      timestamp: 0,
      getInput: () => ({
        horizontal: 0,
        vertical: 0,
        leftPunch: false,
        rightPunch: false,
        defend: false,
      }),
      onMiss: vi.fn(),
      onHit: vi.fn(),
      onBell: vi.fn(),
      onScore: vi.fn(),
      onHeavyHit: vi.fn(),
    });

    expect(
      state.player1Front.punchingLeft || state.player1Front.punchingRight,
    ).toBe(true);
  });

  it("lets bots occasionally pressure a defending target", () => {
    const state = createRuntimePlayerState(0);
    const hpState = createHpState(codeReviewSettings.maxHp.default);
    const koState = createKoState();
    const participants: SlotParticipant[] = [
      {
        id: "bot-team1-front",
        label: "Coder Bot α",
        slotKey: "player1Front",
        team: "team1",
        position: "front",
        isBot: true,
      },
      {
        id: "beta",
        label: "Beta",
        slotKey: "player2Front",
        team: "team2",
        position: "front",
        isBot: false,
      },
    ];
    const participantBySlot = {
      player1Front: participants[0],
      player2Front: participants[1],
    } as const;

    state.player1Front.x = 100;
    state.player1Front.y = 100;
    state.player2Front.x = 100 + BOT_PUNCH_DISTANCE - PLAYER_SIZE / 2;
    state.player2Front.y = 100;
    state.player2Front.defending = true;

    stepMatchFrame({
      settings: Object.fromEntries(
        Object.entries(codeReviewSettings).map(([key, definition]) => [
          key,
          definition.default,
        ]),
      ) as CodeReviewSettings,
      state,
      participants,
      participantBySlot,
      hpState,
      koState,
      dt: 16,
      timestamp: 420,
      getInput: () => ({
        horizontal: 0,
        vertical: 0,
        leftPunch: false,
        rightPunch: false,
        defend: false,
      }),
      onMiss: vi.fn(),
      onHit: vi.fn(),
      onBell: vi.fn(),
      onScore: vi.fn(),
      onHeavyHit: vi.fn(),
    });

    expect(
      state.player1Front.punchingLeft || state.player1Front.punchingRight,
    ).toBe(true);
  });
});
