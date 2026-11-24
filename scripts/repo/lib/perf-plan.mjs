/** Named sizes of the room server's load smoke. */
export const perfProfiles = Object.freeze({
  ci: { rooms: 10, phones: 4, durationMs: 15_000, workers: 2 },
  release: { rooms: 100, phones: 4, durationMs: 60_000, workers: 4 },
});

const forwardedFlags = ["rooms", "phones", "durationMs", "workers"];

export const buildPerfSanityArgs = (options = {}) => {
  const profile = options.profile ? perfProfiles[options.profile] : undefined;
  if (options.profile && !profile) {
    throw new Error(
      `Unknown performance profile "${options.profile}". Expected one of: ${Object.keys(perfProfiles).join(", ")}.`,
    );
  }

  const forwarded = forwardedFlags.flatMap((flag) => {
    const value = options[flag] ?? profile?.[flag];
    return value === undefined ? [] : [`--${flag}=${value}`];
  });
  // pnpm hands everything after the script's name to the script.
  return ["--filter", "@air-jam/devtools", "perf:sanity", ...forwarded];
};
