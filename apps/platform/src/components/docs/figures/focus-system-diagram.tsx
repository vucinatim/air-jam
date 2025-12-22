"use client";

import { diagramColors } from "./diagram-colors";

export const FocusSystemDiagram = () => {
  return (
    <div
      className="flex justify-center overflow-x-auto"
      data-figure-description="Focus system table: Shows how server-authoritative focus controls input routing. Focus can be SYSTEM (inputs go to platform/arcade), GAME (inputs go to your game), or CONTROLLER (direct controller-to-host). The server maintains authoritative control to prevent rogue games from stealing input."
    >
      <svg
        viewBox="0 0 604 200"
        className="w-full max-w-3xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Header row */}
        <rect
          x="2"
          y="30"
          width="600"
          height="40"
          rx="6"
          fill={diagramColors.bgSecondary}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1.5"
        />
        <text
          x="102"
          y="55"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Focus
        </text>
        <text
          x="302"
          y="55"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Input Recipient
        </text>
        <text
          x="502"
          y="55"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
          dominantBaseline="middle"
        >
          Use Case
        </text>

        {/* SYSTEM row */}
        <rect
          x="2"
          y="70"
          width="600"
          height="50"
          rx="4"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1"
        />
        <text
          x="102"
          y="95"
          textAnchor="middle"
          fill={diagramColors.neonPink}
          fontSize="12"
          fontWeight="600"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          SYSTEM
        </text>
        <text
          x="302"
          y="95"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          dominantBaseline="middle"
        >
          Master Host (Arcade)
        </text>
        <text
          x="502"
          y="95"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          Browsing games, navigation
        </text>

        {/* GAME row */}
        <rect
          x="2"
          y="120"
          width="600"
          height="50"
          rx="4"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="1"
        />
        <text
          x="102"
          y="145"
          textAnchor="middle"
          fill={diagramColors.neonCyan}
          fontSize="12"
          fontWeight="600"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          GAME
        </text>
        <text
          x="302"
          y="145"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="11"
          dominantBaseline="middle"
        >
          Child Host (Your Game)
        </text>
        <text
          x="502"
          y="145"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          Active gameplay
        </text>

        {/* Vertical dividers */}
        <line
          x1="202"
          y1="30"
          x2="202"
          y2="170"
          stroke={diagramColors.borderPrimary}
          strokeWidth="1"
        />
        <line
          x1="402"
          y1="30"
          x2="402"
          y2="170"
          stroke={diagramColors.borderPrimary}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

