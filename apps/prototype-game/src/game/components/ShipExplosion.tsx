import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
  SphereGeometry,
  type Mesh,
  AdditiveBlending,
} from "three";

interface Particle {
  position: Vector3;
  velocity: Vector3;
  age: number;
  lifetime: number;
  size: number;
}

// Ship explosion is more powerful than rocket explosion
const PARTICLE_COUNT = 150; // More particles for more power
const EXPLOSION_LIFETIME = 1.5; // Longer active explosion phase
const FADE_OUT_DURATION = 1.0; // Much longer fade out phase (was 0.2 for rocket)
const TOTAL_LIFETIME = EXPLOSION_LIFETIME + FADE_OUT_DURATION; // Total lifetime
const FLASH_LIFETIME = 0.6; // Longer flash sphere lifetime
const EXPLOSION_SPEED = 20; // Faster initial spread (more power)

interface ShipExplosionProps {
  position: [number, number, number];
  onComplete?: () => void;
}

export function ShipExplosion({
  position,
  onComplete,
}: ShipExplosionProps) {
  const particlesRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const particles = useRef<Particle[]>([]);
  const ageRef = useRef(0);

  // Particle material - more intense orange/red/yellow fire colors
  const particleGeometry = useMemo(() => new BoxGeometry(1.0, 1.0, 1.0), []);
  const particleMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff8800, // Brighter orange
        emissive: 0xff5500, // More intense emissive
        emissiveIntensity: 8, // More intense (was 5)
        transparent: true,
        opacity: 1,
        toneMapped: false, // Brighter colors
        blending: AdditiveBlending, // Additive blending for glow effect
        depthWrite: false,
      }),
    []
  );

  // Flash sphere for initial explosion burst (larger and brighter)
  const flashGeometry = useMemo(() => new SphereGeometry(3, 16, 16), []);
  const flashMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xffcc00, // Brighter yellow
        emissive: 0xffcc00,
        emissiveIntensity: 15, // More intense (was 10)
        transparent: true,
        opacity: 1,
        toneMapped: false, // Brighter colors
        depthWrite: false, // Prevent black artifacts when fading
        side: 2, // DoubleSide for better visibility
      }),
    []
  );

  const hasCompletedRef = useRef(false);

  // Initialize particles immediately (not in useEffect to avoid delay)
  if (particles.current.length === 0) {
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => {
      // Random direction in sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = EXPLOSION_SPEED * (0.7 + Math.random() * 1.0);

      return {
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        ),
        age: 0,
        lifetime: EXPLOSION_LIFETIME * (0.8 + Math.random() * 0.7), // Longer lifetime variation
        size: 1.0 + Math.random() * 1.5, // Bigger particles for more impact
      };
    });
  }

  useFrame((_state, delta) => {
    if (!particlesRef.current) return;

    ageRef.current += delta;
    const progress = ageRef.current / EXPLOSION_LIFETIME;
    const fadeOutProgress = Math.max(
      0,
      (ageRef.current - EXPLOSION_LIFETIME) / FADE_OUT_DURATION
    );
    const overallFade = 1 - fadeOutProgress; // Fade out multiplier for all effects

    // Update flash effect (longer lifetime, fades to 0 at end)
    if (flashRef.current) {
      // Flash has its own lifetime, fades to 0 by the end
      const flashProgress = ageRef.current / FLASH_LIFETIME;
      const flashFade = Math.max(0, 1 - flashProgress); // Fade from 1 to 0 over flash lifetime
      const maxScale = 7; // More expansion (was 5)
      // Scale based on flash's own progress
      flashRef.current.scale.setScalar(Math.min(maxScale, 1 + flashProgress * 6));
      const material = flashRef.current.material as MeshStandardMaterial;
      // Ensure opacity is properly set and material stays transparent
      material.opacity = flashFade;
      material.emissiveIntensity = 15 * flashFade; // More intense (was 10)
      // Keep visible until fully transparent, then hide
      flashRef.current.visible = flashFade > 0;
    }

    // Update point light (brighter and larger)
    if (lightRef.current) {
      const lightFade = Math.max(0, 1 - progress * 1.5) * overallFade; // Slower fade
      lightRef.current.intensity = 30 * lightFade; // Brighter (was 20)
      lightRef.current.distance = 35 * (1 + progress * 0.7); // Larger radius (was 25)
    }

    // Update particles
    particles.current.forEach((particle, index) => {
      particle.age += delta;

      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));

      // Apply gravity (slightly less for more dramatic upward spread)
      particle.velocity.y -= 2.5 * delta;

      // Update mesh
      const mesh = particlesRef.current?.children[index] as Mesh;
      if (mesh) {
        const particleProgress = particle.age / particle.lifetime;
        const fadeOut = 1 - particleProgress;
        // Apply overall fade out at the end (slower fade for longer visibility)
        const finalOpacity = fadeOut * overallFade;

        mesh.position.copy(particle.position);
        // Start at full size, fade out more gradually
        const scale = particle.size * (1 - particleProgress * 0.2); // Less shrinking
        mesh.scale.setScalar(Math.max(0.1, scale));

        const material = mesh.material as MeshStandardMaterial;
        material.opacity = finalOpacity;
        material.emissiveIntensity = 8 * finalOpacity; // More intense (was 5)
      }
    });

    // Remove after total lifetime and call onComplete callback
    if (ageRef.current > TOTAL_LIFETIME && !hasCompletedRef.current) {
      particlesRef.current.visible = false;
      if (flashRef.current) flashRef.current.visible = false;
      if (lightRef.current) lightRef.current.visible = false;
      hasCompletedRef.current = true;
      if (onComplete) {
        onComplete();
      }
    }
  });

  return (
    <group position={position}>
      {/* Initial flash burst - larger and brighter */}
      <mesh ref={flashRef} geometry={flashGeometry} material={flashMaterial} />
      
      {/* Point light for dramatic effect - brighter and larger */}
      <pointLight
        ref={lightRef}
        color={0xffcc00}
        intensity={30}
        distance={35}
        decay={1.5}
      />
      
      {/* Particle explosion - more particles for more power */}
      <group ref={particlesRef}>
        {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
          <mesh
            key={index}
            geometry={particleGeometry}
            material={particleMaterial.clone()}
          />
        ))}
      </group>
    </group>
  );
}

