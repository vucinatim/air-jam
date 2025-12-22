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
 * - Automatic latching support (if configured)
 * - Stable function reference across renders
 *
 * **When to use this vs useAirJamHost().getInput:**
 * - Use `useGetInput()` in components that render frequently (game objects, particles)
 * - Use `useAirJamHost().getInput` when you already need other host state
 */
import { useCallback } from "react";
import type { z } from "zod";
import { useAirJamContext } from "../context/air-jam-context";

/**
 * Lightweight hook for accessing controller input without store subscriptions.
 *
 * Returns a stable `getInput` function that retrieves the latest input for a
 * given controller ID. Unlike `useAirJamHost()`, this hook does NOT subscribe
 * to the store, so it won't cause re-renders when connection state changes.
 *
 * **Requirements:**
 * - Must be used within an `AirJamProvider`
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
 *     // Fire if action button pressed (auto-latched)
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
  const { inputManager } = useAirJamContext();

  // Use useCallback to return a stable function reference
  // Access InputManager directly from context (no store subscriptions)
  return useCallback(
    (controllerId: string): z.infer<TSchema> | undefined => {
      if (!inputManager) {
        return undefined;
      }

      return inputManager.getInput(controllerId) as
        | z.infer<TSchema>
        | undefined;
    },
    [inputManager],
  );
};
