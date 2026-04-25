import { inspectAirJamMachineDeclaration } from "./machine-declaration.js";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const configPath = getFlagValue("--config");

if (!configPath) {
  throw new Error(
    "Missing required --config input for Air Jam machine helper.",
  );
}

const inspection = await inspectAirJamMachineDeclaration(configPath);
process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
