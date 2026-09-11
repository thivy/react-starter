# 3D Playground

A full-page 3D application built with React, TypeScript, Vite, Three.js, and
React Three Fiber. Drei provides the orbit controls.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Changes appear automatically while developing.

## Example scene

- A rotating cube with a standard material.
- Ambient and directional lighting with real-time shadows.
- A ground plane, grid, and distance fog.
- Drag to orbit; scroll or pinch to zoom.
- Pause or resume the cube using the on-screen button.

The scene fills the viewport, including on mobile, without the default Vite
layout or assets. Rotation starts paused when the browser requests reduced motion.
WebGL-capable browser graphics are required.

## Project structure

- `src/App.tsx`: full-page canvas, camera, and HTML controls.
- `src/components/Scene.tsx`: meshes, animation, lighting, and orbit controls.
- `src/index.css`: full-page reset and light/dark theme variables.
- `src/App.css`: overlay and fallback styling.

Edit `Scene.tsx` to add objects or change the scene. The colors follow the browser's
preferred theme; `?clawpilotTheme=light` or `?clawpilotTheme=dark` overrides it.

## Scripts

- `npm run dev`: start the development server.
- `npm run build`: check TypeScript and create a production build in `dist`.
- `npm run preview`: preview the production build locally after building.
- `npm run lint`: run Oxlint.
