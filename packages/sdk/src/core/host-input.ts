import { z } from "zod";
import { emitAirJamDiagnostic } from "../diagnostics";
import { participantInputSchemaDescriptionSchema } from "../protocol/leased-control";
import {
  agentValuesToInputState,
  completeInputState,
  createAgentInputSchema,
  createInputStateSchema,
  neutralInputValues,
  type AirJamButtonState,
  type AirJamInput,
  type AirJamInputState,
  type AirJamVector,
} from "./input";

interface Seat {
  state: AirJamInputState;
  /** Presses each button has already turned into a step. */
  consumed: Map<string, number>;
  /** The last direction of each stick that keeps it. */
  kept: Map<string, AirJamVector>;
  values: Record<string, unknown>;
  sampled: string | null;
}

/** One seat's controls changed between two steps. */
export interface AirJamInputChange {
  controllerId: string;
  input: AirJamInputState;
}

/**
 * The host's input lane. Sources (phones, agent leases, replays) report each
 * seat's controls at any time; once per simulation step the host samples
 * every seat, applies each control kind's meaning and hands the step those
 * values until the next one.
 */
export class HostInput {
  private readonly seats = new Map<string, Seat>();
  private readonly leases = new Map<
    string,
    { deadline: number; released: boolean }
  >();
  private readonly stateSchema: ReturnType<typeof createInputStateSchema>;
  private readonly agentSchema: ReturnType<typeof createAgentInputSchema>;
  private readonly neutral: Record<string, unknown>;
  private inputDescription:
    | z.infer<typeof participantInputSchemaDescriptionSchema>
    | undefined;

  constructor(
    private readonly input: AirJamInput,
    /** The host clock input leases expire on. */
    private readonly now: () => number,
  ) {
    this.stateSchema = createInputStateSchema(input);
    this.agentSchema = createAgentInputSchema(input);
    this.neutral = neutralInputValues(input);
  }

  /** A phone's controls; ignored while an agent lease owns the seat. */
  receive(controllerId: string, state: unknown): void {
    if (this.leases.has(controllerId)) return;
    const parsed = this.stateSchema.safeParse(state);
    if (!parsed.success) {
      emitAirJamDiagnostic({
        code: "AJ_INPUT_INVALID",
        severity: "warn",
        message: `Input from controller ${controllerId} does not match the declared controls.`,
        details: { controllerId, issueCount: parsed.error.issues.length },
      });
      return;
    }
    this.setState(
      controllerId,
      completeInputState(this.input, parsed.data as AirJamInputState),
    );
  }

  /** What the current step reads for a player; released and centred before any input. */
  read(controllerId: string): Record<string, unknown> {
    return this.seats.get(controllerId)?.values ?? this.neutral;
  }

  /**
   * Applies each control's meaning for the next step and returns the seats
   * whose source state changed since the previous step.
   */
  sample(): AirJamInputChange[] {
    const now = this.now();
    const changes: AirJamInputChange[] = [];
    for (const [controllerId, lease] of this.leases)
      if (!lease.released && now >= lease.deadline) {
        lease.released = true;
        this.setState(controllerId, completeInputState(this.input, {}));
      }
    for (const [controllerId, seat] of this.seats) {
      seat.values = this.applyMeanings(seat);
      const sampled = JSON.stringify(seat.state);
      if (sampled === seat.sampled) continue;
      seat.sampled = sampled;
      changes.push({ controllerId, input: seat.state });
    }
    return changes;
  }

  clearInput(controllerId: string): void {
    this.seats.delete(controllerId);
    this.leases.delete(controllerId);
  }

  get supportsLeasedInput(): boolean {
    return true;
  }

  describeInputSchema(): z.infer<
    typeof participantInputSchemaDescriptionSchema
  > {
    this.inputDescription ??= participantInputSchemaDescriptionSchema.parse({
      status: "available",
      // Zod attaches a non-enumerable Standard Schema validator; it is not wire data.
      schema: structuredClone(
        z.toJSONSchema(this.agentSchema, { io: "input" }),
      ),
    });
    return this.inputDescription;
  }

  /** An agent's controls for a seat it leases, held until `ttlMs` passes. */
  setLeasedInput(
    controllerId: string,
    values: Record<string, unknown>,
    ttlMs: number,
  ): boolean {
    const parsed = this.agentSchema.safeParse(values);
    if (!parsed.success) return false;
    const now = this.now();
    const lease = this.leases.get(controllerId);
    const previous =
      lease && !lease.released && now < lease.deadline
        ? (this.seats.get(controllerId)?.state ?? null)
        : null;
    this.leases.set(controllerId, { deadline: now + ttlMs, released: false });
    this.setState(
      controllerId,
      completeInputState(
        this.input,
        agentValuesToInputState(previous, parsed.data),
      ),
    );
    return true;
  }

  /** A seat whose agent acts without holding input stops taking phone input. */
  claimLeasedInput(controllerId: string): void {
    if (!this.leases.has(controllerId)) this.releaseLeasedInput(controllerId);
  }

  releaseLeasedInput(controllerId: string): void {
    this.leases.set(controllerId, { deadline: 0, released: true });
    this.setState(controllerId, completeInputState(this.input, {}));
  }

  clearLeasedInputs(): void {
    for (const controllerId of this.leases.keys())
      this.releaseLeasedInput(controllerId);
  }

  private setState(controllerId: string, state: AirJamInputState): void {
    const seat = this.seats.get(controllerId);
    if (seat) {
      seat.state = state;
      return;
    }
    this.seats.set(controllerId, {
      state,
      consumed: new Map(),
      kept: new Map(),
      values: this.neutral,
      sampled: null,
    });
  }

  private applyMeanings(seat: Seat): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const control of Object.values(this.input)) {
      const state = seat.state[control.name];
      if (control.kind === "button") {
        const { down, presses } = state as AirJamButtonState;
        let consumed = seat.consumed.get(control.name) ?? 0;
        // A source that restarted counts presses from zero again.
        if (presses < consumed) consumed = 0;
        const pressed = presses > consumed;
        seat.consumed.set(control.name, pressed ? consumed + 1 : consumed);
        values[control.name] =
          control.mode === "pressed" ? pressed : down || pressed;
      } else if (control.kind === "stick" && control.keepDirection) {
        const vector = state as AirJamVector;
        if (vector.x !== 0 || vector.y !== 0)
          seat.kept.set(control.name, vector);
        values[control.name] = seat.kept.get(control.name) ?? vector;
      } else values[control.name] = state;
    }
    return values;
  }
}
