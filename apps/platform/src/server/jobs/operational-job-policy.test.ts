import { operationalJobKindValues } from "@air-jam/database-contract";
import { describe, expect, it } from "vitest";
import {
  assertValidOperationalJobPolicy,
  getOperationalJobPolicy,
  isOperationalJobKind,
  OPERATIONAL_JOB_POLICIES,
  OperationalJobPolicyError,
  parseOperationalJobKind,
  type OperationalJobPolicy,
} from "./operational-job-policy";

describe("operational job policy", () => {
  it("owns the complete bounded capacity catalog", () => {
    expect(Object.keys(OPERATIONAL_JOB_POLICIES).sort()).toEqual(
      [...operationalJobKindValues].sort(),
    );
    expect(OPERATIONAL_JOB_POLICIES).toEqual({
      release_artifact_processing: {
        kind: "release_artifact_processing",
        lane: "release_processing",
        globalConcurrency: 4,
        perCreatorConcurrency: 2,
        queueDepth: 50,
        maxAttempts: 3,
        leaseSeconds: 300,
        deadlineSeconds: 3_600,
        retryBackoffSeconds: 60,
      },
      release_browser_validation: {
        kind: "release_browser_validation",
        lane: "browser_validation",
        globalConcurrency: 2,
        perCreatorConcurrency: 1,
        queueDepth: 100,
        maxAttempts: 3,
        leaseSeconds: 120,
        deadlineSeconds: 1_800,
        retryBackoffSeconds: 30,
      },
      release_image_moderation: {
        kind: "release_image_moderation",
        lane: "moderation",
        globalConcurrency: 2,
        perCreatorConcurrency: 1,
        queueDepth: 100,
        maxAttempts: 3,
        leaseSeconds: 90,
        deadlineSeconds: 1_800,
        retryBackoffSeconds: 60,
      },
    });
  });

  it("freezes the catalog and every policy", () => {
    expect(Object.isFrozen(OPERATIONAL_JOB_POLICIES)).toBe(true);
    for (const kind of operationalJobKindValues) {
      expect(Object.isFrozen(getOperationalJobPolicy(kind))).toBe(true);
      expect(getOperationalJobPolicy(kind)).toBe(
        OPERATIONAL_JOB_POLICIES[kind],
      );
    }
  });

  it("parses only canonical job kinds", () => {
    expect(isOperationalJobKind("release_browser_validation")).toBe(true);
    expect(parseOperationalJobKind("release_browser_validation")).toBe(
      "release_browser_validation",
    );
    expect(isOperationalJobKind("browser_validation")).toBe(false);
    expect(() => parseOperationalJobKind("browser_validation")).toThrow(
      OperationalJobPolicyError,
    );
  });

  it("rejects unsafe capacity and timing policies", () => {
    const valid = OPERATIONAL_JOB_POLICIES.release_browser_validation;
    const invalidPolicies: OperationalJobPolicy[] = [
      { ...valid, globalConcurrency: 0 },
      { ...valid, perCreatorConcurrency: 3 },
      { ...valid, queueDepth: -1 },
      { ...valid, maxAttempts: 0 },
      { ...valid, leaseSeconds: valid.deadlineSeconds },
      { ...valid, retryBackoffSeconds: valid.deadlineSeconds },
      { ...valid, lane: "release_processing" },
    ];

    for (const policy of invalidPolicies) {
      expect(() => assertValidOperationalJobPolicy(policy)).toThrow(
        OperationalJobPolicyError,
      );
    }
  });
});
