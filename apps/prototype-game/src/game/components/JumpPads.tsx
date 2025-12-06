import { JUMP_PADS } from "../constants";
import { JumpPad } from "./JumpPad";

export function JumpPads() {
  return (
    <>
      {JUMP_PADS.map((pad) => (
        <JumpPad key={pad.id} id={pad.id} position={pad.position} />
      ))}
    </>
  );
}
