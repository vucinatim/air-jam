import { useSendSignal, useSimulationEvents } from "@air-jam/sdk";
import { useHostAudio } from "../../game/audio/use-host-audio";
import type { AirCaptureEvent } from "../../game/simulation/state";

/** Plays the match's sounds on the host and its haptics on players' phones. */
export function useAirCaptureFeedback(): void {
  const audio = useHostAudio();
  const sendSignal = useSendSignal();
  useSimulationEvents<AirCaptureEvent>((event) => {
    if (event.type === "sound") audio.play(event.sound);
    else if (event.type === "haptic")
      sendSignal("HAPTIC", { pattern: event.pattern }, event.controllerId);
  });
}
