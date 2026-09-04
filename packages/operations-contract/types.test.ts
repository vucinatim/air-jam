import {
  createRunbookPreviewDigest,
  getOperationsContractJsonSchema,
  operationalIdentifierSchema,
  operationalRunbookPreviewSchemaV1,
  type OperationalRunbookActionV1,
  type OperationalRunbookPreviewV1,
  type OperationsContractSchemaName,
} from "./index.mjs";

const schemaName: OperationsContractSchemaName = "runbook_preview";
const jsonSchema = getOperationsContractJsonSchema(schemaName);
const parsedPreview: OperationalRunbookPreviewV1 =
  operationalRunbookPreviewSchemaV1.parse({});
const previewDigest: string = createRunbookPreviewDigest(parsedPreview);
const actionPreviewDigest: OperationalRunbookActionV1["previewDigestSha256"] =
  previewDigest;
const identifier: string = operationalIdentifierSchema.parse("worker:one");

void [jsonSchema, actionPreviewDigest, identifier];
