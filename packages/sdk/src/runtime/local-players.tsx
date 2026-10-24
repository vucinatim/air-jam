import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAirJamConfig } from "../context/air-jam-context";
import type { AirJamInput } from "../core/input";
import { embeddedRuntimeParent } from "./embedded-parent";
import {
  createParentSeatProvider,
  startLocalPlayers,
  type LocalSeatProvider,
} from "./local-seats";

const localSeatRegistry = createContext<
  ((provider: LocalSeatProvider | null) => void) | null
>(null);

/**
 * Runs the host page's local players. Seats come from the preview workspace
 * when it registers itself, else from the embedding product; a standalone
 * page without preview phones has no local players.
 */
export const LocalPlayersHost = ({
  input,
  children,
}: {
  input: AirJamInput | undefined;
  children: ReactNode;
}) => {
  const { topology } = useAirJamConfig();
  const [registered, setRegistered] = useState<LocalSeatProvider | null>(null);
  useEffect(() => {
    if (!input) return;
    const parent = topology ? embeddedRuntimeParent(topology) : null;
    const provider =
      registered ?? (parent ? createParentSeatProvider(parent) : null);
    return provider ? startLocalPlayers(input, provider) : undefined;
  }, [input, registered, topology]);
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
