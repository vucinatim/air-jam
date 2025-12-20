import { useCallback, useRef } from "react";
import type { z } from "zod";
import { useAirJamContext } from "../context/AirJamProvider";

interface UseAirJamInputOptions<TInput = Record<string, unknown>> {
  /**
   * Optional: Zod schema for input validation and type inference.
   */
  schema?: z.ZodSchema<TInput>;
}

export interface ControllerHandle<TInput> {
  /**
   * The raw input state for this controller in the current frame.
   */
  readonly raw: TInput;
  /**
   * Returns true if the field is currently "truthy" (e.g. button held down).
   */
  isDown: (field: keyof TInput) => boolean;
  /**
   * Returns true only on the frame the field transitioned from falsey to truthy.
   */
  justPressed: (field: keyof TInput) => boolean;
  /**
   * Returns true only on the frame the field transitioned from truthy to falsey.
   */
  justReleased: (field: keyof TInput) => boolean;
  /**
   * Returns the vector for a given field, defaulting to {x:0, y:0}.
   */
  vector: (field: keyof TInput) => { x: number; y: number };
}

/**
 * The "Perfect" Input Hook.
 * Provides a high-performance, intelligent interface for reading controller inputs.
 * Zero React re-renders.
 */
export const useAirJamInput = <TInput extends Record<string, any>>(
  options: UseAirJamInputOptions<TInput> = {},
) => {
  const { inputBuffer } = useAirJamContext();
  const { schema } = options;

  // Internal state to track previous frame values for edge detection
  // Key: controllerId, Value: Map of fields to their previous values
  const prevFrameMap = useRef<Map<string, Map<keyof TInput, any>>>(new Map());
  // Track which controllers have been "polled" this frame to update prev values correctly
  // In a real game loop, we'd want a clear 'tick' call, but we can simulate it by
  // detecting when the raw input changes.
  const lastRawMap = useRef<Map<string, TInput>>(new Map());

  const getController = useCallback((controllerId: string): ControllerHandle<TInput> | null => {
    const rawInput = inputBuffer.get(controllerId) as TInput;
    if (!rawInput) return null;

    // Validate schema if provided
    let validatedInput = rawInput;
    if (schema) {
      const result = schema.safeParse(rawInput);
      if (result.success) {
        validatedInput = result.data as TInput;
      } else {
        // Fallback or warn? For performance, we'll just use raw if validation fails after one warning
        return null;
      }
    }

    const lastRaw = lastRawMap.current.get(controllerId);
    let prevValues = prevFrameMap.current.get(controllerId);
    if (!prevValues) {
      prevValues = new Map();
      prevFrameMap.current.set(controllerId, prevValues);
    }

    // If the raw input has changed since we last generated a handle, 
    // update the "previous frame" values.
    if (lastRaw && lastRaw !== validatedInput) {
      for (const key in lastRaw) {
        prevValues.set(key as keyof TInput, lastRaw[key]);
      }
    }
    lastRawMap.current.set(controllerId, validatedInput);

    return {
      raw: validatedInput,
      isDown: (field) => !!validatedInput[field],
      justPressed: (field) => {
        const current = !!validatedInput[field];
        const prev = !!prevValues!.get(field);
        return current && !prev;
      },
      justReleased: (field) => {
        const current = !!validatedInput[field];
        const prev = !!prevValues!.get(field);
        return !current && prev;
      },
      vector: (field) => {
        const val = validatedInput[field] as any;
        if (val && typeof val === "object" && "x" in val && "y" in val) {
          return val as { x: number; y: number };
        }
        return { x: 0, y: 0 };
      },
    };
  }, [inputBuffer, schema]);

  const clearInput = useCallback((controllerId: string) => {
    inputBuffer.delete(controllerId);
    prevFrameMap.current.delete(controllerId);
    lastRawMap.current.delete(controllerId);
  }, [inputBuffer]);

  return { getController, clearInput };
};
