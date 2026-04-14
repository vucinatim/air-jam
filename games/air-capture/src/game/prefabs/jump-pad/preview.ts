import { JUMP_PAD_RADIUS } from "../../constants";

export const AIR_CAPTURE_JUMP_PAD_PREVIEW = {
  summary: "A reusable jump pad that launches ships vertically for traversal and routing.",
  accentColor: "#ff8800",
  dimensions: {
    radius: JUMP_PAD_RADIUS,
    height: 6,
  },
} as const;
