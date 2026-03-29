import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fs from "fs-extra";
import kleur from "kleur";

type LocalAiPackManifest = {
  schemaVersion: number;
  packVersion: string;
  channel: string;
  releaseDate?: string;
  scaffold?: {
    template?: string | null;
    createAirjamVersion?: string | null;
  };
  update?: {
    manifestUrl?: string;
    docsBaseUrl?: string;
  };
};

type HostedAiPackRootManifest = {
  schemaVersion: number;
  channels: Record<
    string,
    {
      latestPackVersion: string;
    }
  >;
};

type HostedAiPackVersionManifest = {
  schemaVersion: number;
  channel: string;
  packVersion: string;
  files: HostedAiPackFile[];
};

type HostedAiPackFile = {
  path: string;
  kind: string;
  size: number;
  sha256: string;
  url: string;
};

type AiPackComparison = {
  projectDir: string;
  localManifestPath: string;
  resolvedManifestUrl: string;
  manifestFile?: string;
  localManifest: LocalAiPackManifest;
  latestManifest: HostedAiPackVersionManifest;
  latestPackVersion: string;
  differingFiles: Array<{
    path: string;
    state: "missing" | "different";
    kind: string;
    expectedSha256: string;
    actualSha256?: string;
  }>;
  missingCount: number;
  differentCount: number;
};

const DEFAULT_AI_PACK_ROOT_MANIFEST_URL = "https://air-jam.app/ai-pack/manifest.json";

const normalizeManifestForComparison = (
  manifest: LocalAiPackManifest,
): Omit<LocalAiPackManifest, "scaffold"> => {
  const normalized = { ...manifest };
  delete normalized.scaffold;
  return normalized;
};

const sha256ForFile = async (filePath: string): Promise<string> => {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
};

const readJsonFile = async <T>(filePath: string): Promise<T> =>
  (await fs.readJson(filePath)) as T;

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "create-airjam/ai-pack",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "create-airjam/ai-pack",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const resolveAiPackBaseFromManifestUrl = (manifestUrl: string): string => {
  if (!manifestUrl.endsWith("/manifest.json")) {
    throw new Error(
      `Invalid AI pack manifest URL "${manifestUrl}". Expected it to end with /manifest.json.`,
    );
  }

  return manifestUrl.slice(0, -"/manifest.json".length);
};

const loadHostedJson = async <T>({
  manifestFile,
  manifestUrl,
  relativePath,
}: {
  manifestFile?: string;
  manifestUrl: string;
  relativePath: string;
}): Promise<T> => {
  if (manifestFile) {
    const rootDir = path.dirname(path.resolve(manifestFile));
    return readJsonFile<T>(path.join(rootDir, relativePath));
  }

  const baseUrl = resolveAiPackBaseFromManifestUrl(manifestUrl);
  return fetchJson<T>(`${baseUrl}/${relativePath.replace(/\\/g, "/")}`);
};

const loadHostedText = async ({
  manifestFile,
  manifestUrl,
  relativePath,
}: {
  manifestFile?: string;
  manifestUrl: string;
  relativePath: string;
}): Promise<string> => {
  if (manifestFile) {
    const rootDir = path.dirname(path.resolve(manifestFile));
    return fs.readFile(path.join(rootDir, relativePath), "utf8");
  }

  const baseUrl = resolveAiPackBaseFromManifestUrl(manifestUrl);
  return fetchText(`${baseUrl}/${relativePath.replace(/\\/g, "/")}`);
};

const loadLocalAiPackManifest = async (projectDir: string) => {
  const localManifestPath = path.join(projectDir, ".airjam", "ai-pack.json");

  if (!fs.existsSync(localManifestPath)) {
    throw new Error(
      `Missing local AI pack manifest at ${localManifestPath}. Run this from a scaffolded Air Jam project root or pass --dir.`,
    );
  }

  return {
    localManifestPath,
    localManifest: await readJsonFile<LocalAiPackManifest>(localManifestPath),
  };
};

const compareAgainstLatestPack = async ({
  projectDir,
  manifestUrl,
  manifestFile,
}: {
  projectDir: string;
  manifestUrl?: string;
  manifestFile?: string;
}): Promise<AiPackComparison> => {
  const { localManifest, localManifestPath } = await loadLocalAiPackManifest(projectDir);
  const resolvedManifestUrl =
    manifestUrl ??
    localManifest.update?.manifestUrl ??
    DEFAULT_AI_PACK_ROOT_MANIFEST_URL;

  const rootManifest = await (manifestFile
    ? loadHostedJson<HostedAiPackRootManifest>({
        manifestFile,
        manifestUrl: resolvedManifestUrl,
        relativePath: "manifest.json",
      })
    : fetchJson<HostedAiPackRootManifest>(resolvedManifestUrl));

  const latestChannel = rootManifest.channels[localManifest.channel];
  if (!latestChannel) {
    throw new Error(
      `Hosted AI pack manifest does not expose channel "${localManifest.channel}".`,
    );
  }

  const latestPackVersion = latestChannel.latestPackVersion;
  const latestManifest = await loadHostedJson<HostedAiPackVersionManifest>({
    manifestFile,
    manifestUrl: resolvedManifestUrl,
    relativePath: `${localManifest.channel}/${latestPackVersion}/manifest.json`,
  });

  const differingFiles: AiPackComparison["differingFiles"] = [];

  for (const file of latestManifest.files) {
    const localFilePath = path.join(projectDir, file.path);
    if (!fs.existsSync(localFilePath)) {
      differingFiles.push({
        path: file.path,
        state: "missing",
        kind: file.kind,
        expectedSha256: file.sha256,
      });
      continue;
    }

    if (file.path === ".airjam/ai-pack.json") {
      const localManifestForComparison = normalizeManifestForComparison(
        await readJsonFile<LocalAiPackManifest>(localFilePath),
      );
      const hostedManifestForComparison = normalizeManifestForComparison(
        JSON.parse(
          await loadHostedText({
            manifestFile,
            manifestUrl: resolvedManifestUrl,
            relativePath: file.artifactPath,
          }),
        ) as LocalAiPackManifest,
      );

      if (
        JSON.stringify(localManifestForComparison) !==
        JSON.stringify(hostedManifestForComparison)
      ) {
        differingFiles.push({
          path: file.path,
          state: "different",
          kind: file.kind,
          expectedSha256: file.sha256,
          actualSha256: await sha256ForFile(localFilePath),
        });
      }
      continue;
    }

    const actualSha256 = await sha256ForFile(localFilePath);
    if (actualSha256 !== file.sha256) {
      differingFiles.push({
        path: file.path,
        state: "different",
        kind: file.kind,
        expectedSha256: file.sha256,
        actualSha256,
      });
    }
  }

  return {
    projectDir,
    localManifestPath,
    resolvedManifestUrl,
    manifestFile,
    localManifest,
    latestManifest,
    latestPackVersion,
    missingCount: differingFiles.filter((file) => file.state === "missing").length,
    differentCount: differingFiles.filter((file) => file.state === "different").length,
    differingFiles,
  };
};

const printComparisonSummary = (comparison: AiPackComparison) => {
  console.log(kleur.bold("AI Pack"));
  console.log(`Project: ${comparison.projectDir}`);
  console.log(`Local manifest: ${comparison.localManifestPath}`);
  console.log(
    `Local pack: ${comparison.localManifest.channel}@${comparison.localManifest.packVersion}`,
  );
  console.log(
    `Latest pack: ${comparison.latestManifest.channel}@${comparison.latestPackVersion}`,
  );
  console.log(`Managed files in latest pack: ${comparison.latestManifest.files.length}`);
};

export async function runAiPackStatus({
  dir,
  manifestUrl,
  manifestFile,
}: {
  dir?: string;
  manifestUrl?: string;
  manifestFile?: string;
}): Promise<void> {
  const projectDir = path.resolve(dir ?? process.cwd());
  const comparison = await compareAgainstLatestPack({
    projectDir,
    manifestUrl,
    manifestFile,
  });

  printComparisonSummary(comparison);
  console.log(
    `Files differing from latest: ${comparison.differingFiles.length} (${comparison.missingCount} missing, ${comparison.differentCount} different)`,
  );

  if (
    comparison.localManifest.packVersion === comparison.latestPackVersion &&
    comparison.differingFiles.length === 0
  ) {
    console.log(
      kleur.green("Managed AI pack files match the latest hosted pack."),
    );
    return;
  }

  if (comparison.localManifest.packVersion !== comparison.latestPackVersion) {
    console.log(
      kleur.yellow(
        `Update available: local pack ${comparison.localManifest.packVersion} is behind hosted ${comparison.latestPackVersion}.`,
      ),
    );
  } else {
    console.log(
      kleur.yellow(
        "Local managed AI pack files have drifted from the current hosted pack.",
      ),
    );
  }

  console.log(
    kleur.dim(
      'Use "create-airjam ai-pack diff" to inspect the differing managed files.',
    ),
  );
}

export async function runAiPackDiff({
  dir,
  manifestUrl,
  manifestFile,
}: {
  dir?: string;
  manifestUrl?: string;
  manifestFile?: string;
}): Promise<void> {
  const projectDir = path.resolve(dir ?? process.cwd());
  const comparison = await compareAgainstLatestPack({
    projectDir,
    manifestUrl,
    manifestFile,
  });

  printComparisonSummary(comparison);

  if (comparison.differingFiles.length === 0) {
    console.log(kleur.green("No managed AI pack files differ from the latest hosted pack."));
    return;
  }

  if (comparison.localManifest.packVersion !== comparison.latestPackVersion) {
    console.log(
      kleur.yellow(
        `Comparing local ${comparison.localManifest.packVersion} against hosted ${comparison.latestPackVersion}.`,
      ),
    );
  }

  console.log("");
  console.log(kleur.bold("Differing Managed Files"));
  for (const file of comparison.differingFiles) {
    const label = file.state === "missing" ? kleur.red("missing") : kleur.yellow("different");
    console.log(`- [${label}] ${file.path} (${file.kind})`);
  }

  console.log("");
  console.log(
    kleur.dim(
      "This is a file-level comparison against the latest hosted AI pack. It does not attempt a merge.",
    ),
  );
}

export async function runAiPackUpdate({
  dir,
  manifestUrl,
  manifestFile,
  force = false,
}: {
  dir?: string;
  manifestUrl?: string;
  manifestFile?: string;
  force?: boolean;
}): Promise<void> {
  const projectDir = path.resolve(dir ?? process.cwd());
  const comparison = await compareAgainstLatestPack({
    projectDir,
    manifestUrl,
    manifestFile,
  });

  printComparisonSummary(comparison);

  if (comparison.differingFiles.length === 0) {
    console.log(kleur.green("Managed AI pack files already match the latest hosted pack."));
    return;
  }

  const sameVersion = comparison.localManifest.packVersion === comparison.latestPackVersion;
  if (sameVersion && !force) {
    console.log(
      kleur.yellow(
        "Local managed AI pack files have drifted from the current hosted pack.",
      ),
    );
    console.log(
      kleur.yellow(
        'Refusing to overwrite same-version managed files without --force.',
      ),
    );
    console.log(
      kleur.dim(
        'Inspect drift first with "create-airjam ai-pack diff", then rerun with --force if you want to replace those managed files.',
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (!sameVersion) {
    console.log(
      kleur.yellow(
        `Updating managed AI pack files from ${comparison.localManifest.packVersion} to ${comparison.latestPackVersion}.`,
      ),
    );
  }

  console.log(
    kleur.dim(
      "This replaces canonical AI pack managed files only. It does not attempt a merge.",
    ),
  );

  const latestFilesByPath = new Map(
    comparison.latestManifest.files.map((file) => [file.path, file]),
  );

  for (const differingFile of comparison.differingFiles) {
    const latestFile = latestFilesByPath.get(differingFile.path);
    if (!latestFile) {
      throw new Error(`Missing hosted AI pack file metadata for ${differingFile.path}`);
    }

    const hostedContents = await loadHostedText({
      manifestFile: comparison.manifestFile,
      manifestUrl: comparison.resolvedManifestUrl,
      relativePath: latestFile.artifactPath,
    });

    const localFilePath = path.join(projectDir, latestFile.path);
    await fs.ensureDir(path.dirname(localFilePath));

    if (latestFile.path === ".airjam/ai-pack.json") {
      const hostedManifest = JSON.parse(hostedContents) as LocalAiPackManifest;
      hostedManifest.scaffold = {
        ...(hostedManifest.scaffold ?? {}),
        ...(comparison.localManifest.scaffold ?? {}),
      };
      await fs.writeJson(localFilePath, hostedManifest, { spaces: 2 });
      continue;
    }

    await fs.writeFile(localFilePath, hostedContents, "utf8");
  }

  const refreshed = await compareAgainstLatestPack({
    projectDir,
    manifestUrl,
    manifestFile,
  });

  if (refreshed.differingFiles.length > 0) {
    throw new Error(
      `AI pack update completed but ${refreshed.differingFiles.length} managed files still differ from the hosted pack.`,
    );
  }

  console.log(
    kleur.green(
      `Updated ${comparison.differingFiles.length} managed AI pack file(s) to ${refreshed.latestPackVersion}.`,
    ),
  );
}
