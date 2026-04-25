"use client";

import { diagramColors } from "./diagram-colors";

export const HooksComparisonTable = () => {
  const rows = [
    {
      useCase: "Host screens below the mounted runtime boundary",
      hook: "useAirJamHost",
    },
    {
      useCase: "Individual game objects (ships, projectiles)",
      hook: "useGetInput",
    },
    {
      useCase: "Components that render every frame",
      hook: "useGetInput",
    },
    {
      useCase: "Components that need player list",
      hook: "useAirJamHost",
    },
  ];

  return (
    <div
      className="my-8 flex justify-start overflow-x-auto"
      data-figure-description="Table comparing when to use useAirJamHost versus useGetInput: useAirJamHost is the consumer hook for host-facing UI or any child component that needs room state or player lists below a mounted host runtime. Use useGetInput for individual game objects and other hot paths that should avoid store subscriptions."
    >
      <table className="w-full max-w-2xl border-collapse">
        <thead>
          <tr>
            <th
              className="border-b px-4 py-3 text-left font-semibold"
              style={{
                borderColor: diagramColors.borderPrimary,
                color: diagramColors.textPrimary,
              }}
            >
              Use Case
            </th>
            <th
              className="border-b px-4 py-3 text-left font-semibold"
              style={{
                borderColor: diagramColors.borderPrimary,
                color: diagramColors.textPrimary,
              }}
            >
              Recommended Hook
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="transition-colors hover:opacity-80"
              style={{
                backgroundColor:
                  index % 2 === 0
                    ? diagramColors.bgPrimary
                    : diagramColors.bgSecondary,
              }}
            >
              <td
                className="border-b px-4 py-3"
                style={{
                  borderColor: diagramColors.borderPrimary,
                  color: diagramColors.textSecondary,
                }}
              >
                {row.useCase}
              </td>
              <td
                className="border-b px-4 py-3 font-mono text-sm"
                style={{
                  borderColor: diagramColors.borderPrimary,
                  color: diagramColors.neonCyan,
                }}
              >
                <code>{row.hook}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
