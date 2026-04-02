export type TaskType =
  | "computer"
  | "meeting"
  | "kitchen"
  | "printer"
  | "maintenance";
export type BreakroomActivity = "coffee" | "lunch" | "fifa" | "rest";

// Export task IDs as a union type derived from TASK_DEFINITIONS
export type TaskId =
  | "vibe-coding"
  | "coding"
  | "maili"
  | "opravek"
  | "bejzi-po-spejzo"
  | "odnesi-v-print"
  | "spuci-kavomat"
  | "hisninska-dela"
  | "sestanek-v-sejni"
  | "interni-sestanek"
  | "internet-down"
  | "narisi-strip";

/** Stat system constants */
export const STAT_CONSTANTS = {
  MAX_STAT: 100,
  ENERGY_DECAY_PER_SECOND: 2,
  BOREDOM_DECAY_MIN: 10,
  BOREDOM_DECAY_MAX: 20,
  BOREDOM_DECAY_INTERVAL_MIN_MS: 5000,
  BOREDOM_DECAY_INTERVAL_MAX_MS: 15000,
  COFFEE_ENERGY_RESTORE: 30,
  LUNCH_ENERGY_RESTORE: 50,
  FIFA_BOREDOM_RESTORE: 40,
  BREAKROOM_ACTIVITY_DURATION_MS: 3000,
  TASK_EXPIRY_MS: 45000,
} as const;

export interface TaskDefinition {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  reward: number;
  baseDurationMs: number;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  // Computer tasks
  {
    id: "vibe-coding",
    type: "computer",
    name: "Vibe coding",
    description: "Programiraj z vibrom",
    reward: 400,
    baseDurationMs: 10000,
  },
  {
    id: "coding",
    type: "computer",
    name: "Coding",
    description: "Napiši kodo",
    reward: 500,
    baseDurationMs: 10000,
  },
  {
    id: "maili",
    type: "computer",
    name: "Maili",
    description: "Pošlji e-pošto",
    reward: 450,
    baseDurationMs: 10000,
  },
  {
    id: "opravek",
    type: "computer",
    name: "Opravek",
    description: "Popravi napako",
    reward: 200,
    baseDurationMs: 10000,
  },

  // Kitchen tasks
  {
    id: "bejzi-po-spejzo",
    type: "kitchen",
    name: "Bejži po špejžo",
    description: "Pojdi po prigrizke",
    reward: 0,
    baseDurationMs: 10000,
  },

  // Printer tasks
  {
    id: "odnesi-v-print",
    type: "printer",
    name: "Odnesi v print",
    description: "Natisni dokumente",
    reward: 0,
    baseDurationMs: 10000,
  },

  // Kitchen tasks (coffee machine)
  {
    id: "spuci-kavomat",
    type: "kitchen",
    name: "Spuci kavomat",
    description: "Oper kavomat",
    reward: 0,
    baseDurationMs: 10000,
  },

  // Maintenance tasks
  {
    id: "hisninska-dela",
    type: "maintenance",
    name: "Hišniška dela",
    description: "Hišniška opravila",
    reward: 100,
    baseDurationMs: 10000,
  },

  // Meeting tasks
  {
    id: "sestanek-v-sejni",
    type: "meeting",
    name: "Sestanek v sejni",
    description: "Sestanek v sejni sobi",
    reward: 400,
    baseDurationMs: 10000,
  },
  {
    id: "interni-sestanek",
    type: "meeting",
    name: "Interni sestanek",
    description: "Notranji sestanek",
    reward: 250,
    baseDurationMs: 10000,
  },

  // Maintenance tasks (internet)
  {
    id: "internet-down",
    type: "maintenance",
    name: "Internet je down",
    description: "Popravi internet",
    reward: 250,
    baseDurationMs: 10000,
  },

  // Computer tasks (creative)
  {
    id: "narisi-strip",
    type: "computer",
    name: "Nariši strip",
    description: "Nariši strip",
    reward: 100,
    baseDurationMs: 10000,
  },
];

export interface Location {
  id: string;
  taskTypes: TaskType[];
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  image?: string;
}

export const LOCATIONS: Location[] = [
  // Soba sramote (Room of Shame) - bottom left, left table
  {
    id: "desk-sramote-1",
    taskTypes: ["computer"],
    x: 20,
    y: 150,
    width: 150,
    height: 110,
    label: "Programerska miza",
    image: "/items/coding-table-1.png",
  },
  // Soba sramote - right table
  {
    id: "desk-sramote-2",
    taskTypes: ["computer"],
    x: 220,
    y: 20,
    width: 110,
    height: 150,
    label: "Programerska miza",
    image: "/items/coding-table-2.png",
  },
  // Soba za jok (Room of Crying) - desk with printer, top left
  {
    id: "desk-jok",
    taskTypes: ["computer", "printer"],
    x: 570,
    y: 20,
    width: 110,
    height: 150,
    label: "Desk + Printer",
    image: "/items/table-printer.png",
  },
  // Sejna soba (Meeting Room) - meeting table, top right
  {
    id: "meeting-table",
    taskTypes: ["meeting"],
    x: 640,
    y: 400,
    width: 80,
    height: 120,
    label: "Meeting Table",
    image: "/items/meeting-table.png",
  },
  // Sejna soba - T2 box in corner for maintenance tasks
  {
    id: "t2-box",
    taskTypes: ["maintenance"],
    x: 740,
    y: 550,
    width: 50,
    height: 40,
    label: "T2",
    image: "/items/server.png",
  },
  // Hodnik - doors for kitchen tasks
  {
    id: "hodnik-door",
    taskTypes: ["kitchen"],
    x: 40,
    y: 390,
    width: 80,
    height: 30,
    label: "Doors",
    image: "/items/door.png",
  },
];

export const BREAKROOM_LOCATIONS: Location[] = [
  // Soba sramote - bean bag rest spot
  {
    id: "rest-sramote",
    taskTypes: [],
    x: 585,
    y: 240,
    width: 135,
    height: 60,
    label: "Rest",
    image: "/items/couch-1.png",
  },
  {
    id: "couch-sramote-2",
    taskTypes: [],
    x: 720,
    y: 200,
    width: 75,
    height: 100,
    label: "Couch",
    image: "/items/couch-2.png",
  },
  // Soba za jok - couch
  {
    id: "couch-jok",
    taskTypes: [],
    x: 20,
    y: 20,
    width: 65,
    height: 90,
    label: "Couch",
    image: "/items/beanbag.png",
  },

  // Kuhinja - coffee machine (also a task station)
  {
    id: "coffee-machine",
    taskTypes: ["kitchen"],
    x: 185,
    y: 440,
    width: 50,
    height: 140,
    label: "☕ Coffee",
    image: '/items/kitchen.png'
  },
  // Kuhinja - FIFA table
  {
    id: "fifa-table",
    taskTypes: [],
    x: 340,
    y: 430,
    width: 150,
    height: 35,
    label: "⚽ FIFA",
    image: "/items/fifa.png",
  },
  // Kuhinja - lunch area
  {
    id: "lunch-spot",
    taskTypes: [],
    x: 350,
    y: 525,
    width: 90,
    height: 60,
    label: "🥪 Lunch",
    image: "/items/kitchen-table.png",
  },

];

export interface ActiveTask {
  id: string;
  taskDefId: string;
  name: string;
  description: string;
  reward: number;
  locationId: string;
  spawnTime: number;
  durationMs: number;
}

export interface PlayerTask {
  playerId: string;
  task: ActiveTask;
  startTime: number;
}

export class TaskManager {
  private tasks: ActiveTask[] = [];
  private lastSpawnTime = 0;
  private spawnInterval = 4000;
  private taskIdCounter = 0;
  private playerTasks: PlayerTask[] = [];

  update(currentTime: number): ActiveTask[] {
    // Find expired tasks before filtering them out
    const expiredTasks = this.tasks.filter(
      (t) => currentTime - t.spawnTime >= STAT_CONSTANTS.TASK_EXPIRY_MS,
    );
    
    // Remove expired tasks
    this.tasks = this.tasks.filter(
      (t) => currentTime - t.spawnTime < STAT_CONSTANTS.TASK_EXPIRY_MS,
    );

    if (currentTime - this.lastSpawnTime > this.spawnInterval) {
      this.spawnTask();
      this.lastSpawnTime = currentTime;
    }
    
    return expiredTasks;
  }

  spawnTask() {
    const availableLocations = LOCATIONS.filter(
      (loc) => !this.tasks.some((t) => t.locationId === loc.id),
    );
    if (availableLocations.length === 0) return;

    const location =
      availableLocations[Math.floor(Math.random() * availableLocations.length)];
    const availableTasks = TASK_DEFINITIONS.filter((t) =>
      location.taskTypes.includes(t.type),
    );
    if (availableTasks.length === 0) return;

    const taskDef =
      availableTasks[Math.floor(Math.random() * availableTasks.length)];

    const task: ActiveTask = {
      id: `task-${++this.taskIdCounter}`,
      taskDefId: taskDef.id,
      name: taskDef.name,
      description: taskDef.description,
      reward: taskDef.reward,
      locationId: location.id,
      spawnTime: Date.now(),
      durationMs: taskDef.baseDurationMs,
    };

    this.tasks.push(task);
  }

  hasTaskAt(locationId: string): boolean {
    return this.tasks.some((t) => t.locationId === locationId);
  }

  getTaskAt(locationId: string): ActiveTask | undefined {
    return this.tasks.find((t) => t.locationId === locationId);
  }

  getTasks(): ActiveTask[] {
    return [...this.tasks];
  }

  startTask(playerId: string, locationId: string, durationMs: number): boolean {
    const task = this.tasks.find((t) => t.locationId === locationId);
    if (!task) return false;

    if (this.playerTasks.some((pt) => pt.playerId === playerId)) return false;

    const taskDef = TASK_DEFINITIONS.find((t) => t.id === task.taskDefId);
    if (!taskDef) return false;

    // Use the provided duration based on player's capability
    const adjustedTask = { ...task, durationMs };

    this.playerTasks.push({
      playerId,
      task: adjustedTask,
      startTime: Date.now(),
    });

    this.tasks = this.tasks.filter((t) => t.id !== task.id);
    return true;
  }

  updateTaskProgress(
    playerId: string,
  ): { progress: number; taskName: string } | null {
    const playerTask = this.playerTasks.find((pt) => pt.playerId === playerId);
    if (!playerTask) return null;

    const elapsed = Date.now() - playerTask.startTime;
    const progress = Math.min(elapsed / playerTask.task.durationMs, 1);
    return { progress, taskName: playerTask.task.name };
  }

  completeTask(playerId: string): { reward: number; name: string } | null {
    const playerTask = this.playerTasks.find((pt) => pt.playerId === playerId);
    if (!playerTask) return null;

    const elapsed = Date.now() - playerTask.startTime;
    const progress = elapsed / playerTask.task.durationMs;

    // Require progress >= 1 (100% complete)
    if (progress < 1) return null;

    this.playerTasks = this.playerTasks.filter(
      (pt) => pt.playerId !== playerId,
    );
    return { reward: playerTask.task.reward, name: playerTask.task.name };
  }

  cancelTask(playerId: string): void {
    const index = this.playerTasks.findIndex((pt) => pt.playerId === playerId);
    if (index !== -1) {
      this.playerTasks.splice(index, 1);
    }
  }

  isDoingTask(playerId: string): boolean {
    return this.playerTasks.some((pt) => pt.playerId === playerId);
  }

  getTaskProgress(playerId: string): number {
    const playerTask = this.playerTasks.find((pt) => pt.playerId === playerId);
    if (!playerTask) return 0;
    const elapsed = Date.now() - playerTask.startTime;
    return Math.min(elapsed / playerTask.task.durationMs, 1);
  }

  reset() {
    this.tasks = [];
    this.lastSpawnTime = 0;
    this.taskIdCounter = 0;
    this.playerTasks = [];
  }
}
