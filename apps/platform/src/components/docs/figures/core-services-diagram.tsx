"use client";

import { diagramColors } from "./diagram-colors";

export const CoreServicesDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
      data-figure-description="Core server services diagram: RoomManager handles room creation, player assignment, and cleanup. ConnectionManager tracks socket connections, handles reconnection logic, and manages timeouts. SignalRouter routes input from controllers to hosts and signals from hosts to controllers."
    >
      <svg
        viewBox="0 0 700 280"
        className="w-full max-w-3xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="servicesGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={diagramColors.gradientStartPink} />
            <stop offset="100%" stopColor={diagramColors.gradientEndPink} />
          </linearGradient>
        </defs>

        {/* Title */}
        <text
          x="350"
          y="30"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          Core Services
        </text>

        {/* Room Manager */}
        <rect
          x="50"
          y="60"
          width="280"
          height="90"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="190"
          y="85"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="14"
          fontWeight="600"
        >
          Room Manager
        </text>
        <text
          x="190"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Creates/destroys rooms
        </text>
        <text
          x="190"
          y="130"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Tracks connected players
        </text>

        {/* Auth Service */}
        <rect
          x="370"
          y="60"
          width="280"
          height="90"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="510"
          y="85"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="14"
          fontWeight="600"
        >
          Auth Service
        </text>
        <text
          x="510"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Validates API keys
        </text>
        <text
          x="510"
          y="130"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Enforces rate limits
        </text>

        {/* Event Router */}
        <rect
          x="50"
          y="180"
          width="280"
          height="90"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="190"
          y="205"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="14"
          fontWeight="600"
        >
          Event Router
        </text>
        <text
          x="190"
          y="230"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Routes input/signals
        </text>
        <text
          x="190"
          y="250"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Between hosts and controllers
        </text>

        {/* Focus System */}
        <rect
          x="370"
          y="180"
          width="280"
          height="90"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="510"
          y="205"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="14"
          fontWeight="600"
        >
          Focus System
        </text>
        <text
          x="510"
          y="230"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          Controls input routing
        </text>
        <text
          x="510"
          y="250"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
        >
          System or game receives input
        </text>
      </svg>
    </div>
  );
};

