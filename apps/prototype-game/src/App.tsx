import type { JSX } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HostView } from './routes/HostView'
import { ControllerView } from './routes/ControllerView'

export const App = (): JSX.Element => (
  <Routes>
    <Route path="/" element={<HostView />} />
    <Route path="/joypad" element={<ControllerView />} />
  </Routes>
)
