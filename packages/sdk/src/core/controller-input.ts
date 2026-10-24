import {
  completeInputState,
  type AirJamButtonState,
  type AirJamInput,
  type AirJamInputState,
  type AirJamVector,
} from "./input";

const roundUnit = (value: number): number =>
  Math.round(Math.max(-1, Math.min(1, value)) * 100) / 100 || 0;

/**
 * A controller's side of its player's declared controls. Controls change it;
 * it sends the whole state once per display frame when something changed,
 * and again whenever asked, so the host always holds the latest state.
 */
export class ControllerInput {
  private state: AirJamInputState;
  private readonly axisHolds = new Map<string, { value: number }[]>();
  private readonly buttonHolds = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private pending = false;

  constructor(
    private readonly input: AirJamInput,
    private readonly transport: {
      /** Sends the state, once the room can take it. */
      send: (state: AirJamInputState) => void;
      /** Runs `callback` before the next display frame. */
      requestFrame: (callback: () => void) => void;
    },
  ) {
    this.state = completeInputState(input, {});
  }

  /** Whether a button is down. */
  isDown(name: string): boolean {
    return (this.state[name] as AirJamButtonState).down;
  }

  value(name: string): number | AirJamVector {
    return this.state[name] as number | AirJamVector;
  }

  /** Puts a button down until the returned release is called; each call is one press. */
  press(name: string): () => void {
    this.assertKind(name, "button");
    const holds = (this.buttonHolds.get(name) ?? 0) + 1;
    this.buttonHolds.set(name, holds);
    const { presses } = this.state[name] as AirJamButtonState;
    this.update(name, { down: true, presses: presses + 1 });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.buttonHolds.get(name) ?? 1) - 1;
      this.buttonHolds.set(name, remaining);
      if (remaining > 0) return;
      const current = this.state[name] as AirJamButtonState;
      this.update(name, { down: false, presses: current.presses });
    };
  }

  /**
   * Holds an axis at `value` until the returned release is called. With
   * several holds, the latest one wins, so pressing down while up is held
   * moves down and releasing it moves up again.
   */
  hold(name: string, value: number): () => void {
    this.assertKind(name, "axis");
    const hold = { value: roundUnit(value) };
    const holds = [...(this.axisHolds.get(name) ?? []), hold];
    this.axisHolds.set(name, holds);
    this.update(name, hold.value);
    return () => {
      const remaining = (this.axisHolds.get(name) ?? []).filter(
        (candidate) => candidate !== hold,
      );
      this.axisHolds.set(name, remaining);
      this.update(name, remaining.at(-1)?.value ?? 0);
    };
  }

  /** Sets an axis or a stick. */
  set(name: string, value: number | AirJamVector): void {
    if (typeof value === "number") {
      this.assertKind(name, "axis");
      this.update(name, roundUnit(value));
      return;
    }
    this.assertKind(name, "stick");
    this.update(name, { x: roundUnit(value.x), y: roundUnit(value.y) });
  }

  /** Releases every control, such as when the page loses focus. */
  releaseAll(): void {
    this.axisHolds.clear();
    this.buttonHolds.clear();
    const released = Object.fromEntries(
      Object.entries(this.state).map(([name, value]) => [
        name,
        typeof value === "object" && "down" in value
          ? { down: false, presses: value.presses }
          : typeof value === "number"
            ? 0
            : { x: 0, y: 0 },
      ]),
    ) as AirJamInputState;
    if (JSON.stringify(released) === JSON.stringify(this.state)) return;
    this.state = released;
    this.changed();
  }

  /** Sends the current state now, such as after joining the room. */
  flush(): void {
    this.pending = false;
    this.transport.send(this.state);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(
    name: string,
    value: AirJamButtonState | number | AirJamVector,
  ): void {
    if (JSON.stringify(this.state[name]) === JSON.stringify(value)) return;
    this.state = { ...this.state, [name]: value };
    this.changed();
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
    if (this.pending) return;
    this.pending = true;
    this.transport.requestFrame(() => {
      if (this.pending) this.flush();
    });
  }

  private assertKind(name: string, kind: "axis" | "button" | "stick"): void {
    if (this.input[name]?.kind !== kind)
      throw new Error(`"${name}" is not a declared ${kind} control.`);
  }
}
