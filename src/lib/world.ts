import { createNoise2D } from 'simplex-noise'

export const WORLD_SIZE = 220
export const TERRAIN_SEGMENTS = 256
export const SPAWN = { x: 0, z: 0, heading: -0.43 }

export function seededRandom(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const noise = createNoise2D(seededRandom(2419))

export function pathCenter(distance: number) {
  return Math.sin(distance * 0.043) * 11 + Math.sin(distance * 0.093) * 4
}

export function pathDistance(x: number, z: number) {
  const mainPath = Math.abs(x - pathCenter(z))
  const sidePath = Math.abs(z + 26 + Math.sin(x * 0.065) * 9)
  return Math.min(mainPath, sidePath)
}

export function rawHeight(x: number, z: number) {
  const clearing = 1 - Math.exp(-(x * x + z * z) / 150)
  const hills = noise(x * 0.017 + 8, z * 0.017 + 2) * 3.8
  const ripples = noise(x * 0.06, z * 0.06) * 0.75
  const detail = noise(x * 0.25, z * 0.25) * 0.095
  const edge = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - 87)
  return (hills + ripples) * clearing + detail + edge * edge * 0.035
}

export type TerrainData = {
  vertices: Float32Array
  indices: Uint32Array
  heightAt: (x: number, z: number) => number
}

export function createTerrain(
  size = WORLD_SIZE,
  segments = TERRAIN_SEGMENTS,
  height = rawHeight,
): TerrainData {
  const stride = segments + 1
  const spacing = size / segments
  const vertices = new Float32Array(stride * stride * 3)
  const indices = new Uint32Array(segments * segments * 6)
  for (let row = 0; row <= segments; row++) {
    for (let column = 0; column <= segments; column++) {
      const x = column * spacing - size / 2
      const z = row * spacing - size / 2
      const index = (row * stride + column) * 3
      vertices.set([x, height(x, z), z], index)
      if (row < segments && column < segments) {
        const corner = row * stride + column
        indices.set(
          [corner, corner + stride, corner + 1, corner + 1, corner + stride, corner + stride + 1],
          (row * segments + column) * 6,
        )
      }
    }
  }
  return {
    vertices,
    indices,
    heightAt(x, z) {
      const gridX = Math.max(0, Math.min(segments - 0.00001, (x + size / 2) / spacing))
      const gridZ = Math.max(0, Math.min(segments - 0.00001, (z + size / 2) / spacing))
      const column = Math.floor(gridX)
      const row = Math.floor(gridZ)
      const fractionX = gridX - column
      const fractionZ = gridZ - row
      const corner = row * stride + column
      const topLeft = vertices[corner * 3 + 1]
      const topRight = vertices[(corner + 1) * 3 + 1]
      const bottomLeft = vertices[(corner + stride) * 3 + 1]
      const bottomRight = vertices[(corner + stride + 1) * 3 + 1]
      return fractionX + fractionZ <= 1
        ? topLeft + (topRight - topLeft) * fractionX + (bottomLeft - topLeft) * fractionZ
        : bottomRight +
            (bottomLeft - bottomRight) * (1 - fractionX) +
            (topRight - bottomRight) * (1 - fractionZ)
    },
  }
}

export const terrain = createTerrain()
export const groundHeight = terrain.heightAt

export type WorldObject = {
  kind: 'tree' | 'rock' | 'mushroom'
  x: number
  z: number
  scale: number
  rotation: number
  variant: number
}

const random = seededRandom(615)
export const worldObjects: WorldObject[] = [
  { kind: 'tree', x: -12, z: -10, scale: 1.4, rotation: 0, variant: 0 },
  { kind: 'tree', x: 15, z: -20, scale: 1.65, rotation: 1, variant: 1 },
  { kind: 'tree', x: -23, z: -28, scale: 1.65, rotation: 2, variant: 0 },
  { kind: 'tree', x: 28, z: -38, scale: 1.9, rotation: 2, variant: 2 },
  { kind: 'mushroom', x: 6.5, z: -5.5, scale: 1.55, rotation: 0.2, variant: 0 },
  { kind: 'mushroom', x: 8.2, z: -6, scale: 0.85, rotation: -0.2, variant: 0 },
  { kind: 'mushroom', x: 7.8, z: -4.8, scale: 0.55, rotation: 0.2, variant: 1 },
  { kind: 'rock', x: -6, z: -3, scale: 1.2, rotation: 0.4, variant: 0 },
  { kind: 'rock', x: -7.3, z: -3.4, scale: 0.7, rotation: 1, variant: 1 },
]

for (let index = 0; index < 235; index++) {
  const x = (random() - 0.5) * 187
  const z = (random() - 0.5) * 187
  if (pathDistance(x, z) < 5.8 || Math.hypot(x, z) < 10) continue
  const kind = index % 4 === 0 ? 'tree' : index % 3 === 0 ? 'rock' : 'mushroom'
  worldObjects.push({
    kind,
    x,
    z,
    scale: kind === 'tree' ? 0.8 + random() * 1.2 : 0.3 + random() * 1.1,
    rotation: random() * Math.PI * 2,
    variant: Math.floor(random() * 3),
  })
}

export const landmarks = [
  {
    id: 'wishing-tree',
    name: 'The wishing tree',
    type: 'ANCIENT FLORA',
    x: -12,
    z: -10,
    icon: 'tree',
    description:
      'A thousand leaves. A thousand little wishes. Its roots have held this hillside for longer than anyone remembers.',
  },
  {
    id: 'mushroom-hollow',
    name: 'Mushroom hollow',
    type: 'TINY WONDERS',
    x: 7,
    z: -5.5,
    icon: 'mushroom',
    description:
      'A bright little gathering at the edge of the path. After the rain, their ivory spots hold tiny pools of sunlight.',
  },
  {
    id: 'sunstone-circle',
    name: 'Sunstone circle',
    type: 'QUIET PLACES',
    x: -19,
    z: -38,
    icon: 'stone',
    description:
      'Five weathered stones keeping each other company. Nobody remembers who put them here. The wildflowers seem to approve.',
  },
  {
    id: 'clover-grove',
    name: 'Clover grove',
    type: 'HIDDEN CORNERS',
    x: 28,
    z: -38,
    icon: 'leaf',
    description:
      'A sheltered pocket of green, where the light falls slowly and there is never any reason to hurry.',
  },
] as const

for (let index = 0; index < 5; index++) {
  const angle = (index / 5) * Math.PI * 2
  worldObjects.push({
    kind: 'rock',
    x: -19 + Math.cos(angle) * 3.2,
    z: -38 + Math.sin(angle) * 3.2,
    scale: 1.25,
    rotation: angle,
    variant: 2,
  })
}
