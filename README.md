# Volley Tactics — 3D Tactical Board

An interactive 3D volleyball tactical board and play visualizer. Place players on a regulation court, configure ball trajectories, keyframe movements, and scrub through or play back the full animation.

**[Live Demo](https://clarkmccauley.github.io/volley-tactics/)** *(after deploying to GitHub Pages)*

![Volley Tactics screenshot](https://via.placeholder.com/800x450/0a0e17/38bdf8?text=Volley+Tactics+3D)

## Features

- **3D Regulation Court** — 18m × 9m court with net, antennae, attack lines (3m), and boundary markings
- **Player Billboards** — Neon-glow canvas silhouette sprites (Setter, Attacker, Blocker, Receiver) that always face the camera
- **Team Color Coding** — Blue (Team A) and Orange (Team B) with glowing ground discs
- **Drag & Drop** — Raycast-based player positioning on the court plane
- **Multi-Ball Paths** — Multiple simultaneous Bézier trajectories (pass, set, attack) each with its own color, label, and ball
- **GSAP Easing** — Smooth, decelerate, overshoot, elastic, and bounce interpolation between keyframes
- **Keyframe Animation** — Set waypoints for players and ball at any point on the timeline
- **Timeline Playback** — Play/pause, scrubber, speed controls (0.25×–1.5×)
- **Camera Presets** — Top-down, Isometric, Behind-the-Server, and Free Orbit views
- **Save / Load / Share** — Export plays as JSON or share via URL hash

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | [Vite](https://vitejs.dev/) + TypeScript |
| 3D Engine | [Three.js](https://threejs.org/) |
| Controls | OrbitControls, Raycasting drag |
| Animation | GSAP easing + custom keyframe interpolation |
| Styling | Custom dark-mode CSS |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Usage

### Placing Players
1. Select a pose from the dropdown (Setter, Attacker, Blocker, Receiver)
2. Click **+ Team A** or **+ Team B** to add a player
3. Drag players on the court to reposition them
4. Click a player to open the side panel for precise coordinates and pose changes

### Ball Trajectories
1. Click **+ Ball Path** to add a cubic Bézier trajectory (add multiple for pass/set/attack sequences)
2. Click a trajectory line or drag its control handles to edit
3. Select a path to rename it or change its color in the side panel
4. Each ball is visible only during its keyframe time window

### Keyframing
1. Scrub the timeline to the desired time
2. Position players and adjust ball paths
3. Click **◆ Keyframe** to record the current state
4. Choose an **easing** curve from the timeline dock (Smooth, Elastic, Bounce, etc.)
5. Press **▶** to play back

### Camera Views
- **⬇ Top** — Bird's-eye 2D tactical view
- **◻ Iso** — Isometric coach view
- **🎯 Server** — Behind-the-server perspective
- **🔄 Free** — Full orbit controls (drag to rotate, scroll to zoom)

### Save & Share
- **💾 Save** — Downloads the play as `play.json`
- **📂 Load** — Import a previously saved JSON file
- **🔗 Share** — Copies a URL with the play encoded in the hash

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow that builds and deploys automatically on push to `main`.

### One-time setup

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Under **Build and deployment**, set Source to **GitHub Actions**
4. Push to `main` — the workflow builds with Vite and deploys the `dist/` folder

### Manual deploy

```bash
npm run build
# Then push the dist/ folder or use gh-pages CLI
npx gh-pages -d dist
```

### Base path

The Vite config sets `base: '/volley-tactics/'` for GitHub Pages project sites. If your repo has a different name, update `vite.config.ts`:

```ts
export default defineConfig({
  base: '/your-repo-name/',
});
```

## Project Structure

```
volley-tactics/
├── index.html              # Entry HTML with UI overlay
├── src/
│   ├── main.ts             # App bootstrap & render loop
│   ├── court.ts            # 3D court geometry
│   ├── sprites.ts          # Billboard silhouette sprites
│   ├── ball.ts             # Ball & Bézier trajectories
│   ├── easing.ts           # GSAP easing helpers
│   ├── timeline.ts         # Keyframe playback engine
│   ├── controls.ts         # Camera & drag interaction
│   ├── state.ts            # JSON export/import & URL hash
│   ├── ui.ts                 # DOM event bindings
│   ├── types.ts            # Shared types & math utils
│   └── style.css           # Dark-mode UI theme
├── vite.config.ts
├── package.json
└── .github/workflows/static.yml
```

## Court Dimensions

| Measurement | Value |
|------------|-------|
| Court length | 18 m |
| Court width | 9 m |
| Attack line | 3 m from net |
| Net height | 2.43 m (men's) |
| Antenna height | 0.8 m above net |

## License

MIT
