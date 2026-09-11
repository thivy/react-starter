import { Float, Sky, Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type HudState = {
  speed: number
  heading: number
  boost: boolean
}

type SceneProps = {
  onHudUpdate: (hud: HudState) => void
}

type PlantProps = {
  position: [number, number, number]
  scale?: number
  tint?: string
}

const terrainHeightAt = (x: number, z: number) => {
  const rolling = Math.sin(x * 0.32) * 1.05 + Math.cos(z * 0.28) * 0.85
  const contour = Math.sin((x + z) * 0.17) * 0.55 + Math.cos((x - z) * 0.2) * 0.4
  return rolling + contour
}

const flowerColors = ['#ff9ac1', '#ffd56b', '#7ad7d0', '#8ebeff', '#9eec85', '#f4b6d7']

function useKeyboardControls() {
  const keys = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()

      if (event.code === 'Space') {
        keys.current.space = true
      }

      keys.current[key] = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()

      if (event.code === 'Space') {
        keys.current.space = false
      }

      keys.current[key] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return keys
}

function GrassPatch({ position, scale = 1, tint = '#90d27d' }: PlantProps) {
  const tuft = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!tuft.current) return

    const swirl = Math.sin(clock.elapsedTime * 1.2 + position[0] * 0.4 + position[2] * 0.6) * 0.22
    tuft.current.rotation.z = swirl
    tuft.current.rotation.x = Math.cos(clock.elapsedTime * 1.5 + position[2] * 0.35) * 0.12
  })

  return (
    <group ref={tuft} position={position} scale={scale}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[0.08, 0.45, 0.08]} />
        <meshStandardMaterial color={tint} roughness={1} />
      </mesh>
      <mesh castShadow position={[0.08, 0.36, 0.02]} rotation={[0.2, 0.1, 0.2]}>
        <boxGeometry args={[0.06, 0.32, 0.06]} />
        <meshStandardMaterial color={tint} roughness={1} />
      </mesh>
      <mesh castShadow position={[-0.09, 0.34, -0.03]} rotation={[0.4, -0.2, -0.1]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color={tint} roughness={1} />
      </mesh>
    </group>
  )
}

function Rock({ position, scale = 1 }: PlantProps) {
  return (
    <mesh castShadow receiveShadow position={position} scale={scale}>
      <dodecahedronGeometry args={[0.35, 0]} />
      <meshStandardMaterial color="#9a9f9c" roughness={0.95} />
    </mesh>
  )
}

function Mushroom({ position, scale = 1 }: PlantProps) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.35, 14]} />
        <meshStandardMaterial color="#f4f1ec" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.47, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#f7d7e0" roughness={0.95} />
      </mesh>
    </group>
  )
}

function Tree({ position, scale = 1 }: PlantProps) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.7, 10]} />
        <meshStandardMaterial color="#7b4f39" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 0.96, 0]}>
        <sphereGeometry args={[0.42, 18, 18]} />
        <meshStandardMaterial color="#7fcf7f" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.2, 0.78, 0.15]}>
        <sphereGeometry args={[0.24, 14, 14]} />
        <meshStandardMaterial color="#a9e28d" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Flower({ position, scale = 1, tint = '#ff9ac1' }: PlantProps) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.28, 8]} />
        <meshStandardMaterial color="#7bb76a" roughness={1} />
      </mesh>
      {Array.from({ length: 6 }).map((_, index) => (
        <mesh
          key={`${position.join('-')}-${index}`}
          castShadow
          rotation={[0, (index / 6) * Math.PI * 2, 0]}
          position={[0.08, 0.28, 0]}
        >
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={tint} roughness={0.7} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#ffe682" roughness={0.7} />
      </mesh>
    </group>
  )
}

function Terrain() {
  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(120, 120, 180, 180)
    const position = base.attributes.position

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index)
      const y = position.getY(index)
      const height = terrainHeightAt(x, y)
      position.setZ(index, height)
    }

    base.rotateX(-Math.PI / 2)
    base.computeVertexNormals()
    return base
  }, [])

  const grassTufts = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const x = (Math.sin(index * 1.73) * 16 + (index % 7) * 4.8 - 18) * 2.2
        const z = (Math.cos(index * 1.12) * 17 + (index % 5) * 5.1 - 22) * 2.1
        return {
          position: [x, terrainHeightAt(x, z), z] as [number, number, number],
          scale: 0.7 + ((index % 5) / 10),
          tint: index % 2 === 0 ? '#8ad57a' : '#78c66c',
        }
      }),
    [],
  )

  const flowers = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const x = ((index % 15) - 7) * 7.5 + (index % 3) * 1.2
        const z = (Math.floor(index / 15) - 4) * 7 + (index % 4) * 2.3
        return {
          position: [x, terrainHeightAt(x, z) + 0.08, z] as [number, number, number],
          scale: 0.8 + (index % 4) * 0.15,
          tint: flowerColors[index % flowerColors.length],
        }
      }),
    [],
  )

  const mushrooms = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => {
        const x = ((index % 9) - 4) * 8.5 + (index % 3) * 1.2
        const z = (Math.floor(index / 9) - 2) * 7.5 + (index % 4) * 1.6
        return {
          position: [x, terrainHeightAt(x, z) + 0.08, z] as [number, number, number],
          scale: 0.8 + (index % 4) * 0.2,
        }
      }),
    [],
  )

  const rocks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const x = ((index % 6) - 3) * 16 + (index % 2) * 5
        const z = (Math.floor(index / 6) - 2) * 11 + (index % 5) * 2.4
        return {
          position: [x, terrainHeightAt(x, z), z] as [number, number, number],
          scale: 0.7 + (index % 3) * 0.4,
        }
      }),
    [],
  )

  const trees = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const x = ((index % 6) - 3) * 18 + (index % 2) * 7.5
        const z = (Math.floor(index / 6) - 2) * 15 + (index % 5) * 3.2
        return {
          position: [x, terrainHeightAt(x, z), z] as [number, number, number],
          scale: 0.7 + (index % 3) * 0.45,
        }
      }),
    [],
  )

  const pathSegments = useMemo(
    () =>
      [
        { position: [0, terrainHeightAt(0, 24) + 0.02, 24], rotation: [0, 0.6, 0], size: [12, 0.08, 2.2] },
        { position: [5, terrainHeightAt(5, 15) + 0.02, 15], rotation: [0, 1.1, 0], size: [12, 0.08, 2.2] },
        { position: [11, terrainHeightAt(11, 6) + 0.02, 6], rotation: [0, 1.5, 0], size: [12, 0.08, 2.2] },
        { position: [10, terrainHeightAt(10, -6) + 0.02, -6], rotation: [0, 1.8, 0], size: [12, 0.08, 2.1] },
        { position: [4, terrainHeightAt(4, -16) + 0.02, -16], rotation: [0, 2.4, 0], size: [10, 0.08, 2.4] },
      ] as Array<{
        position: [number, number, number]
        rotation: [number, number, number]
        size: [number, number, number]
      }>,
    [],
  )

  return (
    <>
      <mesh geometry={geometry} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#8cc975" roughness={1} metalness={0.08} />
      </mesh>

      {grassTufts.map((patch, index) => (
        <GrassPatch key={`grass-${index}`} position={patch.position} scale={patch.scale} tint={patch.tint} />
      ))}

      {flowers.map((flower, index) => (
        <Flower key={`flower-${index}`} position={flower.position} scale={flower.scale} tint={flower.tint} />
      ))}

      {mushrooms.map((mushroom, index) => (
        <Mushroom key={`mushroom-${index}`} position={mushroom.position} scale={mushroom.scale} />
      ))}

      {rocks.map((rock, index) => (
        <Rock key={`rock-${index}`} position={rock.position} scale={rock.scale} />
      ))}

      {trees.map((tree, index) => (
        <Tree key={`tree-${index}`} position={tree.position} scale={tree.scale} />
      ))}

      {pathSegments.map((segment, index) => (
        <mesh key={`path-${index}`} position={segment.position} rotation={segment.rotation} receiveShadow>
          <boxGeometry args={segment.size as [number, number, number]} />
          <meshStandardMaterial color="#cab799" roughness={0.95} />
        </mesh>
      ))}
    </>
  )
}

export default function Scene({ onHudUpdate }: SceneProps) {
  const controls = useKeyboardControls()
  const { camera } = useThree()
  const robotRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const wheelRefs = useRef<THREE.Group[]>([])
  const wheelSpin = useRef<number[]>([0, 0, 0, 0])
  const steering = useRef(0)
  const heading = useRef(0)
  const velocity = useRef(0)
  const frontLightRef = useRef<THREE.MeshStandardMaterial>(null)
  const brakeLightRef = useRef<THREE.MeshStandardMaterial>(null)
  const [powerOn, setPowerOn] = useState(true)
  const [scanMode, setScanMode] = useState(false)

  useFrame((state, delta) => {
    const moveInput =
      Number(Boolean(controls.current.w || controls.current.arrowup)) -
      Number(Boolean(controls.current.s || controls.current.arrowdown))

    const steerInput =
      Number(Boolean(controls.current.d || controls.current.arrowright)) -
      Number(Boolean(controls.current.a || controls.current.arrowleft))

    const braking = Boolean(controls.current.space)
    const boost = Boolean(controls.current.shift)
    const maxSpeed = boost ? 11 : 7.5

    const targetSpeed = moveInput * maxSpeed
    velocity.current = THREE.MathUtils.damp(velocity.current, targetSpeed, braking ? 14 : 4.6, delta)

    if (!moveInput && !braking) {
      velocity.current = THREE.MathUtils.damp(velocity.current, 0, 3.2, delta)
    }

    if (braking) {
      velocity.current = THREE.MathUtils.damp(velocity.current, 0, 17, delta)
    }

    const turnScale = Math.min(Math.abs(velocity.current) / maxSpeed, 1)
    const targetSteer = steerInput * (0.7 + turnScale * 0.8)
    steering.current = THREE.MathUtils.damp(steering.current, targetSteer, 8, delta)

    const drivingDirection = Math.abs(velocity.current) > 0.05 ? Math.sign(velocity.current) : 1
    heading.current += steering.current * delta * (0.9 + turnScale * 1.6) * drivingDirection

    if (!robotRef.current) return

    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      heading.current,
    )

    robotRef.current.rotation.y = heading.current
    robotRef.current.position.x += forward.x * velocity.current * delta
    robotRef.current.position.z += forward.z * velocity.current * delta

    const groundHeight = terrainHeightAt(robotRef.current.position.x, robotRef.current.position.z) + 0.72
    robotRef.current.position.y = THREE.MathUtils.damp(
      robotRef.current.position.y,
      groundHeight,
      8,
      delta,
    )

    if (bodyRef.current) {
      const bodyRoll = -steering.current * 0.32 * (0.4 + Math.abs(velocity.current) * 0.32)
      bodyRef.current.rotation.z = THREE.MathUtils.damp(
        bodyRef.current.rotation.z,
        bodyRoll,
        6,
        delta,
      )
      bodyRef.current.rotation.x = THREE.MathUtils.damp(
        bodyRef.current.rotation.x,
        -velocity.current * 0.08 + Math.sin(state.clock.elapsedTime * 2.5) * 0.06,
        5,
        delta,
      )
      bodyRef.current.position.y = 0.14 + Math.sin(state.clock.elapsedTime * 2.5) * 0.05
    }

    wheelRefs.current.forEach((wheel, index) => {
      const isFront = index < 2
      wheelSpin.current[index] += velocity.current * delta * 2.2
      wheel.rotation.x = wheelSpin.current[index]
      wheel.rotation.y = isFront ? steering.current : 0
    })

    if (frontLightRef.current) {
      const lightPulse = powerOn ? 1.1 + Math.sin(state.clock.elapsedTime * 8) * 0.3 : 0.15
      frontLightRef.current.emissiveIntensity = lightPulse
    }

    if (brakeLightRef.current) {
      const brakePulse = scanMode ? 1.1 + Math.sin(state.clock.elapsedTime * 10) * 0.25 : 0.18
      brakeLightRef.current.emissiveIntensity = brakePulse
    }

    const cameraTarget = new THREE.Vector3(
      robotRef.current.position.x - forward.x * 6.2,
      robotRef.current.position.y + 3.3,
      robotRef.current.position.z - forward.z * 6.2,
    )

    camera.position.lerp(cameraTarget, 1 - Math.pow(0.001, delta))
    camera.lookAt(
      robotRef.current.position.x + forward.x * 2.8,
      robotRef.current.position.y + 1.1,
      robotRef.current.position.z + forward.z * 2.8,
    )

    onHudUpdate({
      speed: velocity.current,
      heading: heading.current,
      boost,
    })
  })

  return (
    <>
      <color attach="background" args={['#eaf6f1']} />
      <fog attach="fog" args={['#edf8f4', 18, 70]} />

      <ambientLight intensity={0.9} color="#fff8ef" />
      <hemisphereLight groundColor="#a7cf9a" intensity={1.1} color="#fef8ee" />
      <directionalLight
        castShadow
        position={[12, 14, 8]}
        intensity={2.4}
        color="#fff8ef"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
      />
      <Sky sunPosition={[14, 8, 12]} turbidity={7} rayleigh={1.5} azimuth={0.18} inclination={0.2} />

      <Terrain />

      <Sparkles
        color="#d6f89d"
        count={70}
        scale={[24, 8, 24]}
        size={3.5}
        speed={0.25}
        opacity={0.9}
        position={[0, 2.8, 0]}
      />

      <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.4}>
        <mesh position={[-8, 4.6, 12]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#f8ed93" emissive="#f8ed93" emissiveIntensity={1.2} />
        </mesh>
      </Float>

      <group ref={robotRef} position={[0, terrainHeightAt(0, 0) + 0.72, 0]}>
        <group ref={bodyRef} position={[0, 0.1, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.82, 0]}>
            <boxGeometry args={[2.8, 0.7, 1.8]} />
            <meshStandardMaterial color="#f1f3f0" roughness={0.5} metalness={0.15} />
          </mesh>

          <mesh castShadow receiveShadow position={[0, 0.38, 0]}>
            <boxGeometry args={[2.9, 0.52, 1.65]} />
            <meshStandardMaterial color="#11161d" roughness={0.8} metalness={0.3} />
          </mesh>

          <mesh castShadow receiveShadow position={[0, 0.98, 0]}>
            <boxGeometry args={[2.15, 0.42, 1.45]} />
            <meshStandardMaterial color="#f3f6f7" roughness={0.45} metalness={0.1} />
          </mesh>

          <mesh castShadow receiveShadow position={[0.25, 0.95, 0]}>
            <boxGeometry args={[0.8, 0.15, 1.2]} />
            <meshStandardMaterial color="#dfe3df" roughness={0.5} metalness={0.12} />
          </mesh>

          <mesh castShadow receiveShadow position={[1.52, 0.72, 0]}>
            <boxGeometry args={[0.18, 0.52, 1.38]} />
            <meshStandardMaterial color="#e5e8e8" roughness={0.6} metalness={0.18} />
          </mesh>

          <mesh castShadow receiveShadow position={[-1.52, 0.72, 0]}>
            <boxGeometry args={[0.18, 0.52, 1.38]} />
            <meshStandardMaterial color="#e5e8e8" roughness={0.6} metalness={0.18} />
          </mesh>

          <mesh castShadow receiveShadow position={[0, 1.24, 0.03]}>
            <boxGeometry args={[1.15, 0.2, 0.72]} />
            <meshStandardMaterial color="#10151a" roughness={0.68} metalness={0.32} />
          </mesh>

          <mesh castShadow position={[0.28, 1.46, 0]} onClick={() => setPowerOn((value) => !value)}>
            <cylinderGeometry args={[0.12, 0.12, 0.11, 32]} />
            <meshStandardMaterial
              color={powerOn ? '#dff9ff' : '#a3bcc5'}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          <mesh castShadow position={[0.28, 1.57, 0]} scale={powerOn ? 1 : 0.72}>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 32]} />
            <meshStandardMaterial color="#3de3d0" emissive="#26e7c4" emissiveIntensity={0.9} />
          </mesh>

          <mesh castShadow position={[-0.72, 1.3, 0]} onClick={() => setScanMode((value) => !value)}>
            <boxGeometry args={[0.2, 0.2, 0.12]} />
            <meshStandardMaterial color={scanMode ? '#d8fff3' : '#b8c3cf'} roughness={0.3} metalness={0.8} />
          </mesh>

          <mesh position={[0, 1.05, 0.9]}>
            <boxGeometry args={[1.5, 0.1, 0.08]} />
            <meshStandardMaterial
              ref={frontLightRef}
              color="#ff5f5f"
              emissive="#ff3636"
              emissiveIntensity={1.2}
              roughness={0.4}
            />
          </mesh>

          <mesh position={[0, 1.05, -0.9]}>
            <boxGeometry args={[1.5, 0.1, 0.08]} />
            <meshStandardMaterial
              ref={brakeLightRef}
              color="#ff2730"
              emissive="#ff2730"
              emissiveIntensity={0.2}
              roughness={0.35}
            />
          </mesh>

          <mesh castShadow receiveShadow position={[-0.6, 0.25, 0.95]}>
            <boxGeometry args={[0.9, 0.2, 0.06]} />
            <meshStandardMaterial color="#090c10" roughness={0.85} />
          </mesh>

          <mesh castShadow receiveShadow position={[0.6, 0.25, 0.95]}>
            <boxGeometry args={[0.9, 0.2, 0.06]} />
            <meshStandardMaterial color="#090c10" roughness={0.85} />
          </mesh>

          <mesh castShadow receiveShadow position={[-0.6, 0.25, -0.95]}>
            <boxGeometry args={[0.9, 0.2, 0.06]} />
            <meshStandardMaterial color="#090c10" roughness={0.85} />
          </mesh>

          <mesh castShadow receiveShadow position={[0.6, 0.25, -0.95]}>
            <boxGeometry args={[0.9, 0.2, 0.06]} />
            <meshStandardMaterial color="#090c10" roughness={0.85} />
          </mesh>

          {[-1.2, 1.2].map((x) =>
            [-1, 1].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.25, z * 0.82]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.52, 0.05, 12, 32]} />
                <meshStandardMaterial color="#67f8e0" emissive="#67f8e0" emissiveIntensity={0.8} />
              </mesh>
            )),
          )}
        </group>

        {[
          [-1.2, 0.32, 0.95],
          [1.2, 0.32, 0.95],
          [-1.2, 0.32, -0.95],
          [1.2, 0.32, -0.95],
        ].map((position, index) => (
          <group
            key={`wheel-${index}`}
            ref={(node) => {
              if (node) {
                wheelRefs.current[index] = node
              }
            }}
            position={position as [number, number, number]}
          >
            <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.42, 0.42, 0.32, 28]} />
              <meshStandardMaterial color="#1c2027" roughness={0.82} metalness={0.2} />
            </mesh>
            <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.38, 18]} />
              <meshStandardMaterial color="#dbe3e8" roughness={0.4} metalness={0.75} />
            </mesh>
            <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.39, 0.05, 12, 28]} />
              <meshStandardMaterial color="#68ead1" emissive="#68ead1" emissiveIntensity={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}
