"use client";

import { diagramColors } from "./diagram-colors";

export const InputFlowDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
    >
      <svg
        viewBox="0 0 600 200"
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
        </defs>

        {/* Controller Phone */}
        <rect
          x="30"
          y="40"
          width="160"
          height="80"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="110"
          y="80"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="15"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Controller Phone
        </text>
        <text
          x="110"
          y="145"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          sendInput({`{`} vector: {`{x, y}`} {`})`}
        </text>

        {/* Arrow from Controller to Server */}
        <line
          x1="190"
          y1="80"
          x2="220"
          y2="80"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-right)"
        />

        {/* AirJam Server */}
        <text
          x="300"
          y="25"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="12"
          dominantBaseline="middle"
        >
          Validates • Routes • Broadcasts
        </text>
        <rect
          x="220"
          y="40"
          width="160"
          height="80"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonPink}
          strokeWidth="2"
        />
        <text
          x="300"
          y="80"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="15"
          fontWeight="600"
          dominantBaseline="middle"
        >
          AirJam Server
        </text>

        {/* Arrow from Server to Game */}
        <line
          x1="380"
          y1="80"
          x2="410"
          y2="80"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-right)"
        />

        {/* Your Game */}
        <rect
          x="410"
          y="40"
          width="160"
          height="80"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="490"
          y="80"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="15"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Your Game
        </text>
        <text
          x="490"
          y="145"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          getInput(id)
        </text>
        <text
          x="490"
          y="165"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
          dominantBaseline="middle"
        >
          Returns typed, validated,
        </text>
        <text
          x="490"
          y="180"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="10"
          dominantBaseline="middle"
        >
          latched input
        </text>
      </svg>
    </div>
  );
};
