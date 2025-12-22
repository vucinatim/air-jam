"use client";

import { diagramColors } from "./diagram-colors";

export const SocketEventsDiagram = () => {
  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-lg border p-4"
      style={{
        backgroundColor: diagramColors.bgPrimary,
        borderColor: diagramColors.borderPrimary,
      }}
    >
      <svg
        viewBox="0 0 800 500"
        className="w-full max-w-4xl"
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
        </defs>

        {/* Title */}
        <text
          x="400"
          y="30"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          Socket Events
        </text>

        {/* Host box */}
        <rect
          x="50"
          y="80"
          width="180"
          height="340"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonCyan}
          strokeWidth="2"
        />
        <text
          x="140"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          Host
        </text>

        {/* Server box */}
        <rect
          x="310"
          y="80"
          width="180"
          height="340"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.neonPink}
          strokeWidth="2"
        />
        <text
          x="400"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          Server
        </text>

        {/* Controller box */}
        <rect
          x="570"
          y="80"
          width="180"
          height="340"
          rx="8"
          fill={diagramColors.bgCard}
          stroke={diagramColors.borderPrimary}
          strokeWidth="2"
        />
        <text
          x="660"
          y="110"
          textAnchor="middle"
          fill={diagramColors.textPrimary}
          fontSize="16"
          fontWeight="600"
        >
          Controller
        </text>

        {/* host:register - Host → Server */}
        {/* Host right edge: x=230, Server left edge: x=310 */}
        <line
          x1="230"
          y1="150"
          x2="310"
          y2="150"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-right)"
        />
        <text
          x="270"
          y="142"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          host:register
        </text>
        <text
          x="140"
          y="165"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Create/join room
        </text>

        {/* controller:join - Controller → Server */}
        {/* Controller left edge: x=570, Server right edge: x=490 */}
        <line
          x1="570"
          y1="200"
          x2="490"
          y2="200"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-left)"
        />
        <text
          x="530"
          y="192"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          controller:join
        </text>
        <text
          x="660"
          y="215"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Join existing room
        </text>

        {/* controller:input - Controller → Server → Host */}
        {/* Controller left edge: x=570, Server right edge: x=490 */}
        <line
          x1="570"
          y1="260"
          x2="490"
          y2="260"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-left)"
        />
        <text
          x="530"
          y="252"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          controller:input
        </text>
        {/* Server left edge: x=310, Host right edge: x=230 */}
        <line
          x1="310"
          y1="260"
          x2="230"
          y2="260"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-left)"
        />
        <text
          x="270"
          y="252"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          controller:input
        </text>
        <text
          x="660"
          y="275"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Send input to game
        </text>

        {/* host:signal - Host → Server → Controller */}
        {/* Host right edge: x=230, Server left edge: x=310 */}
        <line
          x1="230"
          y1="320"
          x2="310"
          y2="320"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-right)"
        />
        <text
          x="270"
          y="312"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          host:signal
        </text>
        {/* Server right edge: x=490, Controller left edge: x=570 */}
        <line
          x1="490"
          y1="320"
          x2="570"
          y2="320"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-right)"
        />
        <text
          x="530"
          y="312"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          host:signal
        </text>
        <text
          x="140"
          y="335"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Send haptics/toasts
        </text>

        {/* server:state - Server → All (broadcast) */}
        {/* Server center: x=400, Host right edge: x=230 */}
        <line
          x1="400"
          y1="380"
          x2="230"
          y2="380"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-left)"
        />
        <text
          x="315"
          y="372"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          server:state
        </text>
        {/* Server center: x=400, Controller left edge: x=570 */}
        <line
          x1="400"
          y1="380"
          x2="570"
          y2="380"
          stroke={diagramColors.linePrimary}
          strokeWidth="2"
          markerEnd="url(#arrowhead-right)"
        />
        <text
          x="485"
          y="372"
          textAnchor="middle"
          fill={diagramColors.textSecondary}
          fontSize="10"
          fontWeight="500"
        >
          server:state
        </text>
        <text
          x="400"
          y="395"
          textAnchor="middle"
          fill={diagramColors.textTertiary}
          fontSize="9"
        >
          Broadcast game state
        </text>
      </svg>
    </div>
  );
};
