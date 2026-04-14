import { definePrefab } from "@air-jam/sdk/prefabs";
import { paintPongArena } from "./paint";
import { PONG_ARENA_PREVIEW } from "./preview";
import {
  PONG_ARENA_DEFAULT_PROPS,
  pongArenaPrefabSchema,
} from "./schema";

export const PONG_ARENA_PREFAB = definePrefab({
  id: "pong.arena.default",
  label: "Pong Arena",
  category: "arena",
  description: "Default Pong playfield palette and dimensions for the starter template.",
  tags: ["pong", "arena", "2d", "starter"],
  defaultProps: PONG_ARENA_DEFAULT_PROPS,
  configSchema: pongArenaPrefabSchema,
  preview: PONG_ARENA_PREVIEW,
  render: paintPongArena,
  placement: {
    origin: "center",
    bounds: {
      width: PONG_ARENA_DEFAULT_PROPS.fieldWidth,
      height: PONG_ARENA_DEFAULT_PROPS.fieldHeight,
    },
    footprint: {
      kind: "box",
      width: PONG_ARENA_DEFAULT_PROPS.fieldWidth,
      depth: PONG_ARENA_DEFAULT_PROPS.fieldHeight,
    },
  },
});
