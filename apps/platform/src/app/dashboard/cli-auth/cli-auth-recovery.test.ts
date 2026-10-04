// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardCliAuthPage from "./page";

const { searchParams } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));

describe("CLI login approval recovery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let request: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    searchParams.set("userCode", "abcd-efgh");
    request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ok: true, userCode: "ABCDEFGH", status: "approved" }),
      );
    vi.stubGlobal("fetch", request);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    searchParams.delete("userCode");
    vi.unstubAllGlobals();
  });

  const render = () =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(DashboardCliAuthPage),
        ),
      ),
    );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const input = () => {
    const result = container.querySelector("input");
    if (!result) throw new Error("Approval code input is missing.");
    return result;
  };
  const button = () => {
    const result = container.querySelector("button");
    if (!result) throw new Error("Approval button is missing.");
    return result;
  };
  const submit = () =>
    act(() => {
      const form = container.querySelector("form");
      if (!form) throw new Error("Keyboard approval form is missing.");
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

  it("submits the prefilled code through a native form and announces completion", async () => {
    render();
    expect(input().value).toBe("ABCD-EFGH");
    expect(button().type).toBe("submit");
    submit();
    await flush();
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/cli/auth/device/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userCode: "ABCDEFGH" }),
      }),
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Return to the CLI window",
    );
    expect(input().disabled).toBe(true);
    expect(button().disabled).toBe(true);
    submit();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retains the code after a network failure and permits an explicit retry", async () => {
    request.mockRejectedValueOnce(new TypeError("Network unavailable."));
    render();
    submit();
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Network unavailable.",
    );
    expect(input().value).toBe("ABCD-EFGH");
    expect(input().disabled).toBe(false);
    expect(button().disabled).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
    submit();
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Device approval complete",
    );
  });

  it("shows an expired-code response and lets the creator replace the code", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        { error: "expired_token", message: "Code expired. Start login again." },
        { status: 410 },
      ),
    );
    render();
    submit();
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Code expired. Start login again.",
    );
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("Input setter is missing.");
      setter.call(input(), "ijkl-mnop");
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input().value).toBe("IJKL-MNOP");
    submit();
    await flush();
    expect(request).toHaveBeenLastCalledWith(
      "/api/cli/auth/device/approve",
      expect.objectContaining({
        body: JSON.stringify({ userCode: "IJKLMNOP" }),
      }),
    );
  });

  it("locks the submitted code and ignores another submission while pending", async () => {
    let complete: (response: Response) => void = () => {
      throw new Error("Approval request has not started.");
    };
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render();
    submit();
    await flush();
    expect(input().disabled).toBe(true);
    expect(button().disabled).toBe(true);
    submit();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => complete(Response.json({ ok: true })));
    await flush();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Device approval complete",
    );
  });

  it("rejects an empty approval code without sending a request", async () => {
    searchParams.delete("userCode");
    render();
    submit();
    await flush();
    expect(request).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Enter the Air Jam CLI approval code first.",
    );
    expect(input().disabled).toBe(false);
  });
});
