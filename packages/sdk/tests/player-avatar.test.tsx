// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerAvatar } from "../src/components/player-avatar";

const player = {
  id: "player-1",
  label: "Player One",
  color: "#22d3ee",
} as const;

describe("PlayerAvatar", () => {
  it("renders the player artwork by default", () => {
    render(<PlayerAvatar player={player} />);

    const avatar = screen.getByRole("img", { name: "Player One" });

    expect(avatar.tagName).toBe("IMG");
    expect((avatar as HTMLImageElement).src).toContain("dicebear.com");
  });

  it("renders the shared bot avatar shell when requested", () => {
    render(<PlayerAvatar player={player} isBot />);

    const avatar = screen.getByRole("img", { name: "Player One" });

    expect(avatar.tagName).toBe("DIV");
    expect(avatar.querySelector("svg")).not.toBeNull();
    expect((avatar as HTMLDivElement).style.borderColor).toBe(
      "rgb(34, 211, 238)",
    );
    expect((avatar as HTMLDivElement).style.color).toBe("rgb(34, 211, 238)");
  });
});
