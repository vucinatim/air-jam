export const standardMatchPhases = [
  "lobby",
  "countdown",
  "playing",
  "ended",
] as const;

export type StandardMatchPhase = (typeof standardMatchPhases)[number];
export type ShellMatchPhase = Exclude<StandardMatchPhase, "countdown">;

export const isStandardMatchPhase = (
  value: string,
): value is StandardMatchPhase => {
  return (standardMatchPhases as readonly string[]).includes(value);
};

export const isActiveMatchPhase = (phase: StandardMatchPhase): boolean => {
  return phase === "countdown" || phase === "playing";
};

export const isEndedMatchPhase = (phase: StandardMatchPhase): boolean => {
  return phase === "ended";
};

export const toShellMatchPhase = (
  phase: StandardMatchPhase,
): ShellMatchPhase => {
  if (phase === "countdown") {
    return "playing";
  }
  return phase;
};
