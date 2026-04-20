import { useCallback, useRef, type JSX } from "react";
import type { z } from "zod";
import { createAirJamDiagnosticError } from "../diagnostics";
import { AirJamProvider, type AirJamProviderProps } from "./air-jam-context";
import {
  RuntimeOwnerRegistryContext,
  SessionScopeContext,
  type RuntimeOwnerKind,
  type SessionScope,
} from "./session-scope";

type RuntimeOwnerToken = symbol;

const createScopedSessionProvider = (
  scope: Exclude<SessionScope, "unscoped">,
): (<TSchema extends z.ZodSchema = z.ZodSchema>(
  props: AirJamProviderProps<TSchema>,
) => JSX.Element) => {
  const ScopedSessionProvider = <TSchema extends z.ZodSchema = z.ZodSchema>({
    children,
    ...providerProps
  }: AirJamProviderProps<TSchema>): JSX.Element => {
    const runtimeOwnersRef = useRef<
      Map<
        RuntimeOwnerKind,
        {
          token: RuntimeOwnerToken;
          hookName: string;
        }
      >
    >(new Map());

    const claimOwner = useCallback(
      (kind: RuntimeOwnerKind, token: RuntimeOwnerToken, hookName: string) => {
        const existing = runtimeOwnersRef.current.get(kind);
        if (existing && existing.token !== token) {
          throw createAirJamDiagnosticError(
            "AJ_DUPLICATE_SESSION_OWNER",
            `${hookName} mounted while another ${kind} already owns this session provider. Mount one runtime owner hook per provider tree and use useAirJamHost() or useAirJamController() in child components instead.`,
            {
              scope,
              kind,
              hookName,
              existingHookName: existing.hookName,
            },
          );
        }

        runtimeOwnersRef.current.set(kind, { token, hookName });
        return () => {
          const current = runtimeOwnersRef.current.get(kind);
          if (current?.token === token) {
            runtimeOwnersRef.current.delete(kind);
          }
        };
      },
      [],
    );

    return (
      <SessionScopeContext.Provider value={scope}>
        <RuntimeOwnerRegistryContext.Provider value={{ claimOwner }}>
          <AirJamProvider<TSchema> {...providerProps} surfaceRole={scope}>
            {children}
          </AirJamProvider>
        </RuntimeOwnerRegistryContext.Provider>
      </SessionScopeContext.Provider>
    );
  };
  return ScopedSessionProvider;
};

export const HostSessionProvider = createScopedSessionProvider("host");
export const ControllerSessionProvider =
  createScopedSessionProvider("controller");

export type { AirJamProviderProps };
