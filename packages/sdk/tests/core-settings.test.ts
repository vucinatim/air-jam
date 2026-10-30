import { describe, expect, it } from "vitest";
import { defineAirJamSettings, setting } from "../src/core";
import { HostSettings, type SettingsValues } from "../src/core/settings";

const declaration = defineAirJamSettings({
  speed: setting.number({ default: 2, min: 1, max: 4, step: 0.5, live: true }),
  enabled: setting.boolean({ default: true, live: true }),
  mode: setting.choice({
    options: ["solo", "team"],
    default: "solo",
    live: true,
  }),
  seats: setting.number({ default: 4, min: 2, max: 8, step: 1 }),
});

describe("declared host settings", () => {
  it("validates declarations, fills defaults and accepts initial non-live values", () => {
    expect(new HostSettings(declaration, { seats: 6 }).read()).toEqual({
      values: { speed: 2, enabled: true, mode: "solo", seats: 6 },
      revision: 0,
    });
    expect(() =>
      defineAirJamSettings({ bad_id: setting.boolean({ default: true }) }),
    ).toThrow("AJ_SETTING_INVALID");
    expect(() =>
      defineAirJamSettings({
        speed: setting.number({ default: 1.2, min: 1, max: 4, step: 1 }),
      }),
    ).toThrow("AJ_SETTING_INVALID");
    expect(() =>
      defineAirJamSettings({
        mode: setting.choice({ options: ["solo"], default: "other" as "solo" }),
      }),
    ).toThrow("AJ_SETTING_INVALID");
    expect(() => new HostSettings(declaration, { speed: 10 })).toThrow(
      "AJ_SETTING_INVALID",
    );
    expect(() => new HostSettings(declaration, { missing: 1 })).toThrow(
      "AJ_SETTING_UNKNOWN",
    );
  });

  it("commits a whole patch once and records it before subscribers can act", () => {
    const settings = new HostSettings(declaration);
    const before = settings.read();
    const order: string[] = [];
    settings.subscribe(() =>
      order.push(`subscriber:${settings.read().revision}`),
    );
    const updated = settings.update(
      { speed: 3.5, mode: "team", enabled: false },
      0,
      (revision) => order.push(`record:${revision}`),
    );
    expect(updated).toEqual({
      values: { speed: 3.5, mode: "team", enabled: false, seats: 4 },
      revision: 1,
    });
    expect(order).toEqual(["record:1", "subscriber:1"]);
    expect(before.values.speed).toBe(2);
    expect(Object.isFrozen(updated.values)).toBe(true);
    expect(() => settings.update({ speed: 4 }, 0, () => {})).toThrow(
      "AJ_SETTING_STALE",
    );
    expect(() => settings.update({ seats: 6 }, 1, () => {})).toThrow(
      "AJ_SETTING_NOT_LIVE",
    );
    const invalidPatches: SettingsValues[] = [
      { speed: 4.5 },
      { speed: 2.2 },
      { enabled: "yes" },
      { mode: "other" },
      { missing: 1 },
    ];
    for (const patch of invalidPatches) {
      expect(() => settings.update(patch, 1, () => {})).toThrow(
        /AJ_SETTING_(INVALID|UNKNOWN)/,
      );
      expect(settings.read()).toBe(updated);
    }
    expect(() => settings.update({ speed: 4, seats: 6 }, 1, () => {})).toThrow(
      "AJ_SETTING_NOT_LIVE",
    );
    expect(settings.read()).toBe(updated);
  });
});
