import { createContext, useContext, useEffect, useRef } from "react";
import { createAirJamDiagnosticError } from "../diagnostics";

export type SessionScope = "unscoped" | "host" | "controller";
export type RuntimeOwnerKind = "host-runtime" | "controller-runtime";
type RuntimeOwnerToken = symbol;

export interface RuntimeOwnerRegistryValue {
  claimOwner: (
    kind: RuntimeOwnerKind,
    token: RuntimeOwnerToken,
    hookName: string,
  ) => () => void;
}

export const SessionScopeContext = createContext<SessionScope>("unscoped");
export const RuntimeOwnerRegistryContext =
  createContext<RuntimeOwnerRegistryValue | null>(null);

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
    expectedScope === "host"
      ? "HostSessionProvider"
      : "ControllerSessionProvider";
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

export const useClaimSessionRuntimeOwner = (
  kind: RuntimeOwnerKind,
  hookName: string,
): void => {
  const registry = useContext(RuntimeOwnerRegistryContext);
  const tokenRef = useRef<RuntimeOwnerToken | null>(null);
  if (!tokenRef.current) {
    tokenRef.current = Symbol(`${kind}:${hookName}`);
  }

  useEffect(() => {
    if (!registry) {
      return;
    }
    return registry.claimOwner(kind, tokenRef.current!, hookName);
  }, [registry, kind, hookName]);
};
