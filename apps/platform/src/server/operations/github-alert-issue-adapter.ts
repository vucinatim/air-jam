import {
  OPERATIONAL_ALERT_ISSUE_LABEL,
  createOperationsDocumentDigest,
  githubRepositorySchema,
  operationalAlertSchemaV1,
  type OperationalAlertV1,
} from "@air-jam/operations-contract";
import { createSign } from "node:crypto";
import { z } from "zod";

const managedBlockStart = "<!-- airjam-operational-alert-managed:start -->";
const managedBlockEnd = "<!-- airjam-operational-alert-managed:end -->";
const managedAlertKeyPrefix = "<!-- airjam-operational-alert-key:";

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.string().optional(),
);

const githubAlertIssueEnvSchema = z
  .object({
    AIRJAM_GITHUB_ISSUES_APP_ID: optionalTrimmedString,
    AIRJAM_GITHUB_ISSUES_INSTALLATION_ID: optionalTrimmedString,
    AIRJAM_GITHUB_ISSUES_PRIVATE_KEY: optionalTrimmedString,
    AIRJAM_GITHUB_ISSUES_REPOSITORY: optionalTrimmedString,
  })
  .transform((value, context) => {
    const fields = [
      value.AIRJAM_GITHUB_ISSUES_APP_ID,
      value.AIRJAM_GITHUB_ISSUES_INSTALLATION_ID,
      value.AIRJAM_GITHUB_ISSUES_PRIVATE_KEY,
      value.AIRJAM_GITHUB_ISSUES_REPOSITORY,
    ];
    if (fields.every((field) => !field)) {
      return { enabled: false as const };
    }
    if (fields.some((field) => !field)) {
      context.addIssue({
        code: "custom",
        message:
          "GitHub issue projection requires app ID, installation ID, private key, and repository together.",
      });
      return z.NEVER;
    }
    const repository = githubRepositorySchema.safeParse(
      value.AIRJAM_GITHUB_ISSUES_REPOSITORY!,
    );
    if (!repository.success) {
      context.addIssue({
        code: "custom",
        path: ["AIRJAM_GITHUB_ISSUES_REPOSITORY"],
        message: "GitHub issue repository must use owner/name format.",
      });
      return z.NEVER;
    }
    return {
      enabled: true as const,
      appId: value.AIRJAM_GITHUB_ISSUES_APP_ID!,
      installationId: value.AIRJAM_GITHUB_ISSUES_INSTALLATION_ID!,
      privateKey: value.AIRJAM_GITHUB_ISSUES_PRIVATE_KEY!.replace(
        /\\n/gu,
        "\n",
      ),
      repository: repository.data,
    };
  });

export type GitHubAlertIssueConfig = z.output<typeof githubAlertIssueEnvSchema>;

export const resolveGitHubAlertIssueConfig = (
  env: Record<string, string | undefined> = process.env,
): GitHubAlertIssueConfig => githubAlertIssueEnvSchema.parse(env);

export type GitHubAlertIssueIdentity = {
  number: number;
  url: string;
  state: "open" | "closed";
};

export type GitHubAlertIssueProjectionResult = {
  action: "created" | "updated" | "reopened" | "resolved" | "unchanged";
  issue: GitHubAlertIssueIdentity;
  managedBodyHash: string;
};

export type GitHubAlertIssueProjector = (input: {
  alert: OperationalAlertV1;
  knownIssueNumber: number | null;
}) => Promise<GitHubAlertIssueProjectionResult>;

export class GitHubAlertIssueAdapterError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;

  constructor({
    code,
    message,
    retryable,
    retryAfterSeconds = null,
  }: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterSeconds?: number | null;
  }) {
    super(message);
    this.name = "GitHubAlertIssueAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const GITHUB_ALERT_ISSUE_REQUEST_TIMEOUT_MS = 10_000;
export const GITHUB_ALERT_ISSUE_MAX_REQUESTS_PER_PROJECTION = 22;

const escapeMarkdown = (value: string) => value.replace(/[|\\]/gu, "\\$&");

export const renderOperationalAlertIssueBlock = (
  rawAlert: OperationalAlertV1,
): string => {
  const alert = operationalAlertSchemaV1.parse(rawAlert);
  const recovery = alert.recoveredAt
    ? `Passed at \`${alert.recoveredAt}\`; the issue is resolved until the same alert key recurs.`
    : `Failed at alert revision \`${alert.revision}\`; the issue remains actionable.`;
  return [
    managedBlockStart,
    `${managedAlertKeyPrefix}${alert.alertKey} -->`,
    "## Air Jam operational signal",
    "",
    "> This block is maintained by Air Jam. Human and agent discussion outside it is preserved.",
    "",
    "| Field | Current source truth |",
    "| --- | --- |",
    `| Status | **${alert.status}** |`,
    `| Severity | \`${alert.severity}\` |`,
    `| Environment | \`${alert.environment}\` |`,
    `| Service | \`${alert.service}\` |`,
    `| Policy | \`${alert.policyId}\` |`,
    `| First triggered | \`${alert.firstTriggeredAt}\` |`,
    `| Last observed | \`${alert.lastObservedAt}\` |`,
    `| Occurrences | ${alert.occurrenceCount} |`,
    `| Alert revision | ${alert.revision} |`,
    "",
    escapeMarkdown(alert.summary),
    "",
    "### Evidence pointers",
    "",
    `- Alert: \`operational-alert:${alert.alertKey}@${alert.revision}\``,
    `- Source event: \`operational-event:${alert.latestEventId}\``,
    `- SLO evaluation: \`operational-slo-evaluation:${alert.latestEvaluationId}\``,
    `- Inspect: \`pnpm --silent run repo -- platform operations reliability alerts inspect --alert-key ${alert.alertKey} --json\``,
    "",
    "### Independent verification",
    "",
    recovery,
    "",
    managedBlockEnd,
  ].join("\n");
};

export const mergeOperationalAlertIssueBlock = ({
  existingBody,
  managedBlock,
  alertKey,
}: {
  existingBody: string | null;
  managedBlock: string;
  alertKey: string;
}): string => {
  const body = existingBody ?? "";
  const keyMarkerPattern = /<!-- airjam-operational-alert-key:([^ ]+) -->/gu;
  const keys = [...body.matchAll(keyMarkerPattern)].map((match) => match[1]);
  if (keys.some((key) => key !== alertKey)) {
    throw new GitHubAlertIssueAdapterError({
      code: "github.issue_identity_conflict",
      message: "The target issue belongs to a different Air Jam alert key.",
      retryable: false,
    });
  }
  const start = body.indexOf(managedBlockStart);
  const end = body.indexOf(managedBlockEnd);
  if (start >= 0 !== end >= 0 || (start >= 0 && end < start)) {
    throw new GitHubAlertIssueAdapterError({
      code: "github.managed_block_invalid",
      message: "The target issue contains an incomplete Air Jam managed block.",
      retryable: false,
    });
  }
  if (start >= 0 && end >= start) {
    return `${body.slice(0, start)}${managedBlock}${body.slice(end + managedBlockEnd.length)}`;
  }
  return body.trim() ? `${body}\n\n${managedBlock}` : managedBlock;
};

type GitHubIssue = {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<string | { name: string }>;
  pull_request?: unknown;
};

const parseGitHubIssue = (value: unknown): GitHubIssue =>
  parseGitHubResponse(
    z
      .object({
        number: z.number().int().positive(),
        html_url: z.string().url(),
        title: z.string(),
        body: z.string().nullable(),
        state: z.enum(["open", "closed"]),
        labels: z
          .array(z.union([z.string(), z.object({ name: z.string() })]))
          .optional()
          .transform((labels) => labels ?? []),
        pull_request: z.unknown().optional(),
      })
      .passthrough(),
    value,
  );

const parseGitHubResponse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new GitHubAlertIssueAdapterError({
      code: "github.response_invalid",
      message: "The GitHub issues API returned an invalid response contract.",
      retryable: true,
    });
  }
  return parsed.data;
};

const encodeBase64UrlJson = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const createGitHubAppJwt = ({
  appId,
  privateKey,
  now,
}: {
  appId: string;
  privateKey: string;
  now: Date;
}) => {
  const issuedAt = Math.floor(now.getTime() / 1_000) - 60;
  const header = encodeBase64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = encodeBase64UrlJson({
    iat: issuedAt,
    exp: issuedAt + 9 * 60,
    iss: appId,
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
};

const titleForAlert = (alert: OperationalAlertV1) =>
  `[Air Jam][${alert.environment}][${alert.severity}] ${alert.summary.replace(/\s+/gu, " ")}`.slice(
    0,
    256,
  );

const issueHasOperationalLabel = (issue: GitHubIssue) =>
  issue.labels.some((label) =>
    typeof label === "string"
      ? label === OPERATIONAL_ALERT_ISSUE_LABEL
      : label.name === OPERATIONAL_ALERT_ISSUE_LABEL,
  );

const parseRetryAfterSeconds = (response: Response): number | null => {
  const value = response.headers.get("retry-after");
  if (!value || !/^[1-9][0-9]*$/u.test(value)) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
};

export const createGitHubAlertIssueProjector = ({
  config,
  fetchImpl = fetch,
  apiBaseUrl = "https://api.github.com",
  now = () => new Date(),
}: {
  config: Extract<GitHubAlertIssueConfig, { enabled: true }>;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
  now?: () => Date;
}): GitHubAlertIssueProjector => {
  const [owner, repositoryName] = config.repository.split("/");
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}`;
  let cachedToken: { value: string; expiresAt: number } | null = null;
  let labelReady = false;

  const request = async <T>({
    path,
    method = "GET",
    body,
    jwt = false,
  }: {
    path: string;
    method?: "GET" | "POST" | "PATCH";
    body?: Record<string, unknown>;
    jwt?: boolean;
  }): Promise<T> => {
    let authorization: string;
    if (jwt) {
      try {
        authorization = `Bearer ${createGitHubAppJwt({
          appId: config.appId,
          privateKey: config.privateKey,
          now: now(),
        })}`;
      } catch {
        throw new GitHubAlertIssueAdapterError({
          code: "github.app_identity_invalid",
          message: "The configured GitHub App identity could not sign a JWT.",
          retryable: false,
        });
      }
    } else {
      const currentTime = now().getTime();
      if (!cachedToken || cachedToken.expiresAt - 60_000 <= currentTime) {
        const token = parseGitHubResponse(
          z
            .object({
              token: z.string().trim().min(1),
              expires_at: z.string().datetime(),
            })
            .passthrough(),
          await request<unknown>({
            path: `/app/installations/${encodeURIComponent(config.installationId)}/access_tokens`,
            method: "POST",
            body: { permissions: { issues: "write" } },
            jwt: true,
          }),
        );
        cachedToken = {
          value: token.token,
          expiresAt: Date.parse(token.expires_at),
        };
      }
      authorization = `Bearer ${cachedToken.value}`;
    }
    let response: Response;
    try {
      response = await fetchImpl(`${apiBaseUrl}${path}`, {
        method,
        headers: {
          accept: "application/vnd.github+json",
          authorization,
          "content-type": "application/json",
          "user-agent": "air-jam-operational-worker",
          "x-github-api-version": "2022-11-28",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(GITHUB_ALERT_ISSUE_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new GitHubAlertIssueAdapterError({
        code: "github.transport_failed",
        message: "The GitHub issues API request failed before a response.",
        retryable: true,
      });
    }
    if (!response.ok) {
      const retryAfterSeconds = parseRetryAfterSeconds(response);
      if (!jwt && response.status === 401) cachedToken = null;
      const retryable =
        (!jwt && response.status === 401) ||
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500 ||
        (response.status === 403 &&
          (response.headers.get("x-ratelimit-remaining") === "0" ||
            retryAfterSeconds !== null));
      throw new GitHubAlertIssueAdapterError({
        code: `github.http_${response.status}`,
        message: `The GitHub issues API rejected the request with HTTP ${response.status}.`,
        retryable,
        retryAfterSeconds,
      });
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };

  const ensureLabel = async () => {
    if (labelReady) return;
    try {
      await request({
        path: `${repositoryPath}/labels/${encodeURIComponent(OPERATIONAL_ALERT_ISSUE_LABEL)}`,
      });
    } catch (error) {
      if (
        !(error instanceof GitHubAlertIssueAdapterError) ||
        error.code !== "github.http_404"
      ) {
        throw error;
      }
      try {
        await request({
          path: `${repositoryPath}/labels`,
          method: "POST",
          body: {
            name: OPERATIONAL_ALERT_ISSUE_LABEL,
            color: "B60205",
            description: "Maintained Air Jam operational alert",
          },
        });
      } catch (createError) {
        if (
          !(createError instanceof GitHubAlertIssueAdapterError) ||
          createError.code !== "github.http_422"
        ) {
          throw createError;
        }
        await request({
          path: `${repositoryPath}/labels/${encodeURIComponent(OPERATIONAL_ALERT_ISSUE_LABEL)}`,
        });
      }
    }
    labelReady = true;
  };

  const findIssue = async ({
    alertKey,
    knownIssueNumber,
  }: {
    alertKey: string;
    knownIssueNumber: number | null;
  }): Promise<GitHubIssue | null> => {
    if (knownIssueNumber) {
      try {
        const issue = parseGitHubIssue(
          await request({
            path: `${repositoryPath}/issues/${knownIssueNumber}`,
          }),
        );
        if (issue.pull_request) {
          throw new GitHubAlertIssueAdapterError({
            code: "github.issue_identity_conflict",
            message:
              "The retained GitHub issue number identifies a pull request.",
            retryable: false,
          });
        }
        return issue;
      } catch (error) {
        if (
          !(error instanceof GitHubAlertIssueAdapterError) ||
          error.code !== "github.http_404"
        ) {
          throw error;
        }
      }
    }
    const marker = `${managedAlertKeyPrefix}${alertKey} -->`;
    for (let page = 1; page <= 5; page += 1) {
      const values = parseGitHubResponse(
        z.array(z.unknown()),
        await request<unknown>({
          path: `${repositoryPath}/issues?state=all&per_page=100&page=${page}`,
        }),
      );
      const issues = values
        .map(parseGitHubIssue)
        .filter((issue) => !issue.pull_request);
      const match = issues.find((issue) => issue.body?.includes(marker));
      if (match) return match;
      if (values.length < 100) break;
    }
    return null;
  };

  return async ({ alert: rawAlert, knownIssueNumber }) => {
    const alert = operationalAlertSchemaV1.parse(rawAlert);
    await ensureLabel();
    const managedBlock = renderOperationalAlertIssueBlock(alert);
    const managedBodyHash = createOperationsDocumentDigest(managedBlock);
    const desiredTitle = titleForAlert(alert);
    const desiredState = alert.status === "recovered" ? "closed" : "open";
    let issue = await findIssue({ alertKey: alert.alertKey, knownIssueNumber });
    if (!issue) {
      issue = parseGitHubIssue(
        await request({
          path: `${repositoryPath}/issues`,
          method: "POST",
          body: {
            title: desiredTitle,
            body: managedBlock,
            labels: [OPERATIONAL_ALERT_ISSUE_LABEL],
          },
        }),
      );
      if (desiredState === "closed") {
        issue = parseGitHubIssue(
          await request({
            path: `${repositoryPath}/issues/${issue.number}`,
            method: "PATCH",
            body: { state: "closed", state_reason: "completed" },
          }),
        );
      }
      return {
        action: "created",
        issue: {
          number: issue.number,
          url: issue.html_url,
          state: issue.state,
        },
        managedBodyHash,
      };
    }

    const desiredBody = mergeOperationalAlertIssueBlock({
      existingBody: issue.body,
      managedBlock,
      alertKey: alert.alertKey,
    });
    const titleChanged = issue.title !== desiredTitle;
    const bodyChanged = issue.body !== desiredBody;
    const stateChanged = issue.state !== desiredState;
    const labelChanged = !issueHasOperationalLabel(issue);
    if (labelChanged) {
      await request({
        path: `${repositoryPath}/issues/${issue.number}/labels`,
        method: "POST",
        body: { labels: [OPERATIONAL_ALERT_ISSUE_LABEL] },
      });
    }
    if (!titleChanged && !bodyChanged && !stateChanged) {
      return {
        action: labelChanged ? "updated" : "unchanged",
        issue: {
          number: issue.number,
          url: issue.html_url,
          state: issue.state,
        },
        managedBodyHash,
      };
    }
    const previousState = issue.state;
    issue = parseGitHubIssue(
      await request({
        path: `${repositoryPath}/issues/${issue.number}`,
        method: "PATCH",
        body: {
          title: desiredTitle,
          body: desiredBody,
          state: desiredState,
          ...(desiredState === "closed" ? { state_reason: "completed" } : {}),
        },
      }),
    );
    const action =
      previousState === "closed" && desiredState === "open"
        ? "reopened"
        : previousState === "open" && desiredState === "closed"
          ? "resolved"
          : "updated";
    return {
      action,
      issue: { number: issue.number, url: issue.html_url, state: issue.state },
      managedBodyHash,
    };
  };
};
