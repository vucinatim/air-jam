import type { JSX, ReactNode } from "react";
import { useEffect, useMemo } from "react";
import type { AnyAirJamAgentContract } from "../agent/agent-contract";
import { useAirJamConfig } from "../context/air-jam-context";
import {
  ControllerSessionProvider,
  HostSessionProvider,
  type AirJamProviderProps,
} from "../context/session-providers";
import type { AirJamInput } from "../core/input";
import type { AirJamInputBindings } from "../core/input-bindings";
import type { AttachableStore } from "../core/replicated-store";
import type { AirJamSimulationDeclaration } from "../core/simulation";
import { useControllerRuntimeApi } from "../hooks/internal/use-controller-runtime-api";
import { useHostRuntimeApi } from "../hooks/internal/use-host-runtime-api";
import {
  useControllerRuntimeInspectionContract,
  useHostRuntimeInspectionContract,
} from "../hooks/internal/use-runtime-inspection-contract";
import type { AirJamControllerOptions } from "../hooks/use-air-jam-controller";
import type { AirJamHostOptions } from "../hooks/use-air-jam-host";
import { PlatformSettingsBoundary } from "../settings/platform-settings-runtime";
import {
  publishRuntimeInspectionContract,
  readRuntimeInspectionContract,
} from "./contracts/inspection";
import { publishEmbeddedHostAgent } from "./host-agent-bridge";
import { LocalPlayersHost } from "./local-players";
import { publishEmbeddedHostPreview } from "./preview-inspection-bridge";
import {
  controllerRuntimeContext,
  declaredStoresContext,
  hostRuntimeContext,
} from "./runtime-owner-contexts";

export type AirJamHostRuntimeProps = AirJamProviderProps &
  AirJamHostOptions & {
    children: ReactNode;
    agent?: AnyAirJamAgentContract;
    gameId?: string;
    /** Replicated stores this host owns; they sync while it runs. */
    stores?: readonly AttachableStore[];
    /** The game's simulation, advanced on the SDK clock while the host runs. */
    simulation?: AirJamSimulationDeclaration;
    /** The game's declared controls, read in simulation steps. */
    input?: AirJamInput;
    /** Keyboard layouts and gamepads that join as local players. */
    inputBindings?: AirJamInputBindings;
  };

export type AirJamControllerRuntimeProps = AirJamProviderProps &
  AirJamControllerOptions & {
    children: ReactNode;
    /** Replicated stores this controller mirrors while it runs. */
    stores?: readonly AttachableStore[];
    /** The game's declared controls; this controller sends them. */
    input?: AirJamInput;
  };

const NO_STORES: readonly AttachableStore[] = [];

const HostRuntimeInspectionPublisher = (): null => {
  const inspection = useHostRuntimeInspectionContract();
  const { topology } = useAirJamConfig();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    publishRuntimeInspectionContract(window, inspection);
    const hostAgent = publishEmbeddedHostAgent(inspection, topology);
    const stopPublishing = publishEmbeddedHostPreview(
      inspection,
      topology,
      hostAgent.supported,
    );
    return () => {
      stopPublishing();
      hostAgent.close();
      if (readRuntimeInspectionContract(window)?.role === "host") {
        publishRuntimeInspectionContract(window, null);
      }
    };
  }, [inspection, topology]);

  return null;
};

const ControllerRuntimeInspectionPublisher = (): null => {
  const inspection = useControllerRuntimeInspectionContract();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    publishRuntimeInspectionContract(window, inspection);
    return () => {
      if (readRuntimeInspectionContract(window)?.role === "controller") {
        publishRuntimeInspectionContract(window, null);
      }
    };
  }, [inspection]);

  return null;
};

const HostRuntimeOwner = ({
  children,
  roomId,
  onPlayerJoin,
  onPlayerLeave,
  agent,
  gameId,
  stores = NO_STORES,
  simulation,
  input,
  inputBindings,
}: Pick<
  AirJamHostRuntimeProps,
  | "children"
  | "roomId"
  | "onPlayerJoin"
  | "onPlayerLeave"
  | "agent"
  | "gameId"
  | "stores"
  | "simulation"
  | "input"
  | "inputBindings"
>): JSX.Element => {
  const declared = useMemo(() => new Set(stores), [stores]);
  const game = useMemo(
    () => ({
      stores,
      simulation,
      input,
      agent: agent && { contract: agent, gameId: gameId ?? "game" },
    }),
    [stores, simulation, input, agent, gameId],
  );
  const runtime = useHostRuntimeApi(
    {
      roomId,
      onPlayerJoin,
      onPlayerLeave,
    },
    "AirJamHostRuntime",
    game,
  );

  return (
    <hostRuntimeContext.Provider value={runtime}>
      <declaredStoresContext.Provider value={declared}>
        <HostRuntimeInspectionPublisher />
        <LocalPlayersHost input={input} bindings={inputBindings}>
          {/* The game draws once its declared simulation has loaded. */}
          {simulation && !runtime.simulation ? null : children}
        </LocalPlayersHost>
      </declaredStoresContext.Provider>
    </hostRuntimeContext.Provider>
  );
};

const ControllerRuntimeOwner = ({
  children,
  roomId,
  nickname,
  avatarId,
  controllerId,
  capabilityToken,
  onState,
  stores = NO_STORES,
  input,
}: Pick<
  AirJamControllerRuntimeProps,
  | "children"
  | "roomId"
  | "nickname"
  | "avatarId"
  | "controllerId"
  | "capabilityToken"
  | "onState"
  | "stores"
  | "input"
>): JSX.Element => {
  const declared = useMemo(() => new Set(stores), [stores]);
  const runtime = useControllerRuntimeApi(
    {
      roomId,
      nickname,
      avatarId,
      controllerId,
      capabilityToken,
      onState,
    },
    "AirJamControllerRuntime",
    stores,
    input,
  );

  return (
    <controllerRuntimeContext.Provider value={runtime}>
      <declaredStoresContext.Provider value={declared}>
        <ControllerRuntimeInspectionPublisher />
        {children}
      </declaredStoresContext.Provider>
    </controllerRuntimeContext.Provider>
  );
};

export const AirJamHostRuntime = ({
  children,
  roomId,
  onPlayerJoin,
  onPlayerLeave,
  agent,
  gameId,
  stores,
  simulation,
  input,
  inputBindings,
  ...providerProps
}: AirJamHostRuntimeProps): JSX.Element => {
  return (
    <HostSessionProvider {...providerProps}>
      <PlatformSettingsBoundary>
        <HostRuntimeOwner
          roomId={roomId}
          onPlayerJoin={onPlayerJoin}
          onPlayerLeave={onPlayerLeave}
          agent={agent}
          gameId={gameId}
          stores={stores}
          simulation={simulation}
          input={input}
          inputBindings={inputBindings}
        >
          {children}
        </HostRuntimeOwner>
      </PlatformSettingsBoundary>
    </HostSessionProvider>
  );
};

export const AirJamControllerRuntime = ({
  children,
  roomId,
  nickname,
  avatarId,
  controllerId,
  capabilityToken,
  onState,
  stores,
  input,
  ...providerProps
}: AirJamControllerRuntimeProps): JSX.Element => {
  return (
    <ControllerSessionProvider {...providerProps}>
      <PlatformSettingsBoundary>
        <ControllerRuntimeOwner
          roomId={roomId}
          nickname={nickname}
          avatarId={avatarId}
          controllerId={controllerId}
          capabilityToken={capabilityToken}
          onState={onState}
          stores={stores}
          input={input}
        >
          {children}
        </ControllerRuntimeOwner>
      </PlatformSettingsBoundary>
    </ControllerSessionProvider>
  );
};
