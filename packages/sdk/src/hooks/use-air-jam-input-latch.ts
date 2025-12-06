import { useCallback, useRef } from "react";

interface UseAirJamInputLatchOptions<TInput = Record<string, unknown>> {
  /**
   * Field names that should be latched as booleans.
   * Latching ensures rapid taps are never missed.
   * Example: ['action', 'ability', 'jump']
   */
  booleanFields?: (keyof TInput)[];
  /**
   * Field names that should be latched as vectors (with zero detection).
   * Vector latching keeps flicks alive for one frame after release.
   * Example: ['vector', 'direction', 'movement']
   */
  vectorFields?: (keyof TInput)[];
}

interface LatchState<TInput = Record<string, unknown>> {
  raw: TInput;
  latched: TInput;
  lastRawHash?: string; // Track if raw input changed
}

/**
 * Type-safe utility hook for adding latching behavior to input structures.
 *
 * Latching ensures rapid taps/actions are never missed by keeping them "true"
 * for one frame after they're released. Useful for gamepad buttons and stick flicks.
 *
 * Preserves input types through the latching process.
 *
 * @example
 * ```tsx
 * const inputSchema = z.object({
 *   vector: z.object({ x: z.number(), y: z.number() }),
 *   action: z.boolean(),
 *   ability: z.boolean(),
 * });
 * type GameInput = z.infer<typeof inputSchema>;
 *
 * const { popInput } = useAirJamInput<GameInput>({ roomId, schema: inputSchema });
 * const { getLatched } = useAirJamInputLatch<GameInput>({
 *   booleanFields: ['action', 'ability'],
 *   vectorFields: ['vector'],
 * });
 *
 * useFrame(() => {
 *   const raw = popInput(controllerId);
 *   if (raw) {
 *     const latched = getLatched(controllerId, raw);
 *     // latched is fully typed as GameInput - rapid taps are guaranteed to be caught
 *   }
 * });
 * ```
 */
export const useAirJamInputLatch = <TInput = Record<string, unknown>>(
  options: UseAirJamInputLatchOptions<TInput> = {},
): {
  /**
   * Returns latched version of input for a controller.
   * Maintains state across calls to track previous values.
   * If rawInput is undefined, uses previous raw state (allows latching to persist).
   * Preserves the input type TInput.
   */
  getLatched: (
    controllerId: string,
    rawInput: TInput | undefined,
  ) => TInput | undefined;
  /**
   * Clears latching state for a controller.
   */
  clearState: (controllerId: string) => void;
} => {
  const { booleanFields = [], vectorFields = [] } = options;
  const latchState = useRef<Map<string, LatchState<TInput>>>(new Map());

  const getLatched = useCallback(
    (
      controllerId: string,
      rawInput: TInput | undefined,
    ): TInput | undefined => {
      // If no raw input, use previous raw state (allows latching to persist)
      const state = latchState.current.get(controllerId);
      const actualRaw = rawInput ?? state?.raw;

      if (!actualRaw) {
        return undefined;
      }

      // Simple hash to detect if raw input changed
      const rawHash = JSON.stringify(actualRaw);
      const rawChanged = rawHash !== state?.lastRawHash;

      // If raw hasn't changed and we have previous state, we already consumed
      // Return raw (reset behavior - like old popInput did)
      if (!rawChanged && state) {
        // Reset latched to raw for next frame (consume behavior)
        const resetLatched = { ...actualRaw } as TInput;
        const resetLatchedRecord = resetLatched as Record<string, unknown>;
        const actualRawRecord = actualRaw as Record<string, unknown>;

        // Reset boolean fields to raw
        for (const field of booleanFields) {
          const fieldStr = String(field);
          const rawValue = actualRawRecord[fieldStr];
          resetLatchedRecord[fieldStr] = rawValue ?? false;
        }

        // Reset vector fields to raw
        for (const field of vectorFields) {
          const fieldStr = String(field);
          const rawValue = actualRawRecord[fieldStr];
          if (
            rawValue &&
            typeof rawValue === "object" &&
            !Array.isArray(rawValue)
          ) {
            const rawVec = rawValue as { x?: unknown; y?: unknown };
            if (typeof rawVec.x === "number" && typeof rawVec.y === "number") {
              resetLatchedRecord[fieldStr] = rawVec;
            } else {
              resetLatchedRecord[fieldStr] = { x: 0, y: 0 };
            }
          } else {
            resetLatchedRecord[fieldStr] = { x: 0, y: 0 };
          }
        }

        // Update state with reset values
        latchState.current.set(controllerId, {
          raw: actualRaw,
          latched: resetLatched,
          lastRawHash: rawHash,
        });

        return resetLatched; // Return raw (consumed)
      }

      // New input or first call - calculate latched
      const prevLatched = state?.latched ?? ({} as TInput);

      const latched = { ...actualRaw } as TInput;
      const latchedRecord = latched as Record<string, unknown>;
      const actualRawRecord = actualRaw as Record<string, unknown>;
      const prevLatchedRecord = prevLatched as Record<string, unknown>;

      // Latch boolean fields
      for (const field of booleanFields) {
        const fieldStr = String(field);
        const rawValue = actualRawRecord[fieldStr];
        const prevValue = prevLatchedRecord[fieldStr];

        if (typeof rawValue === "boolean") {
          // Latch: true if currently true OR was true last frame
          latchedRecord[fieldStr] = rawValue || prevValue === true;
        }
      }

      // Latch vector fields (with zero detection)
      for (const field of vectorFields) {
        const fieldStr = String(field);
        const rawValue = actualRawRecord[fieldStr];
        const prevValue = prevLatchedRecord[fieldStr];

        if (
          rawValue &&
          typeof rawValue === "object" &&
          !Array.isArray(rawValue)
        ) {
          const rawVec = rawValue as { x?: unknown; y?: unknown };
          const prevVec = prevValue as { x?: unknown; y?: unknown } | undefined;

          if (typeof rawVec.x === "number" && typeof rawVec.y === "number") {
            const isRawActive = rawVec.x !== 0 || rawVec.y !== 0;
            const isPrevActive =
              prevVec &&
              typeof prevVec.x === "number" &&
              typeof prevVec.y === "number" &&
              (prevVec.x !== 0 || prevVec.y !== 0);

            if (isRawActive) {
              // Currently active - use current value
              latchedRecord[fieldStr] = rawVec;
            } else if (isPrevActive) {
              // Just released but was active - keep previous value (flick)
              latchedRecord[fieldStr] = prevVec;
            } else {
              // Not active - use zero
              latchedRecord[fieldStr] = { x: 0, y: 0 };
            }
          }
        }
      }

      // Store state for next frame
      latchState.current.set(controllerId, {
        raw: actualRaw,
        latched,
        lastRawHash: rawHash,
      });

      return latched;
    },
    [booleanFields, vectorFields],
  );

  const clearState = useCallback((controllerId: string): void => {
    latchState.current.delete(controllerId);
  }, []);

  return {
    getLatched,
    clearState,
  };
};
