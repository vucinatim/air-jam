import {
  createRunbookPreviewDigest,
  getOperationsContractJsonSchema,
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

void [jsonSchema, actionPreviewDigest];
