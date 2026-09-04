import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../../repo/lib/paths.mjs";
import {
  readPlatformMigrationCatalog,
  renderPlatformSchemaHeadSource,
} from "./platform-migration-catalog.mjs";

const generatedPath = path.join(
  repoRoot,
  "apps",
  "platform",
  "src",
  "db",
  "platform-schema-head.generated.ts",
);

export const generatePlatformSchemaHead = async () => {
  const catalog = readPlatformMigrationCatalog();
  const source = renderPlatformSchemaHeadSource(catalog);
  await fs.promises.writeFile(generatedPath, source, "utf8");
  return { catalog, generatedPath, source };
};

export const assertPlatformSchemaHeadIsFresh = async () => {
  const catalog = readPlatformMigrationCatalog();
  const expected = renderPlatformSchemaHeadSource(catalog);
  const actual = await fs.promises.readFile(generatedPath, "utf8");
  if (actual !== expected) {
    throw new Error(
      "Generated platform schema head is stale. Run `pnpm run repo -- platform generated prepare`.",
    );
  }
  return { catalog, generatedPath };
};
