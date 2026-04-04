#!/usr/bin/env node

import { Command } from "commander";
import { registerContentCommands } from "./commands/content.mjs";
import { registerLegacyCommands } from "./commands/legacy.mjs";
import { registerPackCommands } from "./commands/pack.mjs";
import { registerPerfCommands } from "./commands/perf.mjs";
import { registerPlatformCommands } from "./commands/platform.mjs";
import { registerScaffoldCommands } from "./commands/scaffold.mjs";
import { registerWorkspaceCommands } from "./commands/workspace.mjs";

const program = new Command();

program
  .name("air-jam-repo")
  .description("Repo-local Air Jam maintainer CLI");

registerWorkspaceCommands(program);
registerContentCommands(program);
registerPlatformCommands(program);
registerLegacyCommands(program);
registerPerfCommands(program);
registerPackCommands(program);
registerScaffoldCommands(program);

await program.parseAsync(process.argv.filter((value) => value !== "--"));
