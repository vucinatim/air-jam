import postgres from "postgres";
import { createPreviewOverrideContract } from "./preview-override-contract.mjs";

const assertSchemaName = (schemaName) => {
  if (!/^[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Invalid preview schema name: ${schemaName}`);
  }
};

const createPreviewDatabaseClient = (databaseUrl) =>
  postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 15,
    onnotice: () => {},
  });

export const preparePreviewDatabase = async ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
} = {}) => {
  const preview = createPreviewOverrideContract({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    env,
  });
  const {
    manifest,
    overrides: {
      railway: {
        services: { "air-jam-server": serverOverrides },
      },
    },
  } = preview;
  const databaseUrl = serverOverrides.DATABASE_URL;
  const schemaName = manifest.database.schemaName;
  assertSchemaName(schemaName);

  const missingInputs = [];
  if (!databaseUrl) {
    missingInputs.push("PREVIEW_DATABASE_URL_TEMPLATE");
  }

  const actions = [];
  if (!apply) {
    actions.push(`would create schema ${schemaName}`);
    return {
      previewId: manifest.previewId,
      schemaName,
      apply,
      missingInputs,
      actions,
      ready: missingInputs.length === 0,
    };
  }

  if (missingInputs.length > 0) {
    return {
      previewId: manifest.previewId,
      schemaName,
      apply,
      missingInputs,
      actions,
      ready: false,
    };
  }

  const sql = createPreviewDatabaseClient(databaseUrl);
  try {
    await sql.unsafe(`create schema if not exists "${schemaName}"`);
    actions.push(`created schema ${schemaName}`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  return {
    previewId: manifest.previewId,
    schemaName,
    apply,
    missingInputs,
    actions,
    ready: missingInputs.length === 0,
  };
};

export const destroyPreviewDatabase = async ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
} = {}) => {
  const preview = createPreviewOverrideContract({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    env,
  });
  const {
    manifest,
    overrides: {
      railway: {
        services: { "air-jam-server": serverOverrides },
      },
    },
  } = preview;
  const databaseUrl = serverOverrides.DATABASE_URL;
  const schemaName = manifest.database.schemaName;
  assertSchemaName(schemaName);

  const missingInputs = [];
  if (!databaseUrl) {
    missingInputs.push("PREVIEW_DATABASE_URL_TEMPLATE");
  }

  const actions = [];
  if (!apply) {
    actions.push(`would drop schema ${schemaName} cascade`);
    return {
      previewId: manifest.previewId,
      schemaName,
      apply,
      missingInputs,
      actions,
    };
  }

  if (missingInputs.length > 0) {
    return {
      previewId: manifest.previewId,
      schemaName,
      apply,
      missingInputs,
      actions,
    };
  }

  const sql = createPreviewDatabaseClient(databaseUrl);
  try {
    await sql.unsafe(`drop schema if exists "${schemaName}" cascade`);
    actions.push(`dropped schema ${schemaName} cascade`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  return {
    previewId: manifest.previewId,
    schemaName,
    apply,
    missingInputs,
    actions,
  };
};
