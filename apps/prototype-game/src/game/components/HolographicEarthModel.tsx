import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface HolographicEarthModelProps {
  /** Radius of the sphere */
  radius?: number;
  /** Whether to show wireframe overlay */
  showWireframe?: boolean;
  /** Custom texture URL */
  textureUrl?: string;
}

/**
 * Reusable holographic Earth model component
 * Displays a holographic Earth with scanlines, flicker, and fresnel effects
 */
export const HolographicEarthModel = ({
  radius = 2,
  showWireframe = true,
  textureUrl = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg",
}: HolographicEarthModelProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Load Earth texture
  const earthTexture = useTexture(textureUrl);

  // Create texture with proper wrapping
  const texture = useMemo(() => {
    const tex = earthTexture.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, [earthTexture]);

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec3 uColorHigh;
    uniform vec3 uColorLow;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    // Pseudo-random function for flicker
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      // 1. Texture Sampling
      vec4 texColor = texture2D(uTexture, vUv);
      float brightness = texColor.r;

      // 2. Color Mapping
      vec3 finalColor = mix(uColorLow, uColorHigh, brightness);

      // 3. Fresnel Effect (Rim Lighting)
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float dotProduct = dot(normal, viewDir);
      float fresnel = pow(1.0 - abs(dotProduct), 3.0);
      float fresnelClamped = smoothstep(0.3, 1.0, fresnel);
      
      // Add the fresnel glow in a brighter cyan color
      finalColor += vec3(0.2, 0.8, 1.0) * fresnelClamped * 1.5;

      // 4. Scanline Effect
      float scanline = sin(vUv.y * 200.0 - uTime * 5.0) * 0.04;
      float scanlineBand = smoothstep(0.48, 0.5, abs(fract(vUv.y * 2.0 - uTime * 0.2) - 0.5));
      finalColor += uColorHigh * scanlineBand * 0.5;

      // 5. Alpha & Transparency
      float alpha = smoothstep(0.1, 1.0, brightness) * 0.6 + 0.1;
      alpha += fresnelClamped * 0.5;
      
      // 6. Flicker Effect
      float flicker = random(vec2(uTime * 10.0, 0.0)) * 0.1 + 0.9;
      finalColor *= flicker;
      alpha *= flicker;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 256, 256]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTexture: { value: texture },
            uTime: { value: 0 },
            uColorHigh: { value: new THREE.Color(0x00eaff) },
            uColorLow: { value: new THREE.Color(0x001133) },
          }}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {showWireframe && <WireframeOverlay radius={radius} />}
    </>
  );
};

const WireframeOverlay = ({ radius }: { radius: number }) => {
  const wireframeGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius * 1.005, 64, 64);
    return new THREE.WireframeGeometry(geo);
  }, [radius]);

  return (
    <lineSegments geometry={wireframeGeo}>
      <lineBasicMaterial color={0x0055ff} transparent opacity={0.1} />
    </lineSegments>
  );
};

