/**
 * @module InputManager
 * @description Internal input runtime used by host hooks.
 *
 * Public API terms:
 * - `pulse`: consume-on-read, tap-safe behavior (default for booleans)
 * - `hold`: keep last active vector until a new active value arrives
 * - `latest`: read current value as-is (default for vectors and other fields)
 *
 * @internal This class is not exported publicly. Use hooks to access input.
 */
import type { z } from "zod";
import type { ControllerInputEvent } from "../protocol";

type InputFieldBehavior = "pulse" | "hold" | "latest";

interface VectorValue {
  x: number;
  y: number;
}

/**
 * Configuration for input handling with optional validation and per-field behavior.
 *
 * Provided to `HostSessionProvider` to enable typed and behavior-aware input reads.
 *
 * @template TSchema - Zod schema type for input validation
 *
 * @example Basic schema validation
 * ```ts
 * const config: InputConfig = {
 *   schema: z.object({
 *     vector: z.object({ x: z.number(), y: z.number() }),
 *     action: z.boolean(),
 *   }),
 * };
 * ```
 *
 * @example With custom behavior overrides
 * ```ts
 * const config: InputConfig = {
 *   schema: gameInputSchema,
 *   behavior: {
 *     pulse: ["action", "ability"], // consume-on-read
 *     latest: ["aim"],              // read latest value
 *     hold: ["menuVector"],         // keep last non-zero vector
 *   },
 * };
 * ```
 */
export interface InputConfig<TSchema extends z.ZodSchema = z.ZodSchema> {
  /**
   * Zod schema for input validation and type inference.
   *
   * When provided:
   * - Incoming input is validated against the schema
   * - Invalid input returns `undefined` (with console warning)
   * - Return type is inferred from the schema
   *
   * @example
   * ```ts
   * schema: z.object({
   *   vector: z.object({ x: z.number(), y: z.number() }),
   *   action: z.boolean(),
   *   ability: z.boolean(),
   *   timestamp: z.number(),
   * })
   * ```
   */
  schema?: TSchema;
  behavior?: {
    /**
     * Consume-on-read behavior. Useful for tap-safe buttons and one-shot vectors.
     *
     * Defaults: booleans use `pulse` even without explicit config.
     */
    pulse?: string[];
    /**
     * Sticky behavior. For vectors, keeps the last non-zero direction until
     * another non-zero direction arrives.
     */
    hold?: string[];
    /**
     * Stateless behavior. Returns the latest raw value.
     *
     * Defaults: vectors and non-boolean fields use `latest`.
     */
    latest?: string[];
  };
}

/**
 * Internal behavior state per controller.
 * @internal
 */
interface ControllerBehaviorState {
  pulseBooleans: Set<string>;
  pulseVectors: Map<string, VectorValue>;
  holdVectors: Map<string, VectorValue>;
}

/**
 * Internal class that manages input buffering, validation, and behavior semantics.
 *
 * Created automatically by `HostSessionProvider` when input configuration is provided.
 * Access input via `useGetInput()` or `useAirJamHost().getInput()`.
 *
 * @template TSchema - Zod schema type for input validation
 *
 * @internal Not exported publicly. Use hooks to access input.
 *
 * @example How it's used internally
 * ```ts
 * // In HostSessionProvider
 * const inputManager = new InputManager({
 *   schema: gameInputSchema,
 *   behavior: { pulse: ["action"] },
 * });
 *
 * // In useAirJamHost (socket handler)
 * socket.on("server:input", (payload) => {
 *   inputManager.handleInput(payload);
 * });
 *
 * // In game loop (via useGetInput)
 * const input = inputManager.getInput(playerId);
 * ```
 */
export class InputManager<TSchema extends z.ZodSchema = z.ZodSchema> {
  private inputBuffer = new Map<string, Record<string, unknown>>();
  private behaviorState = new Map<string, ControllerBehaviorState>();
  private behaviorOverrides = new Map<string, InputFieldBehavior>();
  private config: InputConfig<TSchema>;

  constructor(config: InputConfig<TSchema> = {}) {
    this.config = config;
    this.behaviorOverrides = this.createBehaviorOverrides(config.behavior);
  }

  /**
   * Handles incoming input events from the socket.
   * Should be called when 'server:input' event is received.
   */
  handleInput(payload: ControllerInputEvent): void {
    // The server already routes by room; keep host runtime hot path minimal.
    this.inputBuffer.set(payload.controllerId, payload.input);
    this.captureTransientBehaviors(payload.controllerId, payload.input);
  }

  /**
   * Gets input for a specific controller.
   * Returns validated and typed input if schema is provided, otherwise raw Record.
   * Applies configured input behavior semantics.
   */
  getInput(controllerId: string): z.infer<TSchema> | undefined {
    const rawInput = this.inputBuffer.get(controllerId);

    if (!rawInput) {
      return undefined;
    }

    // Validate with schema if provided
    let validatedInput: Record<string, unknown> = rawInput;
    if (this.config.schema) {
      const result = this.config.schema.safeParse(rawInput);
      if (!result.success) {
        // Validation failed - log error and return undefined
        console.warn(
          `[InputManager] Invalid input for controller ${controllerId}:`,
          result.error,
        );
        return undefined;
      }
      validatedInput = result.data as Record<string, unknown>;
    }

    return this.applyBehaviors(
      controllerId,
      validatedInput as Record<string, unknown>,
    ) as z.infer<TSchema>;
  }

  /**
   * Clears input state for a controller (e.g., when player leaves).
   */
  clearInput(controllerId: string): void {
    this.inputBuffer.delete(controllerId);
    this.behaviorState.delete(controllerId);
  }

  private getBehaviorState(controllerId: string): ControllerBehaviorState {
    const existing = this.behaviorState.get(controllerId);
    if (existing) {
      return existing;
    }

    const created: ControllerBehaviorState = {
      pulseBooleans: new Set<string>(),
      pulseVectors: new Map<string, VectorValue>(),
      holdVectors: new Map<string, VectorValue>(),
    };
    this.behaviorState.set(controllerId, created);
    return created;
  }

  private createBehaviorOverrides(
    behavior: InputConfig<TSchema>["behavior"],
  ): Map<string, InputFieldBehavior> {
    const overrides = new Map<string, InputFieldBehavior>();

    const assign = (fields: string[] | undefined, mode: InputFieldBehavior) => {
      for (const field of fields ?? []) {
        const existing = overrides.get(field);
        if (existing && existing !== mode) {
          throw new Error(
            `[InputManager] Field "${field}" is configured for both "${existing}" and "${mode}".`,
          );
        }
        overrides.set(field, mode);
      }
    };

    assign(behavior?.pulse, "pulse");
    assign(behavior?.hold, "hold");
    assign(behavior?.latest, "latest");

    return overrides;
  }

  private resolveFieldBehavior(
    field: string,
    value: unknown,
  ): InputFieldBehavior {
    const override = this.behaviorOverrides.get(field);
    if (override) {
      return override;
    }
    if (typeof value === "boolean") {
      return "pulse";
    }
    if (this.isVectorValue(value)) {
      return "latest";
    }
    return "latest";
  }

  private isVectorValue(value: unknown): value is VectorValue {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const vector = value as { x?: unknown; y?: unknown };
    return typeof vector.x === "number" && typeof vector.y === "number";
  }

  private isActiveVector(vector: VectorValue): boolean {
    return vector.x !== 0 || vector.y !== 0;
  }

  private captureTransientBehaviors(
    controllerId: string,
    rawInput: Record<string, unknown>,
  ): void {
    const state = this.getBehaviorState(controllerId);

    for (const [field, value] of Object.entries(rawInput)) {
      const behavior = this.resolveFieldBehavior(field, value);

      if (behavior === "pulse") {
        if (typeof value === "boolean") {
          if (value) {
            state.pulseBooleans.add(field);
          }
          continue;
        }
        if (this.isVectorValue(value) && this.isActiveVector(value)) {
          state.pulseVectors.set(field, value);
        }
        continue;
      }

      if (behavior === "hold" && this.isVectorValue(value)) {
        if (this.isActiveVector(value)) {
          state.holdVectors.set(field, value);
        }
      }
    }
  }

  private applyBehaviors<TInput extends Record<string, unknown>>(
    controllerId: string,
    validatedInput: TInput,
  ): TInput {
    const state = this.getBehaviorState(controllerId);
    const output = { ...validatedInput } as Record<string, unknown>;
    const processedFields = new Set<string>();

    for (const [field, value] of Object.entries(validatedInput)) {
      processedFields.add(field);
      const behavior = this.resolveFieldBehavior(field, value);

      if (behavior === "latest") {
        continue;
      }

      if (behavior === "pulse") {
        if (typeof value === "boolean") {
          const pending = state.pulseBooleans.has(field);
          output[field] = value === true || pending;
          state.pulseBooleans.delete(field);
          continue;
        }

        if (this.isVectorValue(value)) {
          const pending = state.pulseVectors.get(field);
          if (pending) {
            output[field] = this.isActiveVector(value) ? value : pending;
            state.pulseVectors.delete(field);
          }
          continue;
        }

        continue;
      }

      // hold
      if (this.isVectorValue(value)) {
        if (this.isActiveVector(value)) {
          state.holdVectors.set(field, value);
          output[field] = value;
        } else {
          output[field] = state.holdVectors.get(field) ?? { x: 0, y: 0 };
        }
      }
    }

    // Include pending pulse values for optional fields not present in current payload.
    for (const field of Array.from(state.pulseBooleans)) {
      if (!processedFields.has(field)) {
        output[field] = true;
        state.pulseBooleans.delete(field);
      }
    }
    for (const [field, vector] of Array.from(state.pulseVectors.entries())) {
      if (!processedFields.has(field)) {
        output[field] = vector;
        state.pulseVectors.delete(field);
      }
    }

    return output as TInput;
  }
}
