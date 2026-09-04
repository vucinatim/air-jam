import { describe, expect, it } from "vitest";
import { runOperationalJobWorkerCycle } from "./operational-job-worker";

describe("operational job worker schema authority", () => {
  it("blocks claims before touching job authority when schema is incompatible", async () => {
    const incompatibility = new Error("schema incompatible");

    await expect(
      runOperationalJobWorkerCycle({
        kind: "release_artifact_processing",
        workerId: "worker:schema-proof",
        assertSchemaCompatible: async () => {
          throw incompatibility;
        },
      }),
    ).rejects.toBe(incompatibility);
  });
});
