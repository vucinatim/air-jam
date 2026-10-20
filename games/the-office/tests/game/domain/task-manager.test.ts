import { describe, expect, it } from "vitest";
import {
  STAT_CONSTANTS,
  TaskManager,
} from "../../../src/game/domain/task-manager";

describe("TaskManager", () => {
  it("uses caller-provided match time for task progress and completion", () => {
    const taskManager = new TaskManager();
    taskManager.spawnTask(100, () => 0);

    const task = taskManager.getTasks()[0];
    expect(task?.spawnTime).toBe(100);

    const started = taskManager.startTask(
      "player-1",
      task.locationId,
      10000,
      500,
    );
    expect(started).toBe(true);

    expect(taskManager.getTaskProgress("player-1", 5500)).toBe(0.5);
    expect(taskManager.completeTask("player-1", 10499)).toBeNull();
    expect(taskManager.completeTask("player-1", 10500)).toEqual({
      reward: task.reward,
      name: task.name,
    });
  });

  it("expires pending tasks against caller-provided match time", () => {
    const taskManager = new TaskManager();
    taskManager.spawnTask(0, () => 0);

    expect(
      taskManager.update(STAT_CONSTANTS.TASK_EXPIRY_MS - 1, () => 0),
    ).toEqual([]);
    expect(
      taskManager.update(STAT_CONSTANTS.TASK_EXPIRY_MS, () => 0),
    ).toHaveLength(1);
  });
});
