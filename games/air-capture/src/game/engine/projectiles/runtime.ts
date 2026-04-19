import { Object3D } from "three";

export interface ProjectileRuntimeTargets {
  ships: Object3D[];
  obstacles: Object3D[];
}

export interface ControllerTaggedRigidBody {
  userData?: unknown;
  translation(): { x: number; y: number; z: number };
  applyImpulse(
    impulse: { x: number; y: number; z: number },
    wakeUp: boolean,
  ): void;
}

export interface ControllerRigidBodyWorld {
  bodies: {
    forEach(callback: (body: ControllerTaggedRigidBody) => void): void;
  };
}

export function collectProjectileRuntimeTargets(
  scene: Object3D,
  excludedControllerId: string,
): ProjectileRuntimeTargets {
  const targets: ProjectileRuntimeTargets = {
    ships: [],
    obstacles: [],
  };

  scene.traverse((object) => {
    if (
      object.userData?.type === "obstacle" ||
      object.userData?.type === "ground" ||
      object.userData?.isObstacle
    ) {
      targets.obstacles.push(object);
    }

    if (
      object.userData?.gameplayHitbox === true &&
      object.userData?.controllerId &&
      object.userData.controllerId !== excludedControllerId
    ) {
      targets.ships.push(object);
    }
  });

  return targets;
}

export function findControllerRigidBody(
  world: ControllerRigidBodyWorld | null | undefined,
  controllerId: string,
): ControllerTaggedRigidBody | null {
  let match: ControllerTaggedRigidBody | null = null;

  forEachControllerRigidBody(
    world,
    ({ body, controllerId: bodyControllerId }) => {
      if (bodyControllerId === controllerId) {
        match = body;
      }
    },
  );

  return match;
}

export function forEachControllerRigidBody(
  world: ControllerRigidBodyWorld | null | undefined,
  visitor: (entry: {
    body: ControllerTaggedRigidBody;
    controllerId: string;
  }) => void,
) {
  if (!world) {
    return;
  }

  world.bodies.forEach((body) => {
    const controllerId = readControllerId(body.userData);
    if (!controllerId) {
      return;
    }

    visitor({ body, controllerId });
  });
}

function readControllerId(userData: unknown): string | null {
  if (!userData || typeof userData !== "object") {
    return null;
  }

  if (!("controllerId" in userData)) {
    return null;
  }

  const controllerId = (userData as { controllerId?: unknown }).controllerId;
  return typeof controllerId === "string" ? controllerId : null;
}
