# Mellow — Take the scenic route

A peaceful, full-page robot exploration experience built with React, TypeScript,
Vite, Three.js, React Three Fiber, Drei, and Cannon ES. Drive M.O. through a
procedurally generated meadow with rolling terrain and four discoverable landmarks.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Changes appear automatically while developing.

## Explore the meadow

- Physics-driven driving with independent wheel suspension, braking, and
  rechargeable boost.
- Trees, rocks, mushrooms, wildflowers, butterflies, and real-time shadows.
- A field guide, minimap, destination markers, and live driving telemetry.
- Golden hour, morning light, and blue hour lighting.
- Clickable robot eyes, headlights, and antenna, also available in M.O.'s panel.
- Optional synthesized birdsong, gentle-motion settings, and free-look camera.
- Photo mode with PNG downloads.

### Controls

| Input | Action |
| --- | --- |
| W / Up arrow | Drive forward |
| S / Down arrow | Reverse |
| A / D or Left / Right arrows | Steer |
| Space | Brake |
| Shift while driving forward | Boost |
| R | Return to the starting clearing |
| L | Toggle headlights |
| H | Open help |
| Escape | Close a panel or exit photo mode |
| Drag the scene | Look around |
| Scroll | Adjust camera distance |

Touch devices show on-screen driving controls. Camera distance is also available
in settings. Choose a destination in the field guide and follow its guiding light.

The scene fills the viewport on desktop and mobile. Ambient motion starts reduced
when the browser requests reduced motion; driving remains available. WebGL and
hardware acceleration are required. Discoveries and settings last for the current
page session.

## Project structure

- `src/App.tsx`: procedural terrain, scenery, robot model, Cannon physics,
  follow camera, audio, HTML controls, and interface styles.
- `src/index.css`: full-page reset, typography, and focus styling.
- `src/main.tsx`: React entry point.
- `index.html`: page metadata and inline favicon.

The terrain mesh and physics heightfield share the same grid. Keep their
coordinates and triangle layout aligned when changing the landscape.

## Scripts

- `npm run dev`: start the development server.
- `npm run build`: check TypeScript and create a production build in `dist`.
- `npm run preview`: preview the production build locally after building.
- `npm run lint`: run Oxlint.

There is currently no automated test script. Check driving, steering, braking,
reset, panels, photo mode, and touch controls in a WebGL-capable browser after changes.
