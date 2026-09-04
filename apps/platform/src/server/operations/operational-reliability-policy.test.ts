import { describe, expect, it } from "vitest";
import {
  getOperationalReliabilityCatalog,
  OPERATIONAL_SLO_DEFINITIONS,
  OPERATIONAL_SYNTHETIC_CHECKS,
} from "./operational-reliability-policy";

describe("operational reliability policy", () => {
  it("owns exactly one synthetic for every launch-critical story", () => {
    expect(
      OPERATIONAL_SYNTHETIC_CHECKS.map((check) => check.story).sort(),
    ).toEqual([
      "arcade_hosted_release",
      "landing_docs",
      "platform_realtime_health",
      "release_dependencies",
      "room_controller",
      "semantic_gameplay",
    ]);
    expect(
      new Set(OPERATIONAL_SYNTHETIC_CHECKS.map((check) => check.checkId)).size,
    ).toBe(OPERATIONAL_SYNTHETIC_CHECKS.length);
  });

  it("binds every check to one valid SLO and returns detached policy data", () => {
    const sloIds = new Set(OPERATIONAL_SLO_DEFINITIONS.map((slo) => slo.sloId));
    for (const check of OPERATIONAL_SYNTHETIC_CHECKS) {
      expect(sloIds.has(check.sloId)).toBe(true);
    }
    for (const slo of OPERATIONAL_SLO_DEFINITIONS) {
      expect(slo.syntheticCheckIds.length).toBeGreaterThan(0);
      expect([...slo.syntheticCheckIds].sort()).toEqual(
        OPERATIONAL_SYNTHETIC_CHECKS.filter(
          (check) => check.sloId === slo.sloId,
        )
          .map((check) => check.checkId)
          .sort(),
      );
      expect(slo.alerting.consecutiveBreaches).toBeGreaterThan(1);
      expect(slo.alerting.consecutiveRecoveries).toBeGreaterThan(1);
    }

    const first = getOperationalReliabilityCatalog();
    first.checks[0]!.title = "mutated by caller";
    expect(getOperationalReliabilityCatalog().checks[0]!.title).not.toBe(
      "mutated by caller",
    );
  });
});
