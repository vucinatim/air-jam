import {
  type PrefabCaptureDefinition,
  type PrefabCaptureHarness,
  type PrefabCaptureVariants,
  type VisualHarnessMode,
} from "@air-jam/harness";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../lib/paths.mjs";
import { startRepoVisualStack, VISUAL_ARTIFACT_ROOT } from "./core.js";

const DEFAULT_VIEWPORT = {
  width: 1024,
  height: 1024,
};

const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

const resetDir = (dir: string): void => {
  fs.rmSync(dir, { force: true, recursive: true });
  ensureDir(dir);
};

const writeJson = (filePath: string, value: unknown): void => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const resolvePrefabHarnessModulePath = (gameId: string): string => {
  const tsPath = path.join(repoRoot, "games", gameId, "visual", "prefabs.ts");
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }

  const mjsPath = path.join(repoRoot, "games", gameId, "visual", "prefabs.mjs");
  if (fs.existsSync(mjsPath)) {
    return mjsPath;
  }

  throw new Error(
    `No prefab capture harness found for "${gameId}" in games/${gameId}/visual/.`,
  );
};

const loadPrefabHarness = async (
  gameId: string,
): Promise<PrefabCaptureHarness> => {
  const modulePath = resolvePrefabHarnessModulePath(gameId);
  const loaded = (await import(pathToFileURL(modulePath).href)) as {
    prefabCaptureHarness?: PrefabCaptureHarness;
  };
  const harness = loaded.prefabCaptureHarness ?? null;

  if (
    !harness ||
    harness.gameId !== gameId ||
    !Array.isArray(harness.prefabs)
  ) {
    throw new Error(
      `Invalid prefab capture harness for "${gameId}" at ${modulePath}.`,
    );
  }

  return harness;
};

const parseVariants = (variantPairs: string[]): PrefabCaptureVariants => {
  const variants: Record<string, string> = {};

  for (const pair of variantPairs) {
    const separator = pair.indexOf("=");
    if (separator <= 0 || separator === pair.length - 1) {
      throw new Error(`Invalid --variant value "${pair}". Expected key=value.`);
    }

    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid --variant value "${pair}". Expected key=value.`);
    }
    variants[key] = value;
  }

  return variants;
};

const listPrefabIds = (harness: PrefabCaptureHarness): string =>
  harness.prefabs
    .map((prefab) => `${prefab.id} -> ${prefab.prefabId}`)
    .join(", ");

const sanitizeArtifactSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-");

const buildArtifactId = (
  prefab: PrefabCaptureDefinition,
  variants: PrefabCaptureVariants,
): string => {
  const variantSuffix = Object.entries(variants)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${sanitizeArtifactSegment(key)}-${sanitizeArtifactSegment(value)}`,
    )
    .join("__");

  return variantSuffix.length > 0
    ? `${sanitizeArtifactSegment(prefab.id)}__${variantSuffix}`
    : sanitizeArtifactSegment(prefab.id);
};

export type RunVisualPrefabCaptureCommandOptions = {
  gameId: string;
  prefabId: string;
  variantPairs?: string[];
  mode?: VisualHarnessMode;
  secure?: boolean;
};

export const runVisualPrefabCaptureCommand = async ({
  gameId,
  prefabId,
  variantPairs = [],
  mode = "standalone-dev",
  secure = false,
}: RunVisualPrefabCaptureCommandOptions): Promise<void> => {
  if (mode !== "arcade-built" && mode !== "standalone-dev") {
    throw new Error(
      `Unsupported visual prefab capture mode "${mode}". Use "standalone-dev" or "arcade-built".`,
    );
  }

  const harness = await loadPrefabHarness(gameId);
  const variants = parseVariants(variantPairs);
  const prefab = harness.prefabs.find(
    (candidate) => candidate.id === prefabId || candidate.prefabId === prefabId,
  );

  if (!prefab) {
    throw new Error(
      `No prefab capture matched "${prefabId}" for "${gameId}". Available prefab captures: ${listPrefabIds(harness)}`,
    );
  }

  const artifactId = buildArtifactId(prefab, variants);
  const artifactDir = path.join(
    VISUAL_ARTIFACT_ROOT,
    gameId,
    "prefabs",
    artifactId,
  );
  resetDir(artifactDir);

  const stack = await startRepoVisualStack({
    gameId,
    mode,
    secure,
  });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
    ],
  });

  const viewport = prefab.viewport ?? DEFAULT_VIEWPORT;
  const targetUrl = prefab.buildHostUrl(stack.urls.hostUrl, {
    prefabId: prefab.prefabId,
    variants,
    mode,
  });

  let pageError: Error | null = null;

  try {
    const context = await browser.newContext({
      viewport,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => {
      pageError = error;
    });

    console.log(`[visual] Prefab ${prefab.prefabId}`);
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
    });

    if (prefab.waitForTestId) {
      await page
        .getByTestId(prefab.waitForTestId)
        .waitFor({ state: "visible", timeout: 30_000 });
    }

    await page.waitForTimeout(900);

    if (pageError) {
      throw pageError;
    }

    const screenshotPath = path.join(artifactDir, "prefab.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    writeJson(path.join(artifactDir, "metadata.json"), {
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
        relativePath: path.relative(VISUAL_ARTIFACT_ROOT, screenshotPath),
      },
    });

    await context.close();
    console.log(
      `[visual] Prefab capture complete. Artifact written to ${path.join(".airjam", "artifacts", "visual", gameId, "prefabs", artifactId)}.`,
    );
  } finally {
    await browser.close();
    await stack.shutdown();
  }
};
