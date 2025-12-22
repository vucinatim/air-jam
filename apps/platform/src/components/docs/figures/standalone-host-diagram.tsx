"use client";

import { diagramColors } from "./diagram-colors";

export const StandaloneHostDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
      data-figure-description="Standalone host architecture diagram: Your Game (Host) connects directly to the AirJam Server via WebSocket. Controller phones join by scanning QR code and connect to the same server. The host registers a room, receives a room code, and generates a QR code for controllers to join."
    >
      <svg
        viewBox="0 0 700 400"
        className="w-full max-w-3xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="arrowhead-right"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill={diagramColors.arrowFill} />
          </marker>
          <marker
            id="arrowhead-left"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="10 0, 0 3, 10 6"
              transform="rotate(180 5 3)"
              fill={diagramColors.arrowFill}
            />
          </marker>
          <marker
            id="arrowhead-up"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="9"
            orient="auto"
          >
            <polygon
              points="0 0, 5 10, 10 0"
              fill={diagramColors.arrowFill}
              transform="rotate(180 5 5)"
            />
          </marker>
        </defs>

        {/* Your Game (Host) - Left */}
        <rect
          x="50"
          y="50"
          width="200"
          height="120"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="150"
          y="95"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="15"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Your Game
        </text>
        <text
          x="150"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          (Host)
        </text>
        <text
          x="150"
          y="135"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          useAirJamHost()
        </text>

        {/* Air Jam Server - Right */}
        <rect
          x="350"
          y="50"
          width="200"
          height="120"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonPink}
          strokeWidth="2"
        />
        <text
          x="450"
          y="95"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="15"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Air Jam Server
        </text>
        <text
          x="450"
          y="125"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          Room: ABCD
        </text>

        {/* WebSocket bidirectional connection */}
        {/* Your Game right edge: x=250, Server left edge: x=350 */}
        <line
          x1="250"
          y1="110"
          x2="350"
          y2="110"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />
        <text
          x="300"
          y="105"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          WebSocket
        </text>

        {/* Lines from controllers to Server at 60-degree angles */}
        {/* Server bottom center: x=450, y=170 */}
        {/* Controller 1: positioned below and left */}
        {/* Controller 2: positioned below and right */}
        {/* Reduced horizontal spacing for closer controllers */}
        <line
          x1="300"
          y1="320"
          x2="450"
          y2="170"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />
        <line
          x1="600"
          y1="320"
          x2="450"
          y2="170"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />

        {/* Input Events label */}
        <text
          x="450"
          y="245"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
        >
          Input Events
        </text>

        {/* Controller 1 - Below Server, Left */}
        <rect
          x="230"
          y="320"
          width="140"
          height="60"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="300"
          y="340"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Controller 1
        </text>
        <text
          x="300"
          y="360"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          dominantBaseline="middle"
        >
          (Phone)
        </text>

        {/* Controller 2 - Below Server, Right */}
        <rect
          x="530"
          y="320"
          width="140"
          height="60"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="600"
          y="340"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Controller 2
        </text>
        <text
          x="600"
          y="360"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          dominantBaseline="middle"
        >
          (Phone)
        </text>
      </svg>
    </div>
  );
};
