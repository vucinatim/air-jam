import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach } from "vitest";
import { createAirJamMcpServer, inspectMcpProjectSetup } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-mcp-server-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("createAirJamMcpServer", () => {
  it("registers the core Air Jam tools", async () => {
    const server = await createAirJamMcpServer({
      cwd: path.resolve(__dirname, "../../.."),
    });
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.inspect_project",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain("airjam.read_logs");
    expect(listed.tools.map((tool) => tool.name)).toContain("airjam.start_dev");
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.inspect_game_agent_contract",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.list_visual_scenarios",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.read_harness_snapshot",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.list_harness_sessions",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.connect_controller",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.read_runtime_snapshot",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.read_game_snapshot",
    );
    expect(listed.tools.map((tool) => tool.name)).toContain(
      "airjam.invoke_game_action",
    );
    expect(
      listed.tools.find((tool) => tool.name === "airjam.capture_visuals")
        ?.execution,
    ).toEqual({
      taskSupport: "required",
    });
  });

  it("runs inspect_project through MCP", async () => {
    const server = await createAirJamMcpServer();
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: "airjam.inspect_project",
      arguments: {
        cwd: path.resolve(__dirname, "../../.."),
      },
    });

    expect(result.isError).not.toBe(true);
    const typedResult = result as {
      content: Array<{
        type: string;
        text?: string;
      }>;
    };
    const textBlock = typedResult.content.find(
      (block) => block.type === "text",
    );
    const parsed = JSON.parse(textBlock?.text ?? "{}");
    expect(parsed).toMatchObject({
      context: {
        mode: "monorepo",
      },
    });
  });

  it("gates standalone-only mode schemas at server construction time", async () => {
    const standaloneProjectRoot = path.resolve(
      __dirname,
      "../../../games/pong",
    );
    const server = await createAirJamMcpServer({
      cwd: standaloneProjectRoot,
    });
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const listed = await client.listTools();
    const startDevTool = listed.tools.find(
      (tool) => tool.name === "airjam.start_dev",
    );

    expect(startDevTool).toBeDefined();
    expect(JSON.stringify(startDevTool?.inputSchema ?? {})).not.toContain(
      "arcade-dev",
    );
  });

  it("only registers inspect_project outside recognized Air Jam projects", async () => {
    const root = await createTempRoot();
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ name: "not-air-jam", private: true }, null, 2),
      "utf8",
    );

    const server = await createAirJamMcpServer({ cwd: root });
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "airjam.inspect_project",
    ]);
  });
});

describe("inspectMcpProjectSetup", () => {
  it("reports the expected default config shape", async () => {
    const inspection = await inspectMcpProjectSetup({ cwd: process.cwd() });

    expect(inspection.recommendedConfig).toEqual({
      mcpServers: {
        airjam: {
          command: "pnpm",
          args: ["exec", "airjam-mcp"],
        },
      },
    });
  });
});
