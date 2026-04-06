const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
};

const DEFAULT_FOOTER_HINT =
  "Set the required environment variables and retry.";

const resolveColorEnabled = (forced) => {
  if (typeof forced === "boolean") {
    return forced;
  }

  if (typeof process === "undefined") {
    return false;
  }

  if (typeof process.env?.NO_COLOR !== "undefined") {
    return false;
  }

  return Boolean(process.stderr?.isTTY);
};

const paint = (enabled, tone, value) => {
  if (!enabled) {
    return value;
  }

  return `${ANSI[tone]}${value}${ANSI.reset}`;
};

const toEnvKey = (path) => {
  if (!Array.isArray(path) || path.length === 0) {
    return "<root>";
  }

  const firstStringSegment = path.find((segment) => typeof segment === "string");
  return typeof firstStringSegment === "string"
    ? firstStringSegment
    : "<root>";
};

const describeExpectedRule = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      return `type ${String(issue.expected)}`;
    case "invalid_value":
      return issue.values && issue.values.length > 0
        ? `one of: ${issue.values.join(", ")}`
        : "a valid value";
    case "too_small":
      return issue.minimum != null
        ? `at least ${issue.minimum}${issue.inclusive === false ? " (exclusive)" : ""}`
        : "a larger value";
    case "too_big":
      return issue.maximum != null
        ? `at most ${issue.maximum}${issue.inclusive === false ? " (exclusive)" : ""}`
        : "a smaller value";
    case "invalid_format":
      return issue.format ? `format ${issue.format}` : "a valid format";
    default:
      return "a valid value";
  }
};

const toReceivedValue = (env, envKey) => {
  if (!env || envKey === "<root>") {
    return undefined;
  }

  const value = env[envKey];
  if (typeof value === "undefined") {
    return undefined;
  }

  return String(value);
};

const normalizeIssues = ({ zodIssues, env, keyHints }) =>
  zodIssues
    .map((issue) => {
      const envKey = toEnvKey(issue.path);
      return {
        envKey,
        expected: describeExpectedRule(issue),
        received: toReceivedValue(env, envKey),
        message: issue.message,
        fix:
          keyHints?.[envKey] ??
          (envKey === "<root>"
            ? "Adjust the environment values so the schema constraints pass."
            : `Set ${envKey} to a valid value.`),
      };
    })
    .sort((a, b) => {
      if (a.envKey === b.envKey) {
        return a.message.localeCompare(b.message);
      }

      return a.envKey.localeCompare(b.envKey);
    });

export class EnvValidationError extends Error {
  constructor({ boundary, issues, docsHint }) {
    const count = issues.length;
    super(
      `${boundary}: invalid environment configuration (${count} issue${count === 1 ? "" : "s"})`,
    );

    this.name = "EnvValidationError";
    this.boundary = boundary;
    this.issues = issues;
    this.docsHint = docsHint;
  }
}

export const isEnvValidationError = (error) => error instanceof EnvValidationError;

export const validateEnv = ({
  boundary,
  schema,
  env = process.env,
  docsHint,
  keyHints,
}) => {
  const result = schema.safeParse(env);
  if (result.success) {
    return result.data;
  }

  throw new EnvValidationError({
    boundary,
    docsHint,
    issues: normalizeIssues({
      zodIssues: result.error.issues,
      env,
      keyHints,
    }),
  });
};

export const formatEnvValidationError = (
  error,
  { color, includeReceived = true, docsHint } = {},
) => {
  if (!isEnvValidationError(error)) {
    return String(error);
  }

  const colorEnabled = resolveColorEnabled(color);
  const heading = `✖ ${error.boundary}: invalid environment configuration`;

  const lines = [paint(colorEnabled, "red", paint(colorEnabled, "bold", heading))];

  for (const [index, issue] of error.issues.entries()) {
    lines.push(
      `${paint(colorEnabled, "yellow", `${index + 1}. ${issue.envKey}`)}  ${paint(colorEnabled, "dim", `(${issue.message})`)}`,
    );
    lines.push(`   expected: ${issue.expected}`);

    if (includeReceived) {
      lines.push(
        `   received: ${
          typeof issue.received === "string" && issue.received.length > 0
            ? `"${issue.received}"`
            : "<missing>"
        }`,
      );
    }

    lines.push(`   fix: ${issue.fix}`);
  }

  lines.push("");
  lines.push(
    paint(
      colorEnabled,
      "cyan",
      `Next: ${docsHint ?? error.docsHint ?? DEFAULT_FOOTER_HINT}`,
    ),
  );

  return lines.join("\n");
};
