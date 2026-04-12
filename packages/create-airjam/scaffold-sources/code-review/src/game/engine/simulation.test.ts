import { describe, expect, it, vi } from "vitest";
import { PUNCH_DURATION_MS } from "../input";
import {
  BOT_PUNCH_DISTANCE,
  MAX_HP,
  PLAYER_SIZE,
  PUNCH_DAMAGE,
} from "./constants";
import {
  createHpState,
  createKoState,
  createRuntimePlayerState,
} from "./runtime-state";
import { stepMatchFrame } from "./simulation";
import type { SlotParticipant } from "./types";

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
    const hpState = createHpState();
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
    state.player1Front.punchEndRight = PUNCH_DURATION_MS;

    stepMatchFrame({
      state,
      participants,
      participantBySlot,
      hpState,
      koState,
      dt: 16,
      timestamp: 16,
      getInput: () => undefined,
      onMiss: vi.fn(),
      onHit: vi.fn(),
      onBell: vi.fn(),
      onScore: vi.fn(),
      onHeavyHit: vi.fn(),
    });

    expect(hpState.team2).toBe(MAX_HP - PUNCH_DAMAGE);
    expect(state.player1Front.punchLandedRight).toBe(true);
  });

  it("lets bots start a punch when they enter attack range", () => {
    const state = createRuntimePlayerState(0);
    const hpState = createHpState();
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
    const hpState = createHpState();
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
