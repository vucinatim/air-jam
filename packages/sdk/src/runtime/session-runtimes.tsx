import type { JSX, ReactNode } from "react";
import type { z } from "zod";
import {
  ControllerSessionProvider,
  HostSessionProvider,
  type AirJamProviderProps,
} from "../context/session-providers";
import { PlatformSettingsBoundary } from "../settings/platform-settings-runtime";
import type {
  AirJamControllerOptions,
} from "../hooks/use-air-jam-controller";
import type { AirJamHostOptions } from "../hooks/use-air-jam-host";
import { useControllerRuntimeApi } from "../hooks/internal/use-controller-runtime-api";
import { useHostRuntimeApi } from "../hooks/internal/use-host-runtime-api";
import {
  controllerRuntimeContext,
  hostRuntimeContext,
} from "./runtime-owner-contexts";

export type AirJamHostRuntimeProps<
  TSchema extends z.ZodSchema = z.ZodSchema,
> = AirJamProviderProps<TSchema> &
  AirJamHostOptions & {
    children: ReactNode;
  };

export type AirJamControllerRuntimeProps = AirJamProviderProps &
  AirJamControllerOptions & {
    children: ReactNode;
  };

const HostRuntimeOwner = <TSchema extends z.ZodSchema = z.ZodSchema>({
  children,
  roomId,
  onPlayerJoin,
  onPlayerLeave,
}: Pick<
  AirJamHostRuntimeProps<TSchema>,
  "children" | "roomId" | "onPlayerJoin" | "onPlayerLeave"
>): JSX.Element => {
  const runtime = useHostRuntimeApi<TSchema>(
    {
      roomId,
      onPlayerJoin,
      onPlayerLeave,
    },
    "AirJamHostRuntime",
  );

  return (
    <hostRuntimeContext.Provider value={runtime}>
      {children}
    </hostRuntimeContext.Provider>
  );
};

const ControllerRuntimeOwner = ({
  children,
  roomId,
  nickname,
  avatarId,
  controllerId,
  onState,
}: Pick<
  AirJamControllerRuntimeProps,
  "children" | "roomId" | "nickname" | "avatarId" | "controllerId" | "onState"
>): JSX.Element => {
  const runtime = useControllerRuntimeApi(
    {
      roomId,
      nickname,
      avatarId,
      controllerId,
      onState,
    },
    "AirJamControllerRuntime",
  );

  return (
    <controllerRuntimeContext.Provider value={runtime}>
      {children}
    </controllerRuntimeContext.Provider>
  );
};

export const AirJamHostRuntime = <
  TSchema extends z.ZodSchema = z.ZodSchema,
>({
  children,
  roomId,
  onPlayerJoin,
  onPlayerLeave,
  ...providerProps
}: AirJamHostRuntimeProps<TSchema>): JSX.Element => {
  return (
    <HostSessionProvider<TSchema> {...providerProps}>
      <PlatformSettingsBoundary>
        <HostRuntimeOwner<TSchema>
          roomId={roomId}
          onPlayerJoin={onPlayerJoin}
          onPlayerLeave={onPlayerLeave}
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
  onState,
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
          onState={onState}
        >
          {children}
        </ControllerRuntimeOwner>
      </PlatformSettingsBoundary>
    </ControllerSessionProvider>
  );
};
