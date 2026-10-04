// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "./page";

const { readAccount, saveAccount, cancelAccountRead } = vi.hoisted(() => ({
  readAccount: vi.fn(),
  saveAccount: vi.fn(),
  cancelAccountRead: vi.fn(),
}));
const account = {
  id: "creator-1",
  name: "Original name",
  email: "creator@example.invalid",
  role: "creator",
};
vi.mock("@/trpc/react", async () => {
  const { useQueryClient } = await import("@tanstack/react-query");
  return {
    api: {
      useUtils: () => {
        const client = useQueryClient();
        return {
          user: {
            me: {
              cancel: cancelAccountRead,
              getData: () => client.getQueryData(["account"]),
              invalidate: () =>
                client.invalidateQueries({ queryKey: ["account"] }),
              setData: (_input: undefined, data: unknown) =>
                client.setQueryData(["account"], data),
            },
          },
        };
      },
      user: {
        me: {
          useQuery: () =>
            useQuery({ queryKey: ["account"], queryFn: () => readAccount() }),
        },
        updateProfile: {
          useMutation: (options: object) =>
            useMutation({
              mutationFn: (input: { displayName: string }) =>
                saveAccount(input),
              ...options,
            }),
        },
      },
    },
  };
});

describe("creator account recovery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let browserAlert: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    browserAlert = vi.fn();
    vi.stubGlobal("alert", browserAlert);
    readAccount.mockResolvedValue(account);
    saveAccount.mockResolvedValue({ ...account, name: "Accepted name" });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    client.setQueryData(["account"], account);
    cancelAccountRead.mockImplementation(() =>
      client.cancelQueries({ queryKey: ["account"] }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = () =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(AccountPage),
        ),
      ),
    );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const input = () => {
    const result =
      container.querySelector<HTMLInputElement>("input:not(:disabled)") ??
      container.querySelector<HTMLInputElement>(
        'input[placeholder="Your name"]',
      );
    if (!result) throw new Error("Display name input is missing.");
    return result;
  };
  const fill = (value: string) =>
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("Input setter is missing.");
      setter.call(input(), value);
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
  const button = (text: string) => {
    const result = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!result) throw new Error(`Missing ${text} button.`);
    return result;
  };

  it("offers retry after a failed account read", async () => {
    client.removeQueries();
    readAccount.mockRejectedValueOnce(new Error("Account read failed."));
    render();
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load your account",
    );
    act(() => button("Try again").click());
    await flush();
    expect(input().value).toBe(account.name);
  });

  it("does not erase an unsaved name when account data refreshes", async () => {
    render();
    fill("My draft");
    await act(async () =>
      client.setQueryData(["account"], { ...account, name: "Refreshed name" }),
    );
    await flush();
    expect(input().value).toBe("My draft");
    readAccount.mockRejectedValueOnce(new Error("Refresh unavailable."));
    await act(async () => {
      await client.invalidateQueries();
    });
    await flush();
    expect(input().value).toBe("My draft");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load your account",
    );
  });

  it("retains a failed save, locks pending inputs and accepts a retry despite refresh failure", async () => {
    let rejectSave: (error: Error) => void = () => {
      throw new Error("Save has not started.");
    };
    saveAccount.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    render();
    fill("Accepted name");
    act(() => button("Save Changes").click());
    await flush();
    expect(input().disabled).toBe(true);
    expect(button("Save Changes").disabled).toBe(true);
    await act(async () => rejectSave(new Error("Save unavailable.")));
    await flush();
    expect(input().value).toBe("Accepted name");
    expect(input().disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Save unavailable.",
    );
    expect(browserAlert).not.toHaveBeenCalled();
    readAccount.mockRejectedValueOnce(new Error("Refresh unavailable."));
    act(() => button("Save Changes").click());
    await flush();
    expect(saveAccount).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(["account"])).toEqual({
      ...account,
      name: "Accepted name",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Account updated",
    );
    fill("Another draft");
    await flush();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it.each(["before acknowledgement", "during read cancellation"] as const)(
    "does not restore an old account when identity changes %s",
    async (switchTiming) => {
      let acknowledgeSave: (value: typeof account) => void = () => {
        throw new Error("Save has not started.");
      };
      let finishCancellation: () => void = () => {
        throw new Error("Cancellation has not started.");
      };
      saveAccount.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            acknowledgeSave = resolve;
          }),
      );
      if (switchTiming === "during read cancellation") {
        cancelAccountRead.mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishCancellation = resolve;
            }),
        );
      }
      readAccount.mockRejectedValue(new Error("Refresh unavailable."));
      render();
      fill("Accepted name");
      act(() => button("Save Changes").click());
      await flush();
      if (switchTiming === "during read cancellation") {
        await act(async () =>
          acknowledgeSave({ ...account, name: "Accepted name" }),
        );
        await flush();
      }
      const otherAccount = {
        ...account,
        id: "creator-2",
        name: "Other creator",
      };
      await act(async () => client.setQueryData(["account"], otherAccount));
      await flush();
      if (switchTiming === "before acknowledgement") {
        await act(async () =>
          acknowledgeSave({ ...account, name: "Accepted name" }),
        );
      } else {
        await act(async () => finishCancellation());
      }
      await flush();
      expect(client.getQueryData(["account"])).toEqual(otherAccount);
      expect(input().value).toBe("Other creator");
      expect(readAccount).not.toHaveBeenCalled();
    },
  );

  it("resets the editor when a different account is loaded", async () => {
    render();
    fill("My draft");
    await act(async () =>
      client.setQueryData(["account"], {
        ...account,
        id: "creator-2",
        name: "Other creator",
      }),
    );
    await flush();
    expect(input().value).toBe("Other creator");
  });

  it("associates the read-only email with its label", () => {
    render();
    const label = Array.from(container.querySelectorAll("label")).find(
      (candidate) => candidate.textContent === "Email",
    );
    const email = container.querySelector<HTMLInputElement>(
      `input[id="${label?.htmlFor}"]`,
    );
    expect(email?.value).toBe(account.email);
    expect(email?.disabled).toBe(true);
  });
});
