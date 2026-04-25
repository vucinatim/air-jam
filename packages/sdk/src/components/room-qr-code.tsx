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
  const qrKey = `${trimmed}\0${size}\0${padding}\0${foregroundColor}\0${backgroundColor}\0${errorCorrectionLevel}`;
  const [qrState, setQrState] = useState<{
    key: string | null;
    dataUrl: string | null;
    error: boolean;
  }>({
    key: null,
    dataUrl: null,
    error: false,
  });

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
      .then((nextUrl: string) => {
        if (!cancelled) {
          setQrState({
            key: qrKey,
            dataUrl: nextUrl,
            error: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrState({
            key: qrKey,
            dataUrl: null,
            error: true,
          });
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
    qrKey,
    trimmed,
  ]);

  const imageSrc =
    trimmed && qrState.key === qrKey && qrState.dataUrl
      ? qrState.dataUrl
      : null;
  const isLoading = !!trimmed && qrState.key !== qrKey;
  const isUnavailable = !trimmed || (qrState.key === qrKey && qrState.error);

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
      ) : isLoading ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-md bg-black/15 text-xs text-white/70">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span>Generating QR…</span>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-black/15 text-xs text-white/70">
          {isUnavailable ? "QR unavailable" : "Generating QR…"}
        </div>
      )}
    </div>
  );
};
