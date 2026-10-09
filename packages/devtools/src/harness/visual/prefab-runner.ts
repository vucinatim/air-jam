import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { PrefabCaptureDefinition } from "./prefab-contract.js";
import { launchHarnessBrowser } from "./session.js";
import type { VisualHarnessMode } from "./types.js";

const prefabHarnessSchema = z.object({
  gameId: z.string(),
  prefabs: z.array(
    z.object({
      id: z.string(),
      prefabId: z.string(),
      description: z.string().optional(),
      viewport: z
        .object({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        })
        .optional(),
      waitForTestId: z.string().optional(),
      buildHostUrl: z.custom<PrefabCaptureDefinition["buildHostUrl"]>(
        (value) => typeof value === "function",
      ),
    }),
  ),
});

const artifactSegment = (value: string): string => {
  const segment = value.replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!segment || segment === "." || segment === "..") {
    throw new Error(`Invalid prefab artifact segment "${value}".`);
  }
  return segment;
};

export const loadPrefabCapture = async ({
  gameId,
  gameDirectory,
  prefabId,
  variantPairs = [],
  mode = "standalone-dev",
  secure = false,
}: {
  gameId: string;
  gameDirectory: string;
  prefabId: string;
  variantPairs?: string[];
  mode?: VisualHarnessMode;
  secure?: boolean;
}) => {
  if (mode !== "standalone-dev" && mode !== "arcade-built") {
    throw new Error(`Unsupported visual prefab capture mode "${mode}".`);
  }
  if (!gameId || gameId === "." || gameId === "..") {
    throw new Error(`Invalid prefab capture game id "${gameId}".`);
  }
  const modulePath = ["prefabs.ts", "prefabs.mjs"]
    .map((fileName) => path.join(gameDirectory, "visual", fileName))
    .find((filePath) => fs.existsSync(filePath));
  if (!modulePath) {
    throw new Error(
      `No prefab capture harness found in ${path.join(gameDirectory, "visual")}.`,
    );
  }
  const loaded = await import(pathToFileURL(modulePath).href);
  const parsed = prefabHarnessSchema.safeParse(loaded.prefabCaptureHarness);
  if (!parsed.success || parsed.data.gameId !== gameId) {
    throw new Error(
      `Invalid prefab capture harness for "${gameId}" at ${modulePath}.`,
    );
  }
  const harness = parsed.data;
  const prefab = harness.prefabs.find(
    (candidate) => candidate.id === prefabId || candidate.prefabId === prefabId,
  );
  if (!prefab) {
    throw new Error(
      `No prefab capture matched "${prefabId}" for "${gameId}". Available prefab captures: ${harness.prefabs.map((entry) => `${entry.id} -> ${entry.prefabId}`).join(", ")}`,
    );
  }
  const variants = Object.fromEntries(
    variantPairs.map((pair) => {
      const separator = pair.indexOf("=");
      const key = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (separator <= 0 || !key || !value) {
        throw new Error(
          `Invalid --variant value "${pair}". Expected key=value.`,
        );
      }
      return [key, value];
    }),
  );
  const suffix = Object.entries(variants)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${artifactSegment(key)}-${artifactSegment(value)}`)
    .join("__");
  const artifactId = [artifactSegment(prefab.id), suffix]
    .filter(Boolean)
    .join("__");
  return { gameId, prefab, variants, artifactId, mode, secure };
};

export const capturePrefabAtRuntime = async ({
  capture,
  hostUrl,
  artifactRoot,
}: {
  capture: Awaited<ReturnType<typeof loadPrefabCapture>>;
  hostUrl: string;
  artifactRoot: string;
}) => {
  const { gameId, prefab, variants, artifactId, mode, secure } = capture;
  const artifactDirectory = path.join(
    artifactRoot,
    encodeURIComponent(gameId),
    "prefabs",
    artifactId,
  );
  fs.rmSync(artifactDirectory, { force: true, recursive: true });
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const targetUrl = prefab.buildHostUrl(hostUrl, {
    prefabId: prefab.prefabId,
    variants,
    mode,
  });
  const browser = await launchHarnessBrowser();
  try {
    const viewport = prefab.viewport ?? { width: 1024, height: 1024 };
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      let pageError: Error | null = null;
      page.on("pageerror", (error) => {
        pageError ??= error;
      });
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      const game =
        mode === "arcade-built"
          ? page.frameLocator('iframe[data-testid="arcade-host-game-frame"]')
          : page;
      if (prefab.waitForTestId) {
        await game.getByTestId(prefab.waitForTestId).waitFor({
          state: "visible",
          timeout: 30_000,
        });
      }
      await page.waitForTimeout(900);
      if (pageError) throw pageError;
      const screenshotPath = path.join(artifactDirectory, "prefab.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const metadata = {
        gameId,
        captureId: prefab.id,
        prefabId: prefab.prefabId,
        runtimeMode: mode,
        secure,
        capturedAt: new Date().toISOString(),
        viewport,
        variants,
        url: targetUrl,
        screenshot: {
          fileName: "prefab.png",
          relativePath: path.relative(artifactRoot, screenshotPath),
        },
      };
      const metadataPath = path.join(artifactDirectory, "metadata.json");
      fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      return { artifactDirectory, metadataPath, metadata };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
};
