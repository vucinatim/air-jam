import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { ConnectionStatus, GameState, PlayerProfile } from "../protocol";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Avatar, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Play, Pause } from "lucide-react";

interface AirJamOverlayProps {
  roomId: string;
  joinUrl: string;
  connectionStatus: ConnectionStatus;
  players: PlayerProfile[];
  lastError?: string;
  gameState: GameState;
  onTogglePlayPause?: () => void;
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
  gameState,
  onTogglePlayPause,
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

  // Playing mode: thin navbar at top
  if (gameState === "playing") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20">
        <div className="pointer-events-auto mx-auto w-full">
          <div className="flex items-center justify-between px-4 py-2">
            {/* Left: Room name */}
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Room
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {roomId}
                </p>
              </div>
            </div>

            {/* Right: Avatar stack and play/pause */}
            <div className="flex items-center gap-3">
              {/* Avatar stack */}
              {players.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {players.slice(0, 4).map((player) => (
                    <Avatar
                      key={player.id}
                      className="h-8 w-8 border-2 border-background"
                    >
                      <AvatarImage
                        src={getPlayerAvatarUrl(player.id)}
                        alt={player.label}
                      />
                    </Avatar>
                  ))}
                  {players.length > 4 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                      +{players.length - 4}
                    </div>
                  )}
                </div>
              )}

              {/* Play/Pause button */}
              {onTogglePlayPause && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onTogglePlayPause}
                  aria-label={gameState === "playing" ? "Pause" : "Play"}
                  className="h-8 w-8"
                >
                  {gameState === "playing" ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Paused mode: full overlay
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl">
        <Card className="border shadow-lg bg-card/20 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardDescription className="text-xs uppercase tracking-[0.18em]">
              Room Code
            </CardDescription>
            <CardTitle className="text-4xl font-bold tracking-wider mt-2">
              {roomId}
            </CardTitle>
            <Badge variant={connectionVariant} className="mt-3 mx-auto">
              {statusCopy[connectionStatus]}
            </Badge>
            <p className="font-mono text-xs text-muted-foreground mt-4 break-all">
              {joinUrl}
            </p>
          </CardHeader>

          <CardContent className="space-y-6 flex flex-col items-center">
            <div className="overflow-hidden w-48 border-2 border-border bg-card rounded-lg shadow-md">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`Join room ${roomId}`}
                  className="w-full bg-white rounded"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  {qrError ? `QR failed: ${qrError}` : "Generating QR code…"}
                </div>
              )}
            </div>

            <div className="w-full">
              {players.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Waiting for controllers to join…
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground text-center">
                    Connected Players ({players.length})
                  </p>
                  <ul className="flex flex-wrap items-center justify-center gap-4">
                    {players.map((player) => (
                      <li
                        key={player.id}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="relative">
                          <img
                            src={getPlayerAvatarUrl(player.id)}
                            alt={player.label}
                            className="w-16 h-16 rounded-full border-2 border-border shadow-md bg-secondary/30"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-medium text-card-foreground text-center max-w-[100px] truncate">
                            {player.label}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {player.id.slice(0, 8)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {lastError && (
              <Alert variant="destructive" className="w-full">
                <AlertDescription>{lastError}</AlertDescription>
              </Alert>
            )}

            {/* Play button in paused state */}
            {onTogglePlayPause && (
              <div className="w-full pt-2">
                <Button
                  type="button"
                  onClick={onTogglePlayPause}
                  className="w-full"
                  size="lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Game
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
