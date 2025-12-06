import { useCollectiblesStore } from "../collectibles-store";
import { Collectible } from "./Collectible";

export function Collectibles() {
  const collectibles = useCollectiblesStore((state) => state.collectibles);

  return (
    <>
      {collectibles.map((collectible) => (
        <Collectible key={collectible.id} collectible={collectible} />
      ))}
    </>
  );
}
