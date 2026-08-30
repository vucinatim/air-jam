import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AIR_JAM_MCP_SERVER_VERSION } from "./version.js";

const HELP_TEXT = `Usage: airjam-mcp [options]

Official Air Jam MCP server

Options:
  -h, --help       Show this help text
  -V, --version    Show the installed package version
`;

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(HELP_TEXT);
  process.exit(0);
}

if (argv.includes("--version") || argv.includes("-V")) {
  process.stdout.write(`${AIR_JAM_MCP_SERVER_VERSION}\n`);
  process.exit(0);
}

const { createAirJamMcpServer } = await import("./server.js");
const server = await createAirJamMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
