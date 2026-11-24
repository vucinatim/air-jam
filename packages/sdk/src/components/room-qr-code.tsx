import { create } from "qrcode";
import { useMemo, type CSSProperties, type JSX } from "react";

export interface RoomQrCodeProps {
  value: string;
  size?: number;
  padding?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

export const RoomQrCode = ({
  value,
  size = 180,
  padding = 1,
  foregroundColor = "#111111",
  backgroundColor = "#ffffff",
  errorCorrectionLevel = "M",
  className = "",
  style,
  alt = "Room join QR code",
}: RoomQrCodeProps): JSX.Element => {
  const trimmed = value.trim();
  const qr = useMemo(() => {
    if (!trimmed) return null;

    try {
      const { modules } = create(trimmed, { errorCorrectionLevel });
      let path = "";
      for (let row = 0; row < modules.size; row += 1) {
        for (let column = 0; column < modules.size; column += 1) {
          if (modules.data[row * modules.size + column]) {
            path += `M${column},${row}h1v1h-1z`;
          }
        }
      }
      return { path, size: modules.size };
    } catch {
      return null;
    }
  }, [trimmed, errorCorrectionLevel]);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        ...style,
      }}
      aria-live="polite"
      aria-label={alt}
    >
      {qr ? (
        <svg
          role="img"
          aria-label={alt}
          width={size}
          height={size}
          viewBox={`${-padding} ${-padding} ${qr.size + padding * 2} ${qr.size + padding * 2}`}
          shapeRendering="crispEdges"
          className="h-full w-full rounded-md"
        >
          <rect
            x={-padding}
            y={-padding}
            width={qr.size + padding * 2}
            height={qr.size + padding * 2}
            fill={backgroundColor}
          />
          <path d={qr.path} fill={foregroundColor} />
        </svg>
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-black/15 text-xs text-white/70">
          QR unavailable
        </div>
      )}
    </div>
  );
};
