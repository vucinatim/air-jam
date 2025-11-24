import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CylinderGeometry,
  ConeGeometry,
  MeshStandardMaterial,
  Shape,
  ExtrudeGeometry,
  Vector3,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
} from "three";

/**
 * Initialize particle data for exhaust effect
 */
function initParticleData(count: number) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifetimes = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // Random position in a small circle at exhaust origin
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.1;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = -1; // Bottom of rocket
    positions[i3 + 2] = Math.sin(angle) * radius;

    // Random velocity downward with some spread
    velocities[i3] = (Math.random() - 0.5) * 0.5;
    velocities[i3 + 1] = -Math.random() * 2 - 1; // Downward
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;

    // Random lifetime
    lifetimes[i] = Math.random();
    sizes[i] = Math.random() * 0.05 + 0.02;
  }

  return { positions, velocities, lifetimes, sizes };
}

/**
 * Simplified Rocket component for the GameObjectEditor
 * This version doesn't include game logic, physics, or movement
 * Rocket is displayed upright for easy viewing in the editor
 */
export function RocketPreview() {
  // Rocket body (cylinder) - height 2, centered at origin
  const bodyGeometry = useMemo(() => new CylinderGeometry(0.3, 0.3, 2, 16), []);
  const bodyMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.2,
        roughness: 0.7,
      }),
    []
  );

  // Rocket nose (cone) - height 1, base at y=0, tip at y=1
  const noseGeometry = useMemo(() => new ConeGeometry(0.3, 1, 16), []);
  const noseMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.3,
        roughness: 0.6,
      }),
    []
  );

  // Rocket fins (triangular shapes)
  const finGeometry = useMemo(() => {
    // Create a triangular shape in XY plane
    // The triangle extends outward from x=0 (rocket surface) to x=0.4 (outer tip)
    // Base is at y=0.6 (bottom, attached to rocket), tip is at y=0 (top)
    const shape = new Shape();
    shape.moveTo(0, 0.6); // Bottom inner point (attached to rocket at x=0)
    shape.lineTo(0, 0); // Top inner point (attached to rocket at x=0)
    shape.lineTo(0.4, 0); // Top outer point (tip of fin)
    shape.lineTo(0, 0.6); // Close the triangle back to start

    // Extrude along Z axis to give it thickness
    return new ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: false,
    });
  }, []);
  const finMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x999999,
        metalness: 0.2,
        roughness: 0.8,
      }),
    []
  );

  // Flame exhaust effect
  const flameGeometry = useMemo(
    () => new ConeGeometry(0.15, 0.8, 8, 1, true),
    []
  );
  const flameMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8,
        side: 2, // DoubleSide
      }),
    []
  );

  // Exhaust particles
  const particleCount = 200;
  const particlesRef = useRef<Points>(null);
  const particleGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const { positions, velocities, lifetimes, sizes } =
      initParticleData(particleCount);

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("velocity", new BufferAttribute(velocities, 3));
    geometry.setAttribute("lifetime", new BufferAttribute(lifetimes, 1));
    geometry.setAttribute("size", new BufferAttribute(sizes, 1));

    return geometry;
  }, []);

  const particleMaterial = useMemo(
    () =>
      new PointsMaterial({
        color: 0xff6600,
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  // Animate particles
  useFrame((_state, delta) => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    const velocities = particlesRef.current.geometry.attributes.velocity
      .array as Float32Array;
    const lifetimes = particlesRef.current.geometry.attributes.lifetime
      .array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Update position
      positions[i3] += velocities[i3] * delta;
      positions[i3 + 1] += velocities[i3 + 1] * delta;
      positions[i3 + 2] += velocities[i3 + 2] * delta;

      // Update lifetime
      lifetimes[i] -= delta * 0.5;

      // Reset particle if it's dead or too far down
      if (lifetimes[i] <= 0 || positions[i3 + 1] < -3) {
        // Reset to exhaust origin
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.1;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = -1;
        positions[i3 + 2] = Math.sin(angle) * radius;

        // Reset velocity
        velocities[i3] = (Math.random() - 0.5) * 0.5;
        velocities[i3 + 1] = -Math.random() * 2 - 1;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;

        // Reset lifetime
        lifetimes[i] = Math.random() * 0.5 + 0.5;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group position={[0, 1.5, 0]}>
      {/* Rocket body - cylinder goes from y=-1 to y=1 */}
      <mesh
        geometry={bodyGeometry}
        material={bodyMaterial}
        castShadow
        receiveShadow
      />

      {/* Rocket nose - positioned so base aligns with top of cylinder (y=1) */}
      {/* Cone base is at y=0 when positioned at origin, so position at y=1.5 to put base at y=1 */}
      <mesh
        position={[0, 1.5, 0]}
        geometry={noseGeometry}
        material={noseMaterial}
        castShadow
        receiveShadow
      />

      {/* Flame exhaust - positioned at bottom of rocket body */}
      <mesh
        position={[0, -1.4, 0]}
        rotation={[Math.PI, 0, 0]}
        geometry={flameGeometry}
        material={flameMaterial}
      />

      {/* Exhaust particles */}
      <points
        ref={particlesRef}
        geometry={particleGeometry}
        material={particleMaterial}
      />

      {/* Rocket fins - triangular fins positioned at bottom of rocket body */}
      {/* Fin geometry: created in XY plane, extends in +X direction, base at x=0 */}
      {/* For each fin, calculate rotation to align fin's +X with outward direction from rocket */}
      {useMemo(() => {
        const rocketRadius = 0.3;
        const finY = -1; // Bottom of rocket body
        const finThickness = 0.1; // Fin thickness (depth/extrusion along Z axis)
        const finHalfThickness = finThickness / 2; // Half thickness = 0.05

        // Define 4 fin positions and their outward directions
        const finConfigs = [
          {
            position: new Vector3(rocketRadius, finY, 0),
            outwardDir: new Vector3(-1, 0, 0),
          }, // +X
          {
            position: new Vector3(-rocketRadius, finY, 0),
            outwardDir: new Vector3(1, 0, 0),
          }, // -X
          {
            position: new Vector3(0, finY, rocketRadius),
            outwardDir: new Vector3(0, 0, 1),
          }, // +Z
          {
            position: new Vector3(0, finY, -rocketRadius),
            outwardDir: new Vector3(0, 0, -1),
          }, // -Z
        ];

        return finConfigs.map((config, index) => {
          // Calculate rotation to align fin correctly
          // Fin shape is in XY plane, extends in +X direction (from x=0 at rocket to x=0.4 at tip)
          // Rotate around Y axis to align fin's +X with outward direction from rocket
          // Add Math.PI to flip the fin 180 degrees (so it faces outward, not inward)
          const yRotation =
            Math.atan2(config.outwardDir.z, config.outwardDir.x) + Math.PI;

          // Calculate perpendicular direction for offsetting along fin's width (thickness)
          // Perpendicular to outward direction and Y axis (up)
          const perpendicular = new Vector3()
            .crossVectors(config.outwardDir, new Vector3(0, 1, 0))
            .normalize();

          // Determine which pair this fin belongs to (X pair or Z pair)
          // X pair: offset in one direction, Z pair: offset in opposite direction
          const isXPair = Math.abs(config.outwardDir.x) > 0;
          const offsetSign = isXPair ? 1 : -1;

          // Offset position along perpendicular direction by half the fin thickness
          const offsetPosition = config.position
            .clone()
            .addScaledVector(perpendicular, offsetSign * finHalfThickness);

          return (
            <mesh
              key={index}
              position={[offsetPosition.x, offsetPosition.y, offsetPosition.z]}
              rotation={[0, yRotation, 0]}
              geometry={finGeometry}
              material={finMaterial}
              castShadow
              receiveShadow
            />
          );
        });
      }, [finGeometry, finMaterial])}
    </group>
  );
}
