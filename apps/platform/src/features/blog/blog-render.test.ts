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
      expect(html).toContain("<h1");
    }
  }, 30_000);
});
