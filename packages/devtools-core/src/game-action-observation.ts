import type { AirJamActionInvocationResult } from "@air-jam/sdk/protocol";
import type { AirJamGameSnapshotInspection } from "./types.js";

export const isHostAcknowledgementObservationGap = (
  acknowledgement: AirJamActionInvocationResult,
): boolean =>
  acknowledgement.status === "rejected" &&
  (acknowledgement.reason === "host_ack_missing" ||
    acknowledgement.reason === "host_ack_timeout");

const stableStoreSnapshotFingerprint = (
  snapshot: AirJamGameSnapshotInspection,
): string =>
  JSON.stringify(
    snapshot.rawStores
      .map((entry) => ({
        storeDomain: entry.storeDomain,
        revision: entry.revision,
      }))
      .sort((left, right) => left.storeDomain.localeCompare(right.storeDomain)),
  );

const stableStoreSnapshotDataFingerprint = (
  snapshot: AirJamGameSnapshotInspection,
): string =>
  JSON.stringify(
    snapshot.rawStores
      .map((entry) => ({
        storeDomain: entry.storeDomain,
        data: entry.data,
      }))
      .sort((left, right) => left.storeDomain.localeCompare(right.storeDomain)),
  );

export const computeGameSnapshotObservation = ({
  snapshotBefore,
  snapshotAfter,
}: {
  snapshotBefore: AirJamGameSnapshotInspection;
  snapshotAfter: AirJamGameSnapshotInspection;
}): {
  snapshotAfterStatus:
    | "committed-update-observed"
    | "no-new-commit-before-timeout";
  observedStateChange: boolean;
} => {
  const fingerprintBefore = stableStoreSnapshotFingerprint(snapshotBefore);
  const fingerprintAfter = stableStoreSnapshotFingerprint(snapshotAfter);
  const dataFingerprintBefore =
    stableStoreSnapshotDataFingerprint(snapshotBefore);
  const dataFingerprintAfter =
    stableStoreSnapshotDataFingerprint(snapshotAfter);
  const projectedSnapshotBefore = JSON.stringify(snapshotBefore.snapshot);
  const projectedSnapshotAfter = JSON.stringify(snapshotAfter.snapshot);

  return {
    snapshotAfterStatus:
      fingerprintBefore === fingerprintAfter
        ? "no-new-commit-before-timeout"
        : "committed-update-observed",
    observedStateChange:
      dataFingerprintBefore !== dataFingerprintAfter ||
      projectedSnapshotBefore !== projectedSnapshotAfter,
  };
};

export const classifyGameActionOutcome = ({
  acknowledgement,
  observedStateChange,
}: {
  acknowledgement: AirJamActionInvocationResult;
  observedStateChange: boolean;
}): {
  acknowledgementObservation:
    | "host-acknowledged"
    | "host-acknowledgement-not-observed";
  outcome:
    | "accepted"
    | "rejected"
    | "acknowledgement-not-observed-state-changed"
    | "acknowledgement-not-observed-no-state-change-observed";
} => {
  if (!isHostAcknowledgementObservationGap(acknowledgement)) {
    return {
      acknowledgementObservation: "host-acknowledged",
      outcome: acknowledgement.status === "accepted" ? "accepted" : "rejected",
    };
  }

  return {
    acknowledgementObservation: "host-acknowledgement-not-observed",
    outcome: observedStateChange
      ? "acknowledgement-not-observed-state-changed"
      : "acknowledgement-not-observed-no-state-change-observed",
  };
};
