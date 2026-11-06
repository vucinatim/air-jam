import { archivePlatformRelease } from "@air-jam/devtools/release";
import { afterEach, expect, it, vi } from "vitest";
import {
  buildToolDefinitions,
  getRegisteredToolNamesForProjectMode,
} from "../src/tools";

vi.mock("@air-jam/devtools/release", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@air-jam/devtools/release")>()),
  archivePlatformRelease: vi.fn(async () => ({
    release: {
      id: "release",
      status: "archived",
      playUrl: "https://platform.example/play/release",
    },
  })),
}));

afterEach(() => vi.clearAllMocks());
it("exposes archive in each supported mode and returns its exact shared result", async () => {
  for (const projectMode of ["monorepo", "standalone-game"] as const) {
    expect(getRegisteredToolNamesForProjectMode(projectMode)).toContain(
      "airjam.release_archive",
    );
    const tool = buildToolDefinitions({ projectMode })[
      "airjam.release_archive"
    ];
    expect(tool.inputSchema.safeParse({ releaseId: "" }).success).toBe(false);
    const input = {
      platformUrl: "https://platform.example",
      releaseId: "release",
    };
    const response = await tool.run(tool.inputSchema.parse(input) as never);
    expect(response.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          {
            release: {
              id: "release",
              status: "archived",
              playUrl: "https://platform.example/play/release",
            },
          },
          null,
          2,
        ),
      },
    ]);
    expect(archivePlatformRelease).toHaveBeenLastCalledWith(input);
  }
});
