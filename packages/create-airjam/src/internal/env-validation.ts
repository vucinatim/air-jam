const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
} as const;

const DEFAULT_FOOTER_HINT = "Set the required environment variables and retry.";

type EnvValidationIssue = {
  envKey: string;
  expected: string;
  received?: string;
  message: string;
  fix: string;
};

type EnvValidationErrorOptions = {
  boundary: string;
  issues: EnvValidationIssue[];
  docsHint?: string;
};

type FormatEnvValidationErrorOptions = {
  color?: boolean;
  includeReceived?: boolean;
  docsHint?: string;
};

const resolveColorEnabled = (forced?: boolean): boolean => {
  if (typeof forced === "boolean") {
    return forced;
  }

  if (typeof process === "undefined") {
    return false;
  }

  if (typeof process.env.NO_COLOR !== "undefined") {
    return false;
  }

  return Boolean(process.stderr?.isTTY);
};

const paint = (
  enabled: boolean,
  tone: keyof typeof ANSI,
  value: string,
): string => {
  if (!enabled) {
    return value;
  }

  return `${ANSI[tone]}${value}${ANSI.reset}`;
};

export class EnvValidationError extends Error {
  readonly boundary: string;
  readonly issues: EnvValidationIssue[];
  readonly docsHint?: string;

  constructor({ boundary, issues, docsHint }: EnvValidationErrorOptions) {
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

export const isEnvValidationError = (
  error: unknown,
): error is EnvValidationError => error instanceof EnvValidationError;

export const formatEnvValidationError = (
  error: unknown,
  { color, includeReceived = true, docsHint }: FormatEnvValidationErrorOptions = {},
): string => {
  if (!isEnvValidationError(error)) {
    return String(error);
  }

  const colorEnabled = resolveColorEnabled(color);
  const heading = `✖ ${error.boundary}: invalid environment configuration`;
  const lines = [
    paint(colorEnabled, "red", paint(colorEnabled, "bold", heading)),
  ];

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
