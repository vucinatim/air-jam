import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readlinkSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

const processIdentitySchema = z
  .object({
    processId: z.number().int().positive(),
    started: z.string().min(1),
  })
  .strict();
export const processScopeSchema = z
  .object({
    version: z.literal(1),
    token: z.uuid(),
    namespace: z.string().min(1),
    groups: z
      .array(
        z
          .object({
            groupId: z.number().int().positive(),
            anchor: processIdentitySchema,
            members: z.array(processIdentitySchema).max(1024),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
export type ProcessScope = z.infer<typeof processScopeSchema>;
export const processScopeJournalSchema = z
  .object({
    guardian: processIdentitySchema,
    scope: processScopeSchema,
  })
  .strict();
export const processScopeReceiptSchema = z
  .object({
    status: z.enum(["tree_clean", "tree_unconfirmed"]),
    token: z.uuid(),
    survivors: z.array(
      z
        .object({
          processId: z.number().int().positive(),
          groupId: z.number().int().positive(),
        })
        .strict(),
    ),
    errors: z.array(z.string()),
  })
  .strict();
export type ProcessScopeReceipt = z.infer<typeof processScopeReceiptSchema>;
const processRowSchema = processIdentitySchema.extend({
  parentProcessId: z.number().int().nonnegative(),
  groupId: z.number().int().positive(),
  state: z.string(),
  command: z.string(),
});
type ProcessRow = z.infer<typeof processRowSchema>;
export const processScopeMarker = (token: string) =>
  `--airjam-process-scope=${z.uuid().parse(token)}`;
export const createProcessScope = (): ProcessScope => ({
  version: 1,
  token: randomUUID(),
  namespace: processScopeNamespace(),
  groups: [],
});
let namespace: string | undefined;
export function processScopeNamespace() {
  return (namespace ??=
    process.platform === "linux"
      ? `linux:${readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()}:${readlinkSync("/proc/self/ns/pid")}`
      : `darwin:${execFileSync("sysctl", ["-n", "kern.boottime"], { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).trim()}`);
}

function processTable(): ProcessRow[] {
  if (process.platform === "win32")
    throw new Error(
      "Process scope verification requires a POSIX process table.",
    );
  const source = execFileSync(
    "ps",
    ["-A", "-ww", "-o", "pid=,ppid=,pgid=,lstart=,stat=,command="],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, LC_ALL: "C" },
    },
  );
  return source.split("\n").flatMap((line) => {
    const match =
      /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\d+:\d+:\d+\s+\d+)\s+(\S+)\s+(.*)$/.exec(
        line,
      );
    if (!match) {
      if (line.trim())
        throw new Error("Process scope received an invalid process table row.");
      return [];
    }
    if (Number(match[3]) === 0) return [];
    const processId = Number(match[1]);
    let started = match[4];
    if (process.platform === "linux") {
      try {
        const stat = readFileSync(`/proc/${processId}/stat`, "utf8");
        started = `linux:${stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19]}`;
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code === "ENOENT" ||
          (error as NodeJS.ErrnoException).code === "ESRCH"
        )
          return [];
        throw error;
      }
    }
    return [
      processRowSchema.parse({
        processId,
        parentProcessId: Number(match[2]),
        groupId: Number(match[3]),
        started,
        state: match[5],
        command: match[6],
      }),
    ];
  });
}
export function processIdentity(processId: number) {
  const row = processTable().find((row) => row.processId === processId);
  return row ? { processId: row.processId, started: row.started } : null;
}
function carriesToken(row: ProcessRow, token: string) {
  return row.command.split(/\s+/).includes(processScopeMarker(token));
}
function inheritedScope(row: ProcessRow, token: string) {
  try {
    const marker = `AIRJAM_PROCESS_SCOPE=${token}`;
    if (process.platform === "linux")
      return readFileSync(`/proc/${row.processId}/environ`, "utf8")
        .split("\0")
        .includes(marker);
    const command = execFileSync(
      "ps",
      ["eww", "-p", String(row.processId), "-o", "command="],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        env: { ...process.env, LC_ALL: "C" },
      },
    );
    return command.split(/\s+/).includes(marker);
  } catch (error) {
    const result = error as { status?: number; stdout?: string };
    if (result.status === 1 && !result.stdout?.trim()) return false;
    if (
      ["ENOENT", "ESRCH", "EACCES", "EPERM"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return false;
    throw error;
  }
}
function sameProcess(
  left: z.infer<typeof processIdentitySchema>,
  right: z.infer<typeof processIdentitySchema>,
) {
  return left.processId === right.processId && left.started === right.started;
}
function rememberGroup(
  scope: ProcessScope,
  row: ProcessRow,
  table: ProcessRow[],
) {
  let group = scope.groups.find((group) => group.groupId === row.groupId);
  if (!group) {
    if (scope.groups.length >= 64)
      throw new Error("A process scope exceeded its process-group allowance.");
    group = {
      groupId: row.groupId,
      anchor: { processId: row.processId, started: row.started },
      members: [],
    };
    scope.groups.push(group);
  } else if (row.processId === row.groupId && !sameProcess(row, group.anchor)) {
    group.anchor = { processId: row.processId, started: row.started };
    group.members = [];
  }
  group.members = group.members.filter((previous) =>
    table.some(
      (member) =>
        member.groupId === group.groupId && sameProcess(previous, member),
    ),
  );
  for (const member of table.filter(
    (member) => member.groupId === group.groupId,
  ))
    if (!group.members.some((previous) => sameProcess(previous, member))) {
      if (group.members.length >= 1024)
        throw new Error(
          "A process scope exceeded its group membership allowance.",
        );
      group.members.push({
        processId: member.processId,
        started: member.started,
      });
    }
}
export function registerProcessScope(scope: ProcessScope, processId: number) {
  processScopeSchema.parse(scope);
  if (scope.namespace !== processScopeNamespace())
    throw new Error(
      "Process scope belongs to a different boot or PID namespace.",
    );
  const table = processTable();
  const row = table.find((row) => row.processId === processId);
  if (!row || !carriesToken(row, scope.token))
    throw new Error(
      "Process scope registration requires the live, marked process.",
    );
  if (row.groupId !== processId)
    throw new Error("A registered process must lead its own process group.");
  rememberGroup(scope, row, table);
}

/** Verifies registered process generations and token-marked groups; never broad process-name killing. */
export async function closeProcessScope(
  input: ProcessScope,
): Promise<ProcessScopeReceipt> {
  const scope = processScopeSchema.parse(input);
  if (scope.namespace !== processScopeNamespace())
    return {
      status: "tree_clean",
      token: scope.token,
      survivors: [],
      errors: [],
    };
  const errors: string[] = [];
  const retired = new Set<number>();
  const signaled = new Map<number, NodeJS.Signals>();
  const started = performance.now();
  const deadline = started + 3000;
  let survivors: ProcessRow[] = [];
  const signal = (groupId: number, kind: NodeJS.Signals) => {
    if (retired.has(groupId) || signaled.get(groupId) === kind) return;
    try {
      process.kill(-groupId, kind);
      signaled.set(groupId, kind);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH")
        retired.add(groupId);
      else errors.push(`Process group ${groupId}: ${String(error)}`);
    }
  };
  try {
    let empty = false;
    while (true) {
      const table = processTable();
      for (const row of table.filter(
        (row) =>
          carriesToken(row, scope.token) ||
          (process.platform === "linux" && inheritedScope(row, scope.token)),
      )) {
        if (retired.has(row.groupId)) {
          errors.push(`Scope group ${row.groupId} reappeared after exit.`);
          continue;
        }
        rememberGroup(scope, row, table);
      }
      survivors = [];
      for (const group of scope.groups) {
        if (retired.has(group.groupId)) continue;
        const leader = table.find(
          (row) =>
            row.processId === group.groupId && row.groupId === group.groupId,
        );
        if (
          group.anchor.processId === group.groupId &&
          leader &&
          !sameProcess(leader, group.anchor)
        ) {
          retired.add(group.groupId);
          continue;
        }
        const members = table.filter(
          (row) => row.groupId === group.groupId && !row.state.startsWith("Z"),
        );
        if (!members.length) {
          retired.add(group.groupId);
          continue;
        }
        survivors.push(...members);
        const verified = members.some(
          (member) =>
            carriesToken(member, scope.token) ||
            group.members.some((previous) => sameProcess(previous, member)) ||
            inheritedScope(member, scope.token),
        );
        if (!verified) continue;
        rememberGroup(scope, members[0], table);
        signal(
          group.groupId,
          performance.now() - started < 1000 ? "SIGTERM" : "SIGKILL",
        );
      }
      if (!survivors.length && empty) break;
      empty = !survivors.length;
      if (performance.now() >= deadline) break;
      await delay(25);
    }
  } catch (error) {
    errors.push(String(error));
  }
  // Recovery must retain groups first discovered during this cleanup attempt.
  input.groups = scope.groups;
  return {
    status:
      !survivors.length && !errors.length ? "tree_clean" : "tree_unconfirmed",
    token: scope.token,
    survivors: survivors.map(({ processId, groupId }) => ({
      processId,
      groupId,
    })),
    errors,
  };
}
