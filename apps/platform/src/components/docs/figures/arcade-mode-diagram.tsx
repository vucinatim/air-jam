"use client";

import { diagramColors } from "./diagram-colors";

export const ArcadeModeDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
      data-figure-description="Arcade mode architecture diagram: The Air Jam Platform acts as a master host and loads your game inside an iframe as a child host. Controllers connect through the platform's controller shell. The platform manages game switching, and your game receives a join token to connect to the existing room."
    >
      <svg
        viewBox="0 0 700 400"
        className="w-full max-w-3xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="platformGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={diagramColors.gradientStart} />
            <stop offset="100%" stopColor={diagramColors.gradientEnd} />
          </linearGradient>
          <linearGradient id="arcadeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={diagramColors.gradientStartPink} />
            <stop offset="100%" stopColor={diagramColors.gradientEndPink} />
          </linearGradient>
        </defs>

        {/* Air Jam Platform (TV) - Outer box */}
        <rect
          x="50"
          y="30"
          width="600"
          height="340"
          rx="8"
          fill="url(#platformGradient)"
          stroke={diagramColors.borderHighlight}
          strokeWidth="2"
        />
        <text
          x="350"
          y="60"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          Air Jam Platform (TV)
        </text>

        {/* Arcade Browser (Master Host) - Middle box */}
        <rect
          x="80"
          y="90"
          width="540"
          height="260"
          rx="6"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonPink}
          strokeWidth="2"
        />
        <text
          x="350"
          y="115"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="14"
          fontWeight="600"
        >
          Arcade Browser (Master Host)
        </text>
        <text
          x="100"
          y="140"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          • Owns the room
        </text>
        <text
          x="100"
          y="160"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          • Handles game selection
        </text>
        <text
          x="100"
          y="180"
          fill={diagramColors.textSecondary}
          fontSize="11"
          dominantBaseline="middle"
        >
          • Controls input focus
        </text>

        {/* Your Game (Child Host - iframe) - Inner box */}
        <rect
          x="110"
          y="210"
          width="500"
          height="120"
          rx="4"
          fill={diagramColors.bgSecondary}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="360"
          y="235"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="13"
          fontWeight="600"
        >
          Your Game (Child Host - iframe)
        </text>
        <text
          x="130"
          y="260"
          fill={diagramColors.textSecondary}
          fontSize="10"
          dominantBaseline="middle"
        >
          • Joins via secure token
        </text>
        <text
          x="130"
          y="280"
          fill={diagramColors.textSecondary}
          fontSize="10"
          dominantBaseline="middle"
        >
          • Receives input when game has focus
        </text>
      </svg>
    </div>
  );
};

