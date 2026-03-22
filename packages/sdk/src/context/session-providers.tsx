import { createContext, useContext, type JSX } from "react";
import type { z } from "zod";
import { createAirJamDiagnosticError } from "../diagnostics";
import {
  AirJamProvider,
  type AirJamProviderProps,
} from "./air-jam-context";

export type SessionScope = "unscoped" | "host" | "controller";

const SessionScopeContext = createContext<SessionScope>("unscoped");

const createScopedSessionProvider = (
  scope: Exclude<SessionScope, "unscoped">,
): (<TSchema extends z.ZodSchema = z.ZodSchema>(
  props: AirJamProviderProps<TSchema>,
) => JSX.Element) => {
  const ScopedSessionProvider = <TSchema extends z.ZodSchema = z.ZodSchema>({
    children,
    ...providerProps
  }: AirJamProviderProps<TSchema>): JSX.Element => {
    return (
      <SessionScopeContext.Provider value={scope}>
        <AirJamProvider<TSchema> {...providerProps}>{children}</AirJamProvider>
      </SessionScopeContext.Provider>
    );
  };
  return ScopedSessionProvider;
};

export const HostSessionProvider = createScopedSessionProvider("host");
export const ControllerSessionProvider =
  createScopedSessionProvider("controller");

export const useSessionScope = (): SessionScope => {
  return useContext(SessionScopeContext);
};

export const useAssertSessionScope = (
  expectedScope: Exclude<SessionScope, "unscoped">,
  hookName: string,
): void => {
  const scope = useSessionScope();
  if (scope === expectedScope) {
    return;
  }

  const expectedProviderName =
    expectedScope === "host" ? "HostSessionProvider" : "ControllerSessionProvider";
  throw createAirJamDiagnosticError(
    "AJ_SCOPE_MISMATCH",
    `${hookName} requires ${expectedProviderName} when using scoped providers. Received scope "${scope}".`,
    {
      hookName,
      expectedScope,
      receivedScope: scope,
    },
  );
};

export type { AirJamProviderProps };
