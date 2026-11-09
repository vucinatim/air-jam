import { buildToolDefinitions } from "../dist/index.js";
import toolContract from "../tool-contract.json";

it("builds the complete packaged tool list in every project mode", () => {
  for (const projectMode of [
    "monorepo",
    "standalone-game",
    "unknown",
  ] as const) {
    const tools = buildToolDefinitions({ projectMode });
    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining(toolContract[projectMode]),
    );
  }
});
