import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const documentationPageSchema = z
  .object({
    title: z.string().min(1),
    href: z.string().regex(/^\/docs\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/),
    description: z.string().min(1),
    section: z.string().min(1),
    icon: z.enum([
      "info",
      "rocket",
      "lightbulb",
      "layers",
      "cpu",
      "code",
      "zap",
      "network",
      "bot",
    ]),
    keywords: z.array(z.string().min(1)),
    docType: z.enum([
      "concept",
      "guide",
      "reference",
      "contract",
      "migration",
      "agent",
    ]),
    order: z.number().int().nonnegative(),
    sinceVersion: z.string().min(1).optional(),
    lastVerifiedVersion: z.string().min(1).optional(),
    stability: z.enum(["stable", "evolving", "experimental"]).optional(),
    audience: z.enum(["user", "maintainer", "agent", "studio"]).optional(),
  })
  .strict();

const documentationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    packageVersion: z.string().min(1),
    documents: z
      .array(
        z
          .object({
            source: z
              .string()
              .regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/page\.mdx$/),
            page: documentationPageSchema,
            size: z.number().int().nonnegative(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export async function readDocumentationSnapshot() {
  const root = fileURLToPath(
    new URL("../template-assets/documentation/", import.meta.url),
  );
  const manifest = documentationManifestSchema.parse(
    JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8")),
  );
  const seen = new Set<string>();
  const documents = [];
  for (const document of manifest.documents) {
    const expectedHref = `/docs/${document.source.replace(/\/page\.mdx$/, "")}`;
    if (seen.has(document.source) || document.page.href !== expectedHref) {
      throw new Error(`Invalid documentation identity: ${document.source}.`);
    }
    seen.add(document.source);
    const content = await fs.readFile(path.join(root, document.source));
    const digest = createHash("sha256").update(content).digest("hex");
    if (content.length !== document.size || digest !== document.sha256) {
      throw new Error(`Documentation integrity failed for ${document.source}.`);
    }
    documents.push({ ...document, content: content.toString("utf8") });
  }
  return {
    schemaVersion: manifest.schemaVersion,
    packageVersion: manifest.packageVersion,
    documents,
  };
}
