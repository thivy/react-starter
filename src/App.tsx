import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import Scene from './components/Scene'
import './App.css'

type HudState = {
  speed: number
  heading: number
  boost: boolean
}

function App() {
  const [hud, setHud] = useState<HudState>({ speed: 0, heading: 0, boost: false })

  const direction = useMemo(() => {
    const angle = ((hud.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const segments = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round((angle / (Math.PI / 4)) % segments.length)
    return segments[index]
  }, [hud.heading])

  return (
    <main className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [6, 4.5, 9], fov: 42, near: 0.1, far: 200 }}
        aria-label="3D robot driving scene"
        fallback={
          <div className="scene-fallback" role="alert">
            This example requires WebGL. Try a browser with hardware acceleration
            enabled.
          </div>
        }
      >
        <Scene onHudUpdate={setHud} />
      </Canvas>

      <div className="hud" aria-live="polite">
        <div className="hud-card">
          <div className="hud-label">Speed</div>
          <div className="hud-value">{Math.round(Math.abs(hud.speed) * 12)} km/h</div>
          <div className="hud-meta">
            <span className={`status-pill ${hud.boost ? 'active' : ''}`}>
              {hud.boost ? 'Boost ON' : 'Boost OFF'}
            </span>
            <span className="direction-pill">{direction}</span>
          </div>
        </div>
      </div>

      <div className="legend" aria-label="Driving controls">
        <span>WASD / Arrows</span>
        <span>Space brake</span>
        <span>Shift boost</span>
      </div>
    </main>
  )
}

export default App
