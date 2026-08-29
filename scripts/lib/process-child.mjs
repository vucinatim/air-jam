export const stopChild = async (
  child,
  { processGroup = false, timeoutMs = 5_000 } = {},
) => {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const sendSignal = (signal) => {
    if (processGroup && child.pid) {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        // The process group may already be gone; fall back to the direct child.
      }
    }
    child.kill(signal);
  };

  sendSignal("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    sendSignal("SIGKILL");
  }
};
