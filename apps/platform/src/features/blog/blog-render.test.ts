import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getBlogDocuments } from "./index";

describe("blog render validation", () => {
  it("renders every canonical blog post to HTML", async () => {
    for (const document of getBlogDocuments()) {
      const { default: Component } = await document.loadComponent();
      const html = renderToStaticMarkup(createElement(Component));

      expect(html.length).toBeGreaterThan(0);
      // Articles must render with at least one section heading. The page
      // layout renders the article title in its own <h1>, so MDX bodies are
      // free to start at any heading level.
      expect(html).toMatch(/<h[1-6]/);
    }
  }, 30_000);
});
