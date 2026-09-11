import { ContactShadows, Sparkles, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group, MathUtils, Mesh, Vector3 } from 'three'

export type HudState = {
  speed: number
  boost: boolean
  heading: number
  power: boolean
  lights: boolean
}

type SceneProps = {
  lightsOn: boolean
  powerOn: boolean
  onHudChange: (next: HudState) => void
  onTogglePower: () => void
  onToggleLights: () => void
}

type KeyState = {
  forward: boolean
  reverse: boolean
  left: boolean
  right: boolean
  brake: boolean
  boost: boolean
}

const TERRAIN_SIZE = 120
const COLOR = {
  shell: '#f4f5f5',
  shellDark: '#1e2228',
  shellMid: '#dfe1e3',
  accent: '#54f0d7',
  accentDark: '#1bb4a1',
  red: '#ff4d45',
  grass: '#7ccf80',
  path: '#f0dcb8',
  flower: '#f4b4d6',
}

function terrainHeightAt(x: number, z: number) {
  return (
    Math.sin(x * 0.14) * 1.25 +
    Math.cos(z * 0.18) * 1.05 +
    Math.sin((x + z) * 0.08) * 0.85 +
    Math.sin(x * 0.32) * Math.cos(z * 0.27) * 0.5
  )
}

function Robot({
  lightsOn,
  powerOn,
  onHudChange,
  onTogglePower,
  onToggleLights,
}: SceneProps) {
  const robotRef = useRef<Group>(null)
  const frontLeftPivot = useRef<Group>(null)
  const frontRightPivot = useRef<Group>(null)
  const rearLeftPivot = useRef<Group>(null)
  const rearRightPivot = useRef<Group>(null)
  const frontLeftWheel = useRef<Group>(null)
  const frontRightWheel = useRef<Group>(null)
  const rearLeftWheel = useRef<Group>(null)
  const rearRightWheel = useRef<Group>(null)
  const powerButton = useRef<Group>(null)
  const keys = useRef<KeyState>({
    forward: false,
    reverse: false,
    left: false,
    right: false,
    brake: false,
    boost: false,
  })

  const vehicle = useRef({
    position: new Vector3(0, 0, 0),
    velocity: 0,
    heading: 0,
    steer: 0,
  })

  useEffect(() => {
    const handleKey = (event: KeyboardEvent, value: boolean) => {
      const code = event.code
      if (code === 'KeyW' || code === 'ArrowUp') keys.current.forward = value
      if (code === 'KeyS' || code === 'ArrowDown') keys.current.reverse = value
      if (code === 'KeyA' || code === 'ArrowLeft') keys.current.left = value
      if (code === 'KeyD' || code === 'ArrowRight') keys.current.right = value
      if (code === 'Space') keys.current.brake = value
      if (code === 'ShiftLeft' || code === 'ShiftRight') keys.current.boost = value
    }

    const down = (event: KeyboardEvent) => handleKey(event, true)
    const up = (event: KeyboardEvent) => handleKey(event, false)

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.04)
    const throttle = (keys.current.forward ? 1 : 0) - (keys.current.reverse ? 1 : 0)
    const steerInput = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0)
    const boostActive = keys.current.boost && powerOn
    const acceleration = throttle * (boostActive ? 30 : 18)

    vehicle.current.velocity += (acceleration - vehicle.current.velocity * 2.6) * dt

    if (keys.current.brake) {
      vehicle.current.velocity *= 1 - dt * 7
    }

    if (!keys.current.forward && !keys.current.reverse) {
      vehicle.current.velocity *= 1 - dt * 2.5
    }

    if (Math.abs(vehicle.current.velocity) < 0.002) {
      vehicle.current.velocity = 0
    }

    const targetSteer = steerInput * 0.76
    vehicle.current.steer = MathUtils.damp(vehicle.current.steer, targetSteer, 6, dt)

    const speedFactor = Math.min(Math.abs(vehicle.current.velocity), 18)
    const turnRate = vehicle.current.steer * (0.38 + speedFactor * 0.04) * dt
    vehicle.current.heading += turnRate * Math.sign(vehicle.current.velocity || 1)

    const forward = new Vector3(Math.sin(vehicle.current.heading), 0, Math.cos(vehicle.current.heading))
    vehicle.current.position.addScaledVector(forward, vehicle.current.velocity * dt)

    const groundY = terrainHeightAt(vehicle.current.position.x, vehicle.current.position.z) + 0.72
    const pitch =
      terrainHeightAt(vehicle.current.position.x + 0.6, vehicle.current.position.z) -
      terrainHeightAt(vehicle.current.position.x - 0.6, vehicle.current.position.z)
    const roll =
      terrainHeightAt(vehicle.current.position.x, vehicle.current.position.z + 0.6) -
      terrainHeightAt(vehicle.current.position.x, vehicle.current.position.z - 0.6)

    vehicle.current.position.y = groundY

    if (robotRef.current) {
      robotRef.current.position.set(
        vehicle.current.position.x,
        vehicle.current.position.y + Math.sin(state.clock.elapsedTime * 1.7) * 0.04,
        vehicle.current.position.z,
      )
      robotRef.current.rotation.y = -vehicle.current.heading
      robotRef.current.rotation.x = -pitch * 0.2
      robotRef.current.rotation.z = -roll * 0.2
    }

    const wheelSpin = vehicle.current.velocity * dt * 1.5
    const steerAngle = vehicle.current.steer * 0.82

    if (frontLeftPivot.current) frontLeftPivot.current.rotation.y = steerAngle
    if (frontRightPivot.current) frontRightPivot.current.rotation.y = steerAngle
    if (rearLeftPivot.current) rearLeftPivot.current.rotation.y = 0
    if (rearRightPivot.current) rearRightPivot.current.rotation.y = 0

    if (frontLeftWheel.current) frontLeftWheel.current.rotation.z -= wheelSpin
    if (frontRightWheel.current) frontRightWheel.current.rotation.z -= wheelSpin
    if (rearLeftWheel.current) rearLeftWheel.current.rotation.z -= wheelSpin
    if (rearRightWheel.current) rearRightWheel.current.rotation.z -= wheelSpin

    if (powerButton.current) {
      powerButton.current.position.y = powerOn ? 0.05 : -0.05
      powerButton.current.scale.y = powerOn ? 1 : 0.72
    }

    const cameraTarget = new Vector3(
      vehicle.current.position.x - Math.sin(vehicle.current.heading) * 7,
      vehicle.current.position.y + 3.8,
      vehicle.current.position.z - Math.cos(vehicle.current.heading) * 7,
    )
    state.camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4))
    state.camera.lookAt(
      vehicle.current.position.x + Math.sin(vehicle.current.heading) * 2,
      vehicle.current.position.y + 1.4,
      vehicle.current.position.z + Math.cos(vehicle.current.heading) * 2,
    )

    onHudChange({
      speed: Math.abs(vehicle.current.velocity) * 4.5,
      boost: boostActive,
      heading: vehicle.current.heading,
      power: powerOn,
      lights: lightsOn,
    })
  })

  return (
    <group ref={robotRef} position={[0, 0.7, 0]}>
      <group position={[0, 0.4, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.72, 0]} scale={[1, 0.92, 1]}>
          <boxGeometry args={[4.2, 1.2, 2.5]} />
          <meshStandardMaterial color={COLOR.shell} roughness={0.48} metalness={0.22} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 1.15, 0.05]} scale={[1.05, 0.8, 1]}>
          <boxGeometry args={[3.72, 0.78, 2.05]} />
          <meshStandardMaterial color={COLOR.shell} roughness={0.5} metalness={0.18} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
          <boxGeometry args={[3.9, 0.3, 2.26]} />
          <meshStandardMaterial color={COLOR.shellDark} roughness={0.75} metalness={0.3} />
        </mesh>

        <mesh castShadow receiveShadow position={[0.02, 0.6, 1.32]}>
          <boxGeometry args={[3.28, 0.64, 0.22]} />
          <meshStandardMaterial color={COLOR.shellDark} roughness={0.7} metalness={0.4} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.02, 0.6, -1.32]}>
          <boxGeometry args={[3.28, 0.64, 0.22]} />
          <meshStandardMaterial color={COLOR.shellDark} roughness={0.7} metalness={0.4} />
        </mesh>

        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[3.1, 0.4, 1.5]} />
          <meshStandardMaterial color={COLOR.shellDark} roughness={0.32} metalness={0.44} />
        </mesh>

        <mesh position={[0, 1.42, 0]}>
          <boxGeometry args={[2.3, 0.12, 1.25]} />
          <meshStandardMaterial color={COLOR.shell} roughness={0.3} metalness={0.25} />
        </mesh>

        <mesh
          position={[0, 1.52, 0.72]}
          onClick={(event) => {
            event.stopPropagation()
            onToggleLights()
          }}
        >
          <boxGeometry args={[0.9, 0.25, 0.18]} />
          <meshStandardMaterial
            color={lightsOn ? COLOR.accent : '#2c3d3d'}
            emissive={lightsOn ? COLOR.accent : '#0d1a1c'}
            emissiveIntensity={lightsOn ? 2.4 : 0.2}
          />
        </mesh>

        <mesh
          position={[0, 1.52, -0.72]}
          onClick={(event) => {
            event.stopPropagation()
            onTogglePower()
          }}
        >
          <boxGeometry args={[0.9, 0.25, 0.18]} />
          <meshStandardMaterial
            color={powerOn ? COLOR.red : '#3b0d14'}
            emissive={powerOn ? COLOR.red : '#1b070b'}
            emissiveIntensity={powerOn ? 2.3 : 0.2}
          />
        </mesh>

        <mesh position={[-1.35, 0.95, 1.34]} castShadow>
          <boxGeometry args={[0.68, 0.3, 0.18]} />
          <meshStandardMaterial color={COLOR.shellDark} roughness={0.85} />
        </mesh>

        <mesh position={[1.35, 0.95, 1.34]} castShadow>
          <boxGeometry args={[0.68, 0.3, 0.18]} />
          <meshStandardMaterial color={COLOR.shellDark} roughness={0.85} />
        </mesh>

        <group ref={powerButton} position={[0, 0.38, 0]}>
          <mesh
            onClick={(event) => {
              event.stopPropagation()
              onTogglePower()
            }}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.24, 0.24, 0.2, 32]} />
            <meshStandardMaterial
              color={powerOn ? COLOR.accent : '#d5dfe3'}
              emissive={powerOn ? COLOR.accentDark : '#4d5661'}
              emissiveIntensity={powerOn ? 1.8 : 0.3}
            />
          </mesh>
        </group>

        <mesh position={[0, 1.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.1, 0.8]} />
          <meshStandardMaterial color={COLOR.shellMid} roughness={0.45} metalness={0.18} />
        </mesh>
      </group>

      <group position={[-1.65, 0.08, 1.1]} ref={frontLeftPivot}>
        <group ref={frontLeftWheel} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.46, 32]} />
            <meshStandardMaterial color="#171b20" roughness={0.92} metalness={0.28} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0, 0.02]}>
            <cylinderGeometry args={[0.38, 0.38, 0.48, 32]} />
            <meshStandardMaterial color={COLOR.accent} emissive={COLOR.accent} emissiveIntensity={1.1} />
          </mesh>
        </group>
      </group>

      <group position={[1.65, 0.08, 1.1]} ref={frontRightPivot}>
        <group ref={frontRightWheel} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.46, 32]} />
            <meshStandardMaterial color="#171b20" roughness={0.92} metalness={0.28} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0, 0.02]}>
            <cylinderGeometry args={[0.38, 0.38, 0.48, 32]} />
            <meshStandardMaterial color={COLOR.accent} emissive={COLOR.accent} emissiveIntensity={1.1} />
          </mesh>
        </group>
      </group>

      <group position={[-1.65, 0.08, -1.1]} ref={rearLeftPivot}>
        <group ref={rearLeftWheel} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.46, 32]} />
            <meshStandardMaterial color="#171b20" roughness={0.92} metalness={0.28} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0, 0.02]}>
            <cylinderGeometry args={[0.38, 0.38, 0.48, 32]} />
            <meshStandardMaterial color={COLOR.accent} emissive={COLOR.accent} emissiveIntensity={1.1} />
          </mesh>
        </group>
      </group>

      <group position={[1.65, 0.08, -1.1]} ref={rearRightPivot}>
        <group ref={rearRightWheel} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.46, 32]} />
            <meshStandardMaterial color="#171b20" roughness={0.92} metalness={0.28} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0, 0.02]}>
            <cylinderGeometry args={[0.38, 0.38, 0.48, 32]} />
            <meshStandardMaterial color={COLOR.accent} emissive={COLOR.accent} emissiveIntensity={1.1} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function Scene(props: SceneProps) {
  const terrainRef = useRef<Mesh>(null)
  const flora = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const angle = (index / 30) * Math.PI * 2
        const radius = 16 + (index % 6) * 7
        return {
          position: [
            Math.cos(angle) * radius + (index % 5) * 2,
            0,
            Math.sin(angle) * radius + (index % 4) * 1.8,
          ] as [number, number, number],
        }
      }),
    [],
  )

  useFrame(() => {
    const terrain = terrainRef.current
    if (!terrain) return

    const geometry = terrain.geometry
    const positions = geometry.attributes.position
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const y = positions.getY(index)
      const height = terrainHeightAt(x, y)
      positions.setZ(index, height)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <>
      <color attach="background" args={['#edf7ff']} />
      <fog attach="fog" args={['#edf7ff', 10, 60]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#dfeeff', '#95b77d', 1.2]} />
      <directionalLight
        castShadow
        position={[12, 18, 9]}
        intensity={2.4}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <group>
        <mesh ref={terrainRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, 180, 180]} />
          <meshStandardMaterial color={COLOR.grass} roughness={0.96} />
        </mesh>

        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[8, 18, 72]} />
          <meshStandardMaterial color={COLOR.path} roughness={1} />
        </mesh>
      </group>

      {flora.map((item, index) => (
        <group key={index} position={item.position}>
          {index % 3 === 0 ? (
            <>
              <mesh castShadow position={[0, 0.42, 0]}>
                <cylinderGeometry args={[0.08, 0.12, 0.8, 12]} />
                <meshStandardMaterial color="#5d3b2c" />
              </mesh>
              <mesh castShadow position={[0, 1.08, 0]}>
                <sphereGeometry args={[0.45, 18, 18]} />
                <meshStandardMaterial color="#4ec386" />
              </mesh>
            </>
          ) : index % 3 === 1 ? (
            <>
              <mesh castShadow position={[0, 0.28, 0]}>
                <cylinderGeometry args={[0.06, 0.08, 0.56, 10]} />
                <meshStandardMaterial color="#f4e7d5" />
              </mesh>
              <mesh castShadow position={[0, 0.62, 0]}>
                <sphereGeometry args={[0.2, 12, 12]} />
                <meshStandardMaterial color={COLOR.flower} />
              </mesh>
            </>
          ) : (
            <>
              <mesh castShadow position={[0, 0.24, 0]}>
                <cylinderGeometry args={[0.04, 0.06, 0.4, 8]} />
                <meshStandardMaterial color="#f0e5d8" />
              </mesh>
              <mesh castShadow position={[0, 0.45, 0]}>
                <sphereGeometry args={[0.18, 12, 12]} />
                <meshStandardMaterial color="#f7b98c" />
              </mesh>
            </>
          )}
        </group>
      ))}

      <Robot {...props} />

      <Sparkles count={140} scale={[65, 18, 65]} size={2} speed={0.2} opacity={0.9} color="#f8f3b0" />
      <Stars radius={60} depth={20} count={1500} factor={4} saturation={0} fade speed={1} />
      <ContactShadows position={[0, -0.2, 0]} scale={42} blur={2} far={15} opacity={0.6} />
    </>
  )
}
