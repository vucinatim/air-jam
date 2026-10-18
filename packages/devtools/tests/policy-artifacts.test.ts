import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { policyArtifactManifestSchema } from "../src/policy-artifact-contract.js";
import { verifyPolicyArtifacts } from "../src/policy-artifacts.js";
import { airJamPolicyDecisionSchema } from "../src/testing.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
const manifest = {
  version: 1,
  provenance: { model: "Pinned public checkpoint; no inference credentials" },
  files: [{ path: "encoder.onnx", bytes: 4, sha256: "a".repeat(64) }],
};

it("bounds optional decision diagnostics without accepting actor-authored verdicts", () => {
  const decision = { control: { kind: "release" } };
  expect(
    airJamPolicyDecisionSchema.parse({
      ...decision,
      diagnostics: { candidate: "up", confidence: 0.7, truncated: false },
    }),
  ).toHaveProperty("diagnostics.confidence", 0.7);
  expect(
    airJamPolicyDecisionSchema.safeParse({
      ...decision,
      diagnostics: { text: "x".repeat(161) },
    }).success,
  ).toBe(false);
  expect(
    airJamPolicyDecisionSchema.safeParse({
      ...decision,
      diagnostics: Object.fromEntries(
        Array.from({ length: 16 }, (_, index) => [
          "key" + index,
          "x".repeat(100),
        ]),
      ),
    }).success,
  ).toBe(false);
  expect(
    airJamPolicyDecisionSchema.safeParse({
      ...decision,
      diagnostics: { outcome: { status: "passed" } },
    }).success,
  ).toBe(false);
});

it("refuses escaping, duplicate and excessive artifact declarations", () => {
  expect(policyArtifactManifestSchema.parse(manifest)).toEqual(manifest);
  for (const entry of [
    "../weights",
    "/weights",
    "nested/../weights",
    "nested\\weights",
    "nested//weights",
  ])
    expect(
      policyArtifactManifestSchema.safeParse({
        ...manifest,
        files: [{ ...manifest.files[0], path: entry }],
      }).success,
    ).toBe(false);
  expect(
    policyArtifactManifestSchema.safeParse({
      ...manifest,
      files: [...manifest.files, ...manifest.files],
    }).success,
  ).toBe(false);
  expect(
    policyArtifactManifestSchema.safeParse({
      ...manifest,
      files: [
        { ...manifest.files[0], bytes: 4 * 1024 ** 3 },
        { ...manifest.files[0], path: "head.onnx" },
      ],
    }).success,
  ).toBe(false);
});

async function fixture() {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "airjam-artifacts-"));
  directories.push(projectDir);
  const manifestPath = path.join(projectDir, "model.lock.json");
  const content = JSON.stringify(manifest);
  await writeFile(manifestPath, content);
  const artifactRootDir = path.join(projectDir, "artifacts");
  const directory = path.join(
    artifactRootDir,
    createHash("sha256").update(content).digest("hex"),
  );
  return { projectDir, manifestPath, artifactRootDir, directory };
}

it("requires explicit external provisioning and a source-bound manifest", async () => {
  const f = await fixture();
  await expect(
    verifyPolicyArtifacts({ ...f, artifactRootDir: undefined }),
  ).rejects.toThrow("policy_artifacts_missing");
  await expect(
    verifyPolicyArtifacts({
      ...f,
      manifestPath: path.join(f.projectDir, ".."),
    }),
  ).rejects.toThrow("pinned inside");
  await expect(verifyPolicyArtifacts(f)).rejects.toThrow("ENOENT");
});

it("refuses a symlink bundle and a bundle owned by the workload", async () => {
  const f = await fixture();
  await mkdir(f.artifactRootDir);
  await symlink(f.projectDir, f.directory);
  await expect(verifyPolicyArtifacts(f)).rejects.toThrow("without symlinks");
  await rm(f.directory);
  await mkdir(f.directory);
  await expect(verifyPolicyArtifacts(f)).rejects.toThrow(
    "independent filesystem owner",
  );
});
