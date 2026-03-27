import { describe, expect, it } from "vitest";
import { parseCliArgs, passesFilter } from "../scripts/dev-logs";

describe("dev logs cli", () => {
  it("parses runtime filters", () => {
    const options = parseCliArgs([
      "--view=signal",
      "--controller=ctrl_dev_1",
      "--event=runtime.embedded_bridge.attached",
      "--runtime=arcade-host-runtime",
      "--epoch=2",
      "--console-category=framework",
    ]);

    expect(options.view).toBe("signal");
    expect(options.controllerId).toBe("ctrl_dev_1");
    expect(options.event).toBe("runtime.embedded_bridge.attached");
    expect(options.runtimeKind).toBe("arcade-host-runtime");
    expect(options.runtimeEpoch).toBe(2);
    expect(options.consoleCategory).toBe("framework");
  });

  it("filters events by controller, event, runtime kind, and epoch", () => {
    const options = parseCliArgs([
      "--controller=ctrl_dev_1",
      "--event=runtime.embedded_bridge.attached",
      "--runtime=arcade-host-runtime",
      "--epoch=2",
    ]);

    expect(
      passesFilter(
        {
          controllerId: "ctrl_dev_1",
          event: "runtime.embedded_bridge.attached",
          runtimeKind: "arcade-host-runtime",
          runtimeEpoch: 2,
        },
        options,
      ),
    ).toBe(true);
    expect(
      passesFilter(
        {
          controllerId: "ctrl_dev_1",
          event: "runtime.embedded_bridge.attached",
          runtimeKind: "arcade-host-runtime",
          runtimeEpoch: 3,
        },
        options,
      ),
    ).toBe(false);
    expect(
      passesFilter(
        {
          controllerId: "ctrl_dev_1",
          event: "runtime.embedded_bridge.attached",
          runtimeKind: "arcade-controller-runtime",
          runtimeEpoch: 2,
        },
        options,
      ),
    ).toBe(false);
    expect(
      passesFilter(
        {
          controllerId: "ctrl_other",
          event: "runtime.embedded_bridge.attached",
          runtimeKind: "arcade-host-runtime",
          runtimeEpoch: 2,
        },
        options,
      ),
    ).toBe(false);
    expect(
      passesFilter(
        {
          controllerId: "ctrl_dev_1",
          event: "runtime.embedded_bridge.rejected",
          runtimeKind: "arcade-host-runtime",
          runtimeEpoch: 2,
        },
        options,
      ),
    ).toBe(false);
  });

  it("uses signal view to hide infrastructure and low-value framework/browser console chatter", () => {
    const options = parseCliArgs(["--view=signal"]);

    expect(
      passesFilter(
        {
          event: "browser.log_batch.received",
          source: "browser",
        },
        options,
      ),
    ).toBe(false);

    expect(
      passesFilter(
        {
          event: "browser.console",
          source: "browser",
          level: "info",
          consoleCategory: "framework",
          msg: "%c >> query #1",
        },
        options,
      ),
    ).toBe(false);

    expect(
      passesFilter(
        {
          event: "browser.console",
          source: "browser",
          level: "warn",
          consoleCategory: "browser",
          msg: 'Image with src "/logo.png" was detected as the Largest Contentful Paint',
        },
        options,
      ),
    ).toBe(false);

    expect(
      passesFilter(
        {
          event: "browser.console",
          source: "browser",
          level: "warn",
          consoleCategory: "airjam",
          msg: "[InputManager] Invalid input",
        },
        options,
      ),
    ).toBe(true);

    expect(
      passesFilter(
        {
          event: "runtime.provider.mounted",
          source: "browser",
          level: "info",
        },
        options,
      ),
    ).toBe(true);
  });
});
