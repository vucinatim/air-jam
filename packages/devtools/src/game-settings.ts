import { airJamSettingSchema, defineAirJamSettings } from "@air-jam/sdk/core";
import { randomUUID } from "node:crypto";
import {
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type * as TS from "typescript";
import { inspectGame } from "./games.js";

export type SettingValue = number | boolean | string;
export type KeptGameSettings = {
  file: string;
  kept: { key: string; from: SettingValue; to: SettingValue }[];
};

function refuse(code: string, message: string): never {
  throw Object.assign(new Error(`${code}: ${message}`), { code });
}

/** Changes only literal defaults in the declaration selected by the game's config. */
export async function keepGameSettings({
  cwd = process.cwd(),
  values,
}: {
  cwd?: string;
  values: Record<string, SettingValue>;
}): Promise<KeptGameSettings> {
  cwd = await realpath(cwd);
  let ts: typeof TS;
  try {
    ts = createRequire(path.join(cwd, "package.json"))(
      "typescript",
    ) as typeof TS;
  } catch {
    refuse(
      "AJ_SETTINGS_TYPESCRIPT_MISSING",
      "Install typescript in this game's dependencies before keeping settings.",
    );
  }
  const fail: (message: string) => never = (message) =>
    refuse("AJ_SETTINGS_DECLARATION", message);
  const read = async (file: string) => {
    file = await realpath(file);
    const relative = path.relative(cwd, file);
    if (
      relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative)
    )
      fail("The settings declaration must be inside the game project.");
    return ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
  };
  const name = (node: TS.PropertyName) => {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
    return fail(
      "Computed properties cannot be kept; use explicit property names.",
    );
  };
  const properties = (node: TS.Expression | undefined) => {
    if (!node || !ts.isObjectLiteralExpression(node))
      return fail("Use one explicit object literal for the declaration.");
    const result = new Map<string, TS.PropertyAssignment>();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property))
        fail(
          "Spread and shorthand properties cannot be kept; use explicit properties.",
        );
      const key = name(property.name);
      if (result.has(key))
        fail(`Duplicate property ${key} makes the declaration ambiguous.`);
      result.set(key, property);
    }
    return result;
  };
  const isCall = (node: TS.Node, called: string): node is TS.CallExpression =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === called;
  const config = await read(path.join(cwd, "src/airjam.config.ts"));
  const games: TS.CallExpression[] = [];
  const visit = (node: TS.Node) => {
    if (isCall(node, "defineAirJamGame")) games.push(node);
    ts.forEachChild(node, visit);
  };
  visit(config);
  if (games.length !== 1)
    fail("Expected exactly one defineAirJamGame declaration.");
  const selected = properties(games[0].arguments[0]).get(
    "settings",
  )?.initializer;
  if (!selected) fail("This game has no settings declaration.");
  let source = config;
  let declaration = selected;
  if (ts.isIdentifier(selected)) {
    const bindings: { file: TS.SourceFile; expression: TS.Expression }[] = [];
    const findBinding = (file: TS.SourceFile, identifier: string) => {
      for (const statement of file.statements)
        if (ts.isVariableStatement(statement))
          for (const variable of statement.declarationList.declarations)
            if (
              ts.isIdentifier(variable.name) &&
              variable.name.text === identifier &&
              variable.initializer
            )
              bindings.push({ file, expression: variable.initializer });
    };
    findBinding(config, selected.text);
    for (const statement of config.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const clause = statement.importClause;
      const imports = clause?.namedBindings;
      const binding =
        imports && ts.isNamedImports(imports)
          ? imports.elements.filter(
              (entry) => entry.name.text === selected.text,
            )
          : [];
      const isDefault = clause?.name?.text === selected.text;
      if (!binding.length && !isDefault) continue;
      if (!statement.moduleSpecifier.text.startsWith("."))
        fail("Import the settings from a relative game module.");
      const resolved = ts.resolveModuleName(
        statement.moduleSpecifier.text,
        config.fileName,
        {
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          allowImportingTsExtensions: true,
        },
        ts.sys,
      ).resolvedModule;
      if (!resolved) fail("The settings module could not be resolved.");
      const imported = await read(resolved.resolvedFileName);
      if (isDefault) {
        for (const entry of imported.statements)
          if (ts.isExportAssignment(entry)) {
            if (ts.isIdentifier(entry.expression))
              findBinding(imported, entry.expression.text);
            else
              bindings.push({ file: imported, expression: entry.expression });
          }
      }
      for (const entry of binding)
        findBinding(imported, entry.propertyName?.text ?? entry.name.text);
    }
    if (bindings.length !== 1)
      fail("Expected one unambiguous settings binding.");
    source = bindings[0].file;
    declaration = bindings[0].expression;
  }
  if (
    !isCall(declaration, "defineAirJamSettings") ||
    declaration.arguments.length !== 1
  )
    fail("Settings must be bound directly to defineAirJamSettings({...}).");
  const settings = properties(declaration.arguments[0]);
  const edits: { start: number; end: number; text: string }[] = [];
  const kept: KeptGameSettings["kept"] = [];
  for (const [key, to] of Object.entries(values)) {
    const entry = settings.get(key);
    if (!entry)
      refuse("AJ_SETTING_UNKNOWN", `${key} is not declared by this game.`);
    const call = entry.initializer;
    if (
      !ts.isCallExpression(call) ||
      !ts.isPropertyAccessExpression(call.expression) ||
      !ts.isIdentifier(call.expression.expression) ||
      call.expression.expression.text !== "setting" ||
      !["number", "boolean", "choice"].includes(call.expression.name.text) ||
      call.arguments.length !== 1
    )
      fail(
        `${key} must use setting.number, setting.boolean or setting.choice directly.`,
      );
    const literal = properties(call.arguments[0]).get("default")?.initializer;
    if (!literal) fail(`${key} needs an explicit default literal.`);
    let from: SettingValue;
    if (ts.isNumericLiteral(literal)) from = Number(literal.text);
    else if (
      ts.isPrefixUnaryExpression(literal) &&
      literal.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(literal.operand)
    )
      from = -Number(literal.operand.text);
    else if (ts.isStringLiteral(literal)) from = literal.text;
    else if (
      literal.kind === ts.SyntaxKind.TrueKeyword ||
      literal.kind === ts.SyntaxKind.FalseKeyword
    )
      from = literal.kind === ts.SyntaxKind.TrueKeyword;
    else
      fail(
        `${key} needs a number, boolean or string default literal; shared or computed defaults cannot be kept.`,
      );
    kept.push({ key, from, to });
    if (from !== to) {
      let text = JSON.stringify(to);
      if (
        typeof to === "string" &&
        source.text[literal.getStart(source)] === "'"
      )
        text = `'${to.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}'`;
      edits.push({ start: literal.getStart(source), end: literal.end, text });
    }
  }
  // Use the same evaluated descriptors as inspection and the SDK's authoritative validation.
  const inspected = await inspectGame({ cwd });
  const descriptors = Object.fromEntries(
    Object.entries(inspected.declaration.settings ?? {}).map(([key, value]) => [
      key,
      airJamSettingSchema.parse(value),
    ]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (!Object.hasOwn(descriptors, key))
      refuse("AJ_SETTING_UNKNOWN", `${key} is not declared by this game.`);
    try {
      defineAirJamSettings({
        [key]: { ...descriptors[key], default: value },
      } as Parameters<typeof defineAirJamSettings>[0]);
    } catch {
      refuse(
        "AJ_SETTING_INVALID",
        `${key} must match its declared type, range and step or options.`,
      );
    }
  }
  if (edits.length) {
    let output = source.text;
    for (const edit of edits.sort((a, b) => b.start - a.start))
      output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    if ((await readFile(source.fileName, "utf8")) !== source.text)
      refuse(
        "AJ_SETTINGS_STALE",
        "The game changed while keeping settings; read again.",
      );
    const temporary = `${source.fileName}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, output, {
        flag: "wx",
        mode: (await stat(source.fileName)).mode,
      });
      await rename(temporary, source.fileName);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return {
    file: path.relative(cwd, source.fileName).split(path.sep).join("/"),
    kept,
  };
}
