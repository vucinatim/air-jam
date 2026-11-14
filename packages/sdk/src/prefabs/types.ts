import { z, type ZodType } from "zod";

export type PrefabRenderFn<TProps, TRenderOutput = unknown> = (
  props: TProps,
) => TRenderOutput;

export interface PrefabPreviewDescriptor {
  summary: string;
  accentColor?: string;
  dimensions?: Record<string, number>;
  defaultVariant?: string;
  camera?: {
    position: readonly [number, number, number];
    target: readonly [number, number, number];
    fov?: number;
  };
}

export interface PrefabBoundsDescriptor {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
}

export interface PrefabFootprintDescriptor {
  kind: "box" | "circle" | "custom";
  width?: number;
  depth?: number;
  radius?: number;
}

export type PrefabPlacementOrigin = "center" | "ground" | "base" | "custom";

export interface PrefabPlacementDescriptor {
  origin: PrefabPlacementOrigin;
  bounds?: PrefabBoundsDescriptor;
  footprint?: PrefabFootprintDescriptor;
}

export interface PrefabDefinition<
  TProps,
  TRenderContract extends (...args: never[]) => unknown =
    PrefabRenderFn<TProps>,
> {
  id: string;
  label: string;
  category: string;
  description: string;
  tags: readonly string[];
  space: "2d" | "3d";
  states?: readonly PrefabState[];
  defaultProps: TProps;
  configSchema: ZodType<TProps>;
  render?: TRenderContract;
  preview?: PrefabPreviewDescriptor;
  placement?: PrefabPlacementDescriptor;
}

export type PrefabCatalog = readonly PrefabDefinition<
  unknown,
  (...args: never[]) => unknown
>[];

export const definePrefab = <
  const TDefinition extends PrefabDefinition<
    unknown,
    (...args: never[]) => unknown
  >,
>(
  definition: TDefinition,
): TDefinition => definition;

export const createPrefabCatalog = <
  const TPrefabs extends readonly PrefabDefinition<
    unknown,
    (...args: never[]) => unknown
  >[],
>(
  prefabs: TPrefabs,
): TPrefabs => {
  prefabCatalogMetadataSchema.parse(prefabs.map(prefabMetadata));
  for (const prefab of prefabs) prefab.configSchema.parse(prefab.defaultProps);
  return prefabs;
};

export const prefabStateSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    seconds: z.number().positive().finite().optional(),
    loop: z.boolean().optional(),
  })
  .strict();
export type PrefabState = z.infer<typeof prefabStateSchema>;
export const STATIC_PREFAB_STATE: PrefabState = {
  id: "static",
  label: "Static",
};
export const prefabMetadataSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    category: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    space: z.enum(["2d", "3d"]),
    states: z.array(prefabStateSchema).min(1),
    defaultState: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.states.map((state) => state.id)).size !==
        value.states.length ||
      !value.states.some((state) => state.id === value.defaultState)
    )
      context.addIssue({
        code: "custom",
        message: "States must be unique and include defaultState.",
      });
  });
export type PrefabMetadata = z.infer<typeof prefabMetadataSchema>;
export const prefabCatalogMetadataSchema = z
  .array(prefabMetadataSchema)
  .superRefine((catalog, context) => {
    if (new Set(catalog.map((prefab) => prefab.id)).size !== catalog.length)
      context.addIssue({
        code: "custom",
        message: "Prefab ids must be unique.",
      });
  });
export function prefabMetadata(prefab: PrefabCatalog[number]): PrefabMetadata {
  const states =
    prefab.states === undefined ? [STATIC_PREFAB_STATE] : [...prefab.states];
  return prefabMetadataSchema.parse({
    id: prefab.id,
    label: prefab.label,
    category: prefab.category,
    description: prefab.description,
    tags: [...prefab.tags],
    space: prefab.space,
    states,
    defaultState: states[0]?.id,
  });
}
