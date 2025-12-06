import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PhysicsReportDialog } from "../game/components/PhysicsReportDialog";
import { useGameStore } from "../game/game-store";
import { usePhysicsStore } from "../game/physics-store";

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
              className="bg-green-500 font-bold text-white hover:bg-green-600"
            >
              REC
            </Button>
            <Button
              onClick={() =>
                setCameraMode(cameraMode === "topdown" ? "follow" : "topdown")
              }
              className={
                cameraMode === "topdown"
                  ? "bg-purple-500 font-bold text-white hover:bg-purple-600"
                  : "bg-gray-500 font-bold text-white hover:bg-gray-600"
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
              className="animate-pulse bg-red-500 font-bold text-white hover:bg-red-600"
            >
              STOP
            </Button>
            <Button
              onClick={() =>
                setCameraMode(cameraMode === "topdown" ? "follow" : "topdown")
              }
              className={
                cameraMode === "topdown"
                  ? "bg-purple-500 font-bold text-white hover:bg-purple-600"
                  : "bg-gray-500 font-bold text-white hover:bg-gray-600"
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
              className="bg-green-500 font-bold text-white hover:bg-green-600"
            >
              REC
            </Button>
            <Button
              onClick={() => setShowReport(true)}
              className="bg-blue-500 font-bold text-white hover:bg-blue-600"
            >
              DATA
            </Button>
            <Button
              onClick={() =>
                setCameraMode(cameraMode === "topdown" ? "follow" : "topdown")
              }
              className={
                cameraMode === "topdown"
                  ? "bg-purple-500 font-bold text-white hover:bg-purple-600"
                  : "bg-gray-500 font-bold text-white hover:bg-gray-600"
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
