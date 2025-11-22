
import { io } from "socket.io-client";
import { spawn } from "child_process";

const SERVER_PORT = 4002;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const ROOM_ID = "HBEAT";
const CONTROLLER_ID = "CTRL_HB";

async function run() {
  console.log("Starting isolated server on port " + SERVER_PORT + "...");
  const serverProcess = spawn("npx", ["tsx", "packages/server/src/index.ts"], {
    env: { ...process.env, PORT: String(SERVER_PORT) },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  // Wait for server to be ready
  await new Promise<void>((resolve) => {
    serverProcess.stdout.on("data", (data) => {
      console.log(`[Server]: ${data}`);
      if (data.toString().includes("listening")) {
        resolve();
      }
    });
    serverProcess.stderr.on("data", (data) => {
      console.error(`[Server Error]: ${data}`);
    });
  });

  try {
    console.log("Connecting Host...");
    const hostSocket = io(SERVER_URL, {
      transports: ["websocket"],
      query: { role: "host" },
    });

    await new Promise<void>((resolve) => {
      hostSocket.on("connect", () => {
        console.log("Host connected");
        resolve();
      });
    });

    console.log("Registering Host...");
    hostSocket.emit(
      "host:register",
      { roomId: ROOM_ID, maxPlayers: 4 },
      () => {}
    );

    console.log("Connecting Controller...");
    // Use a separate process for controller so we can kill it
    const controllerProcess = spawn("node", ["-e", `
      const { io } = require("socket.io-client");
      const socket = io("${SERVER_URL}", {
        transports: ["websocket"],
        query: { role: "controller" }
      });
      socket.on("connect", () => {
        socket.emit("controller:join", { roomId: "${ROOM_ID}", controllerId: "${CONTROLLER_ID}" }, () => {});
      });
    `], {
      cwd: process.cwd(), // Ensure it can find socket.io-client in node_modules
      stdio: "inherit"
    });

    // Wait for controller to join
    await new Promise<void>((resolve) => {
      hostSocket.on("server:controller_joined", () => {
        console.log("Controller joined detected by host");
        resolve();
      });
    });

    console.log("Killing controller process to simulate crash...");
    const startTime = Date.now();
    controllerProcess.kill("SIGKILL");

    console.log("Waiting for disconnection detection...");
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for disconnect (>20s)")), 20000);
      
      hostSocket.on("server:controller_left", (payload: any) => {
        if (payload.controllerId === CONTROLLER_ID) {
          const duration = Date.now() - startTime;
          console.log(`Disconnection detected in ${duration}ms`);
          clearTimeout(timeout);
          if (duration < 8000) {
             console.log("SUCCESS: Detection was fast (<8s)");
             resolve();
          } else {
             // We resolve anyway to see the time, but log a warning if it's slow
             console.warn(`WARNING: Detection took ${duration}ms, which is > 8s`);
             resolve();
          }
        }
      });
    });

  } finally {
    serverProcess.kill();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
