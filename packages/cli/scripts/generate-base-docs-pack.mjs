import { generateBaseDocsPack } from "./base-docs-pack.mjs";
import { generateDocumentationSnapshot } from "./documentation-snapshot.mjs";

await generateBaseDocsPack();
await generateDocumentationSnapshot();
