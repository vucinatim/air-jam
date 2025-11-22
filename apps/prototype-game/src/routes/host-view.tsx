import type { JSX } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import {
  AirJamOverlay,
  useAirJamHost,
  type ControllerInputEvent,
  type PlayerProfile,
} from '@air-jam/sdk'
import { GameScene } from '../game/game-scene'

export const HostView = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<GameScene | null>(null)

  const handleInput = useCallback((event: ControllerInputEvent) => {
    sceneRef.current?.handleInput(event)
  }, [])

  const handlePlayerJoin = useCallback((player: PlayerProfile) => {
    sceneRef.current?.addPlayer(player)
  }, [])

  const handlePlayerLeave = useCallback((controllerId: string) => {
    sceneRef.current?.removePlayer(controllerId)
  }, [])

  const host = useAirJamHost({
    onInput: handleInput,
    onPlayerJoin: handlePlayerJoin,
    onPlayerLeave: handlePlayerLeave,
    controllerPath: '/joypad',
  })

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }
    const scene = new GameScene(containerRef.current)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return
    host.players.forEach((player) => sceneRef.current?.addPlayer(player))
  }, [host.players])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <AirJamOverlay
        roomId={host.roomId}
        joinUrl={host.joinUrl}
        connectionStatus={host.connectionStatus}
        players={host.players}
        lastError={host.lastError}
      />
      <div
        id="canvas-container"
        ref={containerRef}
        className="h-full w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
      />
    </div>
  )
}
