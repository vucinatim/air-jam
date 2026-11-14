import {
  drawAgentCanvas,
  useHostAgentCapture,
  usePrefabInspection,
} from "@air-jam/sdk";
import { resolvePrefabOrbitCamera } from "@air-jam/sdk/prefabs";
import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type JSX } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import {
  createInitialFlags,
  type TeamPositions,
} from "./game/domain/capture-the-flag";
import { TEAM_CONFIG, type TeamId } from "./game/domain/team";
import { paintAirCaptureArena } from "./game/prefabs/arena/paint-arena";
import { AIR_CAPTURE_ARENA_PREFAB } from "./game/prefabs/arena/prefab";
import { resolveAirCaptureArenaProps } from "./game/prefabs/arena/schema";
import { SpaceEnvironment } from "./game/prefabs/arena/space-environment";
import { AIR_CAPTURE_PREFABS } from "./game/prefabs/catalog";
import { AirCaptureFlag } from "./game/prefabs/flag/render";
import { AirCaptureJumpPad } from "./game/prefabs/jump-pad/render";
import { AirCaptureObstacleBlock } from "./game/prefabs/obstacle-block/render";
import { AirCapturePlayerBase } from "./game/prefabs/player-base/render";
import { AirCaptureShip } from "./game/prefabs/ship/render";
import { airCaptureTheme } from "./game/theme";
import { StaticArenaView } from "./game/view/arena-view";
import type { ArenaView } from "./game/view/arena-view-context";
type AirCapturePrefabEntry = (typeof AIR_CAPTURE_PREFABS)[number];

const DEFAULT_CAMERA = {
  position: [18, 12, 18] as const,
  target: [0, 2, 0] as const,
  fov: 42,
};

function resolveTeamPreviewPositions(
  teamId: TeamId,
  isArenaPreview: boolean,
): TeamPositions {
  if (isArenaPreview) {
    return {
      solaris: [...TEAM_CONFIG.solaris.basePosition],
      nebulon: [...TEAM_CONFIG.nebulon.basePosition],
    };
  }

  return teamId === "solaris"
    ? {
        solaris: [0, 0, 0],
        nebulon: [30, 0, -18],
      }
    : {
        solaris: [-30, 0, 18],
        nebulon: [0, 0, 0],
      };
}

function PrefabFootprintOverlay({
  prefab,
}: {
  prefab: AirCapturePrefabEntry;
}): JSX.Element | null {
  const footprint = prefab.placement?.footprint;
  if (!footprint) {
    return null;
  }

  if (footprint.kind === "circle" && footprint.radius) {
    return (
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[Math.max(footprint.radius - 0.45, 0.05), footprint.radius, 48]}
        />
        <meshBasicMaterial
          color={
            prefab.preview?.accentColor ?? airCaptureTheme.colors.previewAccent
          }
          transparent
          opacity={0.32}
        />
      </mesh>
    );
  }

  if (
    footprint.kind === "box" &&
    footprint.width !== undefined &&
    footprint.depth !== undefined
  ) {
    return (
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[footprint.width, footprint.depth]} />
        <meshBasicMaterial
          color={
            prefab.preview?.accentColor ?? airCaptureTheme.colors.previewAccent
          }
          transparent
          opacity={0.18}
        />
      </mesh>
    );
  }

  return null;
}

function UnitPreviewEnvironment({
  accentColor,
}: {
  accentColor?: string;
}): JSX.Element {
  const props = useMemo(
    () =>
      resolveAirCaptureArenaProps({
        arenaRadius: 42,
        fogDensity: 0.006,
        ambientLightIntensity: 0.75,
        directionalLightIntensity: 2.6,
        directionalLightPosition: {
          x: 26,
          y: 42,
          z: 18,
        },
        forcefieldColor: accentColor ?? airCaptureTheme.colors.forcefieldColor,
        gridColorMajor: airCaptureTheme.colors.arenaGridMajor,
        gridColorMinor: airCaptureTheme.colors.gridColorMinor,
      }),
    [accentColor],
  );

  return <SpaceEnvironment props={props} />;
}

function PrefabScene({
  prefab,
  resolvedProps,
}: {
  prefab: AirCapturePrefabEntry;
  resolvedProps: Record<string, unknown>;
}): JSX.Element {
  const RenderPrefab = {
    "air-capture.arena.default": paintAirCaptureArena,
    "air-capture.flag.team": AirCaptureFlag,
    "air-capture.jump-pad.standard": AirCaptureJumpPad,
    "air-capture.obstacle.block": AirCaptureObstacleBlock,
    "air-capture.player-base.team": AirCapturePlayerBase,
    "air-capture.ship.standard": AirCaptureShip,
  }[prefab.id] as (props: Record<string, unknown>) => JSX.Element;
  const isArenaPreview = prefab.id === AIR_CAPTURE_ARENA_PREFAB.id;

  return (
    <>
      {isArenaPreview ? (
        <RenderPrefab {...resolvedProps} />
      ) : (
        <>
          <UnitPreviewEnvironment accentColor={prefab.preview?.accentColor} />
          <PrefabFootprintOverlay prefab={prefab} />
          <RenderPrefab {...resolvedProps} />
        </>
      )}
    </>
  );
}

function StaticPreviewCamera({
  position,
  target,
  fov,
}: {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
}): JSX.Element {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);

  useEffect(() => {
    if (!cameraRef.current) {
      return;
    }

    cameraRef.current.position.set(...position);
    cameraRef.current.lookAt(...target);
    cameraRef.current.updateProjectionMatrix();
  }, [position, target]);

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[...position]}
      fov={fov}
      near={0.1}
      far={5000}
    />
  );
}

function CaptureCanvas() {
  const { gl, scene, camera } = useThree();
  useHostAgentCapture((canvas, options) => {
    gl.render(scene, camera);
    return drawAgentCanvas(gl.domElement, canvas, options);
  });
  return null;
}

export function PrefabStage(): JSX.Element {
  const { prefab, props, state, view } = usePrefabInspection();
  const selectedPrefab = AIR_CAPTURE_PREFABS.find(
    (item) => item.id === prefab.id,
  );
  if (!selectedPrefab) throw new Error(`Unknown prefab ${prefab.id}`);
  return (
    <AirCapturePrefabStage
      prefab={selectedPrefab}
      props={props}
      stateId={state.id}
      view={view}
    />
  );
}
function AirCapturePrefabStage({
  prefab: selectedPrefab,
  props,
  stateId,
  view,
}: {
  prefab: AirCapturePrefabEntry;
  props: unknown;
  stateId: string;
  view: ReturnType<typeof usePrefabInspection>["view"];
}): JSX.Element {
  const selectedTeam: TeamId = "solaris";
  const isArenaPreview = selectedPrefab.id === AIR_CAPTURE_ARENA_PREFAB.id;
  const previewCamera = resolvePrefabOrbitCamera(
    selectedPrefab.preview?.camera ?? DEFAULT_CAMERA,
    view,
  );
  const resolvedProps = selectedPrefab.configSchema.parse(props);
  const drawingProps =
    selectedPrefab.id === "air-capture.ship.standard"
      ? { ...resolvedProps, thrust: stateId === "boost" ? 1 : 0 }
      : resolvedProps;

  // Prefabs draw a fresh arena: flags at their bases, no ships.
  const arenaView = useMemo<ArenaView>(() => {
    const basePositions = resolveTeamPreviewPositions(
      selectedTeam,
      isArenaPreview,
    );
    return {
      flags: createInitialFlags(basePositions),
      basePositions,
      baseOccupied: () => false,
      shipPosition: () => null,
    };
  }, [isArenaPreview, selectedTeam]);

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-black"
      data-testid="air-capture-prefab-stage"
    >
      <Canvas
        key={`${selectedPrefab.id}:${selectedTeam}`}
        shadows
        gl={{ antialias: true }}
        style={{ height: "100vh", width: "100vw" }}
      >
        <CaptureCanvas />
        <StaticPreviewCamera
          position={previewCamera.position}
          target={previewCamera.target}
          fov={previewCamera.fov ?? 42}
        />
        <StaticArenaView view={arenaView}>
          <group>
            <PrefabScene prefab={selectedPrefab} resolvedProps={drawingProps} />
          </group>
        </StaticArenaView>
      </Canvas>
    </div>
  );
}
