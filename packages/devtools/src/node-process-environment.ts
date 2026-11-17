export function nodeProcessEnvironment(
  allowedKeys: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  return Object.fromEntries(
    ["ELECTRON_RUN_AS_NODE", ...allowedKeys].flatMap((key) =>
      environment[key] === undefined ? [] : [[key, environment[key]]],
    ),
  );
}
