import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAirJamConfig } from "../context/air-jam-context";
import type { AirJamInput } from "../core/input";
import type { AirJamInputBindings } from "../core/input-bindings";
import { embeddedRuntimeParent } from "./embedded-parent";
import {
  connectParentSeats,
  startLocalPlayers,
  type LocalSeatProvider,
} from "./local-seats";

const localSeatRegistry = createContext<
  ((provider: LocalSeatProvider | null) => void) | null
>(null);

/**
 * Runs the host page's local players. Seats come from the preview workspace
 * when it registers itself, else from the embedding product once it says it
 * provides them; without either, keys and gamepads stay the page's own.
 */
export const LocalPlayersHost = ({
  input,
  bindings,
  children,
}: {
  input: AirJamInput | undefined;
  bindings: AirJamInputBindings | undefined;
  children: ReactNode;
}) => {
  const { topology } = useAirJamConfig();
  const [registered, setRegistered] = useState<LocalSeatProvider | null>(null);
  useEffect(() => {
    if (!input || !bindings) return;
    if (registered) return startLocalPlayers(input, bindings, registered);
    const parent = topology ? embeddedRuntimeParent(topology) : null;
    if (!parent) return;
    let stopPlayers = () => {};
    const disconnect = connectParentSeats(parent, (provider) => {
      stopPlayers = startLocalPlayers(input, bindings, provider);
    });
    return () => {
      disconnect();
      stopPlayers();
    };
  }, [input, bindings, registered, topology]);
  return (
    <localSeatRegistry.Provider value={setRegistered}>
      {children}
    </localSeatRegistry.Provider>
  );
};

/** Offers this surface's preview phones as local players' seats while mounted. */
export const useProvideLocalSeats = (provider: LocalSeatProvider | null) => {
  const register = useContext(localSeatRegistry);
  useEffect(() => {
    if (!register || !provider) return;
    register(provider);
    return () => register(null);
  }, [register, provider]);
};
