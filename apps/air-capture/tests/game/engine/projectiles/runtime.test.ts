import { describe, expect, it, vi } from "vitest";
import { Object3D } from "three";
import {
  collectProjectileRuntimeTargets,
  findControllerRigidBody,
  forEachControllerRigidBody,
  type ControllerTaggedRigidBody,
} from "../../../../src/game/engine/projectiles/runtime";

function createBody(
  controllerId?: string,
  translation = { x: 0, y: 0, z: 0 },
): ControllerTaggedRigidBody {
  return {
    userData: controllerId ? { controllerId } : {},
    translation: () => translation,
    applyImpulse: vi.fn(),
  };
}

describe("air-capture projectile runtime helpers", () => {
  it("collects ships and obstacles without leaking the shooter", () => {
    const scene = new Object3D();

    const obstacle = new Object3D();
    obstacle.userData.type = "obstacle";

    const shooter = new Object3D();
    shooter.userData.controllerId = "pilot-1";

    const target = new Object3D();
    target.userData.controllerId = "pilot-2";

    scene.add(obstacle, shooter, target);

    const targets = collectProjectileRuntimeTargets(scene, "pilot-1");

    expect(targets.obstacles).toEqual([obstacle]);
    expect(targets.ships).toEqual([target]);
  });

  it("finds a rigid body by controller id", () => {
    const world = {
      bodies: {
        forEach(callback: (body: ControllerTaggedRigidBody) => void) {
          callback(createBody("pilot-1"));
          callback(createBody("pilot-2"));
        },
      },
    };

    const body = findControllerRigidBody(world, "pilot-2");

    expect(body?.userData).toEqual({ controllerId: "pilot-2" });
  });

  it("iterates only tagged controller bodies", () => {
    const visited: string[] = [];
    const world = {
      bodies: {
        forEach(callback: (body: ControllerTaggedRigidBody) => void) {
          callback(createBody("pilot-1"));
          callback(createBody());
          callback(createBody("pilot-2"));
        },
      },
    };

    forEachControllerRigidBody(world, ({ controllerId }) => {
      visited.push(controllerId);
    });

    expect(visited).toEqual(["pilot-1", "pilot-2"]);
  });
});
