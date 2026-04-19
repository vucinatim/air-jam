import { z } from "zod";

export const airCaptureObstacleBlockPrefabSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number(),
  size: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
});

export type AirCaptureObstacleBlockPrefabProps = z.infer<
  typeof airCaptureObstacleBlockPrefabSchema
>;

export const AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS: AirCaptureObstacleBlockPrefabProps =
  airCaptureObstacleBlockPrefabSchema.parse({
    position: [0, 4, 0],
    rotationY: 0,
    size: [8, 8, 8],
  });
