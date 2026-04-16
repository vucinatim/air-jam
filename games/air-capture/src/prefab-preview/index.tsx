import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { type JSX, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { TEAM_CONFIG, TEAM_IDS, type TeamId } from "../game/domain/team";
import {
  createInitialFlags,
  createInitialScores,
  type TeamPositions,
} from "../game/domain/capture-the-flag";
import { AIR_CAPTURE_ARENA_PREFAB } from "../game/prefabs/arena/prefab";
import { SpaceEnvironment } from "../game/prefabs/arena/space-environment";
import { resolveAirCaptureArenaProps } from "../game/prefabs/arena/schema";
import { AIR_CAPTURE_PREFABS } from "../game/prefabs";
import { useCaptureTheFlagStore } from "../game/stores/match/capture-the-flag-store";
import {
  AIR_CAPTURE_PREFAB_CAPTURE_PREFAB_PARAM,
  AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
  AIR_CAPTURE_PREFAB_CAPTURE_VARIANT_PREFIX,
} from "./params";

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
          color={prefab.preview?.accentColor ?? "#60a5fa"}
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
          color={prefab.preview?.accentColor ?? "#60a5fa"}
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
        forcefieldColor: accentColor ?? "#4cc9f0",
        gridColorMajor: "#374151",
        gridColorMinor: "#1f2937",
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
  const RenderPrefab = prefab.render as (
    props: Record<string, unknown>,
  ) => JSX.Element;
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

const resolveSelectedTeam = (searchParams: URLSearchParams): TeamId => {
  const teamVariant = searchParams.get(
    `${AIR_CAPTURE_PREFAB_CAPTURE_VARIANT_PREFIX}team`,
  );
  return TEAM_IDS.includes(teamVariant as TeamId)
    ? (teamVariant as TeamId)
    : "solaris";
};

export function PrefabCaptureSurface(): JSX.Element {
  const [searchParams] = useSearchParams();
  const selectedPrefab = useMemo(() => {
    const prefabId = searchParams.get(AIR_CAPTURE_PREFAB_CAPTURE_PREFAB_PARAM);
    return (
      AIR_CAPTURE_PREFABS.find((prefab) => prefab.id === prefabId) ??
      AIR_CAPTURE_PREFABS[0]
    );
  }, [searchParams]);

  const selectedTeam = resolveSelectedTeam(searchParams);
  const isArenaPreview = selectedPrefab.id === AIR_CAPTURE_ARENA_PREFAB.id;
  const previewCamera = selectedPrefab.preview?.camera ?? DEFAULT_CAMERA;

  const resolvedProps = useMemo(() => {
    const props = {
      ...(selectedPrefab.defaultProps as Record<string, unknown>),
    };

    if ("teamId" in props) {
      props.teamId = selectedTeam;
    }

    return selectedPrefab.configSchema.parse(props) as Record<string, unknown>;
  }, [selectedPrefab, selectedTeam]);

  useEffect(() => {
    const basePositions = resolveTeamPreviewPositions(selectedTeam, isArenaPreview);
    useCaptureTheFlagStore.setState({
      playerTeams: {},
      basePositions,
      flags: createInitialFlags(basePositions),
      scores: createInitialScores(),
    });
  }, [isArenaPreview, selectedPrefab.id, selectedTeam]);

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-black"
      data-testid={AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID}
    >
      <Canvas
        key={`${selectedPrefab.id}:${selectedTeam}`}
        shadows
        gl={{ antialias: true }}
        style={{ height: "100vh", width: "100vw" }}
      >
        <StaticPreviewCamera
          position={previewCamera.position}
          target={previewCamera.target}
          fov={previewCamera.fov ?? 42}
        />
        <Physics gravity={[0, 0, 0]} interpolate={true}>
          <group>
            <PrefabScene prefab={selectedPrefab} resolvedProps={resolvedProps} />
          </group>
        </Physics>
      </Canvas>
    </div>
  );
}
