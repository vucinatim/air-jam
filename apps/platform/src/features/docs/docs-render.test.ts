import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDocsDocuments } from "./index";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);

describe("docs render validation", () => {
  it("renders every canonical docs page to HTML", async () => {
    for (const document of getDocsDocuments()) {
      const { default: Component } = await document.loadComponent();
      const html = renderToStaticMarkup(createElement(Component));

      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain("<h1");
    }
  }, 30_000);

  it("preserves server-rendered code blocks for docs pages with fenced code", async () => {
    for (const document of getDocsDocuments()) {
      const source = await fs.readFile(
        path.join(repoRoot, document.sourcePath),
        "utf8",
      );

      if (!source.includes("```")) {
        continue;
      }

      const { default: Component } = await document.loadComponent();
      const html = renderToStaticMarkup(createElement(Component));

      expect(html).toContain("<pre");
      expect(html).toContain("<code");
    }
  }, 30_000);

  it("renders markdown tables as HTML tables", async () => {
    const hooksDocument = getDocsDocuments().find(
      (document) => document.page.href === "/docs/sdk/hooks",
    );

    expect(hooksDocument).toBeDefined();

    const { default: Component } = await hooksDocument!.loadComponent();
    const html = renderToStaticMarkup(createElement(Component));

    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
  }, 30_000);
});
