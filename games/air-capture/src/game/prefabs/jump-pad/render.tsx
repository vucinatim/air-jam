import { JumpPad } from "../../components/entities/jump-pad";
import type { AirCaptureJumpPadPrefabProps } from "./schema";

export function AirCaptureJumpPad({
  id,
  position,
}: AirCaptureJumpPadPrefabProps) {
  return <JumpPad id={id} position={position} />;
}
