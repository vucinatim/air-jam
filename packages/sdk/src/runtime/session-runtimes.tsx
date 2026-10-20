import type { JSX, ReactNode } from "react";
import { useEffect, useMemo } from "react";
import type { z } from "zod";
import type { AnyAirJamAgentContract } from "../agent/agent-contract";
import { useAirJamConfig } from "../context/air-jam-context";
import {
  ControllerSessionProvider,
  HostSessionProvider,
  type AirJamProviderProps,
} from "../context/session-providers";
import { useControllerRuntimeApi } from "../hooks/internal/use-controller-runtime-api";
import { useHostRuntimeApi } from "../hooks/internal/use-host-runtime-api";
import type { AirJamControllerOptions } from "../hooks/use-air-jam-controller";
import type { AirJamHostOptions } from "../hooks/use-air-jam-host";
import {
  useControllerRuntimeInspectionContract,
  useHostRuntimeInspectionContract,
} from "../runtime-inspection";
import { PlatformSettingsBoundary } from "../settings/platform-settings-runtime";
import type { AirJamStoreDeclaration } from "../store/create-air-jam-store";
import { registerHostAgentContract } from "./contracts/control";
import {
  publishRuntimeInspectionContract,
  readRuntimeInspectionContract,
} from "./contracts/inspection";
import { publishEmbeddedHostAgent } from "./host-agent-bridge";
import { publishEmbeddedHostPreview } from "./preview-inspection-bridge";
import {
  controllerRuntimeContext,
  declaredStoresContext,
  hostRuntimeContext,
} from "./runtime-owner-contexts";

export type AirJamHostRuntimeProps<TSchema extends z.ZodSchema = z.ZodSchema> =
  AirJamProviderProps<TSchema> &
    AirJamHostOptions & {
      children: ReactNode;
      agent?: AnyAirJamAgentContract;
      gameId?: string;
      /** Replicated stores this host owns; they sync while it runs. */
      stores?: readonly AirJamStoreDeclaration[];
    };

export type AirJamControllerRuntimeProps = AirJamProviderProps &
  AirJamControllerOptions & {
    children: ReactNode;
    /** Replicated stores this controller mirrors while it runs. */
    stores?: readonly AirJamStoreDeclaration[];
  };

const NO_STORES: readonly AirJamStoreDeclaration[] = [];

/** The core stores behind declared store hooks, stable while the declarations are. */
const useDeclaredStores = (declarations: readonly AirJamStoreDeclaration[]) =>
  useMemo(
    () => declarations.map((declaration) => declaration.store),
    [declarations],
  );

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

const HostRuntimeOwner = <TSchema extends z.ZodSchema = z.ZodSchema>({
  children,
  roomId,
  onPlayerJoin,
  onPlayerLeave,
  agent,
  gameId,
  stores = NO_STORES,
}: Pick<
  AirJamHostRuntimeProps<TSchema>,
  | "children"
  | "roomId"
  | "onPlayerJoin"
  | "onPlayerLeave"
  | "agent"
  | "gameId"
  | "stores"
>): JSX.Element => {
  const declaredStores = useDeclaredStores(stores);
  const declared = useMemo(() => new Set(declaredStores), [declaredStores]);
  const runtime = useHostRuntimeApi<TSchema>(
    {
      roomId,
      onPlayerJoin,
      onPlayerLeave,
    },
    "AirJamHostRuntime",
    declaredStores,
  );

  useEffect(() => {
    if (!agent || !runtime.roomId) return;
    return registerHostAgentContract(window, {
      roomId: runtime.roomId,
      gameId: gameId ?? "game",
      contract: agent,
    });
  }, [agent, gameId, runtime.roomId]);

  return (
    <hostRuntimeContext.Provider value={runtime}>
      <declaredStoresContext.Provider value={declared}>
        <HostRuntimeInspectionPublisher />
        {children}
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
>): JSX.Element => {
  const declaredStores = useDeclaredStores(stores);
  const declared = useMemo(() => new Set(declaredStores), [declaredStores]);
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
    declaredStores,
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

export const AirJamHostRuntime = <TSchema extends z.ZodSchema = z.ZodSchema>({
  children,
  roomId,
  onPlayerJoin,
  onPlayerLeave,
  agent,
  gameId,
  stores,
  ...providerProps
}: AirJamHostRuntimeProps<TSchema>): JSX.Element => {
  return (
    <HostSessionProvider<TSchema> {...providerProps}>
      <PlatformSettingsBoundary>
        <HostRuntimeOwner<TSchema>
          roomId={roomId}
          onPlayerJoin={onPlayerJoin}
          onPlayerLeave={onPlayerLeave}
          agent={agent}
          gameId={gameId}
          stores={stores}
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
        >
          {children}
        </ControllerRuntimeOwner>
      </PlatformSettingsBoundary>
    </ControllerSessionProvider>
  );
};
