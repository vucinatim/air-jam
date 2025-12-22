"use client";

import { diagramColors } from "./diagram-colors";

export const SdkArchitectureDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
      data-figure-description="SDK architecture diagram: AirJamProvider wraps the app and provides context. SocketClient manages WebSocket connections. InputManager handles input validation with Zod schemas and applies latching for boolean/vector fields. Zustand store maintains state. Hooks (useAirJamHost, useAirJamController, useGetInput, useSendSignal) provide access to functionality."
    >
      <svg
        viewBox="0 0 700 400"
        className="w-full max-w-3xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="sdkGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={diagramColors.gradientStart} />
            <stop offset="100%" stopColor={diagramColors.gradientEnd} />
          </linearGradient>
          <marker
            id="arrowhead-down"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill={diagramColors.arrowFill} />
          </marker>
        </defs>

        {/* AirJamProvider Container */}
        <rect
          x="50"
          y="20"
          width="600"
          height="360"
          rx="8"
          fill="url(#sdkGradient)"
          stroke={diagramColors.borderHighlight}
          strokeWidth="2"
        />
        <text
          x="350"
          y="50"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="18"
          fontWeight="600"
        >
          AirJamProvider
        </text>

        {/* SocketManager */}
        <rect
          x="80"
          y="80"
          width="200"
          height="80"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="180"
          y="105"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          SocketManager
        </text>
        <text
          x="180"
          y="125"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          (WebSocket)
        </text>
        <text
          x="180"
          y="145"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
        >
          Connection handling
        </text>

        {/* Zustand Store */}
        <rect
          x="320"
          y="80"
          width="280"
          height="80"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="460"
          y="105"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Zustand Store
        </text>
        <text
          x="460"
          y="125"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          (Connection State)
        </text>
        <text
          x="460"
          y="145"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
        >
          Players, status, game state
        </text>

        {/* InputManager */}
        <rect
          x="80"
          y="200"
          width="520"
          height="120"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="340"
          y="230"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="14"
          fontWeight="600"
        >
          InputManager
        </text>
        <text
          x="340"
          y="255"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          • Schema Validation (Zod)
        </text>
        <text
          x="340"
          y="275"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          • Input Latching
        </text>
        <text
          x="340"
          y="295"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          • Per-Controller Buffering
        </text>

        {/* Arrows down from InputManager to hooks */}
        {/* useAirJamHost center: x=170 (80 + 180/2), top: y=355 */}
        <line
          x1="170"
          y1="320"
          x2="170"
          y2="355"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-down)"
        />
        {/* useGetInput center: x=350 (280 + 140/2), top: y=355 */}
        <line
          x1="350"
          y1="320"
          x2="350"
          y2="355"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-down)"
        />
        {/* useAirJamController center: x=520 (440 + 160/2), top: y=355 */}
        <line
          x1="520"
          y1="320"
          x2="520"
          y2="355"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-down)"
        />

        {/* Hooks row */}
        <rect
          x="80"
          y="355"
          width="180"
          height="40"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="170"
          y="375"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
        >
          useAirJamHost
        </text>
        <text
          x="170"
          y="388"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          (Full API)
        </text>

        <rect
          x="280"
          y="355"
          width="140"
          height="40"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="350"
          y="375"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
        >
          useGetInput
        </text>
        <text
          x="350"
          y="388"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          (Perf)
        </text>

        <rect
          x="440"
          y="355"
          width="160"
          height="40"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="520"
          y="375"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
        >
          useAirJamController
        </text>
        <text
          x="520"
          y="388"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          (Mobile)
        </text>
      </svg>
    </div>
  );
};

