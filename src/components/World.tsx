import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState } from "react";
import type { Group, InstancedMesh, Points } from "three";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { groundHeight, pathDistance, seededRandom, terrain, worldObjects } from "../lib/world";

type Instance = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color: string;
};

function Instances({
  geometry,
  instances,
  roughness = 0.9,
  wind = false,
  shadow = false,
}: {
  geometry: BufferGeometry;
  instances: Instance[];
  roughness?: number;
  wind?: boolean;
  shadow?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const [material] = useState(() => {
    const material = new MeshStandardMaterial({
      roughness,
      side: DoubleSide,
      envMapIntensity: 0.24,
    });
    if (wind) {
      const time = { value: 0 };
      material.userData.time = time;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.windTime = time;
        shader.vertexShader = `uniform float windTime;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nfloat phase = windTime * 1.6 + instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.4;\ntransformed.x += sin(phase) * pow(max(position.y, 0.0), 1.5) * 0.12;\ntransformed.z += cos(phase * 0.8) * max(position.y, 0.0) * 0.05;",
        );
      };
      material.customProgramCacheKey = () => "meadow-wind";
    }
    return material;
  });
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new Object3D();
    const color = new Color();
    instances.forEach((instance, index) => {
      dummy.position.set(...instance.position);
      dummy.scale.set(...instance.scale);
      dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
      mesh.current!.setColorAt(index, color.set(instance.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [instances]);
  useFrame(({ clock }) => {
    if (wind && mesh.current)
      (mesh.current.material as MeshStandardMaterial).userData.time.value = clock.elapsedTime;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, instances.length]}
      castShadow={shadow}
      receiveShadow
      frustumCulled
    />
  );
}

function buildGround() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(terrain.vertices, 3));
  geometry.setIndex(new BufferAttribute(terrain.indices, 1));
  const colors = new Float32Array(terrain.vertices.length);
  const grass = new Color("#7fa653");
  const meadow = new Color("#a2be65");
  const dirt = new Color("#c0b17e");
  const trail = new Color("#cbbd92");
  const color = new Color();
  for (let index = 0; index < terrain.vertices.length; index += 3) {
    const x = terrain.vertices[index];
    const z = terrain.vertices[index + 2];
    const variation = (Math.sin(x * 0.39 + Math.cos(z * 0.23) * 1.3) * Math.sin(z * 0.3) + 1) / 2;
    const distance = pathDistance(x, z);
    color.copy(grass).lerp(meadow, variation * 0.65);
    const edge = 2.6 + Math.sin(z * 1.5 + x * 0.7) * 0.12;
    if (distance < edge + 1.2) {
      color.lerp(dirt, Math.max(0, Math.min(1, (edge + 1.2 - distance) / 1.2)));
      if (distance < edge - 0.8) color.lerp(trail, 0.22 + variation * 0.36);
    }
    color.toArray(colors, index);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function grassBlade() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([
        -0.042, 0, 0, 0.042, 0, 0, -0.027, 0.45, 0.01, 0.027, 0.45, 0.01, -0.012, 0.77, 0.08, 0.011,
        0.77, 0.08, 0, 1, 0.16,
      ]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  geometry.computeVertexNormals();
  return mergeGeometries([
    geometry,
    geometry.clone().rotateY(2.1).scale(0.8, 0.72, 0.8),
    geometry.clone().rotateY(4.2).scale(0.9, 0.86, 0.9),
  ]);
}

function createVegetation() {
  const random = seededRandom(82);
  const blades: Instance[] = [];
  const stems: Instance[] = [];
  const petals: Instance[] = [];
  const centers: Instance[] = [];
  const leaves: Instance[] = [];
  const greens = ["#668d41", "#7caa4b", "#8fb85e", "#a3bc5b", "#689757", "#b4ca70"];
  const blooms = ["#fff3d6", "#fff8e9", "#f6c449", "#edb84d", "#dfa3bf", "#b6b6dd", "#f6ecbc"];
  for (let index = 0; index < 37000; index++) {
    const range = index < 18000 ? 130 : 65;
    const x = (random() - 0.5) * range;
    const z = (random() - 0.53) * (range + 10);
    const distance = pathDistance(x, z);
    if (distance < 2.8 + random() * 0.5) continue;
    const height = 0.18 + random() * 0.46;
    blades.push({
      position: [x, groundHeight(x, z) - 0.02, z],
      scale: [0.7 + random(), height, 0.7 + random()],
      rotation: [0, random() * 6.28, 0],
      color: greens[Math.floor(random() * greens.length)],
    });
  }
  for (let index = 0; index < 3100; index++) {
    const near = index > 2600;
    const x = (random() - 0.5) * (near ? 22 : 84);
    const z = (random() - 0.56) * (near ? 35 : 92);
    const distance = pathDistance(x, z);
    if (distance < 3.4 || (distance > 15 && random() > 0.2)) continue;
    const height = 0.24 + random() * 0.46;
    const ground = groundHeight(x, z);
    const color = blooms[Math.floor(random() * blooms.length)];
    const flowerSize = (near ? 1 : 0.65) + random() * 0.75;
    stems.push({
      position: [x, ground + height / 2, z],
      scale: [0.014, height, 0.014],
      color: "#64823b",
    });
    centers.push({
      position: [x, ground + height + 0.019, z],
      scale: [0.046 * flowerSize, 0.027 * flowerSize, 0.046 * flowerSize],
      color: "#e4ae34",
    });
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2 + random() * 0.2;
      petals.push({
        position: [
          x + Math.sin(angle) * 0.08 * flowerSize,
          ground + height,
          z + Math.cos(angle) * 0.08 * flowerSize,
        ],
        scale: [0.053 * flowerSize, 0.024 * flowerSize, 0.095 * flowerSize],
        rotation: [0.1, angle, 0.1],
        color,
      });
    }
    leaves.push({
      position: [x + 0.046, ground + height * 0.55, z],
      scale: [0.07, 0.014, 0.023],
      rotation: [0, random() * 6.28, 0.35],
      color: "#76a24c",
    });
  }
  return { blades, stems, petals, centers, leaves };
}

function createScenery() {
  const random = seededRandom(761);
  const trunks: Instance[] = [];
  const canopies: Instance[] = [];
  const rocks: Instance[] = [];
  const moss: Instance[] = [];
  const mushroomStems: Instance[] = [];
  const caps: Instance[] = [];
  const spots: Instance[] = [];
  const pebbles: Instance[] = [];
  const canopyColors = [
    ["#729e68", "#83af6d", "#9aba77", "#a6c583"],
    ["#518f79", "#699b7e", "#82ac88", "#9bbf96"],
    ["#d59b99", "#dbaa9e", "#e4b7a6", "#c99594"],
  ];
  for (const object of worldObjects) {
    const { x, z, scale, rotation, variant } = object;
    const y = groundHeight(x, z);
    if (object.kind === "tree") {
      trunks.push({
        position: [x, y + 1.85 * scale, z],
        scale: [0.4 * scale, 3.7 * scale, 0.4 * scale],
        rotation: [0.03, rotation, 0.035],
        color: "#837a55",
      });
      for (let branch = 0; branch < 3; branch++) {
        const angle = (branch / 3) * Math.PI * 2 + rotation;
        trunks.push({
          position: [
            x + Math.cos(angle) * 0.55 * scale,
            y + 2.7 * scale,
            z + Math.sin(angle) * 0.55 * scale,
          ],
          scale: [0.17 * scale, 1.9 * scale, 0.17 * scale],
          rotation: [Math.cos(angle) * 0.6, 0, Math.sin(angle) * 0.6],
          color: "#8b805a",
        });
      }
      for (let cluster = 0; cluster < 9; cluster++) {
        const angle = (cluster / 7) * Math.PI * 2 + rotation;
        const radius = cluster > 6 ? 0.25 : 1.3;
        const height = cluster > 6 ? 4.8 : 3.7 + random() * 0.6;
        canopies.push({
          position: [
            x + Math.cos(angle) * radius * scale,
            y + height * scale,
            z + Math.sin(angle) * radius * scale,
          ],
          scale: [
            (1.23 + random() * 0.4) * scale,
            (1.05 + random() * 0.55) * scale,
            (1.1 + random() * 0.4) * scale,
          ],
          rotation: [random(), rotation, random()],
          color: canopyColors[variant][cluster % 4],
        });
      }
    } else if (object.kind === "rock") {
      rocks.push({
        position: [x, y + 0.37 * scale, z],
        scale: [0.88 * scale, 0.64 * scale, 0.72 * scale],
        rotation: [0.12, rotation, 0.15],
        color: ["#989d8a", "#a9ac99", "#8f9b8f"][variant],
      });
      moss.push({
        position: [x - 0.09 * scale, y + 0.77 * scale, z + 0.01 * scale],
        scale: [0.56 * scale, 0.22 * scale, 0.47 * scale],
        rotation: [0, rotation, -0.1],
        color: "#899e56",
      });
    } else {
      mushroomStems.push({
        position: [x, y, z],
        scale: [scale, scale, scale],
        rotation: [0, rotation, 0],
        color: "#e8dfc2",
      });
      caps.push({
        position: [x, y + 0.94 * scale, z],
        scale: [scale, scale, scale],
        rotation: [0, rotation, 0],
        color: ["#db8772", "#e4ac7b", "#c88eaa"][variant],
      });
      for (let spot = 0; spot < 12; spot++) {
        const angle = spot * 2.39996 + rotation;
        const radial = 0.2 + Math.sqrt(spot / 12) * 0.66;
        const top = 0.12 + Math.sqrt(1 - radial * radial) * 0.71;
        const spotScale = (0.045 + random() * 0.05) * scale;
        spots.push({
          position: [
            x + Math.cos(angle) * radial * scale,
            y + (0.95 + top) * scale,
            z + Math.sin(angle) * radial * scale,
          ],
          scale: [spotScale, 0.022 * scale, spotScale * 0.8],
          rotation: [Math.sin(angle) * radial, 0, -Math.cos(angle) * radial],
          color: "#f6edcf",
        });
      }
    }
  }
  for (let index = 0; index < 430; index++) {
    const x = (random() - 0.5) * 120;
    const z = (random() - 0.5) * 130;
    if (pathDistance(x, z) > 5.5) continue;
    const size = 0.025 + random() * 0.085;
    pebbles.push({
      position: [x, groundHeight(x, z) + 0.012, z],
      scale: [size * 1.7, size * 0.6, size],
      rotation: [0, random() * 6, 0],
      color: "#b4ad8a",
    });
  }
  return { trunks, canopies, rocks, moss, mushroomStems, caps, spots, pebbles };
}

function Clouds() {
  const [instances] = useState(() => {
    const random = seededRandom(992);
    return Array.from({ length: 25 }, (_, index) => {
      const x = (random() - 0.5) * 250;
      const z = (random() - 0.5) * 250;
      const height = 26 + random() * 10;
      return Array.from(
        { length: 4 },
        (_, puff): Instance => ({
          position: [x + puff * 3.5, height + Math.sin(puff) * 0.9, z],
          scale: [4 + random() * 3, 1.4 + random(), 2.5 + random()],
          color: index % 2 === 0 ? "#f8f5df" : "#edf1dd",
        }),
      );
    }).flat();
  });
  const [geometry] = useState(() => new SphereGeometry(1, 16, 10));
  return <Instances geometry={geometry} instances={instances} />;
}

function Butterflies() {
  const groups = useRef<(Group | null)[]>([]);
  const wings = useRef<(Group | null)[]>([]);
  const [geometry] = useState(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.12, 0.3, 0.42, 0.23, 0.34, 0.03);
    shape.bezierCurveTo(0.52, -0.21, 0.14, -0.29, 0, 0);
    return new ShapeGeometry(shape, 8);
  });
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    groups.current.forEach((group, index) => {
      if (!group) return;
      const x = Math.sin(time * 0.23 + index * 2.1) * (9 + index * 1.2);
      const z = Math.cos(time * 0.18 + index * 1.7) * (8 + index * 1.6) - 8;
      group.position.set(x, groundHeight(x, z) + 1.1 + Math.sin(time * 1.3 + index) * 0.32, z);
      group.rotation.y = Math.atan2(
        Math.cos(time * 0.23 + index * 2.1),
        -Math.sin(time * 0.18 + index * 1.7),
      );
      if (wings.current[index * 2])
        wings.current[index * 2]!.rotation.y = Math.sin(time * 12 + index) * 0.9;
      if (wings.current[index * 2 + 1])
        wings.current[index * 2 + 1]!.rotation.y = -Math.sin(time * 12 + index) * 0.9;
    });
  });
  return Array.from({ length: 10 }, (_, index) => (
    <group
      key={index}
      ref={(group) => {
        groups.current[index] = group;
      }}
      scale={0.5}
    >
      {[-1, 1].map((side, wing) => (
        <group
          key={side}
          ref={(group) => {
            wings.current[index * 2 + wing] = group;
          }}
        >
          <mesh geometry={geometry} scale={[side, 1, 1]}>
            <meshStandardMaterial
              color={["#f8d27d", "#f6ebc7", "#d1a8c6"][index % 3]}
              side={DoubleSide}
              emissive="#f8dc9f"
              emissiveIntensity={0.15}
            />
          </mesh>
        </group>
      ))}
    </group>
  ));
}

function Pollen({ evening }: { evening: boolean }) {
  const points = useRef<Points>(null);
  const [data] = useState(() => {
    const random = seededRandom(930);
    const positions = new Float32Array(160 * 3);
    for (let index = 0; index < 160; index++) {
      const x = (random() - 0.5) * 70;
      const z = (random() - 0.5) * 70;
      positions.set([x, groundHeight(x, z) + 0.5 + random() * 4, z], index * 3);
    }
    return positions;
  });
  useFrame(({ clock }) => {
    if (points.current) points.current.rotation.y = Math.sin(clock.elapsedTime * 0.04) * 0.07;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={evening ? "#ffeb94" : "#ffffe3"}
        size={evening ? 0.09 : 0.045}
        transparent
        opacity={evening ? 0.95 : 0.6}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export default function World({ evening = false }: { evening?: boolean }) {
  const [ground] = useState(buildGround);
  const [vegetation] = useState(createVegetation);
  const [scenery] = useState(createScenery);
  const [geometries] = useState(() => ({
    grass: grassBlade(),
    stem: new CylinderGeometry(0.75, 1, 1, 5),
    petal: new SphereGeometry(1, 7, 5),
    trunk: new CylinderGeometry(0.52, 0.9, 1, 9),
    canopy: new IcosahedronGeometry(1, 2),
    rock: new IcosahedronGeometry(1, 1),
    mushroomStem: new LatheGeometry(
      [
        new Vector2(0.27, 0),
        new Vector2(0.22, 0.15),
        new Vector2(0.15, 0.73),
        new Vector2(0.2, 1.06),
        new Vector2(0.29, 1.13),
      ],
      16,
    ),
    cap: new LatheGeometry(
      [
        new Vector2(0, 0),
        new Vector2(0.7, 0.01),
        new Vector2(1, 0.075),
        new Vector2(1.015, 0.12),
        new Vector2(0.95, 0.31),
        new Vector2(0.72, 0.59),
        new Vector2(0.37, 0.78),
        new Vector2(0, 0.825),
      ],
      32,
    ),
  }));
  return (
    <>
      <mesh geometry={ground} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.98} envMapIntensity={0.24} />
      </mesh>
      <Instances geometry={geometries.grass} instances={vegetation.blades} wind />
      <Instances geometry={geometries.stem} instances={vegetation.stems} wind />
      <Instances geometry={geometries.petal} instances={vegetation.petals} wind />
      <Instances geometry={geometries.petal} instances={vegetation.centers} wind />
      <Instances geometry={geometries.petal} instances={vegetation.leaves} wind />
      <Instances geometry={geometries.trunk} instances={scenery.trunks} shadow />
      <Instances geometry={geometries.canopy} instances={scenery.canopies} wind shadow />
      <Instances geometry={geometries.rock} instances={scenery.rocks} shadow />
      <Instances geometry={geometries.rock} instances={scenery.moss} shadow />
      <Instances geometry={geometries.mushroomStem} instances={scenery.mushroomStems} shadow />
      <Instances geometry={geometries.cap} instances={scenery.caps} roughness={0.58} shadow />
      <Instances geometry={geometries.petal} instances={scenery.spots} />
      <Instances geometry={geometries.rock} instances={scenery.pebbles} />
      <Clouds />
      <Butterflies />
      <Pollen evening={evening} />
    </>
  );
}
