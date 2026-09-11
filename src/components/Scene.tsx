import { Environment, Lightformer, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { RefObject } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { DirectionalLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Points } from "three";
import { AdditiveBlending, Color, Object3D, Vector3 } from "three";
import type { DriveInput, Telemetry } from "../lib/simulation";
import { FIXED_STEP, initializePhysics, RobotSimulation } from "../lib/simulation";
import { groundHeight, landmarks, SPAWN } from "../lib/world";
import Robot from "./Robot";
import World from "./World";

export type SceneApi = { reset: () => void; focus: () => void; capture: () => void };
export type SceneProps = {
  apiRef: RefObject<SceneApi | null>;
  touchInput: RefObject<DriveInput>;
  clearInput: () => void;
  onReady: () => void;
  onError: (message: string) => void;
  onTelemetry: (telemetry: Telemetry) => void;
  onDiscover: (id: string) => void;
  onZoom: (zoom: number) => void;
  discovered: string[];
  powered: boolean;
  lights: boolean;
  hatchOpen: boolean;
  onPower: () => void;
  onScan: () => void;
  onHatch: () => void;
  scan: number;
  paused: boolean;
  evening: boolean;
  cameraMode: "follow" | "orbit";
  quality: "balanced" | "high";
  zoom: number;
};

function DrivingDust({ simulation }: { simulation: RobotSimulation | null }) {
  const points = useRef<Points>(null);
  const [buffers] = useState(() => ({
    positions: new Float32Array(96 * 3).fill(-100),
    lives: new Float32Array(96),
  }));
  const particleState = useRef({ ages: new Float32Array(96).fill(3), cursor: 0 });
  const [uniforms] = useState(() => ({ dustColor: { value: new Color("#dfd3af") } }));
  useFrame((_, delta) => {
    if (!simulation || !points.current) return;
    const particles = particleState.current;
    const positions = points.current.geometry.attributes.position.array;
    const lives = points.current.geometry.attributes.life.array;
    const speed = Math.abs(simulation.telemetry.speed);
    if (speed > 0.75 && simulation.telemetry.contact > 0) {
      const index = particles.cursor++ % 96;
      const wheel = index % 2 ? 0.9 : -0.9;
      const position = new Vector3(wheel, -0.3, -0.85)
        .applyQuaternion(simulation.rotation)
        .add(simulation.position);
      positions.set([position.x, position.y, position.z], index * 3);
      particles.ages[index] = 0;
    }
    for (let index = 0; index < 96; index++) {
      particles.ages[index] += delta;
      lives[index] = Math.max(0, 1 - particles.ages[index] / 1.5);
      positions[index * 3] += delta * 0.12;
      positions[index * 3 + 1] += delta * 0.14;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.geometry.attributes.life.needsUpdate = true;
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-life" args={[buffers.lives, 1]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader="attribute float life; varying float vLife; void main() { vLife = life; vec4 viewPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewPosition; gl_PointSize = (24.0 + 28.0 * (1.0 - life)) / max(1.0, -viewPosition.z); }"
        fragmentShader="uniform vec3 dustColor; varying float vLife; void main() { float radius = length(gl_PointCoord - vec2(0.5)); float alpha = (1.0 - smoothstep(0.1, 0.5, radius)) * vLife * 0.23; gl_FragColor = vec4(dustColor, alpha); }"
      />
    </points>
  );
}

function GroundingShadow({ simulation }: { simulation: RobotSimulation | null }) {
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    if (!simulation || !mesh.current) return;
    mesh.current.position.set(
      simulation.position.x,
      groundHeight(simulation.position.x, simulation.position.z) + 0.024,
      simulation.position.z,
    );
    mesh.current.rotation.z = simulation.telemetry.heading;
    mesh.current.visible =
      simulation.position.y - groundHeight(simulation.position.x, simulation.position.z) < 1.5;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.8, 4.4]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader="varying vec2 vUv; void main() { vec2 distanceFromCenter = vUv - 0.5; float alpha = exp(-dot(distanceFromCenter, distanceFromCenter) * 19.0) * 0.33; gl_FragColor = vec4(0.12, 0.17, 0.10, alpha); }"
      />
    </mesh>
  );
}

function ScanPulse({ scan, simulation }: { scan: number; simulation: RobotSimulation | null }) {
  const mesh = useRef<Mesh>(null);
  const started = useRef(-100);
  const { clock } = useThree();
  useEffect(() => {
    if (scan > 0) started.current = clock.elapsedTime;
  }, [scan, clock]);
  useFrame(() => {
    if (!mesh.current || !simulation) return;
    const progress = (clock.elapsedTime - started.current) / 2.4;
    mesh.current.visible = progress >= 0 && progress < 1;
    if (!mesh.current.visible) return;
    const radius = 0.8 + progress * 17;
    mesh.current.position.set(
      simulation.position.x,
      groundHeight(simulation.position.x, simulation.position.z) + 0.055,
      simulation.position.z,
    );
    mesh.current.scale.set(radius, radius, radius);
    (mesh.current.material as MeshBasicMaterial).opacity = (1 - progress) * 0.55;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.985, 1, 100]} />
      <meshBasicMaterial
        color="#a1ffe0"
        transparent
        opacity={0}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

export default function Scene(props: SceneProps) {
  const {
    apiRef,
    touchInput,
    clearInput,
    onTelemetry,
    onDiscover,
    discovered,
    powered,
    lights,
    hatchOpen,
    onPower,
    onScan,
    onHatch,
    scan,
    paused,
    evening,
    cameraMode,
    quality,
    zoom,
  } = props;
  const { gl, size } = useThree();
  const [simulation, setSimulation] = useState<RobotSimulation | null>(null);
  const keys = useRef(new Set<string>());
  const accumulator = useRef(0);
  const lastReport = useRef(0);
  const seen = useRef(new Set(discovered));
  const sun = useRef<DirectionalLight>(null);
  const [sunTarget] = useState(() => new Object3D());
  const cameraStateRef = useRef({
    yaw: SPAWN.heading + 0.73,
    pitch: 0.19,
    distance: zoom,
    target: new Vector3(0, 1.35, 0),
    desired: new Vector3(),
    direction: new Vector3(),
    look: new Vector3(),
    lastDrag: -10,
    initialized: false,
  });
  const notifyReady = useEffectEvent(props.onReady);
  const notifyError = useEffectEvent(props.onError);
  const notifyZoom = useEffectEvent(props.onZoom);
  const notifyDiscovery = useEffectEvent(onDiscover);

  useEffect(() => {
    let cancelled = false;
    let current: RobotSimulation | undefined;
    initializePhysics()
      .then(() => {
        if (cancelled) return;
        current = new RobotSimulation();
        for (let frame = 0; frame < 90; frame++) current.step();
        setSimulation(current);
        notifyReady();
      })
      .catch((error: unknown) =>
        notifyError(error instanceof Error ? error.message : "The physics engine could not start."),
      );
    return () => {
      cancelled = true;
      current?.dispose();
    };
  }, []);

  useEffect(() => {
    simulation?.setPowered(powered);
  }, [simulation, powered]);
  useEffect(() => {
    cameraStateRef.current.distance = zoom;
  }, [zoom]);
  useEffect(() => {
    if (!simulation || scan === 0) return;
    for (const landmark of landmarks) {
      if (
        !seen.current.has(landmark.id) &&
        Math.hypot(simulation.position.x - landmark.x, simulation.position.z - landmark.z) < 19
      ) {
        seen.current.add(landmark.id);
        notifyDiscovery(landmark.id);
      }
    }
  }, [scan, simulation]);

  useEffect(() => {
    if (!simulation) return;
    const cameraState = cameraStateRef.current;
    apiRef.current = {
      reset() {
        simulation.reset();
        keys.current.clear();
        clearInput();
        cameraState.initialized = false;
        cameraState.yaw = SPAWN.heading + 0.73;
        cameraState.pitch = 0.19;
      },
      focus() {
        cameraState.yaw = simulation.telemetry.heading + 0.73;
        cameraState.pitch = 0.19;
        cameraState.lastDrag = performance.now() / 1000;
      },
      capture() {
        const link = document.createElement("a");
        link.download = "milo-sunpetal-meadow.png";
        link.href = gl.domElement.toDataURL("image/png");
        link.click();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [simulation, apiRef, clearInput, gl]);

  useEffect(() => {
    const driveKeys = new Set([
      "KeyW",
      "KeyS",
      "KeyA",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "ShiftLeft",
      "ShiftRight",
    ]);
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
        target.isContentEditable ||
        (target.tagName === "BUTTON" && event.code === "Space")
      )
        return;
      if (driveKeys.has(event.code)) {
        event.preventDefault();
        keys.current.add(event.code);
      }
      if (event.code === "KeyR" && !event.repeat) apiRef.current?.reset();
    };
    const keyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };
    const clear = () => {
      keys.current.clear();
      clearInput();
      accumulator.current = 0;
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [apiRef, clearInput]);

  useEffect(() => {
    if (paused) {
      keys.current.clear();
      clearInput();
      accumulator.current = 0;
    }
  }, [paused, clearInput]);

  useEffect(() => {
    const canvas = gl.domElement;
    const cameraState = cameraStateRef.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const pointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      if (pointers.size === 1) {
        cameraState.yaw -= (event.clientX - previous.x) * 0.006;
        cameraState.pitch = Math.max(
          0.12,
          Math.min(1.25, cameraState.pitch + (event.clientY - previous.y) * 0.004),
        );
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (pinch > 0)
          notifyZoom(Math.max(5, Math.min(17, (cameraState.distance * pinch) / distance)));
        pinch = distance;
      }
      cameraState.lastDrag = performance.now() / 1000;
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinch = 0;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      notifyZoom(Math.max(5, Math.min(17, cameraState.distance * Math.exp(event.deltaY * 0.001))));
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  useFrame(({ clock, camera }, delta) => {
    if (!simulation) return;
    const cameraState = cameraStateRef.current;
    const step = Math.min(delta, 0.075);
    if (!paused && !document.hidden) {
      const pressed = keys.current;
      const forward = pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0;
      const backward = pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0;
      const left = pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0;
      const right = pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0;
      const input: DriveInput = {
        throttle: Math.max(-1, Math.min(1, forward - backward + touchInput.current.throttle)),
        steer: Math.max(-1, Math.min(1, left - right + touchInput.current.steer)),
        brake: pressed.has("Space") || touchInput.current.brake,
        boost: pressed.has("ShiftLeft") || pressed.has("ShiftRight") || touchInput.current.boost,
      };
      accumulator.current += step;
      while (accumulator.current >= FIXED_STEP) {
        simulation.step(input);
        accumulator.current -= FIXED_STEP;
      }
    }
    if (clock.elapsedTime - lastReport.current > 0.1) {
      onTelemetry({ ...simulation.telemetry });
      lastReport.current = clock.elapsedTime;
      for (const landmark of landmarks) {
        if (
          !seen.current.has(landmark.id) &&
          Math.hypot(simulation.position.x - landmark.x, simulation.position.z - landmark.z) < 5.5
        ) {
          seen.current.add(landmark.id);
          onDiscover(landmark.id);
        }
      }
    }
    if (
      cameraMode === "follow" &&
      Math.abs(simulation.telemetry.speed) > 0.6 &&
      performance.now() / 1000 - cameraState.lastDrag > 1.8
    ) {
      const behind = simulation.telemetry.heading + Math.PI;
      const difference = Math.atan2(
        Math.sin(behind - cameraState.yaw),
        Math.cos(behind - cameraState.yaw),
      );
      cameraState.yaw += difference * (1 - Math.exp(-step * 0.65));
    }
    cameraState.look
      .copy(simulation.position)
      .add(new Vector3(0, size.width < 650 ? 0.05 : 0.57, 0));
    cameraState.target.lerp(cameraState.look, 1 - Math.exp(-step * 6));
    cameraState.direction.set(
      Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
      Math.sin(cameraState.pitch),
      Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch),
    );
    const framingScale = Math.max(1, (0.73 * size.height) / size.width);
    const distance = simulation.cameraDistance(
      cameraState.target,
      cameraState.direction,
      cameraState.distance * framingScale,
    );
    cameraState.desired.copy(cameraState.target).addScaledVector(cameraState.direction, distance);
    cameraState.desired.y = Math.max(
      cameraState.desired.y,
      groundHeight(cameraState.desired.x, cameraState.desired.z) + 0.6,
    );
    if (!cameraState.initialized) {
      cameraState.target.copy(cameraState.look);
      camera.position.copy(cameraState.desired);
      cameraState.initialized = true;
    }
    camera.position.lerp(
      cameraState.desired,
      1 - Math.exp(-step * (distance < cameraState.distance - 0.3 ? 16 : 4)),
    );
    camera.position.y = Math.max(
      camera.position.y,
      groundHeight(camera.position.x, camera.position.z) + 0.45,
    );
    camera.lookAt(cameraState.target);
    const perspective = camera as PerspectiveCamera;
    perspective.fov +=
      ((simulation.telemetry.boosting ? 45 : 42) - perspective.fov) * (1 - Math.exp(-step * 2));
    perspective.updateProjectionMatrix();
    if (sun.current) {
      sun.current.position.set(
        simulation.position.x - 16,
        simulation.position.y + (evening ? 13 : 24),
        simulation.position.z + 12,
      );
      sunTarget.position.copy(simulation.position);
      sunTarget.updateMatrixWorld();
    }
  });

  return (
    <>
      <color attach="background" args={[evening ? "#ead9bb" : "#dce7cc"]} />
      <fog attach="fog" args={[evening ? "#e6cfb5" : "#d6e4c5", 42, 155]} />
      <Sky
        sunPosition={evening ? [-100, 19, 70] : [-90, 65, 90]}
        turbidity={evening ? 9 : 6}
        rayleigh={0.55}
        mieCoefficient={0.012}
        mieDirectionalG={0.85}
      />
      <ambientLight intensity={evening ? 0.18 : 0.22} color={evening ? "#e2c8af" : "#f1f4dc"} />
      <hemisphereLight args={[evening ? "#ead5be" : "#e2f0e2", "#7d8f63", evening ? 0.65 : 0.8]} />
      <directionalLight
        ref={sun}
        target={sunTarget}
        position={[-16, 24, 12]}
        color={evening ? "#ffcf95" : "#fff1db"}
        intensity={evening ? 1.9 : 2.15}
        castShadow
        shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={75}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />
      <primitive object={sunTarget} />
      <Environment resolution={64} frames={1}>
        <color attach="background" args={["#cbd7c0"]} />
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffffff"
          position={[0, 5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[8, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#fff6df"
          position={[4, 2, 5]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[4, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#d8eae8"
          position={[-4, 2, -3]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[5, 5, 1]}
        />
      </Environment>
      <World evening={evening} />
      <GroundingShadow simulation={simulation} />
      <Robot
        simulation={simulation}
        powered={powered}
        lights={lights}
        hatchOpen={hatchOpen}
        onPower={onPower}
        onScan={onScan}
        onHatch={onHatch}
      />
      <DrivingDust simulation={simulation} />
      <ScanPulse simulation={simulation} scan={scan} />
    </>
  );
}
