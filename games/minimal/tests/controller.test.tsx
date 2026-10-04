import {
  Children,
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ControllerView } from "../src/controller";

const fixture = vi.hoisted(() => ({
  connectionStatus: "connected",
  tap: vi.fn(),
  state: { perPlayerCounts: { player: 2 }, totalCount: 3 },
}));

vi.mock("@air-jam/sdk", () => ({
  useAirJamController: () => ({
    controllerId: "player",
    roomId: "TEST",
    connectionStatus: fixture.connectionStatus,
  }),
}));
vi.mock("@air-jam/sdk/ui", () => ({ SurfaceViewport: () => null }));
vi.mock("../src/game/store", () => ({
  useMinimalStore: Object.assign(
    (selector: (state: typeof fixture.state) => unknown) =>
      selector(fixture.state),
    { useActions: () => ({ tap: fixture.tap }) },
  ),
}));

function findButton(
  node: ReactNode,
): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === "button")
      return child as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
    const button = findButton(child.props.children);
    if (button) return button;
  }
}

describe("Minimal native button activation", () => {
  beforeEach(() => {
    fixture.connectionStatus = "connected";
    fixture.tap.mockClear();
  });

  it("dispatches once through the native click lane without a second pointer-down lane", () => {
    const button = findButton(ControllerView())!;
    expect(button.props.type).toBe("button");
    expect(button.props.disabled).toBe(false);
    expect(button.props.onClick).toBeTypeOf("function");
    expect(button.props.onPointerDown).toBeUndefined();
    button.props.onClick!({} as MouseEvent<HTMLButtonElement>);
    expect(fixture.tap).toHaveBeenCalledTimes(1);
  });

  it.each(["connecting", "disconnected"])(
    "disables the button and guards activation while %s",
    (status) => {
      fixture.connectionStatus = status;
      const button = findButton(ControllerView())!;
      expect(button.props.disabled).toBe(true);
      expect(button.props.onClick).toBeTypeOf("function");
      button.props.onClick!({} as MouseEvent<HTMLButtonElement>);
      expect(fixture.tap).not.toHaveBeenCalled();
    },
  );
});
