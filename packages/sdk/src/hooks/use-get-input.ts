import { useCallback } from "react";
import type { z } from "zod";
import { useAirJamContext } from "../context/air-jam-context";

/**
 * Lightweight hook that provides access to getInput without subscribing to store state.
 * This prevents unwanted re-renders when connection state changes.
 * Gets InputManager from context (provided by AirJamProvider).
 *
 * @example
 * ```tsx
 * // In a component that only needs input (Ship, Laser, etc.)
 * const getInput = useGetInput();
 * const input = getInput(controllerId);
 * ```
 *
 * @returns A stable getInput function that retrieves input for a specific controller.
 * Returns undefined if no input is available or if input config wasn't provided to AirJamProvider.
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

