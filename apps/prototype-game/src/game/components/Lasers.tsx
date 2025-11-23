import { useLasersStore } from "../lasers-store";
import { Laser } from "./Laser";

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
