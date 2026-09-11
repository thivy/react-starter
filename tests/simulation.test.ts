import RAPIER from '@dimforge/rapier3d-compat'
import { afterAll, describe, expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { EMPTY_INPUT, initializePhysics, RobotSimulation } from '../src/lib/simulation'
import { createTerrain, groundHeight, rawHeight, terrain } from '../src/lib/world'

await initializePhysics()
const simulations: RobotSimulation[] = []
const flat = createTerrain(220, 16, () => 0)

function createSimulation(surface = flat) {
  const simulation = new RobotSimulation({ terrain: surface, objects: [], heading: 0 })
  simulations.push(simulation)
  for (let frame = 0; frame < 180; frame++) simulation.step()
  return simulation
}

function advance(simulation: RobotSimulation, frames: number, input = EMPTY_INPUT) {
  for (let frame = 0; frame < frames; frame++) simulation.step(input)
}

afterAll(() => simulations.forEach((simulation) => simulation.dispose()))

describe('shared procedural terrain', () => {
  test('terrain is deterministic and has meaningful elevation changes', () => {
    expect(rawHeight(17, 21)).toBe(rawHeight(17, 21))
    const heights = [-35, -20, 0, 20, 35].flatMap((x) => [-35, 0, 35].map((z) => rawHeight(x, z)))
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(2)
  })

  test('rendered height matches physics collision triangles', () => {
    const simulation = createSimulation(terrain)
    for (const [x, z] of [
      [4.1, 9.6],
      [-21.2, 17.3],
      [32.8, -18.1],
    ]) {
      const hit = simulation.world.castRay(
        new RAPIER.Ray({ x, y: 30, z }, { x: 0, y: -1, z: 0 }),
        60,
        true,
      )
      expect(hit).not.toBeNull()
      expect(30 - hit!.timeOfImpact).toBeCloseTo(groundHeight(x, z), 3)
    }
  })
})

describe('four-wheel rigid-body vehicle', () => {
  test('settles on four independently suspended wheels', () => {
    const simulation = createSimulation()
    expect(simulation.telemetry.contact).toBe(4)
    expect(simulation.position.y).toBeGreaterThan(0.45)
    expect(simulation.position.y).toBeLessThan(1)
    expect(simulation.chassis.mass()).toBeCloseTo(38, 2)
    expect(simulation.isOverturned()).toBe(false)
  })

  test('accelerates forwards, preserves momentum, then brakes', () => {
    const simulation = createSimulation()
    advance(simulation, 180, { ...EMPTY_INPUT, throttle: 1 })
    expect(simulation.telemetry.speed).toBeGreaterThan(2)
    expect(simulation.position.z).toBeGreaterThan(3)
    const movingSpeed = simulation.telemetry.speed
    advance(simulation, 20)
    expect(simulation.telemetry.speed).toBeGreaterThan(0.5)
    expect(simulation.telemetry.speed).toBeLessThan(movingSpeed + 0.2)
    advance(simulation, 120, { ...EMPTY_INPUT, brake: true })
    expect(Math.abs(simulation.telemetry.speed)).toBeLessThan(0.15)
  })

  test('reverses and changes wheel rotation direction', () => {
    const simulation = createSimulation()
    advance(simulation, 100, { ...EMPTY_INPUT, throttle: 1 })
    const forwardRotation = simulation.wheelRotation[0]
    simulation.reset(0)
    advance(simulation, 180, { ...EMPTY_INPUT, throttle: -1 })
    expect(simulation.telemetry.speed).toBeLessThan(-0.8)
    expect(simulation.position.z).toBeLessThan(-2)
    expect(simulation.telemetry.gear).toBe('R')
    expect(simulation.wheelRotation[0]).toBeLessThan(forwardRotation)
  })

  test('releasing the brake never reapplies residual motor torque', () => {
    const slope = createTerrain(220, 32, (_x, z) => z * 0.04)
    const simulation = createSimulation(slope)
    advance(simulation, 150, { ...EMPTY_INPUT, throttle: 1 })
    advance(simulation, 90, { ...EMPTY_INPUT, brake: true })
    advance(simulation, 90)
    expect(simulation.vehicle.wheelEngineForce(0)).toBe(0)
    expect(Math.abs(simulation.telemetry.speed)).toBeLessThan(0.1)
  })

  test('steers progressively and follows a curved trajectory', () => {
    const simulation = createSimulation()
    advance(simulation, 180, { ...EMPTY_INPUT, throttle: 1, steer: 0.65 })
    expect(Math.abs(simulation.position.x)).toBeGreaterThan(1)
    expect(Math.abs(simulation.telemetry.heading)).toBeGreaterThan(0.2)
    expect(simulation.wheelSteering[1]).toBeGreaterThan(simulation.wheelSteering[0])
    expect(simulation.wheelSteering[2]).toBe(0)
    expect(simulation.isOverturned()).toBe(false)
  })

  test('boost increases speed and consumes a rechargeable reserve', () => {
    const normal = createSimulation()
    const boosted = createSimulation()
    advance(normal, 240, { ...EMPTY_INPUT, throttle: 1 })
    advance(boosted, 240, { ...EMPTY_INPUT, throttle: 1, boost: true })
    expect(boosted.telemetry.speed).toBeGreaterThan(normal.telemetry.speed + 0.5)
    expect(boosted.telemetry.boost).toBeLessThan(0.7)
    const reserve = boosted.telemetry.boost
    advance(boosted, 120, { ...EMPTY_INPUT, brake: true })
    expect(boosted.telemetry.boost).toBeGreaterThan(reserve)
  })

  test('suspension responds independently to an uneven surface', () => {
    const uneven = createTerrain(
      80,
      160,
      (x, z) => Math.sin(x * 1.7 + 0.4) * Math.cos(z * 1.2) * 0.13,
    )
    const simulation = createSimulation(uneven)
    const lengths = simulation.wheelSuspension
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(0.005)
    expect(simulation.telemetry.contact).toBeGreaterThanOrEqual(3)
    expect(simulation.isOverturned()).toBe(false)
  })

  test('power-off brakes the vehicle and rejects acceleration', () => {
    const simulation = createSimulation()
    simulation.powered = false
    advance(simulation, 180, { ...EMPTY_INPUT, throttle: 1, boost: true })
    expect(Math.abs(simulation.telemetry.speed)).toBeLessThan(0.1)
    expect(simulation.telemetry.boosting).toBe(false)
  })

  test('solid obstacles stop the chassis instead of allowing tunneling', () => {
    const simulation = createSimulation()
    simulation.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1, 0.5).setTranslation(0, 1, 6))
    advance(simulation, 240, { ...EMPTY_INPUT, throttle: 1 })
    expect(simulation.position.z).toBeLessThan(5.5)
    expect(Number.isFinite(simulation.position.y)).toBe(true)
  })

  test('camera rays avoid solid obstacles and ignore the chassis', () => {
    const simulation = createSimulation()
    simulation.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1, 0.5).setTranslation(0, 1, 6))
    simulation.step()
    expect(simulation.cameraDistance(new Vector3(0, 1, 0), new Vector3(0, 0, 1), 12)).toBeLessThan(
      5.5,
    )
    expect(simulation.cameraDistance(new Vector3(0, 1, 0), new Vector3(0, 0, -1), 12)).toBe(12)
  })

  test('gravity and damped suspension absorb a landing and recover', () => {
    const simulation = createSimulation()
    const restingLength = simulation.wheelSuspension[0]
    simulation.chassis.setTranslation({ x: 0, y: 3.8, z: 0 }, true)
    let shortestSpring = 1
    for (let frame = 0; frame < 300; frame++) {
      simulation.step()
      if (simulation.telemetry.contact > 0)
        shortestSpring = Math.min(shortestSpring, ...simulation.wheelSuspension)
    }
    expect(shortestSpring).toBeLessThan(restingLength - 0.02)
    expect(simulation.telemetry.contact).toBe(4)
    expect(simulation.position.y).toBeGreaterThan(0.5)
    expect(simulation.position.y).toBeLessThan(1)
    expect(simulation.isOverturned()).toBe(false)
  })
})
