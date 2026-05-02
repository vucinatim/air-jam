import { useAirJamHost } from "@air-jam/sdk";
import { PlayerAvatar } from "@air-jam/sdk/ui";

export function OfficeHostPlayerStrip() {
  const players = useAirJamHost((state) => state.players);

  return (
    <div className="mt-4 flex gap-4">
      {players.slice(0, 2).map((player) => (
        <PlayerAvatar key={player.id} player={player} size="sm" />
      ))}
    </div>
  );
}
