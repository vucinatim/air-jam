import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { ConnectionStatus, PlayerProfile } from '../protocol'
import { cn } from '../utils/cn'

interface AirJamOverlayProps {
  roomId: string
  joinUrl: string
  connectionStatus: ConnectionStatus
  players: PlayerProfile[]
  lastError?: string
}

const statusCopy: Record<ConnectionStatus, string> = {
  idle: 'Idle',
  connecting: 'Waiting for server…',
  connected: 'Ready for controllers',
  disconnected: 'Disconnected',
  reconnecting: 'Reconnecting…',
}

export const AirJamOverlay = ({
  roomId,
  joinUrl,
  connectionStatus,
  players,
  lastError,
}: AirJamOverlayProps): JSX.Element => {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      width: 320,
    })
      .then((value) => {
        if (mounted) {
          setQrUrl(value)
          setQrError(null)
        }
      })
      .catch((err) => {
        if (mounted) {
          setQrError(err.message)
        }
      })

    return () => {
      mounted = false
    }
  }, [joinUrl])

  const connectionTone = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-emerald-400 bg-emerald-400/10'
      case 'connecting':
      case 'reconnecting':
        return 'text-amber-400 bg-amber-400/10'
      default:
        return 'text-rose-400 bg-rose-400/10'
    }
  }, [connectionStatus])

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-start justify-end p-6">
      <div className="pointer-events-auto w-[360px] rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950/90 p-5 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Room</p>
            <h2 className="text-3xl font-semibold text-slate-100">{roomId}</h2>
            <p className="text-sm text-slate-400">Scan to join as a controller.</p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-slate-800',
              connectionTone,
            )}
          >
            {statusCopy[connectionStatus]}
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
          {qrUrl ? (
            <img src={qrUrl} alt={`Join room ${roomId}`} className="w-full bg-white" />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              {qrError ? `QR failed: ${qrError}` : 'Generating QR code…'}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">Players</p>
            <span className="text-xs text-slate-500">{players.length} connected</span>
          </div>
          <ul className="mt-2 space-y-1">
            {players.length === 0 && (
              <li className="text-sm text-slate-500">Waiting for controllers…</li>
            )}
            {players.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2 text-sm text-slate-100"
              >
                <span className="font-medium">{player.label}</span>
                <span className="text-xs text-slate-500">{player.id}</span>
              </li>
            ))}
          </ul>
        </div>
        {lastError && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {lastError}
          </div>
        )}
        <p className="mt-3 text-[13px] text-slate-500">
          Join URL: <span className="font-mono text-slate-300">{joinUrl}</span>
        </p>
      </div>
    </div>
  )
}
