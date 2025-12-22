"use client";

import { diagramColors } from "./figures/diagram-colors";

export const SystemOverviewDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
    >
      <svg
        viewBox="0 0 800 600"
        className="w-full max-w-4xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="platformGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={diagramColors.gradientStart} />
            <stop offset="100%" stopColor={diagramColors.gradientEnd} />
          </linearGradient>
          <linearGradient id="serverGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={diagramColors.gradientStartPink} />
            <stop offset="100%" stopColor={diagramColors.gradientEndPink} />
          </linearGradient>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill={diagramColors.arrowFill} />
          </marker>
          <marker
            id="arrowhead-up"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill={diagramColors.arrowFill}
              transform="rotate(180 5 3)"
            />
          </marker>
        </defs>

        {/* Air Jam Platform */}
        <rect
          x="50"
          y="20"
          width="700"
          height="120"
          rx="8"
          fill="url(#platformGradient)"
          stroke={diagramColors.borderHighlight}
          strokeWidth="2"
        />
        <text
          x="400"
          y="50"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="18"
          fontWeight="600"
        >
          Air Jam Platform
        </text>
        <text
          x="400"
          y="72"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="12"
        >
          (apps/platform - Next.js)
        </text>

        {/* Platform boxes */}
        <rect
          x="80"
          y="90"
          width="180"
          height="35"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="170"
          y="108"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          fontWeight="500"
        >
          Game Catalog
        </text>
        <text
          x="170"
          y="120"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          Developer Portal
        </text>

        <rect
          x="280"
          y="90"
          width="180"
          height="35"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="370"
          y="108"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          fontWeight="500"
        >
          Arcade Mode
        </text>
        <text
          x="370"
          y="120"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          Game Launcher
        </text>

        <rect
          x="480"
          y="90"
          width="240"
          height="35"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="600"
          y="108"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          fontWeight="500"
        >
          Controller Shell
        </text>
        <text
          x="600"
          y="120"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (Mobile Wrapper)
        </text>

        {/* Arrow down - Platform to Server */}
        <line
          x1="400"
          y1="140"
          x2="400"
          y2="200"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />

        {/* Air Jam Server */}
        <rect
          x="50"
          y="200"
          width="700"
          height="120"
          rx="8"
          fill="url(#serverGradient)"
          stroke={diagramColors.neonPink}
          strokeWidth="2"
        />
        <text
          x="400"
          y="230"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="18"
          fontWeight="600"
        >
          Air Jam Server
        </text>
        <text
          x="400"
          y="252"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="12"
        >
          (packages/server - Node.js)
        </text>

        {/* Server boxes */}
        <rect
          x="80"
          y="270"
          width="180"
          height="35"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="170"
          y="288"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          fontWeight="500"
        >
          Room Manager
        </text>
        <text
          x="170"
          y="300"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (State + Rooms)
        </text>

        <rect
          x="280"
          y="270"
          width="180"
          height="35"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="370"
          y="288"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          fontWeight="500"
        >
          Auth Service
        </text>
        <text
          x="370"
          y="300"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (API Keys)
        </text>

        <rect
          x="480"
          y="270"
          width="240"
          height="35"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="600"
          y="288"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          fontWeight="500"
        >
          Event Router
        </text>
        <text
          x="600"
          y="300"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (Socket.IO)
        </text>

        {/* Arrows up from server - Left branch point */}
        {/* Branch point at x=200, connects to two Your Game boxes */}
        <line
          x1="200"
          y1="320"
          x2="200"
          y2="420"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerStart="url(#arrowhead-up)"
        />
        {/* Branch lines to Your Game boxes */}
        {/* Left Your Game box center: x=130 (60 + 140/2), top: y=480 */}
        <line
          x1="200"
          y1="420"
          x2="130"
          y2="480"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />
        {/* Right Your Game box center: x=290 (220 + 140/2), top: y=480 */}
        <line
          x1="200"
          y1="420"
          x2="290"
          y2="480"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />

        {/* Arrows up from server - Right branch point */}
        {/* Branch point at x=600, connects to two Phone controllers */}
        <line
          x1="600"
          y1="320"
          x2="600"
          y2="420"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerStart="url(#arrowhead-up)"
        />
        {/* Branch lines to Phone controllers */}
        {/* Phone 1 center: x=560 (500 + 120/2), top: y=480 */}
        <line
          x1="600"
          y1="420"
          x2="560"
          y2="480"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />
        {/* Phone N center: x=720 (660 + 120/2), top: y=480 */}
        <line
          x1="600"
          y1="420"
          x2="720"
          y2="480"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />

        {/* Your Game boxes */}
        <rect
          x="60"
          y="480"
          width="140"
          height="100"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="130"
          y="505"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Your Game
        </text>
        <text
          x="130"
          y="525"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          (Host)
        </text>
        <text
          x="130"
          y="555"
          textAnchor="middle"
          fill={diagramColors.neonCyan}
          fontSize="10"
          fontFamily="monospace"
        >
          @air-jam/sdk
        </text>

        <rect
          x="220"
          y="480"
          width="140"
          height="100"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="290"
          y="505"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Your Game
        </text>
        <text
          x="290"
          y="525"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          (Host)
        </text>
        <text
          x="290"
          y="555"
          textAnchor="middle"
          fill={diagramColors.neonCyan}
          fontSize="10"
          fontFamily="monospace"
        >
          @air-jam/sdk
        </text>

        {/* Phone controllers */}
        <rect
          x="500"
          y="480"
          width="120"
          height="100"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="560"
          y="505"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Phone 1
        </text>
        <text
          x="560"
          y="525"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Ctrl
        </text>
        <text
          x="560"
          y="555"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
        >
          SDK
        </text>

        <text
          x="640"
          y="530"
          fill={diagramColors.textSecondary}
          fontSize="14"
          fontWeight="500"
        >
          ...
        </text>

        <rect
          x="660"
          y="480"
          width="120"
          height="100"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="720"
          y="505"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Phone N
        </text>
        <text
          x="720"
          y="525"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Ctrl
        </text>
        <text
          x="720"
          y="555"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
        >
          SDK
        </text>
      </svg>
    </div>
  );
};
