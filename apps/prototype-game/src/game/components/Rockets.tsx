import { useRocketsStore } from "../rockets-store";
import { Rocket } from "./Rocket";

export function Rockets() {
  const rockets = useRocketsStore((state) => state.rockets);

  return (
    <>
      {rockets.map((rocket) => (
        <Rocket
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





