import type { PongArenaPrefabProps } from "./schema";

interface PaintPongArenaOptions {
  showBounds?: boolean;
}

export const paintPongArena = (
  ctx: CanvasRenderingContext2D,
  props: PongArenaPrefabProps,
  options: PaintPongArenaOptions = {},
): void => {
  ctx.fillStyle = props.backgroundColor;
  ctx.fillRect(0, 0, props.fieldWidth, props.fieldHeight);

  ctx.setLineDash([5, 15]);
  ctx.beginPath();
  ctx.moveTo(props.fieldWidth / 2, 0);
  ctx.lineTo(props.fieldWidth / 2, props.fieldHeight);
  ctx.strokeStyle = props.centerLineColor;
  ctx.stroke();

  if (options.showBounds) {
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.strokeRect(0.5, 0.5, props.fieldWidth - 1, props.fieldHeight - 1);
  }
};
