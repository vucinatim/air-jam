#!/usr/bin/env node

import { Command } from "commander";
import { registerContentCommands } from "./commands/content.mjs";
import { registerDbCommands } from "./commands/db.mjs";
import { registerLegacyCommands } from "./commands/legacy.mjs";
import { registerPackCommands } from "./commands/pack.mjs";
import { registerPerfCommands } from "./commands/perf.mjs";
import { registerPlatformCommands } from "./commands/platform.mjs";
import { registerScaffoldCommands } from "./commands/scaffold.mjs";
import { registerSmokeCommands } from "./commands/smoke.mjs";
import { registerStandardsCommands } from "./commands/standards.mjs";
import { registerWorkspaceCommands } from "./commands/workspace.mjs";

const program = new Command();

program
  .name("air-jam-repo")
  .description("Repo-local Air Jam maintainer CLI");

registerWorkspaceCommands(program);
registerDbCommands(program);
registerContentCommands(program);
registerPlatformCommands(program);
registerLegacyCommands(program);
registerPerfCommands(program);
registerPackCommands(program);
registerScaffoldCommands(program);
registerSmokeCommands(program);
registerStandardsCommands(program);

await program.parseAsync(process.argv.filter((value) => value !== "--"));
