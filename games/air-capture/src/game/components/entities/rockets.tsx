import { useRocketsStore } from "../../stores/projectiles/rockets-store";
import { RocketEntity } from "./rocket";

export function Rockets() {
  const rockets = useRocketsStore((state) => state.rockets);

  return (
    <>
      {rockets.map((rocket) => (
        <RocketEntity
          key={rocket.id}
          id={rocket.id}
          position={rocket.position}
          direction={rocket.direction}
          controllerId={rocket.controllerId}
        />
      ))}
    </>
  );
}
