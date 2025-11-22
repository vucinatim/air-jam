import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import type { ControllerInputEvent, PlayerProfile } from "@air-jam/sdk";

const PLAYER_COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#facc15",
  "#34d399",
];

interface PlayerState {
  mesh: Mesh;
  velocity: Vector3;
  targetVelocity: Vector3;
  color: Color;
  boostTime: number;
}

export class GameScene {
  private readonly scene: Scene;

  private readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;

  private readonly container: HTMLElement;

  private readonly playerStates = new Map<string, PlayerState>();

  private animationHandle: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new Scene();
    this.scene.background = new Color("#0a0e1a");

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new PerspectiveCamera(60, aspect, 0.1, 100);
    this.camera.position.set(0, 8, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Create floor/platform
    const floorGeometry = new PlaneGeometry(20, 20);
    const floorMaterial = new MeshStandardMaterial({
      color: "#1a1f2e",
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Add grid pattern to floor
    for (let i = -8; i <= 8; i += 2) {
      const lineGeometry = new BoxGeometry(0.05, 20, 0.05);
      const lineMaterial = new MeshStandardMaterial({ color: "#2a3040" });
      const lineX = new Mesh(lineGeometry, lineMaterial);
      lineX.position.set(i, 0.01, 0);
      this.scene.add(lineX);

      const lineZ = new Mesh(lineGeometry, lineMaterial);
      lineZ.rotation.y = Math.PI / 2;
      lineZ.position.set(0, 0.01, i);
      this.scene.add(lineZ);
    }

    // Improved lighting
    const ambient = new AmbientLight(0xffffff, 0.6);
    const directional1 = new DirectionalLight(0xffffff, 1.5);
    directional1.position.set(5, 10, 7.5);
    directional1.castShadow = true;
    directional1.shadow.mapSize.width = 2048;
    directional1.shadow.mapSize.height = 2048;
    directional1.shadow.camera.near = 0.5;
    directional1.shadow.camera.far = 50;
    directional1.shadow.camera.left = -10;
    directional1.shadow.camera.right = 10;
    directional1.shadow.camera.top = 10;
    directional1.shadow.camera.bottom = -10;

    const directional2 = new DirectionalLight(0x7cb9ff, 0.8);
    directional2.position.set(-5, 5, -5);

    this.renderer.shadowMap.enabled = true;
    this.scene.add(ambient);
    this.scene.add(directional1);
    this.scene.add(directional2);

    // Add decorative corner pillars
    const pillarGeometry = new BoxGeometry(0.5, 2, 0.5);
    const pillarMaterial = new MeshStandardMaterial({
      color: "#2a3040",
      roughness: 0.7,
      metalness: 0.3,
    });
    const positions = [
      [-9, 1, -9],
      [9, 1, -9],
      [-9, 1, 9],
      [9, 1, 9],
    ];
    positions.forEach(([x, y, z]) => {
      const pillar = new Mesh(pillarGeometry, pillarMaterial.clone());
      pillar.position.set(x, y, z);
      pillar.castShadow = true;
      this.scene.add(pillar);
    });

    window.addEventListener("resize", this.handleResize);
    this.animate();
  }

  addPlayer(profile: PlayerProfile): void {
    if (this.playerStates.has(profile.id)) {
      return;
    }
    const color = new Color(
      PLAYER_COLORS[this.playerStates.size % PLAYER_COLORS.length]
    );
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.5,
      emissive: color,
      emissiveIntensity: 0.2,
    });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;

    const radius = 2 + this.playerStates.size * 0.5;
    const angle = (this.playerStates.size / 6) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius);

    // Add glow effect base
    const glowGeometry = new BoxGeometry(1.2, 1.2, 1.2);
    const glowMaterial = new MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      emissive: color,
      emissiveIntensity: 0.5,
    });
    const glow = new Mesh(glowGeometry, glowMaterial);
    mesh.add(glow);

    this.scene.add(mesh);
    this.playerStates.set(profile.id, {
      mesh,
      velocity: new Vector3(),
      targetVelocity: new Vector3(),
      color,
      boostTime: 0,
    });
  }

  removePlayer(controllerId: string): void {
    const state = this.playerStates.get(controllerId);
    if (!state) return;
    this.scene.remove(state.mesh);
    state.mesh.geometry.dispose();
    if (Array.isArray(state.mesh.material)) {
      state.mesh.material.forEach((mat: Material) => mat.dispose());
    } else {
      (state.mesh.material as Material).dispose();
    }
    this.playerStates.delete(controllerId);
  }

  handleInput(event: ControllerInputEvent): void {
    const state = this.playerStates.get(event.controllerId);
    if (!state) {
      return;
    }
    const baseSpeed = 3;
    const boostMultiplier = event.input.action ? 2 : 1;
    const speed = baseSpeed * boostMultiplier;

    state.targetVelocity.set(
      event.input.vector.x * speed,
      0,
      -event.input.vector.y * speed
    );

    if (event.input.action) {
      state.boostTime = 0.3; // Boost duration
      state.mesh.scale.setScalar(1.2);
      const material = state.mesh.material as MeshStandardMaterial;
      material.emissiveIntensity = 0.8;
      if (state.mesh.children[0]) {
        const glowMaterial = (state.mesh.children[0] as Mesh)
          .material as MeshStandardMaterial;
        glowMaterial.emissiveIntensity = 1.0;
        glowMaterial.opacity = 0.6;
      }
    } else {
      state.boostTime = Math.max(0, state.boostTime - 0.016);
      if (state.boostTime <= 0) {
        state.mesh.scale.setScalar(1);
        const material = state.mesh.material as MeshStandardMaterial;
        material.emissiveIntensity = 0.2;
        if (state.mesh.children[0]) {
          const glowMaterial = (state.mesh.children[0] as Mesh)
            .material as MeshStandardMaterial;
          glowMaterial.emissiveIntensity = 0.5;
          glowMaterial.opacity = 0.3;
        }
      }
    }
  }

  private animate = (): void => {
    this.animationHandle = requestAnimationFrame(this.animate);
    const deltaTime = 0.016;
    this.playerStates.forEach((state) => {
      state.velocity.lerp(state.targetVelocity, 0.15);
      state.mesh.position.addScaledVector(state.velocity, deltaTime);
      state.mesh.position.clamp(
        new Vector3(-9, 0.5, -9),
        new Vector3(9, 0.5, 9)
      );

      // Smooth rotation based on movement
      const rotationSpeed = 0.01 + state.velocity.length() * 0.03;
      state.mesh.rotation.y += rotationSpeed;

      // Bounce effect when boosting
      if (state.boostTime > 0) {
        state.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.02) * 0.2;
        state.boostTime -= deltaTime;
      } else {
        state.mesh.position.y = 0.5;
      }

      // Particle trail effect (simple pulsing glow)
      if (state.mesh.children[0] && state.velocity.length() > 0.1) {
        const glow = state.mesh.children[0] as Mesh;
        const glowMaterial = glow.material as MeshStandardMaterial;
        const pulse =
          Math.sin(Date.now() * 0.005 + state.mesh.position.x) * 0.1 + 0.4;
        glowMaterial.opacity = Math.max(0.2, Math.min(0.6, pulse));
      }
    });
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  };

  dispose(): void {
    if (this.animationHandle) {
      cancelAnimationFrame(this.animationHandle);
    }
    window.removeEventListener("resize", this.handleResize);
    this.playerStates.forEach((_, controllerId) =>
      this.removePlayer(controllerId)
    );
    this.playerStates.clear();
    this.renderer.dispose();
    this.scene.clear();
    this.container.innerHTML = "";
  }
}
