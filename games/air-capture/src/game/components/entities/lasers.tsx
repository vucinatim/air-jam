import { useLasersStore } from "../../stores/projectiles/lasers-store";
import { Laser } from "./laser";

export function Lasers() {
  const lasers = useLasersStore((state) => state.lasers);

  return (
    <>
      {lasers.map((laser) => (
        <Laser
          key={laser.id}
          id={laser.id}
          position={laser.position}
          direction={laser.direction}
          controllerId={laser.controllerId}
        />
      ))}
    </>
  );
}
