import { RoundedBox, useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import { BoxGeometry, ExtrudeGeometry, LatheGeometry, Matrix4, Shape, Vector2 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { RobotSimulation } from '../lib/simulation'
import { WHEEL_CONNECTIONS } from '../lib/simulation'

const finish = {
  shell: '#edece6',
  chassis: '#242a29',
  rubber: '#242826',
  tread: '#303632',
  rim: '#545d58',
  hub: '#373e39',
  mint: '#7cffe0',
  seam: '#6e7772',
}

function roundedPanel(width: number, height: number, radius: number, depth = 0.03) {
  const shape = new Shape()
  const left = -width / 2
  const bottom = -height / 2
  shape.moveTo(left + radius, bottom)
  shape.lineTo(left + width - radius, bottom)
  shape.quadraticCurveTo(left + width, bottom, left + width, bottom + radius)
  shape.lineTo(left + width, bottom + height - radius)
  shape.quadraticCurveTo(left + width, bottom + height, left + width - radius, bottom + height)
  shape.lineTo(left + radius, bottom + height)
  shape.quadraticCurveTo(left, bottom + height, left, bottom + height - radius)
  shape.lineTo(left, bottom + radius)
  shape.quadraticCurveTo(left, bottom, left + radius, bottom)
  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.012,
    curveSegments: 12,
  })
}

function sidePanel() {
  const shape = new Shape()
  shape.moveTo(-1.12, 0.99)
  shape.bezierCurveTo(-1.3, 0.99, -1.31, 0.8, -1.32, 0.62)
  shape.lineTo(-1.32, 0.17)
  shape.bezierCurveTo(-1.14, 0.14, -1.2, 0.4, -0.88, 0.4)
  shape.bezierCurveTo(-0.52, 0.4, -0.45, 0.16, -0.3, -0.08)
  shape.quadraticCurveTo(0, -0.22, 0.3, -0.08)
  shape.bezierCurveTo(0.47, 0.19, 0.57, 0.4, 0.88, 0.4)
  shape.bezierCurveTo(1.14, 0.4, 1.18, 0.16, 1.31, 0.17)
  shape.lineTo(1.31, 0.7)
  shape.quadraticCurveTo(1.3, 0.99, 1.04, 0.99)
  shape.closePath()
  return new ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.018,
    curveSegments: 18,
  })
}

const tireGeometry = new LatheGeometry(
  [
    new Vector2(0.2, -0.16),
    new Vector2(0.37, -0.16),
    new Vector2(0.44, -0.15),
    new Vector2(0.476, -0.115),
    new Vector2(0.49, -0.055),
    new Vector2(0.49, 0.055),
    new Vector2(0.476, 0.115),
    new Vector2(0.44, 0.15),
    new Vector2(0.37, 0.16),
    new Vector2(0.2, 0.16),
    new Vector2(0.2, -0.16),
  ],
  72,
)
tireGeometry.rotateZ(Math.PI / 2)

const treadGeometry = mergeGeometries(
  Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2
    return new BoxGeometry(0.23, 0.008, 0.011)
      .applyMatrix4(new Matrix4().makeRotationX(angle))
      .translate(0, Math.cos(angle) * 0.489, Math.sin(angle) * 0.489)
  }),
)

type ButtonProps = {
  position: [number, number, number]
  radius: number
  onClick: () => void
  power?: boolean
  illuminated?: boolean
}

function FaceButton({ position, radius, onClick, power, illuminated }: ButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const button = useRef<Group>(null)
  useCursor(hovered)
  useFrame((_, delta) => {
    if (button.current)
      button.current.position.z +=
        ((pressed ? -0.032 : 0) - button.current.position.z) * Math.min(1, delta * 22)
  })
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius + 0.019, radius + 0.019, 0.035, 40]} />
        <meshStandardMaterial color="#0c1110" roughness={0.55} metalness={0.3} />
      </mesh>
      <group ref={button}>
        <mesh
          name={power ? 'milo-power-button' : 'milo-scan-button'}
          rotation={[Math.PI / 2, 0, 0]}
          onPointerOver={(event) => {
            event.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => {
            setHovered(false)
            setPressed(false)
          }}
          onPointerDown={(event) => {
            event.stopPropagation()
            setPressed(true)
          }}
          onPointerUp={(event) => {
            event.stopPropagation()
            setPressed(false)
          }}
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
        >
          <cylinderGeometry args={[radius, radius, 0.045, 48]} />
          <meshPhysicalMaterial
            color={hovered ? '#59655f' : '#363e38'}
            roughness={0.36}
            metalness={0.3}
            clearcoat={0.5}
          />
        </mesh>
        {power ? (
          <group position={[0, 0, 0.026]}>
            <mesh rotation={[0, 0, Math.PI / 2 + 0.5]}>
              <torusGeometry args={[0.033, 0.0055, 8, 30, Math.PI * 2 - 1]} />
              <meshStandardMaterial
                color={illuminated ? '#eafff8' : '#718078'}
                emissive={finish.mint}
                emissiveIntensity={illuminated ? 0.7 : 0}
              />
            </mesh>
            <mesh position={[0, 0.026, 0]}>
              <boxGeometry args={[0.009, 0.045, 0.004]} />
              <meshBasicMaterial color={illuminated ? '#eafff8' : '#718078'} />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 0, 0.026]}>
            <circleGeometry args={[radius * 0.77, 40]} />
            <meshPhysicalMaterial color="#222c28" roughness={0.15} metalness={0.4} clearcoat={1} />
          </mesh>
        )}
      </group>
    </group>
  )
}

function Wheel({ side, illuminated }: { side: number; illuminated: boolean }) {
  return (
    <>
      <mesh geometry={tireGeometry} castShadow>
        <meshStandardMaterial color={finish.rubber} roughness={0.91} />
      </mesh>
      <mesh geometry={treadGeometry}>
        <meshStandardMaterial color={finish.tread} roughness={1} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.379, 0.379, 0.331, 64]} />
        <meshPhysicalMaterial
          color={finish.rim}
          metalness={0.72}
          roughness={0.37}
          clearcoat={0.3}
        />
      </mesh>
      <mesh position={[side * 0.174, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.398, 0.012, 10, 80]} />
        <meshBasicMaterial color={illuminated ? '#73edc6' : '#54665c'} toneMapped={false} />
      </mesh>
      <mesh position={[side * 0.166, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.434, 0.009, 8, 72]} />
        <meshStandardMaterial color="#626a63" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[side * 0.177, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.222, 0.222, 0.033, 56]} />
        <meshStandardMaterial color="#151b18" metalness={0.45} roughness={0.42} />
      </mesh>
      <mesh position={[side * 0.199, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.21, 0.21, 0.019, 56]} />
        <meshPhysicalMaterial
          color={finish.hub}
          metalness={0.6}
          roughness={0.48}
          clearcoat={0.18}
        />
      </mesh>
      <mesh position={[-side * 0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.095, 0.095, 0.46, 16]} />
        <meshStandardMaterial color="#353d38" metalness={0.8} roughness={0.35} />
      </mesh>
    </>
  )
}

export type RobotProps = {
  simulation: RobotSimulation | null
  powered: boolean
  lights: boolean
  hatchOpen: boolean
  onPower: () => void
  onScan: () => void
  onHatch: () => void
}

export default function Robot({
  simulation,
  powered,
  lights,
  hatchOpen,
  onPower,
  onScan,
  onHatch,
}: RobotProps) {
  const root = useRef<Group>(null)
  const shell = useRef<Group>(null)
  const hatch = useRef<Group>(null)
  const wheels = useRef<(Group | null)[]>([])
  const spins = useRef<(Group | null)[]>([])
  const indicator = useRef<Mesh>(null)
  const brakeLight = useRef<MeshStandardMaterial>(null)
  const [geometry] = useState(() => ({
    front: roundedPanel(1.57, 1.13, 0.33, 0.035),
    frontSeam: roundedPanel(1.64, 1.19, 0.35, 0.03),
    grille: roundedPanel(0.75, 1.71, 0.17, 0.018),
    grilleInset: roundedPanel(0.66, 1.6, 0.14, 0.016),
    buttons: roundedPanel(0.225, 0.59, 0.105, 0.012),
    hatch: roundedPanel(1.39, 0.65, 0.14, 0.035),
    service: roundedPanel(1.23, 1.74, 0.17, 0.02),
    side: sidePanel(),
  }))
  const illuminated = powered && lights

  useFrame(({ clock }, delta) => {
    if (!simulation || !root.current) return
    root.current.position.copy(simulation.position)
    root.current.quaternion.copy(simulation.rotation)
    const time = clock.elapsedTime
    if (shell.current)
      shell.current.position.y = powered
        ? (Math.sin(time * 1.7) * 0.004) / (1 + Math.abs(simulation.telemetry.speed))
        : 0
    for (let index = 0; index < 4; index++) {
      const wheel = wheels.current[index]
      const spin = spins.current[index]
      if (wheel) {
        wheel.position.y = WHEEL_CONNECTIONS[index].y - simulation.wheelSuspension[index]
        wheel.rotation.y = simulation.wheelSteering[index]
      }
      if (spin) spin.rotation.x = simulation.wheelRotation[index]
    }
    if (hatch.current)
      hatch.current.rotation.x +=
        ((hatchOpen ? -1.35 : 0) - hatch.current.rotation.x) * Math.min(1, delta * 7)
    if (indicator.current) indicator.current.visible = powered && Math.sin(time * 2.5) > -0.8
    if (brakeLight.current)
      brakeLight.current.emissiveIntensity = illuminated
        ? simulation.throttle < 0.05 && Math.abs(simulation.telemetry.speed) > 0.3
          ? 5
          : 2.2
        : 0
  })

  return (
    <group ref={root} name="milo" position={[0, 0.8, 0]}>
      <group ref={shell}>
        <RoundedBox
          args={[1.85, 1.1, 2.63]}
          radius={0.32}
          smoothness={6}
          position={[0, 0.12, 0]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={finish.chassis}
            roughness={0.53}
            metalness={0.22}
            clearcoat={0.22}
          />
        </RoundedBox>
        <RoundedBox
          args={[1.79, 0.68, 2.58]}
          radius={0.29}
          smoothness={8}
          position={[0, 0.705, 0]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={finish.shell}
            metalness={0.22}
            roughness={0.23}
            clearcoat={0.9}
            clearcoatRoughness={0.17}
          />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              geometry={geometry.side}
              position={[side * 0.881, 0, 0]}
              rotation={[0, (side * Math.PI) / 2, 0]}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color={finish.shell}
                metalness={0.21}
                roughness={0.25}
                clearcoat={0.85}
                clearcoatRoughness={0.2}
              />
            </mesh>
            {[-0.87, 0.87].map((longitudinal) => (
              <group
                key={longitudinal}
                position={[side * 0.947, -0.27, longitudinal]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <mesh>
                  <torusGeometry args={[0.535, 0.042, 12, 48, Math.PI]} />
                  <meshStandardMaterial color="#141c18" metalness={0.15} roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.009, side * 0.007]}>
                  <torusGeometry args={[0.575, 0.009, 8, 48, Math.PI]} />
                  <meshStandardMaterial color={finish.seam} metalness={0.65} roughness={0.4} />
                </mesh>
              </group>
            ))}
            <RoundedBox
              args={[0.027, 0.18, 0.42]}
              radius={0.012}
              position={[side * 0.933, -0.29, 0]}
            >
              <meshStandardMaterial color="#171e19" metalness={0.4} roughness={0.5} />
            </RoundedBox>
          </group>
        ))}
        <mesh geometry={geometry.frontSeam} position={[0, 0.248, 1.294]}>
          <meshStandardMaterial color="#62685f" roughness={0.4} metalness={0.65} />
        </mesh>
        <mesh geometry={geometry.front} position={[0, 0.25, 1.326]} castShadow>
          <meshPhysicalMaterial
            color="#292e29"
            roughness={0.41}
            metalness={0.25}
            clearcoat={0.22}
          />
        </mesh>
        <mesh geometry={geometry.buttons} position={[0, 0.15, 1.385]}>
          <meshStandardMaterial color="#171e18" roughness={0.65} />
        </mesh>
        <FaceButton position={[0, 0.33, 1.421]} radius={0.085} onClick={onScan} />
        <FaceButton
          position={[0, 0.105, 1.422]}
          radius={0.077}
          onClick={onPower}
          power
          illuminated={powered}
        />
        <group ref={indicator}>
          {[-0.047, 0, 0.047].map((offset) => (
            <mesh key={offset} position={[offset, -0.025, 1.429]}>
              <sphereGeometry args={[0.009, 10, 8]} />
              <meshStandardMaterial
                color={finish.mint}
                emissive={finish.mint}
                emissiveIntensity={2}
              />
            </mesh>
          ))}
        </group>
        <RoundedBox args={[0.126, 0.043, 0.012]} radius={0.012} position={[0, -0.101, 1.421]}>
          <meshStandardMaterial color="#a4aaa1" metalness={0.85} roughness={0.35} />
        </RoundedBox>
        <RoundedBox args={[0.092, 0.02, 0.01]} radius={0.008} position={[0, -0.101, 1.431]}>
          <meshStandardMaterial color="#0c1510" />
        </RoundedBox>

        <group position={[0, 1.037, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={geometry.grille}>
            <meshStandardMaterial color="#82867d" metalness={0.72} roughness={0.37} />
          </mesh>
          <mesh geometry={geometry.grilleInset} position={[0, 0, 0.017]}>
            <meshStandardMaterial color="#363e34" roughness={0.75} metalness={0.2} />
          </mesh>
        </group>
        {Array.from({ length: 23 }, (_, index) => {
          const offset = (index - 11) * 0.079
          const start = Math.max(-0.282, -0.713 - offset)
          const end = Math.min(0.282, 0.713 - offset)
          if (end <= start) return null
          const center = (start + end) / 2
          return (
            <mesh
              key={index}
              position={[center, 1.087, center + offset - 0.02]}
              rotation={[0, -Math.PI / 4, 0]}
            >
              <boxGeometry args={[(end - start) * Math.SQRT2, 0.015, 0.032]} />
              <meshStandardMaterial color="#0e1712" roughness={0.95} />
            </mesh>
          )
        })}

        <RoundedBox args={[1.58, 0.16, 0.06]} radius={0.028} position={[0, 0.45, -1.323]}>
          <meshStandardMaterial color="#141c16" roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[1.37, 0.06, 0.025]} radius={0.012} position={[0, 0.46, -1.36]}>
          <meshStandardMaterial color="#951f1b" roughness={0.22} />
        </RoundedBox>
        <RoundedBox args={[1.28, 0.026, 0.018]} radius={0.008} position={[0, 0.46, -1.38]}>
          <meshStandardMaterial
            ref={brakeLight}
            color="#ff5a38"
            emissive="#ff2b0c"
            emissiveIntensity={illuminated ? 2.2 : 0}
            toneMapped={false}
          />
        </RoundedBox>
        <group position={[0, -0.324, -1.326]} ref={hatch}>
          <mesh
            geometry={geometry.hatch}
            position={[0, 0.325, 0]}
            rotation={[0, Math.PI, 0]}
            castShadow
          >
            <meshStandardMaterial color="#2b312a" roughness={0.54} metalness={0.25} />
          </mesh>
          <mesh
            name="milo-service-latch"
            position={[0, 0.52, -0.052]}
            onClick={(event) => {
              event.stopPropagation()
              onHatch()
            }}
            onPointerOver={() => {
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <boxGeometry args={[0.22, 0.068, 0.035]} />
            <meshStandardMaterial color="#10190f" roughness={0.35} metalness={0.65} />
          </mesh>
        </group>
        {hatchOpen &&
          [-0.42, -0.14, 0.14, 0.42].map((offset) => (
            <mesh key={offset} position={[offset, 0.02, -1.22]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.11, 0.11, 0.23, 16]} />
              <meshStandardMaterial color="#4a9e69" metalness={0.65} roughness={0.3} />
            </mesh>
          ))}
        <mesh geometry={geometry.service} position={[0, -0.441, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#1b231c" metalness={0.3} roughness={0.75} />
        </mesh>
        {[-0.64, 0.64].flatMap((x) =>
          [-0.86, -0.35, 0.35, 0.86].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, -0.474, z]}>
              <cylinderGeometry args={[0.029, 0.029, 0.012, 12]} />
              <meshStandardMaterial color="#747d6d" metalness={0.85} roughness={0.3} />
            </mesh>
          )),
        )}
        {Array.from({ length: 10 }, (_, index) => (
          <mesh key={index} position={[(index - 4.5) * 0.07, -0.482, -0.29]}>
            <boxGeometry args={[0.026, 0.016, 0.21]} />
            <meshStandardMaterial color="#070f08" />
          </mesh>
        ))}
      </group>
      {WHEEL_CONNECTIONS.map((connection, index) => (
        <group
          key={index}
          name={`milo-wheel-${index}`}
          ref={(value) => {
            wheels.current[index] = value
          }}
          position={[connection.x, -0.25, connection.z]}
        >
          <group
            ref={(value) => {
              spins.current[index] = value
            }}
          >
            <Wheel side={Math.sign(connection.x)} illuminated={illuminated} />
          </group>
          <mesh position={[-Math.sign(connection.x) * 0.16, 0.15, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.25, 12]} />
            <meshStandardMaterial color="#a2aba0" metalness={0.8} roughness={0.25} />
          </mesh>
          {[0, 1, 2, 3, 4].map((coil) => (
            <mesh
              key={coil}
              position={[-Math.sign(connection.x) * 0.16, coil * 0.038 + 0.05, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[0.064, 0.013, 6, 14]} />
              <meshStandardMaterial color="#252e24" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
