export type StandardMatchPhase = "lobby" | "countdown" | "playing" | "ended";
export type ShellMatchPhase = Exclude<StandardMatchPhase, "countdown">;

export const toShellMatchPhase = (
  phase: StandardMatchPhase,
): ShellMatchPhase => {
  if (phase === "countdown") {
    return "playing";
  }
  return phase;
};
