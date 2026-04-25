import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../lib/paths.mjs";
import { runCommandResult } from "../lib/shell.mjs";

function parseDotenvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadDatabaseUrlFromFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== "DATABASE_URL") {
      continue;
    }

    return parseDotenvValue(trimmed.slice(separatorIndex + 1));
  }

  return null;
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const candidates = [
    path.join(repoRoot, "apps", "platform", ".env.local"),
    path.join(repoRoot, "apps", "platform", ".env"),
  ];

  for (const filePath of candidates) {
    const value = loadDatabaseUrlFromFile(filePath);
    if (value) {
      return value;
    }
  }

  return null;
}

function runPgDump(command, args) {
  return runCommandResult(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function printProcessOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function hasDocker() {
  const result = runCommandResult("docker", ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
}

export const runRepoPlatformDbBackupCommand = () => {
  const backupDir = path.join(repoRoot, "backups", "platform");
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "No DATABASE_URL found. Set it in the environment or in apps/platform/.env.local.",
    );
  }

  mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:]/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
  const outputPath = path.join(backupDir, `platform-${timestamp}.dump`);

  let result = runPgDump("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    outputPath,
    databaseUrl,
  ]);

  const versionMismatch =
    result.status !== 0 &&
    typeof result.stderr === "string" &&
    result.stderr.includes("server version mismatch");

  if (versionMismatch && hasDocker()) {
    printProcessOutput(result);
    console.log(
      "Local pg_dump version does not match the server. Retrying with postgres:17 in Docker...",
    );

    result = runPgDump("docker", [
      "run",
      "--rm",
      "-v",
      `${backupDir}:/backup`,
      "postgres:17",
      "pg_dump",
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      `/backup/${path.basename(outputPath)}`,
      databaseUrl,
    ]);
  }

  printProcessOutput(result);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`Platform database backup written to ${outputPath}`);
};
