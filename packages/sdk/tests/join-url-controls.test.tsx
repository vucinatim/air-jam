// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  JoinUrlActionButtons,
  JoinUrlControls,
  JoinUrlField,
} from "../src/ui";

describe("join url controls", () => {
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
  });

  it("disables copy and open buttons when no join url exists", () => {
    render(<JoinUrlActionButtons hasValue={false} />);

    expect(
      screen.getByRole("button", { name: "Copy join link" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Open join link" }).hasAttribute("disabled"),
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
      screen.getByRole("button", { name: "Copied join link" }).hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: "Open join link" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
