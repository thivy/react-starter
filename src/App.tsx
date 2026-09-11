import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import Scene, { type HudState } from './components/Scene'
import './App.css'

function App() {
  const [powerOn, setPowerOn] = useState(true)
  const [lightsOn, setLightsOn] = useState(true)
  const [hud, setHud] = useState<HudState>({
    speed: 0,
    boost: false,
    heading: 0,
    power: true,
    lights: true,
  })

  return (
    <main className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 3.8, 8], fov: 42, near: 0.1, far: 200 }}
        aria-label="Interactive 3D robot driving simulation"
        fallback={
          <div className="scene-fallback" role="alert">
            This experience requires WebGL. Try a browser with hardware acceleration
            enabled.
          </div>
        }
      >
        <Scene
          onHudChange={setHud}
          lightsOn={lightsOn}
          powerOn={powerOn}
          onTogglePower={() => setPowerOn((value) => !value)}
          onToggleLights={() => setLightsOn((value) => !value)}
        />
      </Canvas>

      <div className="hud" aria-live="polite">
        <div className="hud-panel speed-panel">
          <span className="hud-label">Speed</span>
          <strong>{Math.round(hud.speed)} km/h</strong>
        </div>

        <div className="hud-panel compass-panel">
          <span className="hud-label">Heading</span>
          <div className="compass">
            <span className="needle" style={{ transform: `rotate(${hud.heading}rad)` }} />
          </div>
        </div>

        <div className="hud-panel boost-panel">
          <span className="hud-label">Boost</span>
          <strong className={hud.boost ? 'boost-active' : ''}>
            {hud.boost ? 'Active' : 'Standby'}
          </strong>
        </div>
      </div>

      <div className="controls-panel">
        <div className="controls-title">Controls</div>
        <div className="controls-grid">
          <span>W / ↑</span>
          <span>Drive</span>
          <span>S / ↓</span>
          <span>Reverse</span>
          <span>A / ←</span>
          <span>Steer</span>
          <span>D / →</span>
          <span>Steer</span>
          <span>Space</span>
          <span>Brake</span>
          <span>Shift</span>
          <span>Boost</span>
        </div>
      </div>
    </main>
  )
}

export default App
