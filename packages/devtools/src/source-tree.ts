import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { SOURCE_TREE_PROGRAM } from "./source-tree-contract.js";

const entry = z.object({
  path: z.string().min(1),
  mode: z.number().int().min(0).max(511),
});
export const sourceTreeSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  entries: z
    .array(
      z.discriminatedUnion("kind", [
        entry.extend({ kind: z.literal("directory") }),
        entry.extend({ kind: z.literal("link"), target: z.string() }),
        entry.extend({
          kind: z.literal("file"),
          size: z.number().int().nonnegative(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      ]),
    )
    .max(100_000),
});

export async function readSourceTree(directory: string) {
  const result = await promisify(execFile)(
    process.execPath,
    ["-e", SOURCE_TREE_PROGRAM, directory, "manifest"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  return sourceTreeSchema.parse(JSON.parse(result.stdout));
}

/** A copy is accepted only when it matches both reads of the original tree. */
export async function copySourceTree(source: string, destination: string) {
  const before = await readSourceTree(source);
  const bytes = before.entries.reduce(
    (total, entry) => total + (entry.kind === "file" ? entry.size : 0),
    0,
  );
  if (bytes > 512 * 1024 * 1024)
    throw new Error(
      "build_source_too_large: Source exceeds the 512 MiB build limit.",
    );
  await mkdir(destination, { recursive: true });
  for (const entry of before.entries) {
    const target = path.join(destination, entry.path);
    if (entry.kind === "directory") await mkdir(target);
    else if (entry.kind === "link") {
      const relative = path.relative(
        source,
        path.resolve(path.dirname(path.join(source, entry.path)), entry.target),
      );
      if (
        path.isAbsolute(entry.target) ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`)
      )
        throw new Error(
          `build_external_link: Source link escapes the project: ${entry.path}`,
        );
      await symlink(entry.target, target);
    } else {
      await copyFile(path.join(source, entry.path), target);
      await chmod(target, entry.mode);
    }
  }
  for (const entry of [...before.entries].reverse())
    if (entry.kind === "directory")
      await chmod(path.join(destination, entry.path), entry.mode);
  const [original, copied] = await Promise.all([
    readSourceTree(source),
    readSourceTree(destination),
  ]);
  if (before.hash !== original.hash || before.hash !== copied.hash)
    throw new Error(
      "build_source_changed: Source changed while materializing the build.",
    );
  return copied;
}
