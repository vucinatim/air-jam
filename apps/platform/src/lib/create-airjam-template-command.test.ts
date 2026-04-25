import { describe, expect, it } from "vitest";
import {
  buildCreateAirJamTemplateCommand,
  isCreateAirJamTemplateId,
} from "./create-airjam-template-command";

describe("create-airjam template command", () => {
  it("builds the canonical npx command for valid template ids", () => {
    expect(buildCreateAirJamTemplateCommand("pong")).toBe(
      "npx create-airjam@latest my-game --template pong",
    );
    expect(
      buildCreateAirJamTemplateCommand("air-capture", "capture-party"),
    ).toBe("npx create-airjam@latest capture-party --template air-capture");
  });

  it("rejects invalid template ids instead of producing shell text", () => {
    expect(isCreateAirJamTemplateId("pong && rm -rf .")).toBe(false);
    expect(buildCreateAirJamTemplateCommand("pong && rm -rf .")).toBeNull();
    expect(buildCreateAirJamTemplateCommand("")).toBeNull();
  });
});
