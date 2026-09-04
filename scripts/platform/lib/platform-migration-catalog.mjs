import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../../repo/lib/paths.mjs";

export const PLATFORM_MIGRATION_CONTRACT_VERSION = 1;
export const PLATFORM_MIGRATION_POLICY_REQUIRED_AFTER_INDEX = 35;

export const platformMigrationModeValues = [
  "online",
  "operational_lanes",
  "exclusive",
];

const defaultMigrationsRoot = path.join(
  repoRoot,
  "apps",
  "platform",
  "drizzle",
);

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
};

export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
export const digestCanonicalJson = (value) => sha256(canonicalJson(value));

const parseDirectiveValues = (sql, key) =>
  [...sql.matchAll(new RegExp(`^-- airjam:${key}=([^\\r\\n]+)$`, "gmu"))].map(
    (match) => match[1].trim(),
  );

const parseMigrationPolicy = ({ entry, sql }) => {
  if (entry.idx <= PLATFORM_MIGRATION_POLICY_REQUIRED_AFTER_INDEX) {
    return {
      mode: "legacy",
      affectedLanes: [],
      verificationChecks: [],
      policySource: "historical",
    };
  }

  const modes = parseDirectiveValues(sql, "migration-mode");
  if (modes.length !== 1 || !platformMigrationModeValues.includes(modes[0])) {
    throw new Error(
      `Migration ${entry.tag} must declare exactly one -- airjam:migration-mode=${platformMigrationModeValues.join("|")}.`,
    );
  }

  const affectedLaneDirectives = parseDirectiveValues(sql, "affected-lanes");
  if (affectedLaneDirectives.length > 1) {
    throw new Error(
      `Migration ${entry.tag} declares airjam:affected-lanes more than once.`,
    );
  }
  const affectedLanes = affectedLaneDirectives.flatMap((value) =>
    value
      .split(",")
      .map((lane) => lane.trim())
      .filter(Boolean),
  );
  if (new Set(affectedLanes).size !== affectedLanes.length) {
    throw new Error(`Migration ${entry.tag} repeats an affected lane.`);
  }
  if (modes[0] === "operational_lanes" && affectedLanes.length === 0) {
    throw new Error(
      `Migration ${entry.tag} must name at least one airjam:affected-lanes entry.`,
    );
  }
  if (modes[0] !== "operational_lanes" && affectedLanes.length > 0) {
    throw new Error(
      `Migration ${entry.tag} may only name affected lanes in operational_lanes mode.`,
    );
  }

  const verificationChecks = parseDirectiveValues(sql, "verify");
  if (verificationChecks.length === 0) {
    throw new Error(
      `Migration ${entry.tag} must declare at least one -- airjam:verify=<kind>:<identity> check.`,
    );
  }
  for (const check of verificationChecks) {
    if (!/^(table|constraint|index):[a-z0-9_.]+$/u.test(check)) {
      throw new Error(
        `Migration ${entry.tag} has unsupported verification check ${check}.`,
      );
    }
  }

  return {
    mode: modes[0],
    affectedLanes,
    verificationChecks,
    policySource: "directive",
  };
};

export const readPlatformMigrationCatalog = ({
  migrationsRoot = defaultMigrationsRoot,
  allowedOperationalLanes,
} = {}) => {
  const journalPath = path.join(migrationsRoot, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  if (
    journal.version !== "7" ||
    journal.dialect !== "postgresql" ||
    !Array.isArray(journal.entries)
  ) {
    throw new Error("Platform Drizzle journal has an unsupported shape.");
  }

  const entries = journal.entries.map((entry, position) => {
    if (
      entry.idx !== position ||
      !Number.isSafeInteger(entry.when) ||
      typeof entry.tag !== "string" ||
      !entry.tag
    ) {
      throw new Error("Platform Drizzle journal ordering is invalid.");
    }
    const filePath = path.join(migrationsRoot, `${entry.tag}.sql`);
    const sql = fs.readFileSync(filePath, "utf8");
    const policy = parseMigrationPolicy({ entry, sql });
    if (allowedOperationalLanes) {
      for (const lane of policy.affectedLanes) {
        if (!allowedOperationalLanes.includes(lane)) {
          throw new Error(
            `Migration ${entry.tag} names unknown operational lane ${lane}.`,
          );
        }
      }
    }
    return {
      index: entry.idx,
      tag: entry.tag,
      createdAt: entry.when,
      hash: sha256(sql),
      mode: policy.mode,
      affectedLanes: policy.affectedLanes,
      verificationChecks: policy.verificationChecks,
      policySource: policy.policySource,
    };
  });

  const createdAtValues = entries.map((entry) => entry.createdAt);
  if (new Set(createdAtValues).size !== createdAtValues.length) {
    throw new Error("Platform Drizzle migrations must have unique timestamps.");
  }
  for (
    let position = PLATFORM_MIGRATION_POLICY_REQUIRED_AFTER_INDEX + 1;
    position < entries.length;
    position += 1
  ) {
    if (entries[position].createdAt <= entries[position - 1].createdAt) {
      throw new Error(
        `Policy-governed migration ${entries[position].tag} must have a newer timestamp than the preceding journal entry.`,
      );
    }
  }
  const head = entries.at(-1);
  if (!head) throw new Error("Platform Drizzle journal cannot be empty.");
  if (head.createdAt !== Math.max(...createdAtValues)) {
    throw new Error(
      "The platform schema head must have the newest Drizzle timestamp.",
    );
  }

  return {
    contractVersion: PLATFORM_MIGRATION_CONTRACT_VERSION,
    journalVersion: journal.version,
    dialect: journal.dialect,
    policyRequiredAfterIndex: PLATFORM_MIGRATION_POLICY_REQUIRED_AFTER_INDEX,
    entries,
    head,
    digest: digestCanonicalJson(entries),
  };
};

export const renderPlatformSchemaHeadSource = (catalog) =>
  `${[
    "// Generated by scripts/platform/lib/platform-schema-head-generator.mjs.",
    "// Do not edit by hand.",
    "",
    `export const PLATFORM_SCHEMA_CONTRACT_VERSION = ${PLATFORM_MIGRATION_CONTRACT_VERSION} as const;`,
    "",
    "export const platformSchemaHead = {",
    `  tag: ${JSON.stringify(catalog.head.tag)},`,
    `  createdAt: ${catalog.head.createdAt},`,
    `  hash: ${JSON.stringify(catalog.head.hash)},`,
    "  catalogDigest:",
    `    ${JSON.stringify(catalog.digest)},`,
    "} as const;",
  ].join("\n")}\n`;
