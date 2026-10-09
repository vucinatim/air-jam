import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { canonicalDocsRoot, cliRoot } from "./base-docs-pack.mjs";

export const documentationRoot = path.join(
  cliRoot,
  "template-assets",
  "documentation",
);

export async function generateDocumentationSnapshot(
  targetRoot = documentationRoot,
) {
  const catalog = JSON.parse(
    await fs.readFile(path.join(canonicalDocsRoot, "catalog.json"), "utf8"),
  );
  const { version } = JSON.parse(
    await fs.readFile(path.join(cliRoot, "package.json"), "utf8"),
  );
  const requiredComponents = JSON.parse(
    await fs.readFile(
      path.join(canonicalDocsRoot, "renderer-components.json"),
      "utf8",
    ),
  );
  const documents = [];
  for (const entry of catalog) {
    const content = await fs.readFile(
      path.join(canonicalDocsRoot, entry.source),
    );
    const target = path.join(targetRoot, entry.source);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    documents.push({
      source: entry.source,
      page: entry.page,
      size: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  await fs.writeFile(
    path.join(targetRoot, "manifest.json"),
    `${JSON.stringify({ schemaVersion: 1, packageVersion: version, requiredComponents, documents }, null, 2)}\n`,
  );
}
