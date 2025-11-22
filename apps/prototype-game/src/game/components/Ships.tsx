import { useGameStore } from "../game-store";
import { Ship } from "./Ship";

export function Ships() {
  const players = useGameStore((state) => state.players);

  return (
    <>
      {players.map((player, index) => {
        const angle = (index / Math.max(players.length, 1)) * Math.PI * 2;
        const position: [number, number, number] = [
          Math.cos(angle) * 20,
          2,
          Math.sin(angle) * 20,
        ];

        return (
          <Ship
            key={player.controllerId}
            controllerId={player.controllerId}
            input={player.input}
            position={position}
          />
        );
      })}
    </>
  );
}
