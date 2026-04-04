import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type JSX,
} from "react";
import type { z } from "zod";
import { createAirJamDiagnosticError } from "../diagnostics";
import {
  AirJamProvider,
  type AirJamProviderProps,
} from "./air-jam-context";

export type SessionScope = "unscoped" | "host" | "controller";
type RuntimeOwnerKind = "host-runtime" | "controller-runtime";
type RuntimeOwnerToken = symbol;

interface RuntimeOwnerRegistryValue {
  claimOwner: (
    kind: RuntimeOwnerKind,
    token: RuntimeOwnerToken,
    hookName: string,
  ) => () => void;
}

const SessionScopeContext = createContext<SessionScope>("unscoped");
const RuntimeOwnerRegistryContext =
  createContext<RuntimeOwnerRegistryValue | null>(null);

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

    const claimOwner = useCallback<
      RuntimeOwnerRegistryValue["claimOwner"]
    >((kind, token, hookName) => {
      const existing = runtimeOwnersRef.current.get(kind);
      if (existing && existing.token !== token) {
        throw createAirJamDiagnosticError(
          "AJ_DUPLICATE_SESSION_OWNER",
          `${hookName} mounted while another ${kind} already owns this session provider. Mount one runtime owner hook per provider tree and use a read-only session hook in child components instead.`,
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
    }, [scope]);

    return (
      <SessionScopeContext.Provider value={scope}>
        <RuntimeOwnerRegistryContext.Provider value={{ claimOwner }}>
          <AirJamProvider<TSchema> {...providerProps}>{children}</AirJamProvider>
        </RuntimeOwnerRegistryContext.Provider>
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

export type { AirJamProviderProps };
