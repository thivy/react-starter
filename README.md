# Milo - A Little World

A drivable, reference-based 3D robot in Sunpetal Meadow. Built with React 19,
TypeScript, Three.js, React Three Fiber, and Rapier's real-time rigid-body physics.
All robot geometry, terrain, vegetation, maps, and environmental reflections are
generated locally. No external model, texture, or HDR downloads are required.

## Run

Requires Bun and a WebGL 2-capable browser with hardware acceleration.

```sh
bun install
bun run dev
```

Open the URL printed by Vite. If the default port is occupied, Vite chooses the
next available port. The app is also compatible with the existing Vite build and
preview workflow.

## Controls

| Input           | Action                                              |
| --------------- | --------------------------------------------------- |
| W / Up arrow    | Accelerate forward                                  |
| S / Down arrow  | Reverse; brake first when changing travel direction |
| A / Left arrow  | Steer left                                          |
| D / Right arrow | Steer right                                         |
| Space           | Brake and disengage motor torque                    |
| Shift           | Boost while accelerating forward                    |
| R               | Reset the robot to its starting clearing            |
| Pointer drag    | Orbit the camera                                    |
| Scroll / pinch  | Zoom                                                |
| Escape          | Close an open panel                                 |

The on-screen arrows, brake, and boost buttons support press-and-hold driving and
multiple pointer inputs. Keyboard input is cleared on focus loss and when opening
a panel. Form controls do not accidentally drive the robot.

The follow camera gradually returns behind a moving vehicle after manual orbiting.
Orbit mode retains the selected angle. The focus button restores the robot's
three-quarter view. Camera distance automatically adjusts to the viewport's aspect
ratio and is shortened when a physics ray encounters terrain or a solid obstacle.

## Robot

The procedural model follows the supplied reference's ivory rounded shell,
charcoal chassis, scalloped wheel arches, thick rubber tires, recessed metal hubs,
mint wheel rings, diagonal roof grille, front controls, red rear light, service
hatch, seams, springs, axle hardware, underside vents, and fasteners.

- Click the front power button to power the robot and its indicators on or off.
- Click the circular control above it to scan for nearby landmarks.
- Click the rear latch to open or close the service hatch.
- Open the MILO-01 instrument label for accessible equivalents of these controls.
- Running lights can be toggled independently in the robot or settings panel.

Button depression, hatch movement, status blinking, and subtle idle body motion
are animated. Wheel spin, steering, and suspension positions come from physics.

## Physics And World

The simulation uses a fixed 60 Hz Rapier world with gravity, a 38 kg chassis,
box-derived principal inertia, a lowered center of mass, continuous collision
detection, four independently sprung and damped raycast wheels, tire traction,
Ackermann front steering, progressive motor input, rolling resistance, and braking.
Boost has a finite reserve, recharge, and a cooldown threshold.

The bounded 220 x 220 meter world is generated from seeded simplex noise. Its
rendered ground and static collision mesh share exactly the same vertices and
triangle indices. Rocks, tree trunks, and mushroom stems have solid colliders.
Instanced grass, flowers, trees, mushrooms, and rocks keep draw calls manageable.
Wind, butterflies, pollen, driving dust, day/golden-hour lighting, fog, a physical
sky, soft sunlight shadows, and local reflections provide the atmosphere.

These are tuned simulation values, not manufacturer measurements. The model is a
procedural interpretation of the image, not an imported CAD asset. Tires use
Rapier's raycast vehicle model rather than deformable rubber or separate wheel
rigid bodies; vegetation colliders are simplified, and decorative hinges and
springs are visual mechanisms. The meadow is large but finite, not streamed or
infinite.

## Exploration And Settings

- Live speed, heading, drive direction, boost reserve, ground contact, and minimap.
- Four discoverable landmarks, a field journal, and selectable map waypoints.
- Discoveries persist in this browser's local storage; there is no account or API.
- Daylight and golden-hour atmosphere, camera modes, zoom, and render quality.
- Optional locally synthesized wind and motor audio, silent until enabled.
- PNG scene capture, fullscreen where supported, pause, and position recovery.

The interface follows the device's light/dark preference. Override it with
`?clawpilotTheme=light` or `?clawpilotTheme=dark`. CSS transitions respect reduced
motion preferences. Use Balanced quality on lower-powered devices.

## Validation

```sh
bun test
bun run lint
bun run build
bun run preview
```

The Bun tests exercise deterministic terrain, visual/collision surface alignment,
wheel contact, mass, acceleration, coasting, braking, brake release on slopes,
reverse, steering, boost/recharge, uneven suspension, power-off behavior, solid
collisions, camera rays, and landing recovery. They run real Rapier physics, not
mocked positions. The production build type-checks application code; Bun executes
the test sources separately.

## Source Layout

- [src/App.tsx](src/App.tsx): application UI, inputs, live maps, journal, and audio.
- [src/components/Scene.tsx](src/components/Scene.tsx): fixed-step loop, camera, lighting, and scene effects.
- [src/components/Robot.tsx](src/components/Robot.tsx): reference-based geometry and physical controls.
- [src/components/World.tsx](src/components/World.tsx): terrain rendering and instanced scenery.
- [src/lib/simulation.ts](src/lib/simulation.ts): Rapier vehicle, traction, suspension, and collision queries.
- [src/lib/world.ts](src/lib/world.ts): seeded terrain, shared height sampling, objects, and landmarks.
- [tests/simulation.test.ts](tests/simulation.test.ts): physics and terrain regression tests.
