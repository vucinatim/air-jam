import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GitHubAlertIssueAdapterError,
  createGitHubAlertIssueProjector,
  mergeOperationalAlertIssueBlock,
  renderOperationalAlertIssueBlock,
  resolveGitHubAlertIssueConfig,
} from "./github-alert-issue-adapter";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

const createAlert = ({
  revision,
  status = "open",
}: {
  revision: number;
  status?: "open" | "recovered";
}) => ({
  contractVersion: 1 as const,
  alertId: "alert:multiplayer:test",
  alertKey: "slo:multiplayer:test",
  policyId: "multiplayer-session-availability",
  environment: "test" as const,
  service: "realtime_server" as const,
  severity: "critical" as const,
  status,
  summary: "Room and controller flow is unavailable.",
  firstTriggeredAt: "2026-09-04T00:00:00.000Z",
  lastObservedAt: `2026-09-04T00:0${revision}:00.000Z`,
  occurrenceCount: revision,
  latestEventId: `event:multiplayer:${revision}`,
  latestEvaluationId: `evaluation:multiplayer:${revision}`,
  ...(status === "recovered"
    ? { recoveredAt: `2026-09-04T00:0${revision}:00.000Z` }
    : {}),
  revision,
});

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("GitHub alert issue adapter", () => {
  it("creates, updates, resolves, reopens, reconciles, and preserves discussion", async () => {
    let labelExists = false;
    const issues: Array<{
      number: number;
      html_url: string;
      title: string;
      body: string | null;
      state: "open" | "closed";
    }> = [];
    let createCount = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      if (url.pathname.endsWith("/access_tokens")) {
        return jsonResponse({
          token: "installation-token",
          expires_at: "2026-09-04T02:00:00.000Z",
        });
      }
      if (url.pathname.endsWith("/labels/airjam%3Aoperational-alert")) {
        return labelExists ? jsonResponse({ name: "label" }) : jsonResponse({}, 404);
      }
      if (url.pathname.endsWith("/labels") && method === "POST") {
        labelExists = true;
        return jsonResponse({ name: "airjam:operational-alert" }, 201);
      }
      if (url.pathname.endsWith("/issues") && method === "GET") {
        return jsonResponse(issues);
      }
      if (url.pathname.endsWith("/issues") && method === "POST") {
        createCount += 1;
        const body = JSON.parse(String(init?.body)) as {
          title: string;
          body: string;
        };
        const issue = {
          number: issues.length + 1,
          html_url: `https://github.com/vucinatim/air-jam/issues/${issues.length + 1}`,
          title: body.title,
          body: body.body,
          state: "open" as const,
        };
        issues.push(issue);
        return jsonResponse(issue, 201);
      }
      const issueNumber = Number(url.pathname.split("/").at(-1));
      const issue = issues.find((candidate) => candidate.number === issueNumber);
      if (!issue) return jsonResponse({}, 404);
      if (method === "GET") return jsonResponse(issue);
      const body = JSON.parse(String(init?.body)) as Partial<typeof issue>;
      Object.assign(issue, body);
      return jsonResponse(issue);
    };
    const projector = createGitHubAlertIssueProjector({
      config: {
        enabled: true,
        appId: "123",
        installationId: "456",
        privateKey,
        repository: "vucinatim/air-jam",
      },
      fetchImpl,
      apiBaseUrl: "https://fixture.invalid",
      now: () => new Date("2026-09-04T01:00:00.000Z"),
    });

    const created = await projector({
      alert: createAlert({ revision: 1 }),
      knownIssueNumber: null,
    });
    expect(created).toMatchObject({
      action: "created",
      issue: { number: 1, state: "open" },
    });
    issues[0]!.body = `${issues[0]!.body}\n\nHuman diagnosis stays here.`;

    const updated = await projector({
      alert: createAlert({ revision: 2 }),
      knownIssueNumber: 1,
    });
    expect(updated.action).toBe("updated");
    expect(issues[0]!.body).toContain("Human diagnosis stays here.");
    expect(issues[0]!.body).toContain("operational-event:event:multiplayer:2");

    const resolved = await projector({
      alert: createAlert({ revision: 3, status: "recovered" }),
      knownIssueNumber: 1,
    });
    expect(resolved.action).toBe("resolved");
    expect(issues[0]).toMatchObject({ state: "closed" });
    expect(issues[0]!.body).toContain("Passed at");

    const reopened = await projector({
      alert: createAlert({ revision: 4 }),
      knownIssueNumber: 1,
    });
    expect(reopened.action).toBe("reopened");
    expect(issues[0]).toMatchObject({ state: "open" });
    expect(issues[0]!.body).toContain("Failed at alert revision `4`");

    const reconciled = await projector({
      alert: createAlert({ revision: 4 }),
      knownIssueNumber: null,
    });
    expect(reconciled.action).toBe("unchanged");
    expect(createCount).toBe(1);
    expect(issues).toHaveLength(1);
  });

  it("fails closed on partial identity, permission errors, and issue identity conflicts", async () => {
    expect(() =>
      resolveGitHubAlertIssueConfig({
        AIRJAM_GITHUB_ISSUES_APP_ID: "123",
      }),
    ).toThrow(/requires app ID, installation ID, private key, and repository/i);
    expect(() =>
      mergeOperationalAlertIssueBlock({
        existingBody:
          "<!-- airjam-operational-alert-key:another-alert -->\nHuman text",
        managedBlock: renderOperationalAlertIssueBlock(
          createAlert({ revision: 1 }),
        ),
        alertKey: "slo:multiplayer:test",
      }),
    ).toThrow(/different Air Jam alert key/i);

    const projector = createGitHubAlertIssueProjector({
      config: {
        enabled: true,
        appId: "123",
        installationId: "456",
        privateKey,
        repository: "vucinatim/air-jam",
      },
      fetchImpl: async () => jsonResponse({}, 403),
      now: () => new Date("2026-09-04T01:00:00.000Z"),
    });
    await expect(
      projector({
        alert: createAlert({ revision: 1 }),
        knownIssueNumber: null,
      }),
    ).rejects.toMatchObject<Partial<GitHubAlertIssueAdapterError>>({
      code: "github.http_403",
      retryable: false,
    });
  });
});
