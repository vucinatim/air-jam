import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AirJamLogo } from "./air-jam-logo";

describe("AirJamLogo", () => {
  it("serves the bundled mark directly without the runtime image optimizer", () => {
    const markup = renderToStaticMarkup(
      createElement(AirJamLogo, {
        alt: "Air Jam",
        className: "size-8",
      }),
    );

    expect(markup).toContain('src="/images/airjam-logo.png"');
    expect(markup).not.toContain("/_next/image");
  });
});
