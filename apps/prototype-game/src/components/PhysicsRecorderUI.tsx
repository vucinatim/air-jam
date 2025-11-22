import { useState } from "react";
import { PhysicsReportDialog } from "../game/components/PhysicsReportDialog";
import { usePhysicsStore } from "../game/physics-store";
import { useGameStore } from "../game/game-store";
import { Button } from "@/components/ui/button";

export function PhysicsRecorderUI() {
  const isRecording = usePhysicsStore((state) => state.isRecording);
  const recordedFrames = usePhysicsStore((state) => state.recordedFrames);
  const startRecording = usePhysicsStore((state) => state.startRecording);
  const stopRecording = usePhysicsStore((state) => state.stopRecording);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const setCameraMode = useGameStore((state) => state.setCameraMode);
  const [showReport, setShowReport] = useState(false);

  return (
    <>
      <div className="absolute top-20 right-4 z-50 flex gap-2">
        {!isRecording && recordedFrames.length === 0 && (
          <>
            <Button
              onClick={startRecording}
              className="bg-green-500 hover:bg-green-600 text-white font-bold"
            >
              REC
            </Button>
            <Button
              onClick={() =>
                setCameraMode(cameraMode === "topdown" ? "follow" : "topdown")
              }
              className={
                cameraMode === "topdown"
                  ? "bg-purple-500 hover:bg-purple-600 text-white font-bold"
                  : "bg-gray-500 hover:bg-gray-600 text-white font-bold"
              }
            >
              {cameraMode === "topdown" ? "FOLLOW" : "ARENA"}
            </Button>
          </>
        )}

        {isRecording && (
          <>
            <Button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white font-bold animate-pulse"
            >
              STOP
            </Button>
            <Button
              onClick={() =>
                setCameraMode(cameraMode === "topdown" ? "follow" : "topdown")
              }
              className={
                cameraMode === "topdown"
                  ? "bg-purple-500 hover:bg-purple-600 text-white font-bold"
                  : "bg-gray-500 hover:bg-gray-600 text-white font-bold"
              }
            >
              {cameraMode === "topdown" ? "FOLLOW" : "ARENA"}
            </Button>
          </>
        )}

        {!isRecording && recordedFrames.length > 0 && (
          <>
            <Button
              onClick={startRecording}
              className="bg-green-500 hover:bg-green-600 text-white font-bold"
            >
              REC
            </Button>
            <Button
              onClick={() => setShowReport(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold"
            >
              DATA
            </Button>
            <Button
              onClick={() =>
                setCameraMode(cameraMode === "topdown" ? "follow" : "topdown")
              }
              className={
                cameraMode === "topdown"
                  ? "bg-purple-500 hover:bg-purple-600 text-white font-bold"
                  : "bg-gray-500 hover:bg-gray-600 text-white font-bold"
              }
            >
              {cameraMode === "topdown" ? "FOLLOW" : "ARENA"}
            </Button>
          </>
        )}
      </div>

      {showReport && (
        <PhysicsReportDialog
          frames={recordedFrames}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
