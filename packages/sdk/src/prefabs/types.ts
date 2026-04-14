import type { ZodType } from "zod";

export type PrefabRenderFn<TProps, TRenderOutput = unknown> = (
  props: TProps,
) => TRenderOutput;

export interface PrefabPreviewDescriptor {
  summary: string;
  accentColor?: string;
  dimensions?: Record<string, number>;
  defaultVariant?: string;
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
  TRenderContract extends (...args: any[]) => unknown = PrefabRenderFn<TProps>,
> {
  id: string;
  label: string;
  category: string;
  description: string;
  tags: readonly string[];
  defaultProps: TProps;
  configSchema: ZodType<TProps>;
  render: TRenderContract;
  preview?: PrefabPreviewDescriptor;
  placement?: PrefabPlacementDescriptor;
}

export type PrefabCatalog = readonly PrefabDefinition<
  unknown,
  (...args: any[]) => unknown
>[];

export const definePrefab = <
  TProps,
  TRenderContract extends (...args: any[]) => unknown = PrefabRenderFn<TProps>,
>(
  definition: PrefabDefinition<TProps, TRenderContract>,
): PrefabDefinition<TProps, TRenderContract> => definition;

export const createPrefabCatalog = <
  const TPrefabs extends readonly PrefabDefinition<
    unknown,
    (...args: any[]) => unknown
  >[],
>(
  prefabs: TPrefabs,
): TPrefabs => prefabs;
