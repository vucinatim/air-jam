import type { JSX } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HostView } from './routes/host-view'
import { ControllerView } from './routes/controller-view'

export const App = (): JSX.Element => (
  <Routes>
    <Route path="/" element={<HostView />} />
    <Route path="/joypad" element={<ControllerView />} />
  </Routes>
)
