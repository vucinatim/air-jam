export class GameSessionOperations {
  private tail: Promise<unknown> = Promise.resolve();
  private controller = new AbortController();
  private failure: Error | null = null;
  private queued = 0;

  run<T>(
    timeoutMs: number,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.queued >= 32)
      return Promise.reject(
        new Error("session_busy: Too many queued game operations."),
      );
    this.queued++;
    const result = this.tail.then(async () => {
      if (this.failure) throw this.failure;
      let timer: ReturnType<typeof setTimeout>;
      const aborted = new Promise<never>((_, reject) => {
        const fail = () => reject(this.failure ?? new Error("session_closed"));
        this.controller.signal.addEventListener("abort", fail, { once: true });
        timer = setTimeout(() => {
          this.failure = new Error(
            "evaluation_timeout: Game operation exceeded its deadline; close this session before opening another.",
          );
          this.controller.abort();
        }, timeoutMs);
        this.cancelCurrent = () => {
          clearTimeout(timer);
          this.controller.signal.removeEventListener("abort", fail);
        };
      });
      try {
        return await Promise.race([operation(this.controller.signal), aborted]);
      } catch (error) {
        if (
          error instanceof Error &&
          /runtime_disconnected|evaluation_timeout|invalid_runtime_response/.test(
            error.message,
          )
        )
          this.failure = error;
        throw error;
      } finally {
        this.cancelCurrent();
      }
    });
    this.tail = result
      .catch(() => undefined)
      .finally(() => {
        this.queued--;
      });
    return result;
  }
  private cancelCurrent = () => {};
  close() {
    this.failure = new Error("session_closed: This game session is closed.");
    this.controller.abort();
  }
}
