import { Collectible } from "../components/entities/collectible";
import { useCollectiblesStore } from "../stores/world/collectibles-store";

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
