import {
  Check,
  Copy,
  ExternalLink,
  MonitorSmartphone,
  Pause,
  Play,
  QrCode,
  Settings,
} from "lucide-react";
import QRCode from "qrcode";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAirJamHost } from "../hooks/use-air-jam-host";
import type { ConnectionStatus } from "../protocol";
import { PlayerAvatar } from "./player-avatar";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { VolumeControls } from "./volume-controls";

const statusCopy: Record<ConnectionStatus, string> = {
  idle: "Idle",
  connecting: "Waiting for server…",
  connected: "Ready for controllers",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting…",
};

export const AirJamOverlay = (): JSX.Element | null => {
  const host = useAirJamHost();
  const {
    roomId,
    joinUrl,
    connectionStatus,
    players,
    lastError,
    gameState,
    toggleGameState,
    isChildMode,
  } = host;
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);

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

  const handleCopyUrl = async (): Promise<void> => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = joinUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  };

  const handleOpenInNewTab = (): void => {
    if (joinUrl) {
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyPlayerId = async (playerId: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(playerId);
      console.log(`Copied player ID: ${playerId}`);
      setCopiedPlayerId(playerId);
      setTimeout(() => setCopiedPlayerId(null), 1000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = playerId;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        console.log(`Copied player ID: ${playerId}`);
        setCopiedPlayerId(playerId);
        setTimeout(() => setCopiedPlayerId(null), 1000);
      } catch {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  };

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
    <div className="dark">
      {/* Top Navbar - Always Visible */}
      {!isChildMode && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-99999">
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
                      <PlayerAvatar key={player.id} player={player} size="sm" />
                    ))}
                    {players.length > 4 && (
                      <div className="border-background bg-muted flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium">
                        +{players.length - 4}
                      </div>
                    )}
                  </div>
                )}

                {/* Play/Pause button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleGameState}
                  aria-label={gameState === "playing" ? "Pause" : "Play"}
                  className="h-8 w-8"
                >
                  {gameState === "playing" ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paused Overlay - Only visible when paused */}
      {gameState === "paused" && (
        <div className="pointer-events-none fixed inset-0 z-99998 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-2xl">
            <Card className="bg-card/20 flex max-h-[85vh] flex-col overflow-hidden border py-0 shadow-lg backdrop-blur-sm">
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
                    <div className="p-6">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
                        {/* Left: QR Code Section */}
                        <div className="flex flex-col items-start gap-4">
                          <div className="space-y-2">
                            <CardTitle className="text-3xl font-bold tracking-wider">
                              {roomId}
                            </CardTitle>
                            <Badge
                              variant={connectionVariant}
                              className="w-fit"
                            >
                              {statusCopy[connectionStatus]}
                            </Badge>
                          </div>

                          <div className="border-border bg-card w-48 shrink-0 overflow-hidden rounded-lg border-2 shadow-md">
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
                        </div>

                        {/* Right: Info Section */}
                        <div className="flex flex-col gap-6">
                          <div className="space-y-3">
                            <CardDescription className="text-xs tracking-[0.18em] uppercase">
                              Join URL
                            </CardDescription>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={joinUrl}
                                className="bg-background border-input text-foreground focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopyUrl}
                                className="h-10 shrink-0"
                                aria-label="Copy join URL"
                              >
                                {copied ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleOpenInNewTab}
                                className="h-10 shrink-0"
                                aria-label="Open join URL in new tab"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {players.length === 0 ? (
                              <p className="text-sm text-white">
                                Waiting for controllers to join…
                              </p>
                            ) : (
                              <>
                                <p className="text-foreground text-sm font-medium">
                                  Connected Players ({players.length})
                                </p>
                                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {players.map((player) => (
                                    <li
                                      key={player.id}
                                      className="flex min-w-0 flex-col items-start gap-2"
                                    >
                                      <div className="flex w-full min-w-0 items-center gap-2">
                                        <PlayerAvatar
                                          player={player}
                                          size="md"
                                        />
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                                          <span className="text-card-foreground truncate text-sm font-medium">
                                            {player.label}
                                          </span>
                                          <div
                                            onClick={() =>
                                              handleCopyPlayerId(player.id)
                                            }
                                            className="text-muted-foreground m-0 inline min-w-0 cursor-pointer truncate border-0 font-mono text-xs transition-colors hover:text-white"
                                            title="Click to copy player ID"
                                          >
                                            {copiedPlayerId === player.id
                                              ? "Copied!"
                                              : player.id.slice(0, 8)}
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>

                          {lastError && (
                            <Alert variant="destructive" className="w-full">
                              <AlertDescription>{lastError}</AlertDescription>
                            </Alert>
                          )}

                          {/* Play button - bottom right */}
                          <div className="mt-auto flex justify-end">
                            <Button
                              type="button"
                              onClick={toggleGameState}
                              size="lg"
                            >
                              <Play className="mr-2 h-5 w-5" />
                              Start Game
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )}

                {isChildMode && (
                  <TabsContent
                    value="info"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto"
                  >
                    <div className="p-6">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <CardTitle className="text-2xl font-bold tracking-wider">
                            Connected to Platform
                          </CardTitle>
                          <CardDescription>
                            This game is running inside the Air Jam Platform.
                          </CardDescription>
                        </div>

                        <div className="space-y-3">
                          <p className="text-foreground text-sm font-medium">
                            Connected Players ({players.length})
                          </p>
                          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {players.map((player) => (
                              <li
                                key={player.id}
                                className="flex min-w-0 flex-col items-start gap-2"
                              >
                                <div className="flex w-full min-w-0 items-center gap-2">
                                  <PlayerAvatar player={player} size="md" />
                                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                                    <span className="text-card-foreground truncate text-sm font-medium">
                                      {player.label}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Play button in paused state */}
                        <div className="pt-2">
                          <Button
                            type="button"
                            onClick={toggleGameState}
                            size="lg"
                          >
                            <Play className="mr-2 h-5 w-5" />
                            Resume Game
                          </Button>
                        </div>
                      </div>
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
    </div>
  );
};
