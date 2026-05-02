import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAirJamMcpServer } from "./server.js";

const HELP_TEXT = `Usage: airjam-mcp [options]

Official Air Jam MCP server

Options:
  --help     Show this help text
`;

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(HELP_TEXT);
  process.exit(0);
}

const server = await createAirJamMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
