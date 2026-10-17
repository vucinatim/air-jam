import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink, realpath } from "node:fs/promises";
import path from "node:path";

/** Hash installed code, including postinstall output; mutable tool caches are not dependencies. */
export async function inspectInstalledDependencies(
  rootDir: string,
  liveRoot: string,
) {
  const directory = path.join(rootDir, "node_modules"),
    hash = createHash("sha256");
  const excluded = new Set([
    ".cache",
    ".vite",
    ".vite-temp",
    ".modules.yaml",
    ".pnpm/lock.yaml",
  ]);
  const originalModules = path.join(liveRoot, "node_modules");
  const inside = (filename: string) => {
    const relative = path.relative(directory, filename);
    return (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  };
  if (!inside(await realpath(directory)))
    throw new Error(
      "build_dependencies_external: Dependencies resolve outside the snapshot.",
    );
  async function walk(relative = "") {
    for (const name of (await readdir(path.join(directory, relative))).sort()) {
      const filename = relative ? `${relative}/${name}` : name;
      if (excluded.has(filename)) continue;
      const absolute = path.join(directory, filename),
        stat = await lstat(absolute);
      const kind = stat.isDirectory()
        ? "directory"
        : stat.isSymbolicLink()
          ? "link"
          : "file";
      hash.update(JSON.stringify([filename, stat.mode & 511, kind]));
      if (stat.isDirectory()) await walk(filename);
      else if (stat.isSymbolicLink()) {
        if (!inside(await realpath(absolute)))
          throw new Error(
            `build_dependencies_external: Dependency link escapes the snapshot: ${filename}`,
          );
        hash.update(await readlink(absolute));
      } else if (stat.isFile()) {
        const content = await readFile(absolute);
        if (
          relative === ".bin" &&
          content.includes(Buffer.from(originalModules))
        )
          throw new Error(
            `build_dependencies_external: A command shim points at the live checkout: ${filename}`,
          );
        hash.update(createHash("sha256").update(content).digest());
      } else
        throw new Error(
          `build_dependencies_invalid: Unsupported installed entry: ${filename}`,
        );
    }
  }
  await walk();
  return {
    installedTreeHash: hash.digest("hex"),
    installedLockfileHash: createHash("sha256")
      .update(await readFile(path.join(directory, ".pnpm/lock.yaml")))
      .digest("hex"),
  };
}
