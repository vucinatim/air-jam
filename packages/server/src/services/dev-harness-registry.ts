import type {
  DevHarnessCommand,
  DevHarnessCompleteCommandPayload,
  DevHarnessInvokePayload,
  DevHarnessInvokeResponse,
  DevHarnessRegisterPayload,
  DevHarnessSessionRecord,
} from "@air-jam/harness/dev-control";
import { randomUUID } from "node:crypto";

type PendingCommandWaiter = {
  resolve: (command: DevHarnessCommand | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PendingInvocation = {
  sessionId: string;
  resolve: (value: DevHarnessInvokeResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const ACTIVE_SESSION_TTL_MS = 30_000;
const DEFAULT_INVOKE_TIMEOUT_MS = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 20_000;

const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export class DevHarnessRegistry {
  private readonly sessions = new Map<string, DevHarnessSessionRecord>();
  private readonly pendingCommands = new Map<string, DevHarnessCommand[]>();
  private readonly pendingCommandWaiters = new Map<
    string,
    PendingCommandWaiter
  >();
  private readonly pendingInvocations = new Map<string, PendingInvocation>();

  register(payload: DevHarnessRegisterPayload): DevHarnessSessionRecord {
    this.pruneStaleSessions();

    const existing = this.sessions.get(payload.sessionId);
    const nowIso = new Date().toISOString();
    const nextRecord: DevHarnessSessionRecord = {
      sessionId: payload.sessionId,
      gameId: payload.gameId,
      role: payload.role,
      roomId: payload.roomId,
      origin: payload.origin,
      href: payload.href,
      title: payload.title,
      actions: [...payload.actions].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      actionNames: payload.actions
        .map((action) => action.name)
        .sort((left, right) => left.localeCompare(right)),
      snapshot: payload.snapshot,
      registeredAt: existing?.registeredAt ?? nowIso,
      lastSeenAt: nowIso,
    };
    this.sessions.set(payload.sessionId, nextRecord);
    return nextRecord;
  }

  listSessions(
    filters: {
      gameId?: string;
      roomId?: string;
      role?: DevHarnessSessionRecord["role"];
    } = {},
  ): DevHarnessSessionRecord[] {
    this.pruneStaleSessions();
    const roomId = filters.roomId?.trim().toUpperCase();

    return [...this.sessions.values()]
      .filter((session) => {
        if (filters.gameId && session.gameId !== filters.gameId) {
          return false;
        }
        if (roomId && session.roomId !== roomId) {
          return false;
        }
        if (filters.role && session.role !== filters.role) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        return toTimestamp(right.lastSeenAt) - toTimestamp(left.lastSeenAt);
      });
  }

  async awaitNextCommand(
    sessionId: string,
    waitMs = DEFAULT_WAIT_TIMEOUT_MS,
  ): Promise<DevHarnessCommand | null> {
    this.pruneStaleSessions();
    const queued = this.pendingCommands.get(sessionId);
    if (queued && queued.length > 0) {
      const command = queued.shift() ?? null;
      if (queued.length === 0) {
        this.pendingCommands.delete(sessionId);
      }
      return command;
    }

    return new Promise((resolve) => {
      const existingWaiter = this.pendingCommandWaiters.get(sessionId);
      if (existingWaiter) {
        clearTimeout(existingWaiter.timer);
        existingWaiter.resolve(null);
      }

      const timer = setTimeout(() => {
        this.pendingCommandWaiters.delete(sessionId);
        resolve(null);
      }, waitMs);

      this.pendingCommandWaiters.set(sessionId, {
        resolve: (command) => {
          clearTimeout(timer);
          resolve(command);
        },
        timer,
      });
    });
  }

  async invoke(
    payload: DevHarnessInvokePayload,
  ): Promise<DevHarnessInvokeResponse> {
    this.pruneStaleSessions();

    const session = this.resolveTargetSession(payload);
    if (!session) {
      throw new Error("No matching live harness session found.");
    }

    const commandId = randomUUID();
    const command: DevHarnessCommand = {
      commandId,
      actionName: payload.actionName,
      payload: payload.payload,
      issuedAt: new Date().toISOString(),
    };

    const timeoutMs =
      payload.timeoutMs && payload.timeoutMs > 0
        ? payload.timeoutMs
        : DEFAULT_INVOKE_TIMEOUT_MS;

    const resultPromise = new Promise<DevHarnessInvokeResponse>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingInvocations.delete(commandId);
          reject(
            new Error(
              `Timed out waiting for harness action "${payload.actionName}" on session "${session.sessionId}".`,
            ),
          );
        }, timeoutMs);

        this.pendingInvocations.set(commandId, {
          sessionId: session.sessionId,
          resolve,
          reject,
          timer,
        });
      },
    );

    const waiter = this.pendingCommandWaiters.get(session.sessionId);
    if (waiter) {
      this.pendingCommandWaiters.delete(session.sessionId);
      waiter.resolve(command);
    } else {
      const queue = this.pendingCommands.get(session.sessionId) ?? [];
      queue.push(command);
      this.pendingCommands.set(session.sessionId, queue);
    }

    return resultPromise;
  }

  completeCommand(
    payload: DevHarnessCompleteCommandPayload,
  ): DevHarnessInvokeResponse | null {
    const pending = this.pendingInvocations.get(payload.commandId);
    if (!pending) {
      return null;
    }

    this.pendingInvocations.delete(payload.commandId);
    clearTimeout(pending.timer);

    const session = this.sessions.get(pending.sessionId);
    if (!session) {
      const error = new Error(
        `Harness session "${pending.sessionId}" disappeared before completion.`,
      );
      pending.reject(error);
      return null;
    }

    const completedAt = new Date().toISOString();
    const updatedSession: DevHarnessSessionRecord = {
      ...session,
      roomId: payload.result.roomId ?? session.roomId,
      snapshot: payload.result.snapshotAfter ?? session.snapshot,
      lastSeenAt: completedAt,
    };
    this.sessions.set(session.sessionId, updatedSession);

    if (payload.result.error?.message) {
      const error = new Error(payload.result.error.message);
      pending.reject(error);
      return null;
    }

    const response: DevHarnessInvokeResponse = {
      session: updatedSession,
      invocation: {
        ...payload.result,
        commandId: payload.commandId,
        completedAt,
      },
    };
    pending.resolve(response);
    return response;
  }

  private pruneStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - toTimestamp(session.lastSeenAt) <= ACTIVE_SESSION_TTL_MS) {
        continue;
      }

      this.sessions.delete(sessionId);
      this.pendingCommands.delete(sessionId);

      const waiter = this.pendingCommandWaiters.get(sessionId);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.pendingCommandWaiters.delete(sessionId);
        waiter.resolve(null);
      }
    }
  }

  private resolveTargetSession(
    payload: DevHarnessInvokePayload,
  ): DevHarnessSessionRecord | null {
    const sessionId = payload.sessionId?.trim();
    if (sessionId) {
      return this.sessions.get(sessionId) ?? null;
    }

    const roomId = payload.roomId?.trim().toUpperCase();
    const candidates = this.listSessions({
      gameId: payload.gameId,
      roomId,
      role: "host",
    });

    return candidates[0] ?? null;
  }
}
