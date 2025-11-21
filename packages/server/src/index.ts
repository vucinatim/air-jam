import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerStateSchema,
  hostRegistrationSchema,
  type ClientToServerEvents,
  type ControllerJoinedNotice,
  type ControllerLeftNotice,
  type HostLeftNotice,
  type InterServerEvents,
  type RoomCode,
  type ServerErrorPayload,
  type ServerToClientEvents,
  type SocketData,
} from '@air-jam/sdk/protocol'

interface ControllerSession {
  controllerId: string
  nickname?: string
  socketId: string
}

interface RoomSession {
  roomId: RoomCode
  hostSocketId: string
  controllers: Map<string, ControllerSession>
  maxPlayers: number
}

const rooms = new Map<RoomCode, RoomSession>()
const hostIndex = new Map<string, RoomCode>()
const controllerIndex = new Map<string, { roomId: RoomCode; controllerId: string }>()

const PORT = Number(process.env.PORT ?? 4000)

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_, res) => {
  res.json({ ok: true })
})

const httpServer = createServer(app)

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      origin: '*',
    },
  },
)

const emitError = (socketId: string, payload: ServerErrorPayload): void => {
  io.to(socketId).emit('server:error', payload)
}

const removeRoom = (roomId: RoomCode, reason: string): void => {
  const session = rooms.get(roomId)
  if (!session) return

  const hostNotice: HostLeftNotice = { roomId, reason }
  io.to(roomId).emit('server:host_left', hostNotice)

  session.controllers.forEach((controller) => {
    controllerIndex.delete(controller.socketId)
  })

  hostIndex.delete(session.hostSocketId)
  rooms.delete(roomId)
}

io.on(
  'connection',
  (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  ) => {
  socket.on('host:register', (payload, callback) => {
    const parsed = hostRegistrationSchema.safeParse(payload)
    if (!parsed.success) {
      callback({ ok: false, message: parsed.error.message })
      return
    }

    const { roomId, maxPlayers } = parsed.data
    const nextSession: RoomSession = {
      roomId,
      hostSocketId: socket.id,
      controllers: new Map(),
      maxPlayers,
    }

    rooms.set(roomId, nextSession)
    hostIndex.set(socket.id, roomId)
    socket.join(roomId)

    callback({ ok: true, roomId })
    io.to(roomId).emit('server:room_ready', { roomId })
  })

  socket.on('controller:join', (payload, callback) => {
    const parsed = controllerJoinSchema.safeParse(payload)
    if (!parsed.success) {
      callback({ ok: false, message: parsed.error.message })
      return
    }
    const { roomId, controllerId, nickname } = parsed.data
    const session = rooms.get(roomId)
    if (!session) {
      callback({ ok: false, message: 'Room not found' })
      emitError(socket.id, { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
      return
    }

    if (session.controllers.size >= session.maxPlayers) {
      callback({ ok: false, message: 'Room full' })
      emitError(socket.id, { code: 'ROOM_FULL', message: 'Room is full' })
      return
    }

    const existing = session.controllers.get(controllerId)
    if (existing) {
      controllerIndex.delete(existing.socketId)
    }

    const controllerSession: ControllerSession = {
      controllerId,
      nickname,
      socketId: socket.id,
    }

    session.controllers.set(controllerId, controllerSession)
    controllerIndex.set(socket.id, { roomId, controllerId })
    socket.join(roomId)

    const notice: ControllerJoinedNotice = { controllerId, nickname }
    io.to(session.hostSocketId).emit('server:controller_joined', notice)
    callback({ ok: true, controllerId, roomId })
    socket.emit('server:welcome', { controllerId, roomId })
  })

  socket.on('controller:leave', (payload) => {
    const parsed = controllerLeaveSchema.safeParse(payload)
    if (!parsed.success) {
      emitError(socket.id, { code: 'INVALID_PAYLOAD', message: parsed.error.message })
      return
    }
    const { roomId, controllerId } = parsed.data
    const session = rooms.get(roomId)
    if (!session) {
      return
    }
    session.controllers.delete(controllerId)
    controllerIndex.delete(socket.id)
    const notice: ControllerLeftNotice = { controllerId }
    io.to(session.hostSocketId).emit('server:controller_left', notice)
    socket.leave(roomId)
  })

  socket.on('controller:input', (payload) => {
    const parsed = controllerInputSchema.safeParse(payload)
    if (!parsed.success) {
      emitError(socket.id, { code: 'INVALID_PAYLOAD', message: parsed.error.message })
      return
    }
    const { roomId, controllerId } = parsed.data
    const session = rooms.get(roomId)
    if (!session) {
      emitError(socket.id, { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
      return
    }
    if (!session.controllers.has(controllerId)) {
      emitError(socket.id, { code: 'INVALID_PAYLOAD', message: 'Controller not registered' })
      return
    }
    io.to(session.hostSocketId).emit('server:input', parsed.data)
  })

  socket.on('host:state', (payload) => {
    const parsed = controllerStateSchema.safeParse(payload)
    if (!parsed.success) {
      emitError(socket.id, { code: 'INVALID_PAYLOAD', message: parsed.error.message })
      return
    }
    const { roomId } = parsed.data
    const session = rooms.get(roomId)
    if (!session) {
      return
    }

    socket.to(roomId).emit('server:state', parsed.data)
  })

  socket.on('disconnect', () => {
    const roomId = hostIndex.get(socket.id)
    if (roomId) {
      removeRoom(roomId, 'Host disconnected')
      return
    }

    const controller = controllerIndex.get(socket.id)
    if (controller) {
      const session = rooms.get(controller.roomId)
      if (session) {
        session.controllers.delete(controller.controllerId)
        const notice: ControllerLeftNotice = { controllerId: controller.controllerId }
        io.to(session.hostSocketId).emit('server:controller_left', notice)
      }
      controllerIndex.delete(socket.id)
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`[air-jam] server listening on ${PORT}`)
})
