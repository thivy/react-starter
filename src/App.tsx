import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { Component, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// The complete experience lives in this file: terrain, physics, robot, camera and HUD.
const WORLD_SIZE = 240
const GRID = 160
const STEP = WORLD_SIZE / GRID
const START = { x: 0, z: 4 }
const LANDMARKS = [
  { name: 'Clover Fields', subtitle: 'A good place to begin.', x: 0, z: 4, icon: 'flower' },
  { name: 'Mushroom Grove', subtitle: 'Little umbrellas, big daydreams.', x: -25, z: -28, icon: 'mushroom' },
  { name: 'The Wishing Tree', subtitle: 'Leave a little wish in the leaves.', x: 32, z: -38, icon: 'tree' },
  { name: 'Sunstone Hollow', subtitle: 'Even the rocks take it slow.', x: -42, z: 28, icon: 'sun' },
] as const
type IconName = 'leaf' | 'sound' | 'mute' | 'sun' | 'camera' | 'settings' | 'help' | 'arrow' | 'reset' | 'close' | 'flower' | 'mushroom' | 'tree' | 'compass' | 'bolt' | 'check' | 'download'
type Telemetry = { speed: number; heading: number; charge: number; x: number; z: number; boosting: boolean; gear: 'P' | 'D' | 'R' }
type Controls = { keys: Set<string>; reset: number; orbit: number; zoom: number }
type RobotControls = { lights: boolean; antenna: boolean; wave: number }
type TimeOfDay = 'Golden hour' | 'Morning light' | 'Blue hour'

function Icon({ name, size = 20, ...props }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    leaf: <><path d="M19 4C10 3 3 6 5 13s13 6 14-9Z" /><path d="M4 21 15 9M8 16l-1-5m5 1 5 1" /></>,
    sound: <><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="m16 9 6 6m0-6-6 6" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    camera: <><path d="M8 6 10 3h4l2 3h4a2 2 0 0 1 2 2v11H2V8a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12.5" r="4" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="8" cy="18" r="2" fill="currentColor" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.2" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    reset: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    flower: <><path d="M12 8c-6-10-11 0-5 3-10 3-3 12 2 6 0 10 11 5 7-1 10 2 9-9 2-8 4-8-7-10-6 0Z" /><circle cx="12" cy="12" r="2" /></>,
    mushroom: <><path d="M3 13a9 9 0 0 1 18 0H3Zm7 0-1 8h6l-1-8M8 8h.1M14 6h.1M17 10h.1" /></>,
    tree: <><path d="M12 21v-8m0 4-5-4m5 1 4-3" /><path d="M6 15C0 12 3 5 7 5c1-5 10-4 10 1 6 0 6 10-1 10" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5 5-3Z" /></>,
    bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  }
  return <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const u = x - ix, v = z - iz
  const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), a), THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), a), b)
}
function pathX(z: number) { return Math.sin(z * 0.046) * 14 + Math.sin(z * 0.11) * 3 }
function height(x: number, z: number) {
  const broad = (noise(x * 0.018 + 8, z * 0.018 + 2) - 0.5) * 16
  const mid = (noise(x * 0.065 + 30, z * 0.065 + 20) - 0.5) * 2.8
  const detail = (noise(x * 0.25, z * 0.25) - 0.5) * 0.3
  const clearing = THREE.MathUtils.smoothstep(Math.hypot(x, z - 4), 4, 24)
  return (broad + mid) * (0.25 + clearing * 0.75) + detail - 1
}
// Heightfield interpolation uses the same diagonal as Cannon's two cell triangles.
function groundHeight(x: number, z: number) {
  const gx = THREE.MathUtils.clamp((x + WORLD_SIZE / 2) / STEP, 0, GRID - 0.0001)
  const gz = THREE.MathUtils.clamp((WORLD_SIZE / 2 - z) / STEP, 0, GRID - 0.0001)
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz
  const a = height(ix * STEP - WORLD_SIZE / 2, WORLD_SIZE / 2 - iz * STEP)
  const b = height((ix + 1) * STEP - WORLD_SIZE / 2, WORLD_SIZE / 2 - iz * STEP)
  const c = height(ix * STEP - WORLD_SIZE / 2, WORLD_SIZE / 2 - (iz + 1) * STEP)
  const d = height((ix + 1) * STEP - WORLD_SIZE / 2, WORLD_SIZE / 2 - (iz + 1) * STEP)
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
}

const OBSTACLES = Array.from({ length: 115 }, (_, i) => {
  const x = (hash(i, 8) - 0.5) * 198, z = (hash(i, 18) - 0.5) * 198
  return { x, z, scale: 0.8 + hash(i, 28) * 1.8, type: i % 4 === 0 ? 'rock' : 'tree', seed: i }
}).filter(o => Math.abs(o.x - pathX(o.z)) > 7 && Math.hypot(o.x, o.z - 4) > 13)
const HERO_TREES = [
  { x: -13, z: -8, scale: 1.4, type: 'tree', seed: 211 },
  { x: 16, z: -18, scale: 1.7, type: 'tree', seed: 215 },
  { x: 32, z: -38, scale: 2.8, type: 'tree', seed: 219 },
  { x: -42, z: 28, scale: 2.7, type: 'rock', seed: 220 },
]
const ALL_OBSTACLES = [...OBSTACLES, ...HERO_TREES]

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const vertices: number[] = [], colors: number[] = [], indices: number[] = []
    const grass = new THREE.Color(), greenA = new THREE.Color('#7d9950'), greenB = new THREE.Color('#b1bf6b'), path = new THREE.Color('#d7c397')
    for (let i = 0; i <= GRID; i++) {
      for (let j = 0; j <= GRID; j++) {
        const x = i * STEP - WORLD_SIZE / 2, z = WORLD_SIZE / 2 - j * STEP
        vertices.push(x, height(x, z), z)
        const pathDistance = Math.abs(x - pathX(z))
        const clear = Math.hypot(x, z - 4)
        const amount = Math.max(1 - THREE.MathUtils.smoothstep(pathDistance, 2.2, 4.8), (1 - THREE.MathUtils.smoothstep(clear, 3, 7)) * 0.9)
        grass.copy(greenA).lerp(greenB, noise(x * 0.1, z * 0.1)).lerp(path, amount)
        colors.push(grass.r, grass.g, grass.b)
        if (i < GRID && j < GRID) {
          const a = i * (GRID + 1) + j, b = a + GRID + 1
          indices.push(a, b, a + 1, b, b + 1, a + 1)
        }
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={0.97} /></mesh>
}

type InstanceData = { position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number]; color: string }
function Instances({ data, geometry, sway = false, reduced = false }: { data: InstanceData[]; geometry: 'grass' | 'sphere' | 'stem'; sway?: boolean; reduced?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, side: geometry === 'grass' ? THREE.DoubleSide : THREE.FrontSide })
    if (sway) {
      mat.onBeforeCompile = shader => {
        shader.uniforms.uTime = { value: 0 }
        mat.userData.shader = shader
        shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uTime * 1.3 + instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.4) * 0.18 * max(position.y, 0.0);')
      }
    }
    return mat
  }, [geometry, sway])
  useEffect(() => () => material.dispose(), [material])
  useLayoutEffect(() => {
    const obj = new THREE.Object3D(), color = new THREE.Color()
    data.forEach((item, i) => {
      obj.position.set(...item.position)
      obj.scale.set(...item.scale)
      obj.rotation.set(...(item.rotation ?? [0, 0, 0]))
      obj.updateMatrix()
      ref.current!.setMatrixAt(i, obj.matrix)
      ref.current!.setColorAt(i, color.set(item.color))
    })
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [data])
  useFrame(({ clock }) => {
    const shader = ref.current?.material instanceof THREE.MeshStandardMaterial ? ref.current.material.userData.shader : undefined
    if (shader) shader.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime
  })
  return <instancedMesh ref={ref} args={[undefined, material, data.length]} receiveShadow frustumCulled={false}>
    {geometry === 'grass' ? <coneGeometry args={[0.1, 1, 3, 1]} /> : geometry === 'stem' ? <cylinderGeometry args={[0.025, 0.035, 1, 4]} /> : <icosahedronGeometry args={[1, 1]} />}
  </instancedMesh>
}

function Meadow({ reduced }: { reduced: boolean }) {
  const { grass, stems, petals, hearts } = useMemo(() => {
    const grass: InstanceData[] = [], stems: InstanceData[] = [], petals: InstanceData[] = [], hearts: InstanceData[] = []
    for (let i = 0; i < 16000; i++) {
      const x = (hash(i, 41) - 0.5) * 210, z = (hash(i, 42) - 0.5) * 210
      if (Math.abs(x - pathX(z)) < 3.5 || Math.hypot(x, z - 4) < 5.5) continue
      const y = groundHeight(x, z), scale = 0.22 + hash(i, 44) * 0.53
      grass.push({ position: [x, y + scale / 2 - 0.04, z], scale: [0.7 + hash(i, 47), scale, 1], rotation: [0, hash(i, 43) * 6.28, 0.1], color: ['#738d3f', '#91aa50', '#aabd68', '#b4c171'][i % 4] })
      if (i % 11 === 0) {
        const h = 0.36 + hash(i, 46) * 0.45
        stems.push({ position: [x, y + h / 2, z], scale: [1, h, 1], color: '#607c3a' })
        const color = ['#f5eee0', '#f7d277', '#b8a3d5', '#e9aa9b', '#fff3cc'][i % 5]
        hearts.push({ position: [x, y + h + 0.01, z], scale: [0.075, 0.07, 0.075], color: '#d6a747' })
        for (let p = 0; p < 5; p++) {
          const angle = p / 5 * Math.PI * 2
          petals.push({ position: [x + Math.cos(angle) * 0.11, y + h, z + Math.sin(angle) * 0.11], scale: [0.1, 0.04, 0.1], color })
        }
      }
    }
    return { grass, stems, petals, hearts }
  }, [])
  return <><Instances data={grass} geometry="grass" sway reduced={reduced} /><Instances data={stems} geometry="stem" /><Instances data={petals} geometry="sphere" /><Instances data={hearts} geometry="sphere" /></>
}

function Tree({ x, z, scale, seed, reduced }: { x: number; z: number; scale: number; seed: number; reduced: boolean }) {
  const crown = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.z = reduced ? 0 : Math.sin(clock.elapsedTime * 0.6 + seed) * 0.018
  })
  const colors = seed % 5 === 0 ? ['#d3ab6b', '#e1c188', '#bb985d'] : ['#88a45e', '#a5b971', '#718e50']
  return <group position={[x, groundHeight(x, z) - 0.05, z]} scale={scale}>
    <mesh castShadow position={[0, 1.7, 0]} rotation={[0.06, 0, -0.06]}><cylinderGeometry args={[0.13, 0.26, 3.5, 7]} /><meshStandardMaterial color="#7c7660" roughness={1} /></mesh>
    {[-1, 1].map(side => <mesh key={side} castShadow position={[side * 0.3, 2.6, 0]} rotation={[0, 0, side * -0.6]}><cylinderGeometry args={[0.07, 0.12, 1.6, 6]} /><meshStandardMaterial color="#7c7660" /></mesh>)}
    <group ref={crown} position={[0, 2.8, 0]}>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} castShadow receiveShadow position={[Math.sin(i * 2.4) * (i === 0 ? 0 : 0.95), i === 0 ? 1.3 : hash(seed, i) * 0.9, Math.cos(i * 2.4) * 0.7]} scale={[1.15 + hash(seed, i) * 0.5, 1.05, 1.15]}>
        <icosahedronGeometry args={[1.2, 2]} /><meshStandardMaterial color={colors[i % 3]} roughness={0.95} />
      </mesh>)}
    </group>
  </group>
}
function Mushroom({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return <group position={[x, groundHeight(x, z), z]} scale={scale}>
    <mesh castShadow position={[0, 0.28, 0]} rotation={[0, 0, 0.1]}><cylinderGeometry args={[0.11, 0.15, 0.6, 8]} /><meshStandardMaterial color="#eee2bf" /></mesh>
    <mesh castShadow position={[0, 0.55, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.48, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#c77f55" roughness={0.7} /></mesh>
    {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 2.4) * 0.27, 0.76 - (i % 2) * 0.025, Math.cos(i * 2.4) * 0.27]} scale={[1, 0.3, 1]}><sphereGeometry args={[0.065, 7, 5]} /><meshStandardMaterial color="#fff0ce" /></mesh>)}
  </group>
}
function Scenery({ reduced }: { reduced: boolean }) {
  return <>
    {ALL_OBSTACLES.map((o, i) => o.type === 'tree'
      ? <Tree key={i} {...o} reduced={reduced} />
      : <group key={i} position={[o.x, groundHeight(o.x, o.z), o.z]} rotation={[0, o.seed, 0]} scale={o.scale}>
        <mesh castShadow receiveShadow position={[0, 0.35, 0]} scale={[1.2, 0.8, 1]}><dodecahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#979d83" roughness={0.95} /></mesh>
        <mesh castShadow position={[0.7, 0.16, 0.3]} scale={[1, 0.65, 1]}><dodecahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color="#b0b199" /></mesh>
      </group>)}
    {Array.from({ length: 65 }, (_, i) => {
      const x = i < 14 ? -25 + (hash(i, 52) - 0.5) * 12 : (hash(i, 51) - 0.5) * 140
      const z = i < 14 ? -28 + (hash(i, 53) - 0.5) * 12 : (hash(i, 54) - 0.5) * 140
      return Math.hypot(x, z - 4) > 6 ? <Mushroom key={i} x={x} z={z} scale={0.7 + hash(i, 55) * 1.1} /> : null
    })}
    <Mushroom x={6.5} z={5} scale={1.3} /><Mushroom x={7.1} z={5.5} scale={0.8} />
    <group position={[-6, groundHeight(-6, -5), -5]} rotation={[0, 0.2, -0.05]}>
      <mesh castShadow position={[0, 0.9, 0]}><boxGeometry args={[0.12, 1.8, 0.13]} /><meshStandardMaterial color="#7a6c4f" /></mesh>
      <RoundedBox args={[1.6, 0.45, 0.12]} radius={0.05} position={[0.15, 1.55, 0]} castShadow><meshStandardMaterial color="#b49e71" /></RoundedBox>
      <mesh position={[0.2, 1.56, 0.07]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.12, 0.42, 3]} /><meshStandardMaterial color="#f1e8cc" /></mesh>
    </group>
    {Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[(i - 7) * 26, -2, -110 - hash(i, 71) * 18]} scale={[22 + hash(i, 72) * 15, 13 + hash(i, 73) * 17, 22]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color={i % 2 ? '#9cad83' : '#acb998'} roughness={1} /></mesh>)}
  </>
}

function Atmosphere({ reduced, dusk, body }: { reduced: boolean; dusk: boolean; body: RefObject<THREE.Group | null> }) {
  const butterflies = useRef<THREE.Group>(null), dust = useRef<THREE.InstancedMesh>(null)
  const motes = useMemo(() => {
    const points = new Float32Array(180 * 3)
    for (let i = 0; i < 180; i++) points.set([(hash(i, 61) - 0.5) * 110, 1 + hash(i, 62) * 10, (hash(i, 63) - 0.5) * 110], i * 3)
    return points
  }, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const previous = useRef(new THREE.Vector3())
  useFrame(({ clock }, delta) => {
    const t = reduced ? 0 : clock.elapsedTime
    butterflies.current?.children.forEach((b, i) => {
      b.position.set(Math.sin(t * 0.16 + i * 6) * 18, 1.4 + Math.sin(t * 0.5 + i) * 0.5 + groundHeight(b.position.x, b.position.z), Math.cos(t * 0.12 + i * 5) * 18 - 6)
      b.rotation.y = t * 0.2 + i
      b.children.forEach((wing, j) => { wing.rotation.z = Math.sin(t * 11 + i) * 0.6 * (j ? -1 : 1) })
    })
    if (dust.current && body.current) {
      const p = body.current.position
      const moving = p.distanceTo(previous.current) / Math.max(delta, 0.001) > 0.7
      for (let i = 0; i < 28; i++) {
        const age = ((t * 0.5 + i / 28) % 1)
        dummy.position.set(p.x + Math.sin(i * 3.8) * age * 2, p.y - 0.6 + age * 0.7, p.z + Math.cos(i * 2.4) * age * 2)
        dummy.scale.setScalar(moving && !reduced ? (1 - age) * 0.09 : 0)
        dummy.updateMatrix()
        dust.current.setMatrixAt(i, dummy.matrix)
      }
      dust.current.instanceMatrix.needsUpdate = true
      previous.current.copy(p)
    }
  })
  return <>
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[motes, 3]} /></bufferGeometry><pointsMaterial color={dusk ? '#e6ef8d' : '#fff7d3'} size={dusk ? 0.13 : 0.055} transparent opacity={0.8} sizeAttenuation /></points>
    <group ref={butterflies}>{Array.from({ length: 9 }, (_, i) => <group key={i}>{[-1, 1].map(side => <mesh key={side} position={[side * 0.08, 0, 0]} rotation={[-0.5, 0, 0]} scale={[0.13, 0.09, 0.018]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={i % 2 ? '#eccb75' : '#e9eee2'} side={THREE.DoubleSide} /></mesh>)}</group>)}</group>
    <instancedMesh ref={dust} args={[undefined, undefined, 28]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#d5c59e" transparent opacity={0.35} depthWrite={false} /></instancedMesh>
  </>
}

function makePhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) })
  world.broadphase = new CANNON.SAPBroadphase(world)
  ;(world.solver as CANNON.GSSolver).iterations = 12
  world.defaultContactMaterial.friction = 0.65
  world.defaultContactMaterial.restitution = 0.05
  const data = Array.from({ length: GRID + 1 }, (_, i) => Array.from({ length: GRID + 1 }, (_, j) => height(i * STEP - WORLD_SIZE / 2, WORLD_SIZE / 2 - j * STEP)))
  const terrain = new CANNON.Body({ mass: 0, shape: new CANNON.Heightfield(data, { elementSize: STEP }) })
  terrain.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  terrain.position.set(-WORLD_SIZE / 2, 0, WORLD_SIZE / 2)
  world.addBody(terrain)
  ALL_OBSTACLES.forEach(o => {
    const obstacle = new CANNON.Body({ mass: 0 })
    if (o.type === 'tree') {
      obstacle.addShape(new CANNON.Box(new CANNON.Vec3(0.22 * o.scale, 1.8 * o.scale, 0.22 * o.scale)))
      obstacle.position.set(o.x, groundHeight(o.x, o.z) + 1.8 * o.scale, o.z)
    } else {
      obstacle.addShape(new CANNON.Sphere(0.7 * o.scale))
      obstacle.position.set(o.x, groundHeight(o.x, o.z) + 0.28 * o.scale, o.z)
    }
    world.addBody(obstacle)
  })
  // A low chassis carries most mass; a lighter head collider raises the computed inertia.
  const chassis = new CANNON.Body({ mass: 42, linearDamping: 0.12, angularDamping: 0.4 })
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.69, 0.3, 0.66)), new CANNON.Vec3(0, 0.16, 0))
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.67, 0.43, 0.43)), new CANNON.Vec3(0, 0.88, 0.04))
  chassis.position.set(START.x, groundHeight(START.x, START.z) + 1.05, START.z)
  chassis.quaternion.setFromEuler(0, 0.25, 0)
  const vehicle = new CANNON.RaycastVehicle({ chassisBody: chassis, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2 })
  for (const z of [0.61, -0.61]) for (const x of [-0.86, 0.86]) vehicle.addWheel({
    radius: 0.43,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(x, 0.03, z),
    suspensionStiffness: 35,
    suspensionRestLength: 0.34,
    dampingRelaxation: 3.2,
    dampingCompression: 4.5,
    frictionSlip: 3.8,
    rollInfluence: 0.22,
    maxSuspensionForce: 4000,
    maxSuspensionTravel: 0.23,
    customSlidingRotationalSpeed: -20,
    useCustomSlidingRotationalSpeed: false,
  })
  // Invisible barriers keep the complete playable region inside the heightfield.
  for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) {
    const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(axis === 'x' ? 1 : 120, 30, axis === 'z' ? 1 : 120)) })
    wall.position[axis] = side * 113
    world.addBody(wall)
  }
  return { world, vehicle, chassis }
}

function Panel({ position, args, color = '#e6e6ce', radius = 0.12, metalness = 0.12 }: { position: [number, number, number]; args: [number, number, number]; color?: string; radius?: number; metalness?: number }) {
  return <RoundedBox position={position} args={args} radius={radius} smoothness={4} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.37} metalness={metalness} /></RoundedBox>
}
function Wheel() {
  return <group rotation={[0, 0, Math.PI / 2]}>
    <mesh castShadow><cylinderGeometry args={[0.43, 0.43, 0.31, 24]} /><meshStandardMaterial color="#303c35" roughness={0.93} /></mesh>
    {Array.from({ length: 20 }, (_, i) => <group key={i} rotation={[0, i / 20 * Math.PI * 2, 0]}>
      <mesh position={[0, 0, 0.417]} rotation={[0, 0, 0.13]} castShadow><boxGeometry args={[0.09, 0.33, 0.04]} /><meshStandardMaterial color="#3c463b" roughness={0.9} /></mesh>
    </group>)}
    {[-1, 1].map(side => <group key={side} position={[0, side * 0.166, 0]}>
      <mesh><cylinderGeometry args={[0.305, 0.305, 0.025, 24]} /><meshStandardMaterial color="#aeb7a2" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, side * 0.024, 0]}><cylinderGeometry args={[0.235, 0.235, 0.035, 24]} /><meshStandardMaterial color="#5c7161" metalness={0.45} roughness={0.45} /></mesh>
      <mesh position={[0, side * 0.049, 0]}><cylinderGeometry args={[0.125, 0.125, 0.055, 16]} /><meshStandardMaterial color="#d7dac3" metalness={0.6} roughness={0.27} /></mesh>
      {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 1.257) * 0.182, side * 0.048, Math.cos(i * 1.257) * 0.182]}><sphereGeometry args={[0.024, 6, 6]} /><meshStandardMaterial color="#d6dac5" metalness={0.8} roughness={0.3} /></mesh>)}
    </group>)}
  </group>
}

function Robot({ body, wheelRefs, robot, onRobot, reduced }: { body: RefObject<THREE.Group | null>; wheelRefs: RefObject<(THREE.Group | null)[]>; robot: RobotControls; onRobot: (action: keyof RobotControls) => void; reduced: boolean }) {
  const head = useRef<THREE.Group>(null), eyes = useRef<THREE.Group>(null), aerial = useRef<THREE.Group>(null)
  const waveStart = useRef(-100)
  const lastWave = useRef(0)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (robot.wave !== lastWave.current) { lastWave.current = robot.wave; waveStart.current = t }
    if (head.current) {
      head.current.position.y = 0.9 + (reduced ? 0 : Math.sin(t * 1.5) * 0.018)
      head.current.rotation.y = t - waveStart.current < 1.6 ? Math.sin((t - waveStart.current) * 8) * 0.18 : reduced ? 0 : Math.sin(t * 0.55) * 0.035
    }
    if (eyes.current) eyes.current.scale.y = !reduced && t % 5.6 > 5.38 ? 0.12 : 1
    if (aerial.current) aerial.current.rotation.z = robot.antenna && !reduced ? Math.sin(t * 3) * 0.08 : 0
  })
  const interact = (action: keyof RobotControls) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); onRobot(action) }
  return <>
    <group ref={body}>
      <Panel position={[0, 0.02, 0]} args={[1.46, 0.36, 1.42]} color="#526652" radius={0.1} />
      <Panel position={[0, 0.23, 0.02]} args={[1.5, 0.46, 1.27]} radius={0.16} />
      <Panel position={[0, 0.47, 0]} args={[1.27, 0.06, 1.08]} color="#bbc3aa" radius={0.025} />
      <Panel position={[0, -0.1, 0.76]} args={[1.2, 0.18, 0.13]} color="#3d4d41" radius={0.05} />
      <Panel position={[0, -0.1, -0.73]} args={[1.2, 0.15, 0.13]} color="#3d4d41" radius={0.05} />
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * 0.7, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.075, 0.075, 0.4, 10]} /><meshStandardMaterial color="#7e8b77" metalness={0.8} roughness={0.25} /></mesh>
        <Panel position={[side * 0.63, 0.32, 0.02]} args={[0.17, 0.22, 0.96]} color="#7f9275" radius={0.045} />
        {[-1, 1].map(end => <mesh key={end} position={[side * 0.83, 0.01, end * 0.6]} rotation={[0, 0, side * 0.18]}><cylinderGeometry args={[0.055, 0.055, 0.32, 10]} /><meshStandardMaterial color="#b4bca8" metalness={0.85} roughness={0.22} /></mesh>)}
        <mesh position={[side * 0.49, 0.17, 0.669]} onClick={interact('lights')}>
          <sphereGeometry args={[0.09, 16, 12]} /><meshStandardMaterial color={robot.lights ? '#fff0b3' : '#989d7c'} emissive="#ffe5a2" emissiveIntensity={robot.lights ? 2 : 0} />
        </mesh>
        {robot.lights && <pointLight position={[side * 0.48, 0.25, 0.9]} color="#ffe0a0" intensity={1.4} distance={6} />}
        <mesh position={[side * 0.45, 0.16, -0.65]}><boxGeometry args={[0.16, 0.065, 0.025]} /><meshStandardMaterial color="#bd6e54" emissive="#c85e32" emissiveIntensity={robot.lights ? 0.8 : 0.15} /></mesh>
      </group>)}
      <mesh position={[0, 0.54, 0]}><cylinderGeometry args={[0.25, 0.28, 0.24, 16]} /><meshStandardMaterial color="#516458" metalness={0.5} roughness={0.4} /></mesh>
      <group ref={head} position={[0, 0.9, 0]}>
        <Panel position={[0, 0, 0]} args={[1.54, 1.04, 1.03]} color="#e6e7ce" radius={0.23} />
        <Panel position={[0, 0.07, 0.474]} args={[1.34, 0.76, 0.16]} color="#7e917b" radius={0.19} />
        <Panel position={[0, 0.08, 0.553]} args={[1.19, 0.6, 0.065]} color="#263e36" radius={0.16} metalness={0.3} />
        <group ref={eyes} position={[0, 0.12, 0.593]} onClick={interact('wave')}>
          {[-1, 1].map(side => <group key={side} position={[side * 0.285, 0, 0]}>
            <RoundedBox args={[0.18, 0.23, 0.024]} radius={0.08} smoothness={4}><meshStandardMaterial color="#d8f4b1" emissive="#c5edab" emissiveIntensity={1.1} roughness={0.3} /></RoundedBox>
            <mesh position={[-0.035, 0.057, 0.015]}><circleGeometry args={[0.025, 10]} /><meshBasicMaterial color="#fbffe7" /></mesh>
          </group>)}
          <mesh position={[0, -0.13, 0]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.065, 0.009, 6, 16, Math.PI]} /><meshBasicMaterial color="#bddc9b" /></mesh>
        </group>
        <Panel position={[-0.34, -0.349, 0.497]} args={[0.36, 0.07, 0.025]} color="#acb799" radius={0.02} />
        {[0, 1, 2].map(i => <mesh key={i} position={[-0.45 + i * 0.1, -0.35, 0.514]}><circleGeometry args={[0.012, 8]} /><meshStandardMaterial color="#4e6650" /></mesh>)}
        <mesh position={[0.47, -0.345, robot.lights ? 0.518 : 0.537]} rotation={[Math.PI / 2, 0, 0]} onClick={interact('lights')}><cylinderGeometry args={[0.063, 0.063, 0.035, 16]} /><meshStandardMaterial color="#d5a05e" emissive="#d69b4f" emissiveIntensity={robot.lights ? 0.5 : 0} metalness={0.3} /></mesh>
        {[-1, 1].map(side => <group key={side}>
          <mesh position={[side * 0.772, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.21, 0.21, 0.06, 20]} /><meshStandardMaterial color="#7c9179" metalness={0.35} /></mesh>
          <mesh position={[side * 0.813, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.04, 20]} /><meshStandardMaterial color="#bfc9ac" metalness={0.3} /></mesh>
          {[-0.24, -0.12, 0, 0.12, 0.24].map(y => <Panel key={y} position={[side * 0.758, y - 0.02, -0.3]} args={[0.026, 0.043, 0.17]} color="#536c59" radius={0.018} />)}
        </group>)}
        <Panel position={[0, -0.04, -0.521]} args={[0.91, 0.64, 0.038]} color="#c9d0b5" radius={0.08} />
        {[0, 1, 2, 3].map(i => <Panel key={i} position={[0, 0.11 - i * 0.095, -0.548]} args={[0.57, 0.034, 0.018]} color="#7c8d75" radius={0.013} />)}
        {[-1, 1].flatMap(x => [-1, 1].map(y => <mesh key={`${x}${y}`} position={[x * 0.57, y * 0.34, -0.514]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.023, 0.023, 0.018, 8]} /><meshStandardMaterial color="#79866f" metalness={0.85} roughness={0.3} /></mesh>))}
        <group ref={aerial} position={[-0.46, 0.48, -0.13]} onClick={interact('antenna')}>
          <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.019, 0.024, 0.42, 8]} /><meshStandardMaterial color="#6a7f6b" metalness={0.7} /></mesh>
          <mesh position={[0, 0.44, 0]}><sphereGeometry args={[0.079, 16, 12]} /><meshStandardMaterial color={robot.antenna ? '#c2d795' : '#7c8e73'} emissive="#bfe585" emissiveIntensity={robot.antenna ? 0.8 : 0} /></mesh>
        </group>
        <Panel position={[0.36, 0.511, -0.04]} args={[0.22, 0.045, 0.24]} color="#7f9b70" radius={0.035} />
      </group>
    </group>
    {[0, 1, 2, 3].map(i => <group key={i} ref={el => { wheelRefs.current[i] = el }}><Wheel /></group>)}
  </>
}

const Simulation = memo(function Simulation({ controls, robot, onRobot, onTelemetry, reduced, time, waypoint, orbitMode }: {
  controls: RefObject<Controls>; robot: RobotControls; onRobot: (action: keyof RobotControls) => void; onTelemetry: (t: Telemetry) => void; reduced: boolean; time: TimeOfDay; waypoint: number | null; orbitMode: boolean
}) {
  const physics = useMemo(() => makePhysics(), [])
  const body = useRef<THREE.Group>(null), wheelRefs = useRef<(THREE.Group | null)[]>([])
  const { camera, gl } = useThree()
  const state = useRef({ force: 0, steer: 0, charge: 100, reset: 0, report: 0, cameraAngle: 0.6 })
  const cameraTarget = useRef(new THREE.Vector3(0, groundHeight(0, 4) + 0.7, 4))
  const cameraPosition = useRef(new THREE.Vector3())
  const cameraOffset = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const shadowLight = useRef<THREE.DirectionalLight>(null)
  const shadowTarget = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    physics.vehicle.addToWorld(physics.world)
    const canvas = gl.domElement
    let down = false, lastX = 0
    const wheel = (event: WheelEvent) => { event.preventDefault(); controls.current.zoom = THREE.MathUtils.clamp(controls.current.zoom + event.deltaY * 0.006, 5, 18) }
    const start = (event: PointerEvent) => { down = true; lastX = event.clientX; canvas.setPointerCapture(event.pointerId) }
    const move = (event: PointerEvent) => { if (down) { controls.current.orbit += (event.clientX - lastX) * 0.006; lastX = event.clientX } }
    const end = () => { down = false }
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('pointerdown', start)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)
    return () => {
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end)
      physics.vehicle.removeFromWorld(physics.world)
    }
  }, [controls, gl, physics])
  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, 0.05), s = state.current, { chassis, world, vehicle } = physics
    const keys = controls.current.keys
    if (s.reset !== controls.current.reset || chassis.position.y < -30) {
      s.reset = controls.current.reset
      chassis.position.set(START.x, groundHeight(START.x, START.z) + 1.1, START.z)
      chassis.quaternion.setFromEuler(0, 0.25, 0)
      chassis.velocity.setZero(); chassis.angularVelocity.setZero(); chassis.force.setZero(); chassis.torque.setZero()
      s.force = 0; s.steer = 0
    }
    const forward = keys.has('KeyW') || keys.has('ArrowUp'), reverse = keys.has('KeyS') || keys.has('ArrowDown')
    const left = keys.has('KeyA') || keys.has('ArrowLeft'), right = keys.has('KeyD') || keys.has('ArrowRight')
    const braking = keys.has('Space')
    const boosting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && forward && !braking && s.charge > 1
    s.charge = THREE.MathUtils.clamp(s.charge + (boosting ? -19 : 10) * dt, 0, 100)
    const speed = chassis.velocity.length()
    const throttle = Number(forward) - Number(reverse)
    const targetForce = braking ? 0 : -throttle * (boosting ? 110 : engineForceAtSpeed(speed))
    s.force = THREE.MathUtils.damp(s.force, targetForce, 3, dt)
    s.steer = THREE.MathUtils.damp(s.steer, (Number(left) - Number(right)) * (0.5 / (1 + speed * 0.09)), 5, dt)
    for (let i = 0; i < 4; i++) {
      vehicle.applyEngineForce(s.force, i)
      vehicle.setBrake(braking ? 14 : throttle === 0 ? 0.45 : 0.03, i)
      vehicle.setSteeringValue(i < 2 ? s.steer : 0, i)
    }
    world.step(1 / 60, dt, 4)
    if (body.current) {
      body.current.position.copy(chassis.position)
      body.current.quaternion.copy(chassis.quaternion)
    }
    vehicle.wheelInfos.forEach((_, i) => {
      vehicle.updateWheelTransform(i)
      wheelRefs.current[i]?.position.copy(vehicle.wheelInfos[i].worldTransform.position)
      wheelRefs.current[i]?.quaternion.copy(vehicle.wheelInfos[i].worldTransform.quaternion)
    })
    const heading = Math.atan2(2 * (chassis.quaternion.w * chassis.quaternion.y + chassis.quaternion.x * chassis.quaternion.z), 1 - 2 * (chassis.quaternion.y ** 2 + chassis.quaternion.x ** 2))
    if (speed > 0.5 && !orbitMode) controls.current.orbit = THREE.MathUtils.damp(controls.current.orbit, 0, 0.6, dt)
    if (speed > 0.5 && !orbitMode) {
      const difference = Math.atan2(Math.sin(heading + Math.PI - s.cameraAngle), Math.cos(heading + Math.PI - s.cameraAngle))
      s.cameraAngle += difference * (1 - Math.exp(-1.5 * dt))
    }
    const cameraAngle = s.cameraAngle + controls.current.orbit
    const distance = controls.current.zoom
    const target = cameraTarget.current
    look.current.set(chassis.position.x, chassis.position.y + 0.65, chassis.position.z)
    target.lerp(look.current, 1 - Math.exp(-4 * dt))
    cameraOffset.current.set(Math.sin(cameraAngle) * distance, distance * 0.43, Math.cos(cameraAngle) * distance)
    cameraPosition.current.copy(target).add(cameraOffset.current)
    // Sample the entire sightline, not just the camera endpoint, to clear hills and trees.
    let safeDistance = 1
    for (let n = 1; n <= 20; n++) {
      const t = n / 20, x = target.x + cameraOffset.current.x * t, z = target.z + cameraOffset.current.z * t
      const y = target.y + cameraOffset.current.y * t
      const treeHit = ALL_OBSTACLES.some(o => o.type === 'tree' && Math.hypot(x - o.x, z - o.z) < o.scale * 0.5 && y < groundHeight(o.x, o.z) + o.scale * 4.5)
      if (y < groundHeight(x, z) + 0.6 || treeHit) { safeDistance = Math.max(0.18, (n - 1) / 20); break }
    }
    cameraPosition.current.copy(target).addScaledVector(cameraOffset.current, safeDistance)
    cameraPosition.current.y = Math.max(cameraPosition.current.y, groundHeight(cameraPosition.current.x, cameraPosition.current.z) + 0.7)
    camera.position.lerp(cameraPosition.current, 1 - Math.exp(-3 * dt))
    camera.lookAt(target)
    if (shadowLight.current) {
      shadowLight.current.position.set(chassis.position.x - 15, chassis.position.y + 25, chassis.position.z + 12)
      shadowTarget.position.copy(chassis.position)
    }
    s.report += dt
    if (s.report > 0.1) {
      s.report = 0
      const signedSpeed = chassis.velocity.x * Math.sin(heading) + chassis.velocity.z * Math.cos(heading)
      onTelemetry({ speed: speed * 3.6, heading, charge: s.charge, x: chassis.position.x, z: chassis.position.z, boosting, gear: speed < 0.22 ? 'P' : signedSpeed < -0.1 ? 'R' : 'D' })
    }
  })
  const dusk = time === 'Blue hour', morning = time === 'Morning light'
  const sky = dusk ? '#929eb1' : morning ? '#dce8df' : '#e5e8ce'
  return <>
    <color attach="background" args={[sky]} /><fog attach="fog" args={[sky, 48, 155]} />
    <hemisphereLight args={[dusk ? '#bac9e0' : '#f0f3dc', '#72824b', dusk ? 1.6 : 2.2]} />
    <directionalLight ref={shadowLight} target={shadowTarget} position={[-15, 25, 12]} intensity={dusk ? 1.3 : 3.1} color={dusk ? '#d0dcff' : morning ? '#fff9e2' : '#ffe4ad'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={85} shadow-normalBias={0.035} shadow-bias={-0.0002} />
    <primitive object={shadowTarget} />
    <Environment resolution={64} frames={1}>
      <Lightformer form="ring" intensity={3} color="#fff2d5" position={[0, 6, -4]} scale={10} />
      <Lightformer intensity={1.2} color="#c5d9cf" position={[-5, 2, 0]} scale={8} rotation={[0, Math.PI / 2, 0]} />
    </Environment>
    <Terrain /><Meadow reduced={reduced} /><Scenery reduced={reduced} />
    <Atmosphere reduced={reduced} dusk={dusk} body={body} />
    <Robot body={body} wheelRefs={wheelRefs} robot={robot} onRobot={onRobot} reduced={reduced} />
    {waypoint !== null && <group position={[LANDMARKS[waypoint].x, groundHeight(LANDMARKS[waypoint].x, LANDMARKS[waypoint].z), LANDMARKS[waypoint].z]}>
      <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.13, 0.5, 8, 16, 1, true]} /><meshBasicMaterial color="#f7eab0" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}><ringGeometry args={[2, 2.15, 48]} /><meshBasicMaterial color="#fff1c2" side={THREE.DoubleSide} /></mesh>
    </group>}
  </>
})
function engineForceAtSpeed(speed: number) { return 65 * Math.max(0.12, 1 - speed / 9) }

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="scene-error"><Icon name="leaf" size={38} /><h2>A little pause in the adventure.</h2><p>We couldn’t start the 3D world. Enable hardware acceleration and reload to try again.</p><button onClick={() => window.location.reload()}>Try again</button></div> : this.props.children }
}

function MiniMap({ telemetry, waypoint, onOpen }: { telemetry: Telemetry; waypoint: number | null; onOpen: () => void }) {
  const mapPath = Array.from({ length: 65 }, (_, i) => {
    const z = -120 + i * 3.75
    return `${i ? 'L' : 'M'}${100 + pathX(z) * 0.72},${100 + z * 0.72}`
  }).join(' ')
  return <button className="minimap" onClick={onOpen} aria-label="Open field guide and choose a destination">
    <div className="map-heading"><span>CLOVER FIELDS</span><Icon name="compass" size={15} /></div>
    <svg viewBox="0 0 200 184" className="map-art" aria-hidden="true">
      <defs><pattern id="mapGrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#657751" strokeOpacity=".07" /></pattern></defs>
      <rect width="200" height="184" fill="#dde4bf" />
      <path d="M-10 40Q40 0 66 45T150 26T220 60V-10H-10M-5 145Q48 112 70 158T151 140T210 170V200H-5" fill="#ccd7ae" />
      <path d="M160-5Q130 40 170 65T176 130T140 190" fill="none" stroke="#b8cec3" strokeWidth="10" />
      <path d={mapPath} fill="none" stroke="#f5f0d5" strokeWidth="7" />
      <rect width="200" height="184" fill="url(#mapGrid)" />
      {LANDMARKS.map((place, i) => <g key={place.name} transform={`translate(${100 + place.x * 0.72},${100 + place.z * 0.72})`}><circle r={waypoint === i ? 8 : 3} fill={waypoint === i ? '#f4d987' : '#8d9e6f'} stroke="#f9f5de" strokeWidth="2" /></g>)}
      <g transform={`translate(${100 + telemetry.x * 0.72},${100 + telemetry.z * 0.72}) rotate(${-telemetry.heading * 180 / Math.PI + 180})`}><circle r="12" fill="#fffce9" fillOpacity=".6" /><path d="m0-7 5 12-5-2-5 2Z" fill="#435e43" /></g>
      <text x="184" y="19" fontSize="9" fill="#657451" fontFamily="sans-serif">N</text>
    </svg>
    <div className="map-footer"><span><i />You are here</span><span>↗</span></div>
  </button>
}

function useAmbientAudio(enabled: boolean, onFailure: () => void) {
  useEffect(() => {
    if (!enabled) return
    let context: AudioContext
    try { context = new AudioContext() } catch { onFailure(); return }
    void context.resume().catch(onFailure)
    const master = context.createGain()
    master.gain.value = 0.025
    master.connect(context.destination)
    const play = () => {
      if (context.state !== 'running' || document.hidden) return
      for (let i = 0; i < 3; i++) {
        const osc = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * 0.16
        osc.type = 'sine'; osc.frequency.setValueAtTime(1600 + Math.random() * 900, start); osc.frequency.exponentialRampToValueAtTime(2600, start + 0.1)
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.25, start + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
        osc.connect(gain); gain.connect(master); osc.start(start); osc.stop(start + 0.17)
        osc.onended = () => { osc.disconnect(); gain.disconnect() }
      }
    }
    play()
    const interval = window.setInterval(play, 4600)
    return () => { window.clearInterval(interval); void context.close() }
  }, [enabled, onFailure])
}
export default function App() {
  const controls = useRef<Controls>({ keys: new Set(), reset: 0, orbit: 0, zoom: 10 })
  const [telemetry, setTelemetry] = useState<Telemetry>({ speed: 0, heading: 0, charge: 100, x: 0, z: 4, boosting: false, gear: 'P' })
  const [robot, setRobot] = useState<RobotControls>({ lights: true, antenna: true, wave: 0 })
  const [sound, setSound] = useState(false)
  const [time, setTime] = useState<TimeOfDay>('Golden hour')
  const [panel, setPanel] = useState<'help' | 'settings' | 'guide' | 'robot' | 'time' | null>(null)
  const [photo, setPhoto] = useState(false)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [orbitMode, setOrbitMode] = useState(false)
  const [cameraZoom, setCameraZoom] = useState(10)
  const [waypoint, setWaypoint] = useState<number | null>(null)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const renderer = useRef<THREE.WebGLRenderer | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notify = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3600)
  }, [])
  const audioFailure = useCallback(() => { setSound(false); notify('Nature sounds aren’t available in this browser.') }, [notify])
  useAmbientAudio(sound, audioFailure)
  const actRobot = useCallback((action: keyof RobotControls) => {
    setRobot(value => ({ ...value, [action]: action === 'wave' ? value.wave + 1 : !value[action] }))
  }, [])
  const reset = () => { controls.current.reset++; controls.current.keys.clear(); controls.current.orbit = 0; notify('Back to your happy place.') }
  const reportTelemetry = useCallback((next: Telemetry) => {
    setTelemetry(next)
    const nearby = LANDMARKS.findIndex(place => Math.hypot(place.x - next.x, place.z - next.z) < 7)
    if (nearby >= 0 && !visited.has(nearby)) {
      setVisited(previous => new Set([...previous, nearby]))
      notify(`Discovered ${LANDMARKS[nearby].name}. A little wonder, found.`)
    }
    if (waypoint !== null && nearby === waypoint) setWaypoint(null)
  }, [visited, waypoint, notify])
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.code === 'Escape') { setPanel(null); setPhoto(false); return }
      if (target.closest('input, select, textarea, [contenteditable]') || panel) return
      if (event.code === 'Space' && target.closest('button, a')) return
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      controls.current.keys.add(event.code)
      if (event.code === 'KeyR' && !event.repeat) controls.current.reset++
      if (event.code === 'KeyH' && !event.repeat) setPanel('help')
      if (event.code === 'KeyL' && !event.repeat) setRobot(value => ({ ...value, lights: !value.lights }))
    }
    const up = (event: KeyboardEvent) => controls.current.keys.delete(event.code)
    const clear = () => controls.current.keys.clear()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear) }
  }, [panel])
  useEffect(() => {
    if (panel) {
      controls.current.keys.clear()
      lastFocus.current = document.activeElement as HTMLElement
      panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    } else lastFocus.current?.focus()
  }, [panel])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const savePhoto = () => {
    if (!renderer.current) return
    renderer.current.domElement.toBlob(blob => {
      if (!blob) { notify('Your photo could not be saved. Please try again.'); return }
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'a-mellow-moment.png'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('A little moment, saved.')
    })
  }
  const direction = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'][((Math.round(telemetry.heading / (Math.PI / 4)) % 8) + 8) % 8]
  const togglePanel = (next: typeof panel) => { setCameraZoom(controls.current.zoom); setPanel(previous => previous === next ? null : next) }
  const touchKey = (code: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); controls.current.keys.add(code) },
    onPointerUp: () => controls.current.keys.delete(code),
    onPointerCancel: () => controls.current.keys.delete(code),
    onLostPointerCapture: () => controls.current.keys.delete(code),
  })
  return <main className={`mellow-app ${photo ? 'photo-mode' : ''}`}>
    <style>{STYLES}</style>
    <header className="topbar">
      <a className="brand" href="./" aria-label="Mellow home"><span className="brand-mark"><Icon name="leaf" size={24} /></span><span>mellow<span className="brand-period">.</span></span></a>
      <div className="brand-caption">A LITTLE ROBOT. A WIDE, WILD WORLD.</div>
      <div className="top-actions">
        <span className="live-status"><i /> Free to wander</span><span className="header-divider" />
        <button className={`icon-button ${sound ? 'selected' : ''}`} aria-label={sound ? 'Mute nature sounds' : 'Enable nature sounds'} aria-pressed={sound} onClick={() => setSound(!sound)}><Icon name={sound ? 'sound' : 'mute'} /></button>
        <button className="icon-button" aria-label="Open settings" aria-expanded={panel === 'settings'} onClick={() => togglePanel('settings')}><Icon name="settings" /></button>
        <button className="help-button" aria-label="How to play" aria-expanded={panel === 'help'} onClick={() => togglePanel('help')}><Icon name="help" size={19} /><span>How to play</span></button>
      </div>
    </header>
    <section className="world" aria-label="Interactive robot exploration world">
      <SceneBoundary>
        <Canvas shadows dpr={[1, 1.5]} camera={{ position: [6, 5, 13], fov: 43, near: 0.1, far: 280 }} gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { renderer.current = gl; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; setReady(true) }} fallback={<div className="scene-error"><h2>A browser with a little more magic.</h2><p>Please enable WebGL and hardware acceleration to explore Mellow.</p></div>}>
          <Simulation controls={controls} robot={robot} onRobot={actRobot} onTelemetry={reportTelemetry} reduced={reduced} time={time} waypoint={waypoint} orbitMode={orbitMode} />
        </Canvas>
      </SceneBoundary>
      <div className="world-vignette" />
      {!ready && <div className="loading-world"><Icon name="leaf" size={28} /><span>Growing your little world…</span></div>}
      <div className="world-top hud">
        <div className="world-label"><span className="little-star">✳</span> THE MEADOW <span className="label-rule" /> <span>01</span></div>
        <div className="scene-actions"><button className="weather-button" onClick={() => togglePanel('time')} aria-expanded={panel === 'time'}><Icon name="sun" size={17} />{time}<span className="chevron">⌄</span></button><button className="photo-button" onClick={() => { setPanel(null); setPhoto(true) }}><Icon name="camera" size={17} /><span>Photo mode</span></button></div>
      </div>
      <section className="intro hud" aria-label="Welcome">
        <div className="eyebrow"><span /> LESS HURRY. MORE WONDER.</div>
        <h1>Take the<br />scenic route<span>.</span></h1>
        <p>Nowhere to be. Everything to discover.<br />Just you, M.O., and a little curiosity.</p>
        <button className="meet-button" onClick={() => togglePanel('robot')}><span className="tiny-robot"><i /><i /></span>Say hello to M.O.<Icon name="arrow" size={17} /></button>
      </section>
      <aside className="map-position hud"><MiniMap telemetry={telemetry} waypoint={waypoint} onOpen={() => togglePanel('guide')} /><div className="coordinates">{Math.abs(telemetry.z).toFixed(2)}° {telemetry.z > 0 ? 'S' : 'N'} <span>·</span> {Math.abs(telemetry.x).toFixed(2)}° {telemetry.x > 0 ? 'E' : 'W'}</div></aside>
      <div className="robot-hint hud"><span className="hint-line" /><span><i /> A curious little companion</span></div>
      <button className="field-guide hud" onClick={() => togglePanel('guide')}><span className="guide-icon"><Icon name="flower" size={23} /></span><span><span className="small-label">YOUR LITTLE ADVENTURE</span><strong>{visited.size} of 4 wonders found <Icon name="arrow" size={15} /></strong></span><span className="guide-dots">{LANDMARKS.map((_, i) => <i key={i} className={visited.has(i) ? 'found' : ''} />)}</span></button>
      <div className="telemetry hud">
        <div className="speed"><span className="gear">{telemetry.gear}</span><strong>{Math.round(telemetry.speed).toString().padStart(2, '0')}</strong><span className="speed-unit">km/h</span></div>
        <span className="telemetry-divider" />
        <div className="boost"><div><Icon name="bolt" size={14} /><span>{telemetry.boosting ? 'A LITTLE EXTRA!' : 'BOOST'}<span>{Math.round(telemetry.charge)}%</span></span></div><div className="boost-track"><span style={{ width: `${telemetry.charge}%` }} /></div></div>
        <div className="direction"><Icon name="compass" size={20} /><span>{direction}</span></div>
      </div>
      <div className="touch-controls hud" aria-label="Touch driving controls"><button aria-label="Steer left" {...touchKey('KeyA')}>←</button><div><button aria-label="Drive forward" {...touchKey('KeyW')}>↑</button><button aria-label="Reverse" {...touchKey('KeyS')}>↓</button></div><button aria-label="Steer right" {...touchKey('KeyD')}>→</button><button aria-label="Brake" {...touchKey('Space')}>■</button><button aria-label="Boost" {...touchKey('ShiftLeft')}><Icon name="bolt" /></button></div>
      <div className="bottom-bar hud">
        <div className="controls-legend"><span className="keyboard-cluster"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span>Wander around</span><span className="control-separator" /><kbd className="wide-key">SPACE</kbd><span>Brake</span><kbd className="wide-key">SHIFT</kbd><span>Boost</span></div>
        <span className="camera-legend"><span className="mouse-icon" />Drag to look <i />Scroll to zoom</span>
        <button className="reset-button" onClick={reset}><Icon name="reset" size={15} /><span>Start fresh</span><kbd>R</kbd></button>
      </div>
      <div className="world-footer hud"><span>MADE FOR THE JOY OF EXPLORING</span><span>Take a breath. Stay a while. <Icon name="leaf" size={12} /></span></div>
      {photo && <div className="photo-controls"><span><Icon name="camera" /> A mellow moment</span><button onClick={savePhoto}><Icon name="download" size={17} />Save image</button><button onClick={() => setPhoto(false)}><Icon name="close" size={17} />Exit photo mode</button></div>}
      {toast && <div className="toast" role="status"><Icon name="leaf" size={17} />{toast}</div>}
      {panel && <div className={`panel-backdrop ${panel === 'time' ? 'subtle-backdrop' : ''}`} onPointerDown={e => { if (e.target === e.currentTarget) setPanel(null) }}>
        <section className={`dialog ${panel === 'time' ? 'time-dialog' : ''}`} ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={e => {
          if (e.key !== 'Tab') return
          const items = panelRef.current?.querySelectorAll<HTMLElement>('button, input, select, a[href]')
          if (!items?.length) return
          const first = items[0], last = items[items.length - 1]
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        }}>
          <button className="dialog-close icon-button" onClick={() => setPanel(null)} aria-label="Close dialog"><Icon name="close" /></button>
          <div className="dialog-icon"><Icon name={panel === 'help' ? 'compass' : panel === 'settings' ? 'settings' : panel === 'guide' ? 'flower' : panel === 'time' ? 'sun' : 'leaf'} size={26} /></div>
          <span className="eyebrow">{panel === 'guide' ? 'COLLECT MOMENTS, NOT THINGS' : 'A LITTLE MOMENT OF MELLOW'}</span>
          <h2 id="dialog-title">{panel === 'help' ? 'Follow your curiosity.' : panel === 'settings' ? 'Make yourself at home.' : panel === 'guide' ? 'The field guide.' : panel === 'time' ? 'A different kind of light.' : 'Small robot. Big heart.'}</h2>
          {panel === 'help' && <><p>There’s no wrong way to wander. Roll over the hills, follow the path, or see where a wildflower takes you.</p><div className="help-grid"><kbd>W / ↑</kbd><span>Move forward</span><kbd>S / ↓</kbd><span>Reverse</span><kbd>A D / ← →</kbd><span>Steer left and right</span><kbd>SPACE</kbd><span>Brake gently</span><kbd>SHIFT</kbd><span>A little boost (recharges naturally)</span><kbd>R</kbd><span>Return to the clearing</span><kbd>L</kbd><span>Toggle M.O.’s headlights</span></div><p className="dialog-note">Drag the world to look around. Scroll to get closer. Click M.O.’s face, lights, or antenna to say hello.</p><button className="primary-button" onClick={() => setPanel(null)}>Let’s wander <Icon name="arrow" size={17} /></button></>}
          {panel === 'settings' && <><p>Your world, at your own pace.</p><label className="setting-row"><span><strong>Nature sounds</strong><small>Soft, procedurally generated birdsong</small></span><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /></label><label className="setting-row"><span><strong>Gentle motion</strong><small>Pause ambient motion and blinking</small></span><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /></label><label className="setting-row"><span><strong>Free-look camera</strong><small>Keep your view while driving</small></span><input type="checkbox" checked={orbitMode} onChange={e => setOrbitMode(e.target.checked)} /></label><label className="setting-row"><span><strong>Camera distance</strong><small>Near and cozy, or a wider perspective</small></span><input aria-label="Camera distance" type="range" min="5" max="18" value={cameraZoom} onChange={e => { const value = Number(e.target.value); controls.current.zoom = value; setCameraZoom(value) }} /></label><button className="primary-button" onClick={() => setPanel(null)}>Just right <Icon name="check" size={17} /></button></>}
          {panel === 'guide' && <><p>Four little wonders are waiting in the meadow.<br />Choose a place to leave a guiding light.</p><div className="landmark-list">{LANDMARKS.map((place, i) => <button key={place.name} onClick={() => { setWaypoint(i); setPanel(null); notify(`Follow the golden light to ${place.name}.`) }}><span className={`landmark-icon ${visited.has(i) ? 'discovered' : ''}`}><Icon name={place.icon} size={23} /></span><span><strong>{place.name}</strong><small>{place.subtitle}</small></span>{visited.has(i) ? <Icon name="check" size={18} /> : <span className="distance">{Math.round(Math.hypot(place.x - telemetry.x, place.z - telemetry.z))} m</span>}</button>)}</div><p className="dialog-note">{visited.size} of 4 places discovered. There’s no rush.</p></>}
          {panel === 'robot' && <><p>Meet M.O. — your Meadow Observer. Built for little detours, flower appreciation, and absolutely no deadlines.</p><div className="robot-profile"><span className="tiny-robot big-robot"><i /><i /></span><span><strong>M.O. / Nº 004</strong><small><i /> Feeling wonderfully curious</small></span></div><div className="robot-buttons"><button aria-pressed={robot.lights} onClick={() => actRobot('lights')}><Icon name="sun" />Headlights <span>{robot.lights ? 'On' : 'Off'}</span></button><button aria-pressed={robot.antenna} onClick={() => actRobot('antenna')}><Icon name="bolt" />Antenna <span>{robot.antenna ? 'On' : 'Off'}</span></button><button onClick={() => { actRobot('wave'); setPanel(null); notify('M.O. is very happy to see you.') }}><Icon name="leaf" />Say hello <Icon name="arrow" size={15} /></button></div><p className="dialog-note">42 kg of curiosity · Independent suspension · Solar-powered spirit</p></>}
          {panel === 'time' && <div className="time-options">{(['Golden hour', 'Morning light', 'Blue hour'] as const).map((value, i) => <button key={value} onClick={() => { setTime(value); setPanel(null) }}><span className={`time-swatch swatch-${i}`} /><span>{value}<small>{['Warm light. Long, lovely shadows.', 'A fresh start, soft and bright.', 'A quiet world of little fireflies.'][i]}</small></span>{time === value && <Icon name="check" size={18} />}</button>)}</div>}
        </section>
      </div>}
    </section>
  </main>
}

const STYLES = `
:root{--ink:#304534;--muted:#76816b;--paper:#f7f8ef;--line:rgba(61,82,45,.13);--green:#4f6946}
.mellow-app{width:100%;height:100%;display:flex;flex-direction:column;background:var(--paper);color:var(--ink)}
button{cursor:pointer;color:inherit}button,a{-webkit-tap-highlight-color:transparent}button{transition:background .2s,transform .2s,box-shadow .2s}button:hover{filter:brightness(.97)}button:active{transform:translateY(1px)}
.topbar{height:86px;min-height:86px;padding:0 42px;display:flex;align-items:center;border-bottom:1px solid var(--line);z-index:5;gap:36px}
.brand{display:flex;align-items:center;gap:11px;color:#334d39;text-decoration:none;font-size:35px;font-weight:700;letter-spacing:-2px}.brand-mark{height:37px;width:37px;border:1.5px solid #536b48;border-radius:12px;display:grid;place-items:center;transform:rotate(-7deg)}.brand-mark svg{transform:rotate(7deg)}.brand-period{color:#839b62}
.brand-caption{font-size:9px;font-weight:600;letter-spacing:2.05px;color:#849078;margin-top:4px}.top-actions{display:flex;align-items:center;gap:13px;margin-left:auto}.live-status{font-size:11px;display:flex;align-items:center;gap:7px;white-space:nowrap}.live-status i,.map-footer i,.robot-hint i,.robot-profile small i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#8ba56e}.header-divider{height:22px;width:1px;background:var(--line);margin:0 6px}.icon-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;border-radius:50%}.icon-button:hover,.icon-button.selected{background:#e9eddc}.help-button{display:flex;align-items:center;gap:7px;border:1px solid #dce1cf;border-radius:7px;padding:9px 12px;background:transparent;font-size:11px;margin-left:4px}
.world{flex:1;position:relative;min-height:0;isolation:isolate;overflow:hidden}.world>div:first-of-type{position:absolute!important;inset:0}.world canvas{touch-action:none;cursor:grab}.world canvas:active{cursor:grabbing}.world-vignette{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(239,240,218,.22),transparent 45%),linear-gradient(0deg,rgba(37,59,28,.13),transparent 25%)}.hud{transition:opacity .3s}
.world-top{position:absolute;left:43px;right:43px;top:28px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}.world-label{display:flex;align-items:center;gap:10px;font-size:10px;letter-spacing:1.8px;font-weight:600}.little-star{font-size:23px;line-height:1;color:#62764e}.label-rule{height:1px;width:26px;background:#667c4f;opacity:.35;margin-left:7px}.world-label>span:last-child{font-size:9px;opacity:.6}.scene-actions{display:flex;gap:9px;pointer-events:auto}.weather-button,.photo-button{display:flex;align-items:center;gap:8px;background:rgba(248,249,234,.7);border:1px solid rgba(255,255,245,.5);backdrop-filter:blur(12px);font-size:10px;padding:9px 12px;border-radius:7px}.chevron{margin-left:7px;color:#8b9776}
.intro{position:absolute;top:115px;left:58px;pointer-events:none}.eyebrow{font-size:9px;letter-spacing:1.85px;font-weight:600;color:#738164;display:flex;align-items:center;gap:8px}.eyebrow>span{height:5px;width:5px;background:#899b63;border-radius:50%}.intro h1{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:clamp(48px,4.7vw,76px);line-height:1.04;letter-spacing:-3.3px;margin:21px 0 19px;color:#354b35}.intro h1>span{color:#849b5d}.intro p{font-size:12px;line-height:1.9;letter-spacing:.1px;color:#657457;margin:0}.meet-button{display:flex;align-items:center;gap:10px;margin-top:23px;padding:10px 12px 10px 9px;border:1px solid rgba(79,105,57,.15);background:rgba(249,249,231,.57);border-radius:8px;pointer-events:auto;font-size:10px;backdrop-filter:blur(12px)}.meet-button>svg{margin-left:8px;color:#758667}.tiny-robot{width:24px;height:20px;display:flex;justify-content:center;align-items:center;gap:5px;border-radius:6px;background:#4b6250;border:3px solid #bdc8a5;box-shadow:0 0 0 1px #9eae8c}.tiny-robot i{height:5px;width:3px;border-radius:2px;background:#e3edb8}
.map-position{position:absolute;right:43px;top:98px;width:179px}.minimap{display:block;border:1px solid rgba(255,255,240,.72);border-radius:12px;width:100%;overflow:hidden;background:rgba(246,247,228,.88);padding:0;box-shadow:0 4px 24px #3c51200b}.map-heading{display:flex;align-items:center;justify-content:space-between;padding:13px 13px 10px;font-size:8px;letter-spacing:1.4px;font-weight:600}.map-art{display:block;width:100%;height:157px;border-top:1px solid #ccd7af88;border-bottom:1px solid #ccd7af88}.map-footer{display:flex;justify-content:space-between;padding:10px 13px;font-size:9px}.map-footer>span:first-child{display:flex;align-items:center;gap:6px}.coordinates{text-align:center;font-size:8px;letter-spacing:1px;color:#647153;margin-top:11px}.coordinates>span{padding:0 6px}
.robot-hint{position:absolute;top:63%;left:59%;display:flex;align-items:center;gap:9px;pointer-events:none}.hint-line{height:1px;width:34px;background:#87967480}.robot-hint>span:last-child{font-size:9px;display:flex;align-items:center;gap:6px;color:#4b603e;background:#f4f5e4b8;border:1px solid #ffffed70;backdrop-filter:blur(8px);padding:9px 12px;border-radius:6px}
.field-guide{position:absolute;left:44px;bottom:155px;display:flex;align-items:center;gap:12px;padding:14px 16px;background:#f6f7e8e8;border:1px solid #ffffea99;border-radius:11px;box-shadow:0 4px 28px #31422108;text-align:left}.guide-icon{width:38px;height:38px;display:grid;place-items:center;background:#e6ebd4;border-radius:10px;color:#788f57}.small-label{display:block;font-size:7px;letter-spacing:1.4px;color:#869076;margin-bottom:6px}.field-guide strong{display:flex;align-items:center;gap:12px;font-size:11px;font-weight:400}.guide-dots{display:flex;gap:4px;margin-left:14px}.guide-dots i{width:5px;height:5px;border:1px solid #b4bea2;border-radius:50%}.guide-dots i.found{background:#788d60;border-color:#788d60}
.telemetry{position:absolute;right:44px;bottom:155px;padding:14px 17px;display:flex;align-items:center;gap:17px;border-radius:11px;border:1px solid #ffffe999;background:#f6f7e8ee;box-shadow:0 4px 28px #31422108;height:69px}.speed{display:flex;align-items:baseline;gap:7px}.gear{align-self:center;display:grid;place-items:center;background:#e6ead8;border-radius:4px;width:20px;height:23px;font-size:10px;margin-right:3px}.speed strong{font-family:'Trebuchet MS',sans-serif;font-weight:400;font-size:35px;letter-spacing:-2px;font-variant-numeric:tabular-nums;line-height:1}.speed-unit{font-size:9px;color:#7f886f}.telemetry-divider{height:28px;width:1px;background:var(--line)}.boost{width:108px}.boost>div:first-child{display:flex;align-items:center;gap:3px}.boost>div>span{font-size:7px;letter-spacing:1px;flex:1}.boost>div>span>span{float:right;font-size:8px;letter-spacing:0;color:#79856a}.boost-track{height:4px;background:#dce3cc;border-radius:3px;margin-top:8px;overflow:hidden}.boost-track>span{height:100%;display:block;background:#8ca36a;border-radius:3px;transition:width .1s}.direction{display:flex;flex-direction:column;align-items:center;gap:3px;margin-left:2px}.direction>span{font-size:7px}
.bottom-bar{position:absolute;bottom:56px;left:43px;right:43px;min-height:70px;border:1px solid #ffffeda6;border-radius:11px;background:rgba(246,248,234,.92);backdrop-filter:blur(15px);display:flex;align-items:center;padding:13px 23px;gap:26px;box-shadow:0 8px 35px #32462912}.controls-legend{display:flex;gap:9px;align-items:center;font-size:10px;white-space:nowrap}.keyboard-cluster{display:flex;flex-direction:column;align-items:center;gap:3px;margin-right:4px}.keyboard-cluster>span{display:flex;gap:3px}kbd{display:inline-grid;place-items:center;background:#fafbf2;border:1px solid #d8deca;border-bottom-width:2px;border-radius:4px;min-width:19px;height:20px;font-family:inherit;font-size:8px;color:#667458}.wide-key{padding:0 7px;font-size:7px;letter-spacing:.65px;height:24px;margin-left:10px}.control-separator{height:23px;width:1px;background:var(--line);margin:0 7px}.camera-legend{display:flex;align-items:center;font-size:9px;color:#7e896f;gap:7px;margin-left:auto;white-space:nowrap}.camera-legend i{width:3px;height:3px;border-radius:50%;background:#a0aa8b;margin:0 1px}.mouse-icon{width:10px;height:15px;border:1px solid #94a083;border-radius:5px;position:relative}.mouse-icon:after{content:'';width:1px;height:4px;background:#94a083;position:absolute;top:2px;left:4px}.reset-button{display:flex;align-items:center;gap:7px;border:0;border-left:1px solid var(--line);padding:4px 0 4px 22px;background:none;font-size:10px;white-space:nowrap}.reset-button>kbd{margin-left:5px}
.world-footer{position:absolute;bottom:23px;left:44px;right:44px;display:flex;justify-content:space-between;align-items:center;font-size:7px;color:#e6ebd7;letter-spacing:1.5px;text-shadow:0 1px 5px #344b32aa}.world-footer>span:last-child{display:flex;gap:8px;align-items:center;letter-spacing:.2px;font-size:9px}.photo-mode .hud,.photo-mode .topbar{display:none}.photo-mode .world-vignette{display:none}.photo-controls{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:#f6f8e9eb;border:1px solid #ffffed99;border-radius:12px;padding:12px 16px;white-space:nowrap;backdrop-filter:blur(12px)}.photo-controls>span{display:flex;align-items:center;gap:8px;font-family:Georgia,serif;font-size:18px;margin-right:12px}.photo-controls button{display:flex;align-items:center;gap:6px;border:1px solid #d8dfc8;border-radius:6px;background:transparent;padding:8px 10px;font-size:10px}
.panel-backdrop{position:absolute;inset:0;background:#263b2e3b;backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:10;padding:22px}.dialog{width:440px;max-height:100%;overflow:auto;position:relative;background:#f8f9ef;border:1px solid #fffef4;border-radius:20px;padding:32px;box-shadow:0 20px 90px #20332333;animation:arrive .2s ease-out}.dialog-close{position:absolute;right:15px;top:15px}.dialog-icon{width:49px;height:49px;display:grid;place-items:center;border-radius:14px;background:#e6ecd7;color:#6a8652;margin-bottom:23px}.dialog .eyebrow{font-size:7px;letter-spacing:1.5px}.dialog h2{font-family:Georgia,serif;font-size:30px;font-weight:400;letter-spacing:-1px;margin:12px 0 15px}.dialog p{font-size:12px;line-height:1.9;color:#77816a;margin:0 0 18px}.dialog .dialog-note{font-size:10px;border-top:1px solid var(--line);padding-top:16px;margin-top:16px;margin-bottom:0}.primary-button{display:flex;align-items:center;justify-content:center;gap:15px;width:100%;border:0;border-radius:8px;background:#4f6946;color:#f4f5df;padding:13px;margin-top:22px;font-size:12px}.help-grid{display:grid;grid-template-columns:105px 1fr;gap:9px 14px;align-items:center;font-size:11px}.help-grid kbd{width:max-content;min-width:38px;padding:4px 8px;height:25px;font-size:9px}.setting-row{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:16px 0;border-top:1px solid var(--line);cursor:pointer}.setting-row strong{font-size:12px;font-weight:500;display:block}.setting-row small{display:block;font-size:10px;color:#8a937c;margin-top:6px}.setting-row input{accent-color:#728d5a;width:18px;height:18px;flex-shrink:0}.setting-row input[type=range]{width:86px}.landmark-list{display:flex;flex-direction:column;gap:9px}.landmark-list button{display:flex;align-items:center;gap:13px;padding:12px 10px;text-align:left;background:#f0f3e4;border:1px solid #e2e7d5;border-radius:9px}.landmark-icon{display:grid;place-items:center;width:39px;height:39px;border-radius:9px;color:#94a67f;background:#e7ecd9;flex-shrink:0}.landmark-icon.discovered{color:#5f7a4b;background:#dbe6c6}.landmark-list strong{display:block;font-size:12px;font-weight:500}.landmark-list small{display:block;margin-top:5px;font-size:9px;color:#869079}.landmark-list button>svg,.distance{margin-left:auto;color:#7d9169}.distance{font-size:10px;white-space:nowrap}.robot-profile{display:flex;gap:18px;align-items:center;background:#edf1df;border:1px solid #dde5ca;border-radius:12px;padding:20px;margin:20px 0}.big-robot{height:49px;width:60px;border-width:7px;border-radius:14px;gap:12px;transform:rotate(-6deg)}.big-robot i{width:7px;height:12px}.robot-profile strong{display:block;font-size:12px;letter-spacing:1px}.robot-profile small{display:block;font-size:9px;margin-top:8px;color:#7a8e62}.robot-buttons{display:flex;flex-direction:column;gap:8px}.robot-buttons button{display:flex;align-items:center;gap:10px;border:1px solid #dfe5d1;border-radius:7px;padding:11px;background:transparent;font-size:11px}.robot-buttons button>span,.robot-buttons button>svg:last-child:not(:first-child){margin-left:auto}.robot-buttons button>span{font-size:9px;color:#84956e}.subtle-backdrop{background:transparent;backdrop-filter:none;justify-content:flex-end;align-items:flex-start;padding-top:73px;padding-right:44px}.time-dialog{width:340px;padding:25px}.time-dialog .dialog-icon{display:none}.time-dialog .eyebrow{margin-top:8px}.time-dialog h2{font-size:24px;padding-right:15px}.time-options{display:flex;flex-direction:column;gap:8px}.time-options button{border:1px solid #e1e6d4;display:flex;align-items:center;text-align:left;background:transparent;padding:11px;border-radius:9px;gap:12px;font-size:11px}.time-options small{display:block;font-size:9px;color:#8a947c;margin-top:5px}.time-options button>svg{margin-left:auto}.time-swatch{display:block;width:32px;height:32px;border-radius:50%;background:linear-gradient(#f0d297,#b3bf88)}.swatch-1{background:linear-gradient(#d9e5e3,#a9c196)}.swatch-2{background:linear-gradient(#8b9bb4,#727f86)}
.toast{position:absolute;bottom:143px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:9px;background:#f7f9ecf5;border:1px solid #ffffe9;border-radius:9px;padding:13px 18px;font-size:11px;box-shadow:0 5px 30px #3146261c;z-index:20;max-width:90%;animation:arrive .2s ease-out}.loading-world{position:absolute;inset:0;background:#e5e8ce;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-size:12px;letter-spacing:1px;z-index:3}.scene-error{height:100%;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#e5e8ce;padding:40px;text-align:center}.scene-error h2{font-family:Georgia,serif;font-weight:400;font-size:28px}.scene-error p{max-width:370px;font-size:13px;line-height:1.8}.scene-error button{background:#506c47;color:#f5f7e8;border:0;border-radius:7px;padding:12px 23px}.touch-controls{display:none}
@keyframes arrive{from{opacity:0;margin-top:8px}to{opacity:1;margin-top:0}}
@media(min-width:1600px){.intro{top:135px;left:65px}.intro p{font-size:14px}.intro h1{font-size:83px}.meet-button{font-size:12px}.map-position{width:195px}.map-art{height:172px}}
@media(max-width:1100px){.topbar{padding:0 27px;gap:24px}.brand-caption{font-size:7px;letter-spacing:1.3px}.live-status{display:none}.world-top{left:29px;right:29px}.intro{left:35px;top:109px}.intro h1{font-size:58px}.map-position{right:29px;width:150px}.map-art{height:130px}.bottom-bar{left:28px;right:28px;gap:15px;padding:12px 17px}.camera-legend{display:none}.reset-button{margin-left:auto}.field-guide{left:29px}.telemetry{right:29px;gap:12px}.robot-hint{left:57%}.world-footer{left:29px;right:29px}}
@media(max-width:760px){.topbar{height:69px;min-height:69px;padding:0 20px;gap:15px}.brand{font-size:30px;gap:8px}.brand-mark{width:31px;height:31px;border-radius:10px}.brand-mark svg{width:21px}.brand-caption,.header-divider,.help-button span{display:none}.top-actions{gap:6px}.help-button{padding:6px;border:0;margin:0}.world-top{top:20px;left:22px;right:22px}.world-label{font-size:8px;letter-spacing:1.3px}.world-label .label-rule,.world-label>span:last-child{display:none}.weather-button,.photo-button{font-size:9px;padding:8px}.photo-button span{display:none}.intro{top:92px;left:27px}.intro .eyebrow{font-size:7px;letter-spacing:1.2px}.intro h1{font-size:48px;letter-spacing:-2.8px;margin:16px 0}.intro p{font-size:10px}.meet-button{font-size:9px;margin-top:16px;padding:8px}.map-position{right:20px;top:94px;width:118px}.map-heading{font-size:6px;letter-spacing:.6px;padding:10px}.map-heading svg{width:12px}.map-art{height:104px}.map-footer{font-size:7px;padding:8px 10px}.coordinates{font-size:6px;letter-spacing:.4px}.robot-hint{display:none}.field-guide{left:20px;bottom:142px;gap:8px;padding:11px}.guide-icon{width:30px;height:30px}.small-label{font-size:6px;letter-spacing:.8px}.field-guide strong{font-size:9px;gap:7px}.guide-dots{display:none}.telemetry{right:20px;bottom:142px;height:56px;padding:11px;gap:8px}.speed strong{font-size:29px}.speed-unit{font-size:8px}.gear{width:17px;height:21px;font-size:8px}.boost{width:64px}.boost>div>span{font-size:6px;letter-spacing:0}.boost svg{width:11px}.boost>div>span>span{font-size:7px}.direction,.telemetry-divider{display:none}.bottom-bar{left:20px;right:20px;bottom:48px;padding:10px 14px;min-height:68px;gap:8px}.controls-legend{gap:5px;font-size:8px}.controls-legend>span:nth-child(2){max-width:40px;white-space:normal;line-height:1.6}.control-separator{margin:0 4px}.wide-key{font-size:6px;padding:0 5px;margin-left:5px}.reset-button{padding-left:11px;font-size:9px;gap:5px}.reset-button>kbd{display:none}.world-footer{bottom:20px;left:22px;right:22px;font-size:5px;letter-spacing:.8px}.world-footer>span:last-child{font-size:7px}.dialog{max-width:410px;padding:27px}.dialog h2{font-size:28px}.dialog p{font-size:11px}.photo-controls{bottom:24px;gap:7px;padding:10px}.photo-controls>span{display:none}.photo-controls button{font-size:9px}.toast{bottom:217px;font-size:10px;padding:12px;min-width:230px}.subtle-backdrop{padding:64px 20px 20px}}
@media(max-width:430px){.intro h1{font-size:43px}.intro{left:23px}.intro p{font-size:9px}.map-position{width:98px;top:103px;right:17px}.map-art{height:85px}.map-heading{font-size:5.5px;padding:8px}.map-footer{padding:8px;font-size:6px}.coordinates{display:none}.field-guide{left:15px;padding:9px;bottom:137px}.guide-icon{width:26px;height:29px}.guide-icon svg{width:18px}.field-guide strong{font-size:8px}.small-label{font-size:5px}.telemetry{right:15px;bottom:137px;gap:6px;padding:9px;height:54px}.boost{width:56px}.speed strong{font-size:25px}.speed{gap:4px}.speed-unit{font-size:7px}.bottom-bar{left:15px;right:15px;padding:10px}.controls-legend{font-size:7px;gap:4px}.wide-key{margin-left:2px;font-size:5px}.reset-button>span{display:none}.control-separator{margin:0 2px}.world-label{font-size:7px}.scene-actions{gap:5px}.weather-button{font-size:8px}.chevron{margin:0}}
@media(pointer:coarse){.touch-controls{position:absolute;left:50%;transform:translateX(-50%);bottom:54px;display:flex;align-items:center;gap:7px}.touch-controls>div{display:flex;flex-direction:column;gap:5px}.touch-controls button{width:43px;height:36px;display:grid;place-items:center;border:1px solid #fffef4a1;border-radius:8px;background:#f7f8e7d9;backdrop-filter:blur(8px);font-size:18px;touch-action:none;user-select:none}.bottom-bar{display:none}.field-guide,.telemetry{bottom:153px}.world-footer{bottom:15px}.photo-mode .touch-controls{display:none}}
@media(max-height:650px) and (min-width:761px){.topbar{height:65px;min-height:65px}.intro{top:80px}.intro h1{font-size:49px;margin:15px 0}.intro p{font-size:10px}.meet-button{margin-top:14px}.map-position{top:80px;width:140px}.map-art{height:110px}.field-guide,.telemetry{bottom:130px}.bottom-bar{bottom:43px;min-height:62px}.world-footer{bottom:17px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
`
