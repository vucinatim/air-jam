
import { useAbilitiesStore } from "./abilities-store";
import { usePlayerStatsStore } from "./player-stats-store";
import "./abilities/speed-boost"; // Register the ability

const controllerId = "test-controller";

async function runTest() {
  console.log("Starting Boost Ability Test");

  // 1. Initialize stats
  usePlayerStatsStore.getState().initializeStats(controllerId);
  console.log("Initial Speed Multiplier:", usePlayerStatsStore.getState().getSpeedMultiplier(controllerId));

  // 2. Give ability
  useAbilitiesStore.getState().collectAbility(controllerId, "speed_boost");
  const ability = useAbilitiesStore.getState().getAbility(controllerId);
  console.log("Ability given:", ability?.id);

  if (!ability) {
    console.error("Failed to give ability");
    return;
  }

  // 3. Activate ability
  console.log("Activating ability...");
  useAbilitiesStore.getState().activateAbility(controllerId, "speed_boost");

  // 4. Check stats
  const multiplier = usePlayerStatsStore.getState().getSpeedMultiplier(controllerId);
  console.log("Speed Multiplier after activation:", multiplier);

  if (multiplier !== 1.5) {
    console.error("FAIL: Speed multiplier should be 1.5, but is", multiplier);
  } else {
    console.log("PASS: Speed multiplier is 1.5");
  }

  // 5. Check active state
  const isActive = useAbilitiesStore.getState().isAbilityActive(controllerId);
  console.log("Is Ability Active:", isActive);

  // 6. Simulate expiration (wait 5 seconds? or manually clear)
  // We can't easily wait 5 seconds in this script if we want it fast, but we can check if clearAbility works.
  
  console.log("Clearing ability...");
  useAbilitiesStore.getState().clearAbility(controllerId);

  const multiplierAfter = usePlayerStatsStore.getState().getSpeedMultiplier(controllerId);
  console.log("Speed Multiplier after clear:", multiplierAfter);

  if (multiplierAfter !== 1.0) {
    console.error("FAIL: Speed multiplier should be 1.0, but is", multiplierAfter);
  } else {
    console.log("PASS: Speed multiplier reset to 1.0");
  }
}

runTest().catch(console.error);
