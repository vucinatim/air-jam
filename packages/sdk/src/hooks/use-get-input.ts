/**
 * @module useGetInput
 * @description Lightweight hook for accessing controller input without triggering re-renders.
 *
 * This hook is designed for performance-critical code paths like game loops
 * where you need to read input frequently without causing React re-renders.
 *
 * **Key features:**
 * - No store subscriptions = no re-renders on state changes
 * - Typed input based on provider schema
 * - Tap-safe behavior handling (booleans pulse by default)
 * - Stable function reference across renders
 *
 * **When to use this vs useAirJamHost().getInput:**
 * - Use `useGetInput()` in components that render frequently (game objects, particles)
 * - Use `useAirJamHost().getInput` in host-facing UI or child components that already read host runtime state
 */
import { useContext } from "react";
import type { z } from "zod";
import { useAssertSessionScope } from "../context/session-scope";
import { createAirJamDiagnosticError } from "../diagnostics";
import { hostRuntimeContext } from "../runtime/runtime-owner-contexts";
import type { AirJamHostRuntimeControls } from "./use-air-jam-host";

/**
 * Lightweight hook for accessing controller input without store subscriptions.
 *
 * Returns a stable `getInput` function that retrieves the latest input for a
 * given controller ID. Unlike `useAirJamHost()`, this hook does NOT subscribe
 * to host session state, so it won't cause re-renders when connection state changes.
 *
 * **Requirements:**
 * - Must be used within `airjam.Host` or the underlying scoped host runtime
 * - Input configuration must be provided to the provider
 *
 * @template TSchema - Zod schema type for input (from provider)
 * @returns A stable function that retrieves input for a controller ID
 *
 * @example In a game loop (React Three Fiber)
 * ```tsx
 * const Ship = ({ playerId }: { playerId: string }) => {
 *   const getInput = useGetInput<typeof gameInputSchema>();
 *   const meshRef = useRef<THREE.Mesh>(null);
 *
 *   useFrame(() => {
 *     const input = getInput(playerId);
 *     if (!input || !meshRef.current) return;
 *
 *     // Move ship based on joystick
 *     meshRef.current.position.x += input.vector.x * SPEED;
 *     meshRef.current.position.y += input.vector.y * SPEED;
 *
 *     // Fire if action button pressed (tap-safe pulse)
 *     if (input.action) {
 *       fireLaser();
 *     }
 *   });
 *
 *   return <mesh ref={meshRef}>...</mesh>;
 * };
 * ```
 *
 * @example In a regular React component
 * ```tsx
 * const InputDebugger = ({ playerId }: { playerId: string }) => {
 *   const getInput = useGetInput();
 *   const [display, setDisplay] = useState<string>("");
 *
 *   useEffect(() => {
 *     const interval = setInterval(() => {
 *       const input = getInput(playerId);
 *       setDisplay(JSON.stringify(input, null, 2));
 *     }, 100);
 *     return () => clearInterval(interval);
 *   }, [playerId, getInput]);
 *
 *   return <pre>{display}</pre>;
 * };
 * ```
 */
export const useGetInput = <TSchema extends z.ZodSchema = z.ZodSchema>(): ((
  controllerId: string,
) => z.infer<TSchema> | undefined) => {
  useAssertSessionScope("host", "useGetInput");

  const runtime = useContext(hostRuntimeContext) as Pick<
    AirJamHostRuntimeControls<TSchema>,
    "getInput"
  > | null;
  if (!runtime)
    throw createAirJamDiagnosticError(
      "AJ_SCOPE_MISMATCH",
      "useGetInput requires a mounted host runtime boundary. Wrap the host tree with <airjam.Host>.",
      {
        hookName: "useGetInput",
        expectedScope: "host",
        receivedScope: "host",
      },
    );
  return runtime.getInput;
};
