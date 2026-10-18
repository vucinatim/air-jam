import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import {
  policyArtifactManifestSchema,
  policyArtifactReceiptSchema,
} from "./policy-artifact-contract.js";

async function assertProtectedEntry(target: string, directory: boolean) {
  const information = await lstat(target);
  if (directory ? !information.isDirectory() : !information.isFile())
    throw new Error(
      "policy_artifact_invalid: Expected a regular artifact entry, without symlinks.",
    );
  if (
    !process.getuid ||
    process.getuid() === 0 ||
    information.uid === process.getuid()
  )
    throw new Error(
      "policy_artifact_writable: Artifacts require an independent filesystem owner and a non-root policy.",
    );
  try {
    await access(target, constants.W_OK);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EACCES")
      return;
    throw error;
  }
  throw new Error(
    "policy_artifact_writable: Policy artifacts must be read-only to the workload.",
  );
}

/** This validates public, independently provisioned files; it does not download or run models. */
export async function verifyPolicyArtifacts(options: {
  projectDir: string;
  manifestPath: string;
  artifactRootDir?: string;
  signal?: AbortSignal;
}): Promise<{
  directory: string;
  receipt: z.infer<typeof policyArtifactReceiptSchema>;
}> {
  const started = performance.now();
  options.signal?.throwIfAborted();
  if (!options.artifactRootDir || !path.isAbsolute(options.artifactRootDir))
    throw new Error(
      "policy_artifacts_missing: Configure an absolute AIRJAM_TEST_ARTIFACTS_DIR for this policy.",
    );
  const project = await realpath(options.projectDir);
  const manifestPath = await realpath(options.manifestPath);
  const relative = path.relative(project, manifestPath);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(
      "policy_artifact_invalid: The manifest must be pinned inside the project source.",
    );
  if ((await lstat(manifestPath)).size > 64 * 1024)
    throw new Error("policy_artifact_invalid: Manifest exceeds 64 KiB.");
  const content = await readFile(manifestPath, { signal: options.signal });
  const manifest = policyArtifactManifestSchema.parse(
    JSON.parse(content.toString("utf8")),
  );
  const manifestSha256 = createHash("sha256").update(content).digest("hex");
  const directory = path.join(options.artifactRootDir, manifestSha256);
  const directories = new Set<string>();
  let ancestor = directory;
  while (true) {
    directories.add(ancestor);
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  for (const file of manifest.files) {
    let parent = path.dirname(path.join(directory, file.path));
    while (parent !== directory) {
      directories.add(parent);
      parent = path.dirname(parent);
    }
  }
  for (const parent of directories) await assertProtectedEntry(parent, true);
  const expected = new Set(manifest.files.map((file) => file.path));
  const pending = [""];
  for (const relative of pending) {
    options.signal?.throwIfAborted();
    for (const entry of await readdir(path.join(directory, relative), {
      withFileTypes: true,
    })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (
        entry.isDirectory() &&
        [...expected].some((file) => file.startsWith(name + "/"))
      )
        pending.push(name);
      else if (!entry.isFile() || !expected.has(name))
        throw new Error(
          `policy_artifact_invalid: Unlisted artifact entry: ${name}.`,
        );
    }
  }
  for (const file of manifest.files) {
    options.signal?.throwIfAborted();
    const target = path.join(directory, file.path);
    await assertProtectedEntry(target, false);
    if ((await lstat(target)).size !== file.bytes)
      throw new Error(
        `policy_artifact_invalid: Size differs for ${file.path}.`,
      );
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(target, {
      signal: options.signal,
    }))
      hash.update(chunk);
    if (hash.digest("hex") !== file.sha256)
      throw new Error(
        `policy_artifact_invalid: Digest differs for ${file.path}.`,
      );
  }
  return {
    directory,
    receipt: policyArtifactReceiptSchema.parse({
      manifestSha256,
      manifest,
      verifyMs: performance.now() - started,
    }),
  };
}
