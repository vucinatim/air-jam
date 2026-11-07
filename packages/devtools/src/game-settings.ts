import { airJamSettingSchema, defineAirJamSettings } from "@air-jam/sdk/core";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
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
  // Bind only game source. SDK/package declarations and ambient libraries are
  // irrelevant to resolving which local variable the game actually imports.
  const sourceRoot = path.join(cwd, "src");
  const localFile = (file: string) => {
    try {
      const resolved = realpathSync(file);
      const relative = path.relative(cwd, resolved);
      return relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative) &&
        !relative.split(path.sep).includes("node_modules")
        ? resolved
        : undefined;
    } catch {
      return undefined;
    }
  };
  const options: TS.CompilerOptions = {
    noLib: true,
    types: [],
    skipLibCheck: true,
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
  };
  const host = ts.createCompilerHost(options);
  host.getCurrentDirectory = () => cwd;
  host.fileExists = (file) => localFile(file) !== undefined;
  host.readFile = (file) => {
    const local = localFile(file);
    return local ? ts.sys.readFile(local) : undefined;
  };
  host.getSourceFile = (file, languageVersion) => {
    const local = localFile(file);
    const text = local ? host.readFile(local) : undefined;
    return local && text !== undefined
      ? ts.createSourceFile(local, text, languageVersion, true)
      : undefined;
  };
  host.resolveModuleNames = (names, containingFile) =>
    names.map((name) =>
      name.startsWith(".")
        ? ts.resolveModuleName(name, containingFile, options, host)
            .resolvedModule
        : undefined,
    );
  const configPath = path.join(sourceRoot, "airjam.config.ts");
  const program = ts.createProgram([configPath], options, host);
  const config = program.getSourceFile(configPath);
  if (!config) fail("The game's src/airjam.config.ts could not be read.");
  if (program.getSyntacticDiagnostics().length)
    fail("Fix the game's source syntax before keeping settings.");
  const checker = program.getTypeChecker();
  const resolveVariable = (initial: TS.Symbol | undefined) => {
    let symbol = initial;
    const aliases = new Set<TS.Symbol>();
    while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      if (aliases.has(symbol))
        fail("The settings binding has a circular alias.");
      aliases.add(symbol);
      symbol = checker.getAliasedSymbol(symbol);
    }
    const declarations = symbol?.getDeclarations();
    if (
      declarations?.length !== 1 ||
      !ts.isVariableDeclaration(declarations[0])
    )
      fail("Expected one unambiguous source variable declaration.");
    const variable = declarations[0];
    if (
      !ts.isIdentifier(variable.name) ||
      !ts.isVariableDeclarationList(variable.parent) ||
      !(variable.parent.flags & ts.NodeFlags.Const) ||
      !variable.initializer
    )
      fail("Settings must use one directly initialized const binding.");
    return {
      source: variable.getSourceFile(),
      initializer: variable.initializer,
    };
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
  const games: TS.CallExpression[] = [];
  const visit = (node: TS.Node) => {
    if (isCall(node, "defineAirJamGame")) games.push(node);
    ts.forEachChild(node, visit);
  };
  visit(config);
  if (games.length !== 1)
    fail("Expected exactly one defineAirJamGame declaration.");
  const module = checker.getSymbolAtLocation(config);
  const exportedGame =
    module &&
    checker.getExportsOfModule(module).find((entry) => entry.name === "airjam");
  if (resolveVariable(exportedGame).initializer !== games[0])
    fail(
      "The defineAirJamGame declaration must be the game's exported airjam value.",
    );
  // A checker may still pick a symbol from invalid duplicate exports. Never
  // treat that recovery choice as an authoritative source-edit target.
  if (
    program
      .getSemanticDiagnostics()
      .some(({ code }) => [2300, 2308, 2323, 2451, 2484, 2588].includes(code))
  )
    fail(
      "Duplicate or ambiguous bindings must be resolved before keeping settings.",
    );
  const selected = properties(games[0].arguments[0]).get(
    "settings",
  )?.initializer;
  if (!selected) fail("This game has no settings declaration.");
  let source = config;
  let declaration = selected;
  if (ts.isIdentifier(selected)) {
    const binding = resolveVariable(checker.getSymbolAtLocation(selected));
    source = binding.source;
    declaration = binding.initializer;
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
