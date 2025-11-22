import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { ConnectionStatus, PlayerProfile } from "../protocol";
import { Badge } from "./ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";

interface AirJamOverlayProps {
  roomId: string;
  joinUrl: string;
  connectionStatus: ConnectionStatus;
  players: PlayerProfile[];
  lastError?: string;
}

const statusCopy: Record<ConnectionStatus, string> = {
  idle: "Idle",
  connecting: "Waiting for server…",
  connected: "Ready for controllers",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting…",
};

// Generate a consistent avatar URL for a player based on their ID
const getPlayerAvatarUrl = (playerId: string): string => {
  // Use DiceBear API with identicon style for GitHub-like avatars
  // The seed ensures the same player ID always gets the same avatar
  return `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(
    playerId
  )}`;
};

export const AirJamOverlay = ({
  roomId,
  joinUrl,
  connectionStatus,
  players,
  lastError,
}: AirJamOverlayProps): JSX.Element => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      width: 320,
    })
      .then((value) => {
        if (mounted) {
          setQrUrl(value);
          setQrError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setQrError(err.message);
        }
      });

    return () => {
      mounted = false;
    };
  }, [joinUrl]);

  const connectionVariant = useMemo<
    "default" | "secondary" | "destructive" | "outline"
  >(() => {
    switch (connectionStatus) {
      case "connected":
        return "default";
      case "connecting":
      case "reconnecting":
        return "secondary";
      default:
        return "destructive";
    }
  }, [connectionStatus]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
      <div className="pointer-events-auto w-full h-full flex flex-col justify-center backdrop-blur bg-background/10 gap-4">
        <CardHeader>
          <div className="flex flex-col items-center justify-between gap-2">
            <CardDescription className="text-xs uppercase tracking-[0.18em]">
              Room
            </CardDescription>
            <CardTitle className="text-3xl">{roomId}</CardTitle>
            <Badge variant={connectionVariant}>
              {statusCopy[connectionStatus]}
            </Badge>
            <span className="font-mono text-foreground mt-1 text-[10px]">
              {joinUrl}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex flex-col items-center justify-center">
          <div className="overflow-hidden w-40 border bg-card/80 rounded-lg">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={`Join room ${roomId}`}
                className="w-full bg-white"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {qrError ? `QR failed: ${qrError}` : "Generating QR code…"}
              </div>
            )}
          </div>

          <div className="w-full max-w-md">
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                Waiting for controllers…
              </p>
            ) : (
              <ul className="flex flex-wrap items-center justify-center gap-6">
                {players.map((player) => (
                  <li
                    key={player.id}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="relative">
                      <img
                        src={getPlayerAvatarUrl(player.id)}
                        alt={player.label}
                        className="w-16 h-16 rounded-full border-3 border-white shadow-lg bg-secondary/50"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-medium text-foreground text-center max-w-[100px] truncate">
                        {player.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {player.id.slice(0, 8)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lastError && (
            <Alert variant="destructive">
              <AlertDescription>{lastError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </div>
    </div>
  );
};
