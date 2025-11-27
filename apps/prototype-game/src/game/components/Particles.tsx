"use client";
import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";
import {
  Color,
  Float32BufferAttribute,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";

const ParticleShaderMaterial = new ShaderMaterial({
  uniforms: {
    color: { value: new Color("cyan") },
    pointSize: { value: 1.0 },
    dpr: { value: 1.0 },
    zoomFactor: { value: 1.0 }, // Added zoomFactor
  },
  vertexShader: `
    uniform float pointSize;
    uniform float dpr;
    uniform float zoomFactor; // New zoom uniform
    attribute float age;
    attribute float particleSize;
    varying vec2 vUv;
    varying float vAge;

    void main() {
      vUv = uv;
      vAge = age;
      gl_PointSize = particleSize * pointSize * dpr * zoomFactor; // Adjust size by zoomFactor
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying vec2 vUv;
    varying float vAge;

    void main() {
      float r = 0.0, delta = 0.0, alpha = 1.0;
      vec2 cxy = 2.0 * gl_PointCoord - 1.0;
      r = dot(cxy, cxy);
      if (r > 1.0) {
        discard;
      }
      alpha *= 1.0 - vAge; // Fade out based on age
      gl_FragColor = vec4(color, alpha);
    }
  `,
});

export interface ParticleConfig {
  maxParticles: number;
  color: string | number | Color;
  initialVelocity: number;
  size: number;
  sizeVariance: number;
  opacity: number;
  lifetime: number;
  emissionRate: number;
  turbulence: number;
  gravityModifier: number;
  boxSize?: Vector3;
}

interface ParticlesProps {
  visible?: boolean;
  config: ParticleConfig;
  objectRef: React.RefObject<Mesh | null>;
  position?: Vector3;
}

const Particles = ({ visible = true, objectRef, config }: ParticlesProps) => {
  const shaderRef = useRef<ShaderMaterial>(ParticleShaderMaterial);
  const timeRef = useRef(0);
  const meshRef = useRef<Points>(null);
  const prevObjectPosition = useRef(new Vector3(0, 0, 0));
  const emissionTimer = useRef(0);

  const getObjectPosition = useCallback(() => {
    if (objectRef?.current instanceof Mesh) {
      const pos = new Vector3();
      objectRef.current.getWorldPosition(pos);
      return pos;
    }

    return new Vector3(0, 0, 0);
  }, [objectRef]);

  const { positions, velocities, ages, sizes } = useMemo(() => {
    return initializeParticles(
      getObjectPosition(),
      config.maxParticles,
      config.initialVelocity,
      config.emissionRate,
      config.size,
      config.sizeVariance
    );
  }, [getObjectPosition, config]);

  useFrame((state, delta) => {
    timeRef.current += delta;

    if (shaderRef.current) {
      shaderRef.current.uniforms.color.value.set(config.color);
      shaderRef.current.uniforms.pointSize.value = config.size;
      shaderRef.current.uniforms.dpr.value = window.devicePixelRatio;
      shaderRef.current.opacity = config.opacity;
      shaderRef.current.uniforms.zoomFactor.value = state.camera.zoom;
    }

    if (!meshRef.current) return;

    const objectPosition = getObjectPosition();
    const positionsArray = meshRef.current.geometry.attributes.position.array;
    const agesArray = meshRef.current.geometry.attributes.age.array;

    emissionTimer.current += delta * config.emissionRate;
    let emitCount = Math.floor(emissionTimer.current);
    emissionTimer.current -= emitCount;

    for (let i = 0; i < config.maxParticles; i++) {
      if (emitCount > 0 && agesArray[i] < 0) {
        resetParticle({
          index: i,
          objectPosition,
          positions: positionsArray as Float32Array,
          velocities,
          ages: agesArray as Float32Array,
          config,
        });
        emitCount -= 1;
      } else {
        updateParticle({
          index: i,
          delta,
          objectPosition,
          positions: positionsArray as Float32Array,
          velocities,
          ages: agesArray as Float32Array,
          config,
        });
      }
    }

    prevObjectPosition.current.copy(objectPosition);
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.attributes.age.needsUpdate = true;
  });

  return (
    <points visible={visible} ref={meshRef}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          args={[positions.array, positions.itemSize]}
        />
        <bufferAttribute attach="attributes-age" args={[ages, 1]} />
        <bufferAttribute
          attach="attributes-particleSize"
          args={[sizes.array, sizes.itemSize]}
        />
      </bufferGeometry>
      <primitive attach="material" object={shaderRef.current} transparent />
    </points>
  );
};

function initializeParticles(
  objectPosition: Vector3,
  count: number,
  velocity: number,
  emissionRate: number,
  size: number,
  sizeVariance: number
) {
  const positions = [];
  const velocities = [];
  const ages = [];
  const sizes = [];

  for (let i = 0; i < count; i++) {
    const position = objectPosition.clone();
    positions.push(position.x, position.y, position.z);
    velocities.push(
      new Vector3(
        (Math.random() - 0.5) * velocity,
        (Math.random() - 0.5) * velocity,
        (Math.random() - 0.5) * velocity
      )
    );

    ages.push(-i / emissionRate);
    sizes.push(size + sizeVariance * (Math.random() - 0.5) * 2);
  }

  return {
    positions: new Float32BufferAttribute(positions.flat(), 3),
    velocities,
    ages: new Float32Array(ages),
    sizes: new Float32BufferAttribute(sizes, 1),
  };
}

interface UpdateParticleParams {
  index: number;
  delta: number;
  objectPosition: Vector3;
  positions: Float32Array;
  velocities: Vector3[];
  ages: Float32Array;
  config: ParticleConfig;
}

function updateParticle({
  index,
  delta,
  objectPosition,
  positions,
  velocities,
  ages,
  config,
}: UpdateParticleParams) {
  if (ages[index] < 0) {
    ages[index] += delta / config.lifetime;
    return;
  }

  const i3 = index * 3;
  ages[index] += delta / config.lifetime;

  // Update velocity with gravity and turbulence
  velocities[index].y -= config.gravityModifier * delta;
  velocities[index].add(
    new Vector3(
      (Math.random() - 0.5) * config.turbulence,
      (Math.random() - 0.5) * config.turbulence,
      (Math.random() - 0.5) * config.turbulence
    )
  );

  // Calculate new position
  const newPosition = velocities[index].clone().multiplyScalar(delta);

  positions[i3] += newPosition.x;
  positions[i3 + 1] += newPosition.y;
  positions[i3 + 2] += newPosition.z;

  // Reset particle when its age reaches 1
  if (ages[index] >= 1.0) {
    resetParticle({
      index,
      objectPosition,
      positions,
      velocities,
      ages,
      config,
    });
  }
}

interface ResetParticleParams {
  index: number;
  objectPosition: Vector3;
  positions: Float32Array;
  velocities: Vector3[];
  ages: Float32Array;
  config: ParticleConfig;
}

function resetParticle({
  index,
  objectPosition,
  positions,
  velocities,
  ages,
  config,
}: ResetParticleParams) {
  const newPos = config.boxSize
    ? new Vector3(
        (Math.random() - 0.5) * config.boxSize.x,
        (Math.random() - 0.5) * config.boxSize.y,
        (Math.random() - 0.5) * config.boxSize.z
      )
    : new Vector3(0, 0, 0);

  newPos.add(objectPosition);

  positions[index * 3] = newPos.x;
  positions[index * 3 + 1] = newPos.y;
  positions[index * 3 + 2] = newPos.z;

  velocities[index] = new Vector3(
    (Math.random() - 0.5) * config.initialVelocity,
    (Math.random() - 0.5) * config.initialVelocity,
    (Math.random() - 0.5) * config.initialVelocity
  );

  ages[index] = 0;
}

export default Particles;
