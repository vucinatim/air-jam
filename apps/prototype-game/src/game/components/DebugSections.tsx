import { useGameStore } from "../game-store";
import { useHealthStore } from "../health-store";
import { useLasersStore } from "../lasers-store";
import { useDecalsStore } from "../decals-store";
import {
  useAbilitiesStore,
  getAllAbilityDefinitions,
  getAbilityIconPath,
} from "../abilities-store";
import { useDebugStore } from "../debug-store";
import { DebugSection } from "./DebugOverlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBotManager } from "../bot-system/BotManager";
import {
  useCaptureTheFlagStore,
  TEAM_CONFIG,
  type TeamId,
} from "../capture-the-flag-store";

const OBSTACLE_COUNT = 18; // From Obstacles.tsx

export function BotsSection() {
  const addBot = useBotManager((state) => state.addBot);
  const removeBot = useBotManager((state) => state.removeBot);
  const bots = useBotManager((state) => state.bots);

  return (
    <DebugSection title="Bots">
      <div className="space-y-3">
        <Button onClick={addBot} className="w-full" size="sm">
          Add Bot
        </Button>

        {bots.size > 0 && (
          <div className="space-y-2">
            {Array.from(bots.keys()).map((botId) => (
              <div
                key={botId}
                className="flex items-center justify-between p-2 rounded-md bg-muted/20"
              >
                <span className="text-sm font-medium">{botId}</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => removeBot(botId)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DebugSection>
  );
}

export function PlayersSection() {
  const players = useGameStore((state) => state.players);
  const health = useHealthStore((state) => state.health);
  const setHealth = useHealthStore((state) => state.setHealth);
  const collectAbility = useAbilitiesStore((state) => state.collectAbility);
  const clearAbility = useAbilitiesStore((state) => state.clearAbility);
  const getAbility = useAbilitiesStore((state) => state.getAbility);
  const isAbilityActive = useAbilitiesStore((state) => state.isAbilityActive);
  const getRemainingDuration = useAbilitiesStore(
    (state) => state.getRemainingDuration
  );

  const allAbilities = getAllAbilityDefinitions();

  const adjustHealth = (controllerId: string, delta: number) => {
    const currentHealth = health[controllerId] ?? 100;
    const newHealth = Math.max(0, Math.min(100, currentHealth + delta));
    setHealth(controllerId, newHealth);
  };

  if (players.length === 0) {
    return (
      <DebugSection title="Players">
        <p className="text-sm text-muted-foreground">No players connected</p>
      </DebugSection>
    );
  }

  return (
    <DebugSection title="Players">
      <div className="space-y-3">
        {players.map((player) => {
          const playerHealth = health[player.controllerId] ?? 100;
          const healthPercentage = (playerHealth / 100) * 100;
          const currentAbility = getAbility(player.controllerId);
          const abilityActive = isAbilityActive(player.controllerId);
          const remainingDuration = abilityActive
            ? getRemainingDuration(player.controllerId)
            : 0;

          return (
            <div
              key={player.controllerId}
              className="p-3 rounded-md border border-border bg-muted/20"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {player.profile.label ||
                      `Player ${player.controllerId.slice(0, 8)}`}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {player.controllerId.slice(0, 8)}
                </span>
              </div>

              {/* Health Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Health</span>
                  <span className="text-xs font-mono font-semibold text-foreground">
                    {Math.round(playerHealth)}/100
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-200",
                      healthPercentage > 60 && "bg-green-500",
                      healthPercentage > 30 &&
                        healthPercentage <= 60 &&
                        "bg-yellow-500",
                      healthPercentage <= 30 && "bg-red-500"
                    )}
                    style={{ width: `${healthPercentage}%` }}
                  />
                </div>
              </div>

              {/* Health Controls */}
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustHealth(player.controllerId, -10)}
                  className="flex-1 h-8 text-xs"
                >
                  -10
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustHealth(player.controllerId, -1)}
                  className="flex-1 h-8 text-xs"
                >
                  -1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustHealth(player.controllerId, 1)}
                  className="flex-1 h-8 text-xs"
                >
                  +1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustHealth(player.controllerId, 10)}
                  className="flex-1 h-8 text-xs"
                >
                  +10
                </Button>
              </div>

              {/* Ability Section */}
              <div className="border-t border-border pt-3">
                {/* Current Ability Status */}
                {currentAbility ? (
                  <div className="mb-3 p-2 rounded-md bg-background/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <img
                          src={getAbilityIconPath(currentAbility.id)}
                          alt=""
                          className="w-5 h-5 object-cover rounded-full"
                        />
                        <span className="text-sm font-medium text-foreground">
                          {currentAbility.name}
                        </span>
                      </div>
                      {abilityActive && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {remainingDuration.toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          abilityActive
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        )}
                      >
                        {abilityActive ? "Active" : "Ready"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => clearAbility(player.controllerId)}
                        className="h-6 text-xs ml-auto"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 p-2 rounded-md bg-background/50">
                    <span className="text-xs text-muted-foreground">
                      No ability equipped
                    </span>
                  </div>
                )}

                {/* Ability Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {allAbilities.map((ability) => (
                    <Button
                      key={ability.id}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        collectAbility(player.controllerId, ability.id)
                      }
                      className="h-10 flex items-center justify-center gap-1 text-xs"
                      disabled={
                        currentAbility?.id === ability.id && !abilityActive
                      }
                    >
                      <img
                        src={getAbilityIconPath(ability.id)}
                        alt=""
                        className="w-6 h-6 object-cover rounded-full"
                      />
                      <span className="text-[10px] leading-tight">
                        {ability.name}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DebugSection>
  );
}

export function SceneInfoSection() {
  const players = useGameStore((state) => state.players);
  const lasers = useLasersStore((state) => state.lasers);
  const decals = useDecalsStore((state) => state.decals);
  const freeFlyMode = useDebugStore((state) => state.freeFlyMode);
  const toggleFreeFly = useDebugStore((state) => state.toggleFreeFly);

  const stats = [
    { label: "Players", value: players.length, color: "text-blue-500" },
    { label: "Lasers", value: lasers.length, color: "text-red-500" },
    { label: "Decals", value: decals.length, color: "text-purple-500" },
    { label: "Obstacles", value: OBSTACLE_COUNT, color: "text-gray-500" },
  ];

  return (
    <DebugSection title="Scene Information">
      <div className="space-y-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between p-2 rounded-md bg-muted/20"
          >
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <span className={cn("text-sm font-mono font-semibold", stat.color)}>
              {stat.value}
            </span>
          </div>
        ))}
        <div className="pt-2 border-t border-border">
          <Button
            variant={freeFlyMode ? "default" : "outline"}
            size="sm"
            onClick={toggleFreeFly}
            className="w-full"
          >
            {freeFlyMode ? "Disable" : "Enable"} Free Fly Mode
          </Button>
          {freeFlyMode && (
            <p className="text-xs text-muted-foreground mt-2">
              Click canvas to lock mouse. WASD to move, Space/Shift for up/down.
              Press ESC to unlock.
            </p>
          )}
        </div>
      </div>
    </DebugSection>
  );
}

export function CTFDebugSection() {
  const scores = useCaptureTheFlagStore((state) => state.scores);
  const basePositions = useCaptureTheFlagStore((state) => state.basePositions);
  const manualScore = useCaptureTheFlagStore((state) => state.manualScore);

  return (
    <DebugSection title="Capture The Flag">
      <div className="space-y-3">
        {/* Scores */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Scores</h4>
          {(Object.keys(TEAM_CONFIG) as TeamId[]).map((teamId) => {
            const team = TEAM_CONFIG[teamId];
            return (
              <div
                key={teamId}
                className="flex items-center justify-between p-2 rounded-md bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="text-sm text-foreground">{team.label}</span>
                </div>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {scores[teamId] ?? 0}
                </span>
              </div>
            );
          })}
        </div>

        {/* Base Positions */}
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground">Base Positions</h4>
          {(Object.keys(TEAM_CONFIG) as TeamId[]).map((teamId) => {
            const team = TEAM_CONFIG[teamId];
            const pos = basePositions[teamId];
            return (
              <div
                key={teamId}
                className="p-2 rounded-md bg-muted/20"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="text-sm text-foreground">{team.label}</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  ({pos[0].toFixed(1)}, {pos[1].toFixed(1)}, {pos[2].toFixed(1)})
                </div>
              </div>
            );
          })}
        </div>

        {/* Manual Scoring */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            Manual Scoring
          </h4>
          <div className="space-y-2">
            {(Object.keys(TEAM_CONFIG) as TeamId[]).map((teamId) => {
              const team = TEAM_CONFIG[teamId];
              return (
                <Button
                  key={teamId}
                  variant="outline"
                  size="sm"
                  onClick={() => manualScore(teamId)}
                  className="w-full"
                  style={{ borderColor: team.color }}
                >
                  Score Point: {team.label}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Click to manually score a point for a team. This will move bases to new random positions.
          </p>
        </div>
      </div>
    </DebugSection>
  );
}
