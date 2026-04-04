/**
 * Task sidebar component showing pending tasks as post-it notes.
 */

import type { ActiveTask } from "../task-manager";

interface TaskSidebarProps {
  pendingTasks: ActiveTask[];
}

const MAX_VISIBLE_NOTES = 5;

/**
 * Sidebar component displaying the TODO list of pending tasks as post-it notes.
 */
export function TaskSidebar({ pendingTasks }: TaskSidebarProps) {
  const visibleTasks = pendingTasks.slice(0, MAX_VISIBLE_NOTES);
  const remainingCount = pendingTasks.length - MAX_VISIBLE_NOTES;

  return (
    <div className="flex w-48 flex-col gap-3 p-3">
      <div className="flex flex-col gap-3">
        {pendingTasks.length === 0 ? (
          <p className="text-center text-sm text-slate-500">Ni nalog</p>
        ) : (
          <>
            {visibleTasks.map((task, index) => (
              <div
                key={task.id}
                className="aspect-square flex flex-col items-center justify-center p-3 shadow-md relative bg-amber-100"
                style={{
                  transform: `rotate(${index % 2 === 0 ? -1.5 : 1.5}deg)`,
                  boxShadow: "2px 3px 6px rgba(0, 0, 0, 0.12)",
                }}
              >
                <span className="font-semibold text-slate-800 text-center text-sm leading-tight">
                  {task.name}
                </span>
                <p className="text-xs text-slate-600 text-center mt-1 leading-tight">
                  {task.description}
                </p>
                <span className="absolute bottom-2 right-2 text-base font-semibold text-slate-700">
                  {task.reward}€
                </span>
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="relative h-24 mt-2">
                {/* Stack of notes behind */}
                <div
                  className="absolute inset-0 aspect-square bg-amber-200"
                  style={{
                    transform: "rotate(3deg) translateY(6px)",
                    boxShadow: "1px 2px 4px rgba(0, 0, 0, 0.08)",
                  }}
                />
                <div
                  className="absolute inset-0 aspect-square bg-amber-200"
                  style={{
                    transform: "rotate(-1.5deg) translateY(3px)",
                    boxShadow: "1px 2px 4px rgba(0, 0, 0, 0.08)",
                  }}
                />
                {/* Top note with number */}
                <div
                  className="absolute inset-0 aspect-square flex items-center justify-center bg-amber-100"
                  style={{
                    transform: "rotate(0.5deg)",
                    boxShadow: "2px 3px 6px rgba(0, 0, 0, 0.12)",
                  }}
                >
                  <span className="text-3xl font-semibold text-slate-700">
                    +{remainingCount}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
