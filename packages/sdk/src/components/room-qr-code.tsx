import { toDataURL } from "qrcode";
import { useEffect, useState, type CSSProperties, type JSX } from "react";

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
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!trimmed) {
      return;
    }

    let cancelled = false;

    void toDataURL(trimmed, {
      width: size,
      margin: padding,
      errorCorrectionLevel,
      color: {
        dark: foregroundColor,
        light: backgroundColor,
      },
    })
      .then((nextUrl) => {
        if (!cancelled) {
          setDataUrl(nextUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    backgroundColor,
    errorCorrectionLevel,
    foregroundColor,
    padding,
    size,
    trimmed,
  ]);

  const imageSrc = trimmed && dataUrl ? dataUrl : null;

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
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full rounded-md object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-black/15 text-xs text-white/70">
          QR unavailable
        </div>
      )}
    </div>
  );
};
