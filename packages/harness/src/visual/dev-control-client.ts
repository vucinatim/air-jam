import {
  DEV_HARNESS_COMMANDS_PATH,
  DEV_HARNESS_REGISTER_PATH,
  type DevHarnessActionDescriptor,
  type DevHarnessCommand,
  type DevHarnessCompleteCommandPayload,
  type DevHarnessRegisterPayload,
  type DevHarnessRole,
} from "../core/dev-control.js";
import type { PublishedVisualHarnessBridgeSnapshot } from "../core/runtime-bridge.js";

const createSessionId = (): string => {
  const cryptoLike = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }

  return `airjam-harness-${Date.now().toString(36)}`;
};

const resolveBaseUrl = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.origin.replace(/\/$/, "");
};

const readCommand = async (
  endpoint: string,
  signal: AbortSignal,
): Promise<DevHarnessCommand | null> => {
  const response = await fetch(endpoint, {
    method: "GET",
    signal,
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Harness command poll failed with ${response.status}.`);
  }

  return (await response.json()) as DevHarnessCommand;
};

type VisualHarnessDevControlClientOptions = {
  gameId: string;
  role?: DevHarnessRole;
  readSnapshot: () => PublishedVisualHarnessBridgeSnapshot | null;
  listActions: () => DevHarnessActionDescriptor[];
  invokeAction: (actionName: string, payload?: unknown) => Promise<unknown>;
};

type VisualHarnessDevControlWindow = Window & {
  __airJamVisualHarnessSessionId__?: string;
};

export class VisualHarnessDevControlClient {
  public readonly sessionId = createSessionId();

  private readonly gameId: string;
  private readonly role: DevHarnessRole;
  private readonly readSnapshot: () => PublishedVisualHarnessBridgeSnapshot | null;
  private readonly listActions: () => DevHarnessActionDescriptor[];
  private readonly invokeAction: (
    actionName: string,
    payload?: unknown,
  ) => Promise<unknown>;
  private pollAbortController: AbortController | null = null;
  private running = false;

  constructor(options: VisualHarnessDevControlClientOptions) {
    this.gameId = options.gameId;
    this.role = options.role ?? "host";
    this.readSnapshot = options.readSnapshot;
    this.listActions = options.listActions;
    this.invokeAction = options.invokeAction;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    if (typeof window !== "undefined") {
      (
        window as VisualHarnessDevControlWindow
      ).__airJamVisualHarnessSessionId__ = this.sessionId;
    }

    void this.register();
    void this.pollLoop();
  }

  stop(): void {
    this.running = false;
    this.pollAbortController?.abort();
    this.pollAbortController = null;

    if (typeof window !== "undefined") {
      delete (window as VisualHarnessDevControlWindow)
        .__airJamVisualHarnessSessionId__;
    }
  }

  sync(): void {
    if (!this.running) {
      return;
    }

    void this.register();
  }

  private buildRegisterPayload(): DevHarnessRegisterPayload | null {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || typeof window === "undefined") {
      return null;
    }

    const snapshot = this.readSnapshot();

    return {
      sessionId: this.sessionId,
      gameId: this.gameId,
      role: this.role,
      roomId: snapshot?.roomId ?? null,
      origin: window.location.origin,
      href: window.location.href,
      title: document.title || null,
      actions: this.listActions(),
      snapshot,
    };
  }

  private async register(): Promise<void> {
    const payload = this.buildRegisterPayload();
    const baseUrl = resolveBaseUrl();
    if (!payload || !baseUrl) {
      return;
    }

    await fetch(`${baseUrl}${DEV_HARNESS_REGISTER_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(() => null);
  }

  private async pollLoop(): Promise<void> {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl) {
      return;
    }

    while (this.running) {
      const abortController = new AbortController();
      this.pollAbortController = abortController;

      try {
        const command = await readCommand(
          `${baseUrl}${DEV_HARNESS_COMMANDS_PATH}?sessionId=${encodeURIComponent(
            this.sessionId,
          )}&waitMs=20000`,
          abortController.signal,
        );
        if (!command) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        await this.completeCommand(command);
      } catch (error) {
        if (!this.running) {
          return;
        }

        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  private async completeCommand(command: DevHarnessCommand): Promise<void> {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl) {
      return;
    }

    const snapshotBefore = this.readSnapshot();
    let payload: DevHarnessCompleteCommandPayload;

    try {
      const result = await this.invokeAction(
        command.actionName,
        command.payload,
      );
      payload = {
        commandId: command.commandId,
        result: {
          sessionId: this.sessionId,
          roomId: snapshotBefore?.roomId ?? null,
          gameId: this.gameId,
          actionName: command.actionName,
          result,
          snapshotBefore,
          snapshotAfter: this.readSnapshot(),
        },
      };
    } catch (error) {
      payload = {
        commandId: command.commandId,
        result: {
          sessionId: this.sessionId,
          roomId: snapshotBefore?.roomId ?? null,
          gameId: this.gameId,
          actionName: command.actionName,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
          snapshotBefore,
          snapshotAfter: this.readSnapshot(),
        },
      };
    }

    await fetch(`${baseUrl}${DEV_HARNESS_COMMANDS_PATH}/complete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(() => null);

    this.sync();
  }
}
