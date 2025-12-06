import { MonitorSmartphone, Pause, Play, QrCode, Settings } from "lucide-react";
import QRCode from "qrcode";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import type { ConnectionStatus, GameState, PlayerProfile } from "../protocol";
import { Alert, AlertDescription } from "./ui/alert";
import { Avatar, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { VolumeControls } from "./volume-controls";

interface AirJamOverlayProps {
  roomId: string;
  joinUrl: string;
  connectionStatus: ConnectionStatus;
  players: PlayerProfile[];
  lastError?: string;
  gameState: GameState;
  onTogglePlayPause?: () => void;
  isChildMode?: boolean;
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
    playerId,
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
  isChildMode = false,
}: AirJamOverlayProps): JSX.Element | null => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    // No need to generate QR in child mode
    if (isChildMode) return;

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
  }, [joinUrl, isChildMode]);

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

  // In Child Mode (Platform), we hide the overlay completely
  // because the Platform handles the UI/Header.
  if (isChildMode) return null;

  // Always render the navbar (unless child mode + playing)
  return (
    <>
      {/* Top Navbar - Always Visible */}
      {!isChildMode && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-99999">
          <div className="mx-auto w-full">
            <div className="flex items-center justify-between px-4 py-2">
              {/* Left: Room name */}
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                    Room
                  </p>
                  <p className="text-foreground text-lg font-semibold">
                    {roomId}
                  </p>
                </div>
              </div>

              {/* Right: Avatar stack and play/pause */}
              <div className="pointer-events-auto flex items-center gap-3">
                {/* Avatar stack */}
                {players.length > 0 && (
                  <div className="flex items-center -space-x-2">
                    {players.slice(0, 4).map((player) => (
                      <Avatar
                        key={player.id}
                        className="h-8 w-8 border-2"
                        style={{
                          borderColor: player.color || "hsl(var(--border))",
                        }}
                      >
                        <AvatarImage
                          src={getPlayerAvatarUrl(player.id)}
                          alt={player.label}
                        />
                      </Avatar>
                    ))}
                    {players.length > 4 && (
                      <div className="border-background bg-muted flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium">
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
      )}

      {/* Paused Overlay - Only visible when paused */}
      {gameState === "paused" && (
        <div className="pointer-events-none fixed inset-0 z-99998 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-2xl">
            <Card className="bg-card/20 flex h-[80vh] flex-col overflow-hidden border py-0 shadow-lg backdrop-blur-sm">
          <Tabs
            defaultValue={isChildMode ? "settings" : "room-code"}
            className="flex h-full w-full flex-col gap-0"
          >
            <TabsList className="border-border grid w-full shrink-0 grid-cols-2 rounded-none border-b bg-transparent p-0">
              {!isChildMode && (
                <TabsTrigger
                  value="room-code"
                  className="hover:bg-background/50 data-[state=active]:bg-background/50 flex items-center gap-2 rounded-none border-none bg-transparent"
                >
                  <QrCode className="h-4 w-4" />
                  Room Code
                </TabsTrigger>
              )}
              {isChildMode && (
                <TabsTrigger
                  value="info"
                  className="hover:bg-background/50 data-[state=active]:bg-background/50 flex items-center gap-2 rounded-none border-none bg-transparent"
                >
                  <MonitorSmartphone className="h-4 w-4" />
                  Platform
                </TabsTrigger>
              )}
              <TabsTrigger
                value="settings"
                className="hover:bg-background/50 data-[state=active]:bg-background/50 flex items-center gap-2 rounded-none border-none bg-transparent"
              >
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {!isChildMode && (
              <TabsContent
                value="room-code"
                className="mt-0 min-h-0 flex-1 overflow-y-auto"
              >
                <div className="space-y-6 pb-6">
                  <CardHeader className="pt-6 text-center">
                    <CardTitle className="text-4xl font-bold tracking-wider">
                      {roomId}
                    </CardTitle>
                    <Badge variant={connectionVariant} className="mx-auto mt-3">
                      {statusCopy[connectionStatus]}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                      <CardDescription className="text-xs tracking-[0.18em] uppercase">
                        Join URL
                      </CardDescription>
                      <p className="text-muted-foreground text-center font-mono text-xs break-all">
                        {joinUrl}
                      </p>

                      <div className="border-border bg-card w-48 overflow-hidden rounded-lg border-2 shadow-md">
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt={`Join room ${roomId}`}
                            className="w-full rounded bg-white"
                          />
                        ) : (
                          <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
                            {qrError
                              ? `QR failed: ${qrError}`
                              : "Generating QR code…"}
                          </div>
                        )}
                      </div>

                      <div className="w-full">
                        {players.length === 0 ? (
                          <p className="text-muted-foreground py-4 text-center text-sm">
                            Waiting for controllers to join…
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-foreground text-center text-sm font-medium">
                              Connected Players ({players.length})
                            </p>
                            <ul className="flex flex-wrap items-center justify-center gap-4">
                              {players.map((player) => (
                                <li
                                  key={player.id}
                                  className="flex flex-col items-center gap-2"
                                >
                                  <img
                                    src={getPlayerAvatarUrl(player.id)}
                                    alt={player.label}
                                    className="bg-secondary/30 h-16 w-16 rounded-full border-4 shadow-md"
                                    style={{
                                      borderColor:
                                        player.color || "hsl(var(--border))",
                                    }}
                                  />
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-card-foreground max-w-[100px] truncate text-center text-sm font-medium">
                                      {player.label}
                                    </span>
                                    <span className="text-muted-foreground font-mono text-xs">
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
                        <div className="pt-2">
                          <Button
                            type="button"
                            onClick={onTogglePlayPause}
                            size="lg"
                          >
                            <Play className="mr-2 h-5 w-5" />
                            Start Game
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </TabsContent>
            )}

            {isChildMode && (
              <TabsContent
                value="info"
                className="mt-0 min-h-0 flex-1 overflow-y-auto"
              >
                <div className="space-y-6 pb-6">
                  <CardHeader className="pt-6 text-center">
                    <CardTitle className="text-2xl font-bold tracking-wider">
                      Connected to Platform
                    </CardTitle>
                    <CardDescription className="mt-2">
                      This game is running inside the Air Jam Platform.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-full">
                        <div className="space-y-3">
                          <p className="text-foreground text-center text-sm font-medium">
                            Connected Players ({players.length})
                          </p>
                          <ul className="flex flex-wrap items-center justify-center gap-4">
                            {players.map((player) => (
                              <li
                                key={player.id}
                                className="flex flex-col items-center gap-2"
                              >
                                <img
                                  src={getPlayerAvatarUrl(player.id)}
                                  alt={player.label}
                                  className="bg-secondary/30 h-16 w-16 rounded-full border-4 shadow-md"
                                  style={{
                                    borderColor:
                                      player.color || "hsl(var(--border))",
                                  }}
                                />
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-card-foreground max-w-[100px] truncate text-center text-sm font-medium">
                                    {player.label}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Play button in paused state */}
                      {onTogglePlayPause && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            onClick={onTogglePlayPause}
                            size="lg"
                          >
                            <Play className="mr-2 h-5 w-5" />
                            Resume Game
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </TabsContent>
            )}

            <TabsContent
              value="settings"
              className="mt-0 min-h-0 flex-1 overflow-y-auto"
            >
              <CardContent className="pt-6 pb-6">
                <div className="space-y-6">
                  {/* Audio Controls Section */}
                  <div className="space-y-4">
                    <VolumeControls />
                  </div>

                  {/* Connection Settings Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-semibold">Connection</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">
                          Status
                        </span>
                        <Badge variant={connectionVariant}>
                          {statusCopy[connectionStatus]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">
                          Room ID
                        </span>
                        <span className="font-mono text-sm">{roomId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">
                          Players
                        </span>
                        <span className="text-sm font-medium">
                          {players.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Display Settings Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-semibold">Display</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">
                          Game State
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {gameState}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
        </div>
      )}
    </>
  );
};
