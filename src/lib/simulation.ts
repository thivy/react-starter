import RAPIER from '@dimforge/rapier3d-compat'
import { Quaternion, Vector3 } from 'three'
import type { TerrainData, WorldObject } from './world'
import { groundHeight, SPAWN, terrain, worldObjects } from './world'

export const FIXED_STEP = 1 / 60
export const WHEEL_RADIUS = 0.49
export const WHEEL_CONNECTIONS = [
  { x: -1.01, y: 0.1, z: 0.87 },
  { x: 1.01, y: 0.1, z: 0.87 },
  { x: -1.01, y: 0.1, z: -0.87 },
  { x: 1.01, y: 0.1, z: -0.87 },
]

export type DriveInput = { throttle: number; steer: number; brake: boolean; boost: boolean }
export type Telemetry = {
  speed: number
  heading: number
  boost: number
  boosting: boolean
  distance: number
  x: number
  z: number
  contact: number
  gear: 'P' | 'D' | 'R'
}
export const EMPTY_INPUT: DriveInput = { throttle: 0, steer: 0, brake: false, boost: false }
export const EMPTY_TELEMETRY: Telemetry = {
  speed: 0,
  heading: SPAWN.heading,
  boost: 1,
  boosting: false,
  distance: 0,
  x: 0,
  z: 0,
  contact: 4,
  gear: 'P',
}

let initialization: Promise<void> | undefined
export function initializePhysics() {
  initialization ??= RAPIER.init()
  return initialization
}

export class RobotSimulation {
  readonly world: RAPIER.World
  readonly chassis: RAPIER.RigidBody
  readonly vehicle: RAPIER.DynamicRayCastVehicleController
  readonly ground: RAPIER.Collider
  readonly position = new Vector3()
  readonly rotation = new Quaternion()
  readonly wheelRotation = [0, 0, 0, 0]
  readonly wheelSuspension = [0.4, 0.4, 0.4, 0.4]
  readonly wheelSteering = [0, 0, 0, 0]
  readonly telemetry: Telemetry = { ...EMPTY_TELEMETRY }
  powered = true
  steering = 0
  throttle = 0
  private boostCooling = false
  private readonly forward = new Vector3()
  private readonly up = new Vector3()
  private readonly localHeight: TerrainData['heightAt']

  constructor(options: { terrain?: TerrainData; objects?: WorldObject[]; heading?: number } = {}) {
    const surface = options.terrain ?? terrain
    this.localHeight = surface.heightAt
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = FIXED_STEP
    this.world.numSolverIterations = 8
    this.ground = this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(surface.vertices, surface.indices)
        .setFriction(0.85)
        .setRestitution(0.02),
    )
    const mass = 38
    const width = 1.74
    const height = 1.05
    const length = 2.55
    this.chassis = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, this.localHeight(0, 0) + 0.9, 0)
        .setAdditionalMassProperties(
          mass,
          { x: 0, y: -0.19, z: -0.04 },
          {
            x: (mass * (height * height + length * length)) / 12,
            y: (mass * (width * width + length * length)) / 12,
            z: (mass * (width * width + height * height)) / 12,
          },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setLinearDamping(0.045)
        .setAngularDamping(0.65)
        .setCcdEnabled(true)
        .setCanSleep(false),
    )
    this.world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(0.66, 0.37, 1.05, 0.17)
        .setTranslation(0, 0.26, 0)
        .setDensity(0)
        .setFriction(0.45)
        .setRestitution(0.1),
      this.chassis,
    )
    this.vehicle = this.world.createVehicleController(this.chassis)
    this.vehicle.indexUpAxis = 1
    this.vehicle.setIndexForwardAxis = 2
    WHEEL_CONNECTIONS.forEach((connection, index) => {
      this.vehicle.addWheel(
        connection,
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        0.4,
        WHEEL_RADIUS,
      )
      this.vehicle.setWheelSuspensionStiffness(index, 34)
      this.vehicle.setWheelSuspensionCompression(index, 4.4)
      this.vehicle.setWheelSuspensionRelaxation(index, 5.2)
      this.vehicle.setWheelMaxSuspensionTravel(index, 0.24)
      this.vehicle.setWheelMaxSuspensionForce(index, 1900)
      this.vehicle.setWheelFrictionSlip(index, 2.2)
      this.vehicle.setWheelSideFrictionStiffness(index, 1.25)
    })
    for (const object of options.objects ?? worldObjects) this.addObstacle(object)
    this.reset(options.heading ?? SPAWN.heading)
    this.world.step()
  }

  private addObstacle(object: WorldObject) {
    const height = groundHeight(object.x, object.z)
    let collider: RAPIER.ColliderDesc
    if (object.kind === 'tree') {
      collider = RAPIER.ColliderDesc.cylinder(
        1.6 * object.scale,
        0.26 * object.scale,
      ).setTranslation(object.x, height + 1.6 * object.scale, object.z)
    } else if (object.kind === 'mushroom') {
      collider = RAPIER.ColliderDesc.cylinder(
        0.48 * object.scale,
        0.19 * object.scale,
      ).setTranslation(object.x, height + 0.48 * object.scale, object.z)
    } else {
      collider = RAPIER.ColliderDesc.roundCuboid(
        0.6 * object.scale,
        0.38 * object.scale,
        0.5 * object.scale,
        0.18 * object.scale,
      )
        .setTranslation(object.x, height + 0.38 * object.scale, object.z)
        .setRotation({
          x: 0,
          y: Math.sin(object.rotation / 2),
          z: 0,
          w: Math.cos(object.rotation / 2),
        })
    }
    this.world.createCollider(collider.setFriction(0.8).setRestitution(0.08))
  }

  reset(heading = SPAWN.heading, x = SPAWN.x, z = SPAWN.z) {
    this.chassis.setTranslation({ x, y: this.localHeight(x, z) + 1.1, z }, true)
    this.chassis.setRotation(
      { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
      true,
    )
    this.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.chassis.resetForces(true)
    this.chassis.resetTorques(true)
    this.throttle = 0
    this.steering = 0
    this.syncPose()
  }

  setPowered(powered: boolean) {
    this.powered = powered
  }

  step(input: DriveInput = EMPTY_INPUT) {
    this.syncPose()
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation)
    const velocity = this.chassis.linvel()
    const speed =
      this.forward.x * velocity.x + this.forward.y * velocity.y + this.forward.z * velocity.z
    const throttleTarget = this.powered && !input.brake ? input.throttle : 0
    this.throttle =
      input.brake || !this.powered
        ? 0
        : this.throttle + (throttleTarget - this.throttle) * (1 - Math.exp(-FIXED_STEP * 4.2))
    if (Math.abs(this.throttle) < 0.001) this.throttle = 0
    const steeringTarget = (input.steer * 0.53) / (1 + Math.abs(speed) * 0.15)
    this.steering += (steeringTarget - this.steering) * (1 - Math.exp(-FIXED_STEP * 5))
    if (this.telemetry.boost < 0.015) this.boostCooling = true
    if (this.telemetry.boost > 0.23) this.boostCooling = false
    const boosting =
      this.powered && input.boost && input.throttle > 0 && !input.brake && !this.boostCooling
    this.telemetry.boost = Math.max(
      0,
      Math.min(1, this.telemetry.boost + FIXED_STEP * (boosting ? -0.12 : 0.055)),
    )
    this.telemetry.boosting = boosting
    const maxSpeed = this.throttle < 0 ? 2.6 : boosting ? 7 : 4.4
    const forceLimit = Math.max(0, 1 - Math.pow(Math.abs(speed) / maxSpeed, 2))
    const changingDirection = input.throttle !== 0 && speed * input.throttle < -0.25
    const parking = Math.abs(speed) < 0.16 && input.throttle === 0
    const brake =
      input.brake || !this.powered ? 0.9 : changingDirection ? 0.6 : parking ? 0.28 : 0.028
    for (let index = 0; index < 4; index++) {
      const force =
        changingDirection || input.brake || !this.powered
          ? 0
          : this.throttle * (boosting ? 48 : 31) * forceLimit
      this.vehicle.setWheelEngineForce(index, force)
      this.vehicle.setWheelBrake(index, brake)
      const ackermann =
        index < 2 && Math.abs(this.steering) > 0.001
          ? Math.atan(1.74 / (1.74 / Math.tan(this.steering) + (index === 0 ? 1.01 : -1.01)))
          : 0
      this.vehicle.setWheelSteering(index, index < 2 ? ackermann : 0)
      this.wheelSteering[index] = index < 2 ? ackermann : 0
    }
    this.vehicle.updateVehicle(
      FIXED_STEP,
      undefined,
      undefined,
      (collider) => collider.parent()?.handle !== this.chassis.handle,
    )
    this.world.step()
    this.syncPose()
    let contact = 0
    for (let index = 0; index < 4; index++) {
      this.wheelRotation[index] = this.vehicle.wheelRotation(index) ?? 0
      this.wheelSuspension[index] = this.vehicle.wheelSuspensionLength(index) ?? 0.4
      if (this.vehicle.wheelIsInContact(index)) contact++
    }
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation)
    const nextVelocity = this.chassis.linvel()
    const forwardSpeed = this.forward.dot(
      new Vector3(nextVelocity.x, nextVelocity.y, nextVelocity.z),
    )
    this.telemetry.speed = forwardSpeed
    this.telemetry.heading = Math.atan2(this.forward.x, this.forward.z)
    this.telemetry.distance += Math.abs(forwardSpeed) * FIXED_STEP
    this.telemetry.x = this.position.x
    this.telemetry.z = this.position.z
    this.telemetry.contact = contact
    this.telemetry.gear = Math.abs(forwardSpeed) < 0.12 ? 'P' : forwardSpeed < 0 ? 'R' : 'D'
    if (this.position.y < -25) this.reset()
  }

  cameraDistance(origin: Vector3, direction: Vector3, distance: number) {
    const ray = new RAPIER.Ray(origin, direction)
    const hit = this.world.castRay(
      ray,
      distance,
      true,
      undefined,
      undefined,
      undefined,
      this.chassis,
    )
    return hit ? Math.max(0.8, hit.timeOfImpact - 0.45) : distance
  }

  isOverturned() {
    return this.up.set(0, 1, 0).applyQuaternion(this.rotation).y < 0.2
  }

  private syncPose() {
    const position = this.chassis.translation()
    const rotation = this.chassis.rotation()
    this.position.set(position.x, position.y, position.z)
    this.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  dispose() {
    this.world.removeVehicleController(this.vehicle)
    this.world.free()
  }
}
