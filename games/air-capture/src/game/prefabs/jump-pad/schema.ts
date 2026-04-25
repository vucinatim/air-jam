import { z } from "zod";

export const airCaptureJumpPadPrefabSchema = z.object({
  id: z.string().min(1),
  position: z.tuple([z.number(), z.number(), z.number()]),
});

export type AirCaptureJumpPadPrefabProps = z.infer<
  typeof airCaptureJumpPadPrefabSchema
>;

export const AIR_CAPTURE_JUMP_PAD_DEFAULT_PROPS: AirCaptureJumpPadPrefabProps =
  airCaptureJumpPadPrefabSchema.parse({
    id: "jump-pad-preview",
    position: [0, 0, 0],
  });
