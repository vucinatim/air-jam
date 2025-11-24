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

const PARTICLE_COUNT = 80; // More particles for better visibility
const EXPLOSION_LIFETIME = 1.2; // Active explosion phase
const FADE_OUT_DURATION = 0.2; // Quicker fade out phase duration
const TOTAL_LIFETIME = EXPLOSION_LIFETIME + FADE_OUT_DURATION; // Total lifetime
const FLASH_LIFETIME = 0.4; // Flash sphere lifetime (longer than initial burst)
const EXPLOSION_SPEED = 15; // Faster initial spread

interface RocketExplosionProps {
  position: [number, number, number];
  onComplete?: () => void;
}

export function RocketExplosion({
  position,
  onComplete,
}: RocketExplosionProps) {
  const particlesRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const particles = useRef<Particle[]>([]);
  const ageRef = useRef(0);

  // Particle material - orange/red fire colors (brighter and more visible)
  const particleGeometry = useMemo(() => new BoxGeometry(0.8, 0.8, 0.8), []);
  const particleMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 5,
        transparent: true,
        opacity: 1,
        toneMapped: false, // Brighter colors
        blending: AdditiveBlending, // Additive blending for glow effect
        depthWrite: false,
      }),
    []
  );

  // Flash sphere for initial explosion burst (brighter)
  const flashGeometry = useMemo(() => new SphereGeometry(2, 16, 16), []);
  const flashMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xffaa00, // Match emissive color to avoid black appearance
        emissive: 0xffaa00,
        emissiveIntensity: 10,
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
      const speed = EXPLOSION_SPEED * (0.6 + Math.random() * 0.8);

      return {
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        ),
        age: 0,
        lifetime: EXPLOSION_LIFETIME * (0.7 + Math.random() * 0.6),
        size: 0.8 + Math.random() * 1.2, // Bigger particles for more impact
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
      const maxScale = 5; // More expansion
      // Scale based on flash's own progress
      flashRef.current.scale.setScalar(Math.min(maxScale, 1 + flashProgress * 4));
      const material = flashRef.current.material as MeshStandardMaterial;
      // Ensure opacity is properly set and material stays transparent
      material.opacity = flashFade;
      material.emissiveIntensity = 10 * flashFade;
      // Keep visible until fully transparent, then hide
      flashRef.current.visible = flashFade > 0;
    }

    // Update point light (brighter and larger)
    if (lightRef.current) {
      const lightFade = Math.max(0, 1 - progress * 2) * overallFade;
      lightRef.current.intensity = 20 * lightFade; // Brighter
      lightRef.current.distance = 25 * (1 + progress * 0.5); // Larger radius
    }

    // Update particles
    particles.current.forEach((particle, index) => {
      particle.age += delta;

      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));

      // Apply gravity (less than collectible explosion for more dramatic effect)
      particle.velocity.y -= 3 * delta;

      // Update mesh
      const mesh = particlesRef.current?.children[index] as Mesh;
      if (mesh) {
        const particleProgress = particle.age / particle.lifetime;
        const fadeOut = 1 - particleProgress;
        // Apply overall fade out at the end
        const finalOpacity = fadeOut * overallFade;

        mesh.position.copy(particle.position);
        // Start at full size, fade out
        const scale = particle.size * (1 - particleProgress * 0.3); // Don't shrink too much
        mesh.scale.setScalar(Math.max(0.1, scale));

        const material = mesh.material as MeshStandardMaterial;
        material.opacity = finalOpacity;
        material.emissiveIntensity = 5 * finalOpacity; // Brighter particles
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
      {/* Initial flash burst */}
      <mesh ref={flashRef} geometry={flashGeometry} material={flashMaterial} />
      
      {/* Point light for dramatic effect */}
      <pointLight
        ref={lightRef}
        color={0xffaa00}
        intensity={20}
        distance={25}
        decay={1.5}
      />
      
      {/* Particle explosion */}
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

