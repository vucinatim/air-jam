import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const trailVertexShader = `
  uniform float uTime;
  
  attribute float aAge;       // 0 = newest, 1 = oldest
  attribute vec3 aDirection;  // Direction of this segment
  attribute float aAngle;     // Angle around the cylinder
  attribute float aRadius;    // Pre-calculated radius for this point
  
  varying float vAge;
  varying vec2 vUv;
  
  void main() {
    vAge = aAge;
    
    // Create UVs: x = around cylinder, y = along trail (age)
    vUv = vec2(aAngle / 6.28318, aAge);

    // Calculate the coordinate system for this segment
    vec3 up = vec3(0, 1, 0);
    vec3 right = normalize(cross(aDirection, up));
    
    // Handle edge case where direction is straight up
    if (length(right) < 0.001) {
      right = normalize(cross(aDirection, vec3(1, 0, 0)));
    }
    vec3 localUp = normalize(cross(right, aDirection));
    
    // Calculate the offset for the cylinder vertex
    vec3 offset = (right * cos(aAngle) + localUp * sin(aAngle)) * aRadius;
    
    // Calculate final position
    vec4 mvPosition = modelViewMatrix * vec4(position + offset, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const trailFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  
  varying float vAge;
  varying vec2 vUv;
  
  void main() {
    // Fade out based on age (tip of the cone fades out)
    float alpha = (1.0 - vAge) * uOpacity;
    
    // Simple core glow effect
    // Darken the edges of the cylinder to make it look voluminous
    float core = sin(vUv.x * 3.14159); 
    
    gl_FragColor = vec4(uColor, alpha * core);
  }
`;

interface ExhaustTrailProps {
  target: React.RefObject<THREE.Object3D | null>;
  thrustRef: React.MutableRefObject<number>;
  color?: string | THREE.Color;
  width?: number; // Starting width (at exhaust)
  length?: number; // Life of the trail in seconds
  decaySpeed?: number; // How fast it tapers/fades
  stiffness?: number; // How much the trail "drags" (higher = straighter cone)
  maxPoints?: number;
  interval?: number; // Frame skip for performance
}

export function Trail({
  target,
  thrustRef,
  color = "#00ffff",
  width = 0.5,
  length = 1.5, // Increased from 1.0
  maxPoints = 200, // Increased from 100
  interval = 1, // Reduced from 2 for more frequent points
}: ExhaustTrailProps) {
  const { scene } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  // Data structures to manage trail history
  const points = useRef<THREE.Vector3[]>([]);
  const directions = useRef<THREE.Vector3[]>([]);
  const creationTimes = useRef<number[]>([]); // Store absolute time of creation

  const frameCount = useRef(0);
  const segments = 12; // Increased from 8 for more detailed trail
  
  // Simulated velocity for stationary ships
  const simulatedPrevPos = useRef<THREE.Vector3 | null>(null);
  const simulatedVelocity = useRef(new THREE.Vector3(0, 0, -1)); // Default forward direction

  // Initialize Geometry buffers once
  useEffect(() => {
    if (!geomRef.current) return;
    const geo = geomRef.current;

    // Calculate total vertices: maxPoints * segments * 2 (for triangles)
    // We allocate the maximum possible size
    const maxVerts = maxPoints * segments * 6;

    const pos = new Float32Array(maxVerts * 3);
    const age = new Float32Array(maxVerts);
    const angle = new Float32Array(maxVerts);
    const dir = new Float32Array(maxVerts * 3);
    const radius = new Float32Array(maxVerts);
    const indices: number[] = [];

    // Set up indices for a continuous strip of quads
    for (let i = 0; i < maxPoints - 1; i++) {
      for (let s = 0; s < segments; s++) {
        const base = i * segments;
        const nextBase = (i + 1) * segments;

        const a = base + s;
        const b = base + ((s + 1) % segments);
        const c = nextBase + s;
        const d = nextBase + ((s + 1) % segments);

        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aAge", new THREE.BufferAttribute(age, 1));
    geo.setAttribute("aAngle", new THREE.BufferAttribute(angle, 1));
    geo.setAttribute("aDirection", new THREE.BufferAttribute(dir, 3));
    geo.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    geo.setIndex(indices);

    // Prevent culling when trail extends outside view
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  }, [maxPoints, segments]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1.0 },
    }),
    [color],
  );

  useFrame((state) => {
    if (!target.current || !meshRef.current || !geomRef.current) return;

    const now = state.clock.elapsedTime;
    const geo = geomRef.current;
    const attrPos = geo.attributes.position as THREE.BufferAttribute;
    const attrAge = geo.attributes.aAge as THREE.BufferAttribute;
    const attrAngle = geo.attributes.aAngle as THREE.BufferAttribute;
    const attrDir = geo.attributes.aDirection as THREE.BufferAttribute;
    const attrRadius = geo.attributes.aRadius as THREE.BufferAttribute;

    // 1. ADD NEW POINTS (only while thrusting)
    const isThrusting = thrustRef.current > 0.1;
    frameCount.current++;
    if (isThrusting && frameCount.current % interval === 0) {
      const worldPos = new THREE.Vector3();
      target.current.getWorldPosition(worldPos);

      // Get the actual previous position (from points or simulated)
      const lastP = points.current[0] || simulatedPrevPos.current;
      
      // Check if we've moved enough
      const actualDistance = lastP ? lastP.distanceTo(worldPos) : Infinity;
      const hasRealMovement = actualDistance > 0.01;
      
      // Always add points when thrusting, but use simulated movement if ship is stationary
      let pointToAdd: THREE.Vector3;
      let dir: THREE.Vector3;
      
      if (hasRealMovement && lastP) {
        // Real movement - use actual position and direction
        pointToAdd = worldPos;
        dir = new THREE.Vector3().subVectors(worldPos, lastP);
        if (dir.length() < 0.001) {
          // Movement too small, use simulated velocity instead
          dir = simulatedVelocity.current.clone();
          if (dir.length() < 0.1) {
            dir.set(0, 0, -1);
          } else {
            dir.normalize();
          }
        } else {
          dir.normalize();
        }
        // Update simulated velocity based on real movement
        simulatedVelocity.current.copy(dir);
        // Update simulated position to match real position
        simulatedPrevPos.current = worldPos.clone();
      } else {
        // Stationary - simulate forward movement
        // Get the ship's forward direction from its rotation
        const shipForward = new THREE.Vector3(0, 0, -1);
        target.current.getWorldDirection(shipForward);
        
        // Use ship's forward direction, or fall back to simulated velocity
        if (shipForward.length() > 0.1) {
          dir = shipForward.normalize();
          simulatedVelocity.current.copy(dir);
        } else {
          dir = simulatedVelocity.current.clone();
          if (dir.length() < 0.1) {
            // Fallback to default forward direction
            dir.set(0, 0, -1);
          } else {
            dir.normalize();
          }
          simulatedVelocity.current.copy(dir);
        }
        
        // Calculate simulated position by moving forward from last point
        if (!simulatedPrevPos.current) {
          simulatedPrevPos.current = worldPos.clone();
        }
        // Move simulated position forward along the direction
        const simulatedStep = 0.15; // Distance to move per frame
        simulatedPrevPos.current.addScaledVector(dir, simulatedStep);
        pointToAdd = simulatedPrevPos.current.clone();
      }
      
      // Add the point (either real or simulated)
      points.current.unshift(pointToAdd);
      creationTimes.current.unshift(now);
      directions.current.unshift(dir);
    }

    // 2. PRUNE DEAD POINTS (The Fix)
    // Remove points that are older than `length` seconds
    // We check from the back (oldest)
    while (points.current.length > 0) {
      const oldestIndex = points.current.length - 1;
      const age = now - creationTimes.current[oldestIndex];

      // If the oldest point is too old OR we have too many points, remove it
      if (age > length || points.current.length > maxPoints) {
        points.current.pop();
        creationTimes.current.pop();
        directions.current.pop();
      } else {
        break; // Oldest point is still valid, so all newer points are valid
      }
    }

    // 3. UPDATE GEOMETRY
    const count = points.current.length;

    // If we don't have enough points to form a segment, hide the mesh
    if (count < 2) {
      geo.setDrawRange(0, 0);
      return;
    }

    for (let i = 0; i < count; i++) {
      const pointAge = (now - creationTimes.current[i]) / length; // 0 to 1
      const p = points.current[i];
      const d = directions.current[i];

      // Skip if point or direction is missing
      if (!p || !d) continue;

      // Taper Logic: Width shrinks as it gets older
      const currentRadius = width * 0.5 * (1.0 - pointAge);

      for (let s = 0; s < segments; s++) {
        const idx = i * segments + s;

        attrPos.setXYZ(idx, p.x, p.y, p.z);
        attrAge.setX(idx, pointAge);
        attrDir.setXYZ(idx, d.x, d.y, d.z);
        attrRadius.setX(idx, Math.max(0, currentRadius));
        attrAngle.setX(idx, (s / segments) * Math.PI * 2);
      }
    }

    attrPos.needsUpdate = true;
    attrAge.needsUpdate = true;
    attrDir.needsUpdate = true;
    attrRadius.needsUpdate = true;
    attrAngle.needsUpdate = true;

    // Draw only the active segments
    // (count - 1) segments * (segments per ring) * 6 indices per quad
    geo.setDrawRange(0, (count - 1) * segments * 6);
  });

  return createPortal(
    <mesh ref={meshRef} frustumCulled={false}>
      <bufferGeometry ref={geomRef} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={trailVertexShader}
        fragmentShader={trailFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>,
    scene,
  );
}

