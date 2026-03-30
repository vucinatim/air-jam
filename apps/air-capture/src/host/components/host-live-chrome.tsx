import { Settings2, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import {
  HostMuteButton,
  type HostConnectionStatus,
} from "./host-overlays";

export const HostLiveChrome = ({
  roomId,
  connectionStatus,
  audioMuted,
  onToggleAudio,
  isEditorOpen,
  onToggleEditor,
}: {
  roomId: string | null;
  connectionStatus: HostConnectionStatus;
  audioMuted: boolean;
  onToggleAudio: () => void;
  isEditorOpen: boolean;
  onToggleEditor: () => void;
}) => {
  return (
    <>
      <div className="absolute top-4 right-4 left-4 z-50 flex items-center justify-end gap-3 text-xs uppercase">
        <div className="mr-auto flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connectionStatus === "connected"
                ? "bg-emerald-400"
                : connectionStatus === "connecting" ||
                    connectionStatus === "reconnecting"
                  ? "bg-amber-300"
                  : "bg-rose-400"
            }`}
          />
          <span className="text-white/90">
            Room <span className="font-semibold tracking-wider">{roomId || "----"}</span>
          </span>
        </div>
        <HostMuteButton muted={audioMuted} onToggle={onToggleAudio} />
      </div>

      <div className="absolute top-14 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleEditor}
          className="bg-background/80 backdrop-blur-sm"
        >
          {isEditorOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Settings2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </>
  );
};

export const HostEditorPanel = ({
  isOpen,
  title,
  children,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="border-border bg-background absolute top-0 right-0 z-40 flex h-full w-1/2 flex-col border-l">
      <div className="border-border shrink-0 border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
};
