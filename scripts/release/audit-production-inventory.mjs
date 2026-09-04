#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const provider = "OSV.dev";
const auditEndpoint = "https://api.osv.dev/v1/querybatch";
const timeoutMs = 30_000;
const compareStrings = (left, right) => left.localeCompare(right);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const buildOsvQueries = (inventory) => {
  if (
    inventory?.contract !== "air-jam-production-dependency-inventory/v1" ||
    !Array.isArray(inventory.packages)
  ) {
    throw new Error("Production dependency inventory is invalid.");
  }
  const packages = new Map();
  for (const [index, entry] of inventory.packages.entries()) {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !entry.name ||
      typeof entry.version !== "string" ||
      !entry.version
    ) {
      throw new Error(`Dependency inventory entry ${index} is invalid.`);
    }
    packages.set(`${entry.name}@${entry.version}`, {
      name: entry.name,
      version: entry.version,
    });
  }
  return [...packages.values()]
    .sort((left, right) =>
      compareStrings(
        `${left.name}@${left.version}`,
        `${right.name}@${right.version}`,
      ),
    )
    .map((entry) => ({
      package: { ecosystem: "npm", name: entry.name },
      version: entry.version,
    }));
};

export const normalizeOsvBatchResponse = ({
  response,
  queries,
  inventorySha256,
}) => {
  if (
    !response ||
    typeof response !== "object" ||
    Array.isArray(response) ||
    !Array.isArray(response.results) ||
    response.results.length !== queries.length
  ) {
    throw new Error("OSV batch response does not match the submitted queries.");
  }
  const findings = [];
  for (const [index, result] of response.results.entries()) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error(`OSV result ${index} is invalid.`);
    }
    if (result.next_page_token) {
      throw new Error(`OSV result ${index} is paginated; audit is incomplete.`);
    }
    const vulnerabilities = result.vulns ?? [];
    if (!Array.isArray(vulnerabilities)) {
      throw new Error(`OSV result ${index}.vulns must be an array.`);
    }
    for (const [
      vulnerabilityIndex,
      vulnerability,
    ] of vulnerabilities.entries()) {
      if (
        !vulnerability ||
        typeof vulnerability.id !== "string" ||
        !vulnerability.id ||
        typeof vulnerability.modified !== "string" ||
        !Number.isFinite(Date.parse(vulnerability.modified))
      ) {
        throw new Error(
          `OSV result ${index}.vulns[${vulnerabilityIndex}] is invalid.`,
        );
      }
      findings.push({
        id: vulnerability.id,
        modified: vulnerability.modified,
        package: queries[index].package.name,
        version: queries[index].version,
      });
    }
  }
  findings.sort((left, right) =>
    compareStrings(
      `${left.package}@${left.version}:${left.id}`,
      `${right.package}@${right.version}:${right.id}`,
    ),
  );
  return {
    contract: "air-jam-production-dependency-audit/v1",
    method: "osv-querybatch",
    provider,
    endpoint: auditEndpoint,
    inventorySha256,
    queriedPackages: new Set(queries.map((query) => query.package.name)).size,
    queriedVersions: queries.length,
    vulnerabilityCount: findings.length,
    findings,
  };
};

export const auditProductionInventory = async (inventoryPath) => {
  const inventoryBytes = fs.readFileSync(inventoryPath);
  const inventory = JSON.parse(inventoryBytes);
  const queries = buildOsvQueries(inventory);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();
  let response;
  try {
    response = await fetch(auditEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "air-jam-public-release-audit/1",
      },
      body: JSON.stringify({ queries }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`OSV audit request failed with HTTP ${response.status}.`);
  }
  let parsed;
  try {
    parsed = await response.json();
  } catch (error) {
    throw new Error("OSV audit response was not valid JSON.", { cause: error });
  }
  return normalizeOsvBatchResponse({
    response: parsed,
    queries,
    inventorySha256: sha256(inventoryBytes),
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventoryIndex = process.argv.indexOf("--inventory");
  const inventoryPath =
    inventoryIndex === -1 ? null : process.argv[inventoryIndex + 1];
  if (!inventoryPath) {
    throw new Error(
      "Usage: audit-production-inventory.mjs --inventory <dependencies.json>",
    );
  }
  const result = await auditProductionInventory(inventoryPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
