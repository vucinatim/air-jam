import { detectProjectContext } from "@air-jam/devtools-core";
import type {
  CreateTaskRequestHandlerExtra,
  TaskRequestHandlerExtra,
} from "@modelcontextprotocol/sdk/experimental/tasks";
import { InMemoryTaskStore } from "@modelcontextprotocol/sdk/experimental/tasks";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  buildToolDefinitions,
  getRegisteredToolNamesForProjectMode,
} from "./tools.js";

const DEFAULT_TASK_TTL_MS = 5 * 60 * 1000;
const TASK_CAPABLE_CLIENT_NOTE =
  " Requires an MCP client with task-backed tool execution support.";

const describeToolForRegistration = ({
  description,
  requiresTaskSupport,
}: {
  description: string;
  requiresTaskSupport: boolean;
}): string =>
  requiresTaskSupport
    ? `${description}${TASK_CAPABLE_CLIENT_NOTE}`
    : description;

const createToolErrorResult = (error: unknown): CallToolResult => ({
  content: [
    {
      type: "text",
      text:
        error instanceof Error
          ? error.message
          : `Air Jam MCP task failed: ${String(error)}`,
    },
  ],
  isError: true,
});

export const createAirJamMcpServer = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<McpServer> => {
  const context = await detectProjectContext({ cwd });
  const toolDefinitions = buildToolDefinitions({
    projectMode: context.mode,
  });
  const registeredToolNames = getRegisteredToolNamesForProjectMode(
    context.mode,
  );
  const taskStore = new InMemoryTaskStore();
  const server = new McpServer(
    {
      name: "air-jam",
      version: "1.0.0",
    },
    {
      capabilities: {
        tasks: {
          list: {},
          cancel: {},
          requests: {
            tools: {
              call: {},
            },
          },
        },
      },
      instructions:
        "Use Air Jam tools before falling back to raw shell commands for Air Jam-native workflows. Start with inspect_project, read_logs with view=signal, and inspect_game when debugging runtime or game issues. If a tool advertises task-backed execution support as required, call it through an MCP client flow that supports tasks instead of assuming one blocking request/response call.",
      taskStore,
    },
  );

  for (const toolName of registeredToolNames) {
    const tool = toolDefinitions[toolName];
    const description = describeToolForRegistration({
      description: tool.description,
      requiresTaskSupport: tool.execution?.taskSupport === "required",
    });
    const baseConfig = {
      description,
      inputSchema: tool.inputSchema,
    };

    if (tool.execution?.taskSupport === "required") {
      server.experimental.tasks.registerToolTask(
        toolName,
        {
          ...baseConfig,
          execution: {
            taskSupport: "required",
          },
        },
        {
          createTask: async (
            args: unknown,
            { taskStore, taskRequestedTtl }: CreateTaskRequestHandlerExtra,
          ) => {
            const task = await taskStore.createTask({
              ttl: taskRequestedTtl ?? DEFAULT_TASK_TTL_MS,
            });

            void (async () => {
              try {
                const result = await tool.run(args as never);
                await taskStore.storeTaskResult(
                  task.taskId,
                  "completed",
                  result,
                );
              } catch (error) {
                await taskStore.storeTaskResult(
                  task.taskId,
                  "failed",
                  createToolErrorResult(error),
                );
              }
            })();

            return { task };
          },
          getTask: async (
            _args: unknown,
            { taskId, taskStore }: TaskRequestHandlerExtra,
          ) => taskStore.getTask(taskId),
          getTaskResult: async (
            _args: unknown,
            { taskId, taskStore }: TaskRequestHandlerExtra,
          ) => taskStore.getTaskResult(taskId) as Promise<CallToolResult>,
        },
      );
      continue;
    }

    server.registerTool(toolName, baseConfig, async (args: unknown) =>
      tool.run(args as never),
    );
  }

  return server;
};
