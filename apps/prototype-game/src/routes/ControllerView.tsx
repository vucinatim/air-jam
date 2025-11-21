import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ControllerShell, useAirJamController } from '@air-jam/sdk'

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

export const ControllerView = (): JSX.Element => {
  const { roomId, connectionStatus, lastError, sendInput } = useAirJamController()
  const [vector, setVector] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [actionPressed, setActionPressed] = useState(false)

  const statusLabel = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting…'
      case 'reconnecting':
        return 'Reconnecting…'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Idle'
    }
  }, [connectionStatus])

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      return undefined
    }
    const pushInput = (): void => {
      sendInput({
        vector,
        action: actionPressed,
        timestamp: Date.now(),
      })
    }
    pushInput()
    const interval = window.setInterval(pushInput, 50)
    return () => window.clearInterval(interval)
  }, [actionPressed, connectionStatus, sendInput, vector])

  const setDirection = (x: number, y: number): void => {
    setVector({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) })
  }

  const resetDirection = (): void => {
    setVector({ x: 0, y: 0 })
  }

  return (
    <ControllerShell
      roomId={roomId}
      connectionStatus={connectionStatus}
      lastError={lastError}
      requiredOrientation="landscape"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-8">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-center shadow-lg">
          <p className="text-sm text-slate-300">Drag or tap to move. Hold the action button to boost.</p>
          <p className="mt-1 text-xs text-slate-500">{statusLabel}</p>
        </div>
        <div className="grid w-full grid-cols-[1fr_auto] gap-6">
          <div className="relative flex aspect-square w-full max-w-xs items-center justify-center">
            <div className="absolute inset-0 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-inner" />
            <div className="relative grid h-full w-full grid-cols-3 grid-rows-3 gap-2 p-2">
              <button
                type="button"
                className="col-start-2 row-start-1 rounded-xl bg-slate-800/80 text-lg font-semibold text-slate-100 shadow-md active:scale-95"
                onPointerDown={() => setDirection(0, 1)}
                onPointerUp={resetDirection}
                onPointerLeave={resetDirection}
              >
                ↑
              </button>
              <button
                type="button"
                className="col-start-1 row-start-2 rounded-xl bg-slate-800/80 text-lg font-semibold text-slate-100 shadow-md active:scale-95"
                onPointerDown={() => setDirection(-1, 0)}
                onPointerUp={resetDirection}
                onPointerLeave={resetDirection}
              >
                ←
              </button>
              <div className="col-start-2 row-start-2 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full border border-slate-700 bg-slate-800/60 shadow-inner" />
              </div>
              <button
                type="button"
                className="col-start-3 row-start-2 rounded-xl bg-slate-800/80 text-lg font-semibold text-slate-100 shadow-md active:scale-95"
                onPointerDown={() => setDirection(1, 0)}
                onPointerUp={resetDirection}
                onPointerLeave={resetDirection}
              >
                →
              </button>
              <button
                type="button"
                className="col-start-2 row-start-3 rounded-xl bg-slate-800/80 text-lg font-semibold text-slate-100 shadow-md active:scale-95"
                onPointerDown={() => setDirection(0, -1)}
                onPointerUp={resetDirection}
                onPointerLeave={resetDirection}
              >
                ↓
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              className="aspect-square h-32 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-xl font-bold text-slate-950 shadow-[0_15px_30px_rgba(6,182,212,0.35)] active:scale-95"
              onPointerDown={() => setActionPressed(true)}
              onPointerUp={() => setActionPressed(false)}
              onPointerLeave={() => setActionPressed(false)}
            >
              Boost
            </button>
          </div>
        </div>
      </div>
    </ControllerShell>
  )
}
