/**
 * Who flies and how a match runs: connected players and bots become ships on
 * their teams, a new round puts everyone back at their bases, the countdown
 * ends on game time and the first team to the target wins.
 */
import type { PlayerProfile } from "@air-jam/sdk";
import { Quaternion, Vector3 } from "three";
import { BotController } from "../bot-system/bot-controller";
import { generateRandomBasePositions } from "../domain/capture-the-flag";
import { TEAM_CONFIG, TEAM_IDS, type TeamId } from "../domain/team";
import { createPlayerFlightState } from "../engine/ships/flight";
import {
  assignPlayerToTeam,
  reduceRemovePlayer,
  reduceResetMatch,
  reduceSetPlayerTeam,
} from "../stores/match/capture-the-flag-store-state";
import { prototypeMatchStore } from "../stores/match/match-store";
import { MATCH_COUNTDOWN_DURATION_MS } from "../stores/match/match-store-state";
import { emptyTeamSets } from "./arena";
import { addShipBody, removeShipBody, teleportShip } from "./physics";
import { resetShipMotion, spawnPositionAt } from "./ships";
import {
  MAX_HEALTH,
  MAX_SHIPS,
  nextEntityId,
  type AirCaptureSim,
  type Emit,
  type ShipSim,
  type ShipSource,
} from "./state";

/** Whether ships fly: during the countdown and the match itself. */
export const isMatchActive = (phase: AirCaptureSim["matchPhase"]): boolean =>
  phase === "countdown" || phase === "playing";

const addShip = (
  sim: AirCaptureSim,
  controllerId: string,
  label: string,
  source: ShipSource,
  teamId: TeamId,
  random: () => number,
) => {
  sim.ctf = reduceSetPlayerTeam(sim.ctf, controllerId, teamId);
  const spawn = spawnPositionAt(
    sim.ctf.basePositions[teamId],
    [...sim.ships.values()].filter((ship) => ship.teamId === teamId).length,
  );
  const ship: ShipSim = {
    controllerId,
    label,
    teamId,
    color: TEAM_CONFIG[teamId].color,
    source,
    body: addShipBody(sim.physics, controllerId, spawn),
    previousPosition: new Vector3(...spawn),
    position: new Vector3(...spawn),
    previousRotation: new Quaternion(),
    rotation: new Quaternion(),
    smoothedInput: { x: 0, y: 0 },
    angularVelocity: 0,
    pitchAngularVelocity: 0,
    wingRoll: 0,
    lastActionPressed: false,
    lastAbilityPressed: false,
    lastShotAt: 0,
    health: MAX_HEALTH,
    dead: false,
    respawnAt: 0,
    flight: createPlayerFlightState(),
    speedMultiplier: 1,
    queuedAbility: null,
    activeAbility: null,
    thrusting: false,
    thrustVisual: 0,
    bot: source === "bot" ? new BotController(controllerId, random) : null,
  };
  sim.ships.set(controllerId, ship);
};

const removeShip = (sim: AirCaptureSim, controllerId: string) => {
  const ship = sim.ships.get(controllerId);
  if (!ship) return;
  removeShipBody(sim.physics, ship.body);
  sim.ships.delete(controllerId);
  sim.ctf = reduceRemovePlayer(sim.ctf, controllerId);
};

const setShipTeam = (sim: AirCaptureSim, ship: ShipSim, teamId: TeamId) => {
  if (ship.teamId === teamId) return;
  ship.teamId = teamId;
  ship.color = TEAM_CONFIG[teamId].color;
  sim.ctf = reduceSetPlayerTeam(sim.ctf, ship.controllerId, teamId);
};

/** Makes the arena's ships match the room and the lobby's team choices. */
export const syncRoster = (
  sim: AirCaptureSim,
  players: readonly PlayerProfile[],
  random: () => number,
  emit: Emit,
): void => {
  const { teamAssignments, botCounts } = prototypeMatchStore.getState();
  const connected = new Set(players.map((player) => player.id));
  for (const ship of [...sim.ships.values()])
    if (ship.source === "connected" && !connected.has(ship.controllerId))
      removeShip(sim, ship.controllerId);

  for (const player of players) {
    const ship = sim.ships.get(player.id);
    const assigned = teamAssignments[player.id]?.teamId;
    if (ship) {
      ship.label = player.label;
      if (assigned) setShipTeam(sim, ship, assigned);
    } else if (sim.ships.size < MAX_SHIPS) {
      const teamId = assigned ?? assignPlayerToTeam(sim.ctf, player.id).teamId;
      addShip(sim, player.id, player.label, "connected", teamId, random);
      emit({ type: "sound", sound: "player_join" });
    }
  }

  for (const teamId of TEAM_IDS) {
    const bots = [...sim.ships.values()].filter(
      (ship) => ship.source === "bot" && ship.teamId === teamId,
    );
    for (const bot of bots.slice(botCounts[teamId]))
      removeShip(sim, bot.controllerId);
    for (let count = bots.length; count < botCounts[teamId]; count += 1) {
      if (sim.ships.size >= MAX_SHIPS) break;
      const controllerId = nextEntityId(sim, "bot");
      addShip(
        sim,
        controllerId,
        `Bot ${controllerId.slice(4)}`,
        "bot",
        teamId,
        random,
      );
    }
  }

  const roster = players.map((player) => player.id).join("\u0000");
  if (roster !== sim.roster) {
    sim.roster = roster;
    void prototypeMatchStore.actions.syncConnectedPlayers({
      connectedPlayerIds: players.map((player) => player.id),
    });
  }
};

/** A new round: new base spots, every ship home, no projectiles in flight. */
const startRound = (sim: AirCaptureSim, random: () => number) => {
  sim.ctf = reduceResetMatch(sim.ctf, generateRandomBasePositions(random));
  sim.roundId += 1;
  sim.lasers.clear();
  sim.rockets.clear();
  sim.baseOccupants = emptyTeamSets();
  sim.flagContacts = emptyTeamSets();
  const perTeam = Object.fromEntries(
    TEAM_IDS.map((teamId) => [teamId, 0]),
  ) as Record<TeamId, number>;
  for (const ship of sim.ships.values()) {
    const spawn = spawnPositionAt(
      sim.ctf.basePositions[ship.teamId],
      perTeam[ship.teamId]++,
    );
    teleportShip(ship.body, spawn);
    ship.position.set(...spawn);
    ship.previousPosition.copy(ship.position);
    resetShipMotion(ship);
    ship.health = MAX_HEALTH;
    ship.dead = false;
    ship.respawnAt = 0;
    ship.flight = createPlayerFlightState();
    ship.speedMultiplier = 1;
    ship.queuedAbility = null;
    ship.activeAbility = null;
  }
};

/** Follows the lobby's match phase and starts rounds and countdowns. */
export const followMatchPhase = (
  sim: AirCaptureSim,
  random: () => number,
): void => {
  const { matchPhase } = prototypeMatchStore.getState();
  if (matchPhase === sim.matchPhase) return;
  if (!isMatchActive(sim.matchPhase) && isMatchActive(matchPhase))
    startRound(sim, random);
  sim.countdownEndsAt =
    matchPhase === "countdown"
      ? sim.time + MATCH_COUNTDOWN_DURATION_MS / 1000
      : null;
  sim.matchPhase = matchPhase;
};

/** Ends the countdown on game time and the match when a team reaches the target. */
export const decideMatch = (sim: AirCaptureSim, emit: Emit): void => {
  if (sim.countdownEndsAt !== null) {
    if (sim.time >= sim.countdownEndsAt) {
      sim.countdownEndsAt = null;
      void prototypeMatchStore.actions.finishCountdown();
    } else
      void prototypeMatchStore.actions.setCountdownSeconds({
        seconds: Math.ceil(sim.countdownEndsAt - sim.time),
      });
    return;
  }
  const { matchPhase, pointsToWin } = prototypeMatchStore.getState();
  if (matchPhase !== "playing") return;
  const winner = TEAM_IDS.find(
    (teamId) => sim.ctf.scores[teamId] >= pointsToWin,
  );
  if (!winner) return;
  void prototypeMatchStore.actions.endMatch({
    winner,
    finalScores: { ...sim.ctf.scores },
  });
  emit({ type: "sound", sound: "success" });
};
