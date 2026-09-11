import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import Scene from './components/Scene'
import './App.css'

function App() {
  const [animated, setAnimated] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  return (
    <main className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [5, 4, 6], fov: 45, near: 0.1, far: 100 }}
        aria-label="3D scene with a rotating cube above a grid"
        fallback={
          <div className="scene-fallback" role="alert">
            This example requires WebGL. Try a browser with hardware acceleration
            enabled.
          </div>
        }
      >
        <Scene animated={animated} />
      </Canvas>

      <section className="scene-overlay" aria-label="Scene controls">
        <h1>3D Playground</h1>
        <p>Drag to orbit. Scroll or pinch to zoom.</p>
        <button type="button" onClick={() => setAnimated((value) => !value)}>
          {animated ? 'Pause rotation' : 'Resume rotation'}
        </button>
      </section>
    </main>
  )
}

export default App
