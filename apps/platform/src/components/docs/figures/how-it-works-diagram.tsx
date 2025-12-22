"use client";

import { diagramColors } from "./diagram-colors";

export const HowItWorksDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
      data-figure-description="How Air Jam works overview: 1) Your game displays a QR code with room ID. 2) Players scan QR on their phones - no app download required. 3) Phone becomes a game controller with joystick and buttons. 4) All input is routed through the AirJam Server to your game in real-time."
    >
      <svg
        viewBox="0 0 700 450"
        className="w-full max-w-3xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="hostGradient"
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

        {/* HOST (TV/Computer) */}
        <rect
          x="50"
          y="20"
          width="600"
          height="140"
          rx="8"
          fill="url(#hostGradient)"
          stroke={diagramColors.borderHighlight}
          strokeWidth="2"
        />
        <text
          x="350"
          y="50"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          HOST (TV/Computer)
        </text>

        {/* Your Game box inside Host */}
        {/* Box center: y = 70 + 75/2 = 107.5 */}
        <rect
          x="80"
          y="70"
          width="540"
          height="75"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="350"
          y="95"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Your Game
        </text>
        <text
          x="350"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          • Renders game graphics
        </text>
        <text
          x="350"
          y="125"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          • Processes player input • Manages game state
        </text>

        {/* Arrow from Host to Server */}
        <line
          x1="350"
          y1="160"
          x2="350"
          y2="220"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-down)"
        />
        <text
          x="360"
          y="185"
          fill={diagramColors.textTertiary}
          fontSize="9"
          fontFamily="monospace"
        >
          useAirJamHost()
        </text>

        {/* Air Jam Server */}
        {/* Box center: y = 240 + 80/2 = 280 */}
        <rect
          x="200"
          y="240"
          width="300"
          height="80"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonPink}
          strokeWidth="2"
        />
        <text
          x="350"
          y="270"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="15"
          fontWeight="600"
        >
          Air Jam Server
        </text>
        <text
          x="350"
          y="295"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          (WebSocket)
        </text>

        {/* Arrow from Server to Controllers */}
        <line
          x1="350"
          y1="320"
          x2="350"
          y2="340"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-down)"
        />

        {/* Branch lines to controllers */}
        <line
          x1="350"
          y1="340"
          x2="180"
          y2="380"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />
        <line
          x1="350"
          y1="340"
          x2="350"
          y2="380"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />
        <line
          x1="350"
          y1="340"
          x2="520"
          y2="380"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
        />

        {/* Controller boxes */}
        {/* Box center: y = 380 + 60/2 = 410 */}
        <rect
          x="120"
          y="380"
          width="120"
          height="60"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="180"
          y="400"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
        >
          Controller 1
        </text>
        <text
          x="180"
          y="412"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (Phone)
        </text>
        <text
          x="180"
          y="425"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Joystick + Btns
        </text>

        <rect
          x="290"
          y="380"
          width="120"
          height="60"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="350"
          y="400"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
        >
          Controller 2
        </text>
        <text
          x="350"
          y="412"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (Phone)
        </text>
        <text
          x="350"
          y="425"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Joystick + Btns
        </text>

        <rect
          x="460"
          y="380"
          width="120"
          height="60"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="520"
          y="400"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="12"
          fontWeight="600"
        >
          Controller 3
        </text>
        <text
          x="520"
          y="412"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
        >
          (Phone)
        </text>
        <text
          x="520"
          y="425"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Joystick + Btns
        </text>
      </svg>
    </div>
  );
};

