import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

type SceneProps = {
  animated: boolean
}

function RotatingCube({ animated, color }: SceneProps & { color: string }) {
  const mesh = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!mesh.current || !animated) return

    const step = Math.min(delta, 0.1)
    mesh.current.rotation.x += step * 0.25
    mesh.current.rotation.y += step * 0.5
  })

  return (
    <mesh ref={mesh} position={[0, 1.5, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.15} />
    </mesh>
  )
}

export default function Scene({ animated }: SceneProps) {
  const theme = getComputedStyle(document.documentElement)
  const background = theme.getPropertyValue('--cp-bg').trim()
  const ground = theme.getPropertyValue('--cp-surface-soft').trim()
  const accent = theme.getPropertyValue('--cp-accent').trim()
  const grid = theme.getPropertyValue('--cp-border').trim()
  const gridCenter = theme.getPropertyValue('--cp-border-strong').trim()

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 16, 42]} />
      <ambientLight intensity={0.7} />
      <directionalLight
        castShadow
        position={[6, 9, 5]}
        intensity={3}
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.04}
      />

      <RotatingCube animated={animated} color={accent} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={ground} roughness={1} />
      </mesh>
      <gridHelper args={[40, 40, gridCenter, grid]} />

      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        enableDamping
        enablePan={false}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  )
}
