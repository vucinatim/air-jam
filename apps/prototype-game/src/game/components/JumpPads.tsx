import { JumpPad } from "./JumpPad";
import { JUMP_PADS } from "../constants";

export function JumpPads() {
  return (
    <>
      {JUMP_PADS.map((pad) => (
        <JumpPad key={pad.id} id={pad.id} position={pad.position} />
      ))}
    </>
  );
}

