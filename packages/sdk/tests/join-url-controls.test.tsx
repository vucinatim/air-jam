// @vitest-environment jsdom
import { resolveRuntimeTopology } from "@air-jam/sdk/runtime-topology";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildArcadeGameIframeSrc } from "../src/arcade/url";
import { JoinUrlActionButtons, JoinUrlControls, JoinUrlField } from "../src/ui";

describe("join url controls", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("renders the field label, value, and helper text", () => {
    render(
      <JoinUrlField
        value="https://example.com/controller?room=ROOM1"
        label="Controller URL"
        helperText="Share this with players."
      />,
    );

    expect(screen.getByText("Controller URL")).toBeTruthy();
    expect(
      screen.getByDisplayValue("https://example.com/controller?room=ROOM1"),
    ).toBeTruthy();
    expect(screen.getByText("Share this with players.")).toBeTruthy();
    expect(
      screen
        .getByDisplayValue("https://example.com/controller?room=ROOM1")
        .getAttribute("name"),
    ).toBe("airjam-controller-link");
  });

  it("disables copy and open buttons when no join url exists", () => {
    render(<JoinUrlActionButtons hasValue={false} />);

    expect(
      screen
        .getByRole("button", { name: "Copy join link" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Open join link" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps the composed control API stable", () => {
    render(
      <JoinUrlControls
        value="https://example.com/controller?room=ROOM1"
        copied
        onCopy={() => undefined}
        onOpen={() => undefined}
      />,
    );

    expect(
      screen.getByDisplayValue("https://example.com/controller?room=ROOM1"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Copied join link" })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Open join link" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("leaves joining to the Arcade when the game runs inside it", () => {
    const origin = window.location.origin;
    const gameUrl = new URL(
      buildArcadeGameIframeSrc({
        normalizedUrl: `${origin}/play`,
        roomId: "ABCD",
        launchCapability: { token: "join_123", expiresAt: 1_700_000_000_000 },
        joinUrl: `${origin}/controller?room=ABCD`,
        topology: resolveRuntimeTopology({
          runtimeMode: "arcade-live",
          surfaceRole: "host",
          appOrigin: origin,
          backendOrigin: origin,
          publicHost: origin,
          embedded: true,
          embedParentOrigin: origin,
        }),
        arcadeSurface: { epoch: 1, kind: "game", gameId: "pong" },
      }),
    );
    window.history.replaceState(null, "", `${gameUrl.pathname}${gameUrl.search}`);

    const { container } = render(
      <JoinUrlControls value={`${origin}/controller?room=ABCD&aj_cap=x`} />,
    );

    expect(container.innerHTML).toBe("");
  });
});
