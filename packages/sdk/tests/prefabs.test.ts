import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  createPrefabCatalog,
  definePrefab,
  type PrefabDefinition,
} from "../src/prefabs";

describe("prefab contract leaf", () => {
  it("keeps prefab definitions on a stable explicit contract", () => {
    const cratePrefab = definePrefab({
      id: "test.crate.default",
      label: "Crate",
      category: "obstacle",
      description: "A reusable crate obstacle.",
      tags: ["test", "crate"],
      defaultProps: {
        width: 2,
      },
      configSchema: z.object({
        width: z.number().positive(),
      }),
      render: ({ width }) => width,
      preview: {
        summary: "A square crate obstacle.",
        accentColor: "#ff9900",
        camera: {
          position: [6, 5, 6],
          target: [0, 1, 0],
        },
      },
      placement: {
        origin: "ground",
        bounds: {
          width: 2,
          depth: 2,
          height: 2,
        },
        footprint: {
          kind: "box",
          width: 2,
          depth: 2,
        },
      },
    });

    expect(cratePrefab.configSchema.parse(cratePrefab.defaultProps)).toEqual({
      width: 2,
    });
    expect(cratePrefab.preview?.summary).toContain("crate");
    expect(cratePrefab.preview?.camera?.position).toEqual([6, 5, 6]);
    expect(cratePrefab.placement?.origin).toBe("ground");
    expect(cratePrefab.render({ width: 4 })).toBe(4);
  });

  it("creates a stable game-owned prefab catalog export", () => {
    const prefab = definePrefab({
      id: "test.arena.default",
      label: "Arena",
      category: "scene",
      description: "A reusable arena shell.",
      tags: ["test", "arena"],
      defaultProps: {
        width: 100,
      },
      configSchema: z.object({
        width: z.number().positive(),
      }),
      render: ({ width }) => width,
    });
    const catalog = createPrefabCatalog([prefab] as const);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.id).toBe("test.arena.default");
  });

  it("supports strongly typed prefab definitions without root-sdk exposure", () => {
    const prefab: PrefabDefinition<
      { width: number },
      ({ width }: { width: number }) => number
    > = definePrefab({
      id: "test.typed.default",
      label: "Typed",
      category: "prop",
      description: "A typed prefab definition.",
      tags: ["typed"],
      defaultProps: {
        width: 1,
      },
      configSchema: z.object({
        width: z.number().positive(),
      }),
      render: ({ width }) => width,
    });

    expect(prefab.render(prefab.defaultProps)).toBe(1);
  });
});
