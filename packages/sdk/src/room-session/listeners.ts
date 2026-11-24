/** Typed event listeners; `on` returns the call that removes the listener. */
export class Listeners<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<
    keyof Events,
    Set<(event: never) => void>
  >();

  on<Name extends keyof Events>(
    name: Name,
    listener: (event: Events[Name]) => void,
  ): () => void {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener as (event: never) => void);
    this.listeners.set(name, set);
    return () => set.delete(listener as (event: never) => void);
  }

  emit<Name extends keyof Events>(name: Name, event: Events[Name]): void {
    for (const listener of [...(this.listeners.get(name) ?? [])])
      (listener as (event: Events[Name]) => void)(event);
  }
}
