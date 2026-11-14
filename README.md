markdown
# TRAP WORLD

A hardcore **pixel-art trap platformer** built entirely with HTML5 Canvas and vanilla JavaScript (ES modules). No backend, no dependencies, no build step — just open it and play.

![genre](https://img.shields.io/badge/genre-precision%20platformer-6df2ff) ![tech](https://img.shields.io/badge/tech-HTML5%20Canvas-ff5c8a) ![license](https://img.shields.io/badge/license-MIT-5ef2a0)

---

## Features

- **5 hand-built levels** across 5 distinct worlds (Forest, Castle, Lava Depths, Factory, Nightmare)
- **Double jump** from the very first level, with coyote time and jump buffering
- **12+ trap types**: hidden spikes, fake platforms, collapsing floors, falling ceilings, crushers, moving spikes, moving platforms, rising lava, teleport traps, invisible walls, enemies and fake exits
- **Checkpoints**, instant respawn, persistent death counter
- **Fully procedural visuals** — parallax skies, stars, moonlight, ridge lines, trees, towers, lava glow
- **Fully procedural audio** — WebAudio synthesized SFX and per-theme ambient music
- **Responsive** — the canvas scales to fit any screen; large touch controls on mobile; no scrolling
- **Local save** — unlocked levels, best deaths and settings in `localStorage`
- **Settings** — master / music / SFX volumes, screen shake, graphics quality
- **Pause menu, level select, how-to-play, credits**

---

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move left | `A` / `←` | ◀ button |
| Move right | `D` / `→` | ▶ button |
| Jump / Double jump | `Space` / `W` / `↑` | ▲ button |
| Restart level | `R` | Pause menu |
| Pause | `Esc` | ❚❚ button |

---

## Project structure
TRAP-WORLD/
├── index.html
├── README.md
├── .gitignore
├── css/
│ ├── main.css
│ ├── game.css
│ ├── menu.css
│ ├── responsive.css
│ └── animations.css
└── js/
├── main.js
├── game.js
├── engine.js
├── player.js
├── physics.js
├── camera.js
├── input.js
├── mobile-controls.js
├── collision.js
├── traps.js
├── particles.js
├── audio.js
├── levels.js
├── level-manager.js
├── save-system.js
├── settings.js
├── ui.js
├── backgrounds.js
└── utilities.js

text

Every module has a single responsibility. `save-system.js` is the only place that touches `localStorage`, so it can be replaced by an online backend later without touching gameplay code.

---

## Running locally

Because the game uses **ES modules**, it must be served over `http://` (opening `index.html` via `file://` will fail with a CORS error).

```bash
# Python 3
python -m http.server 8080

# or Node
npx serve .

# or VS Code: "Live Server" extension → Go Live
Then open http://localhost:8080.

Deploying to GitHub Pages
Create a repository and push the whole project to the main branch.

Go to Settings → Pages.

Under Source, select Deploy from a branch, branch main, folder / (root).

Save. Your game will be live at https://<username>.github.io/<repo>/.

All asset paths are relative, all imports are relative ES module paths, and there are no hardcoded localhost URLs, no API keys and no server requirements.

Design notes
Logical render resolution is 480 × 270, upscaled with image-rendering: pixelated, so the pixel grid stays crisp at any size.

The HUD is HTML/CSS (not canvas), which keeps text sharp and accessible at every scale.

Physics run on a fixed 60 Hz timestep with an accumulator, and collision uses sub-stepping, so nothing tunnels through platforms at any framerate.

Traps rebuild their solid/hazard rectangles every frame, which lets them appear, vanish, move and reset without ever leaving the physics world in an invalid state.

Death resets all traps in the level but preserves the last checkpoint.

License
MIT — do whatever you want. All art and audio are generated procedurally at runtime and are original to this project.

text

---

## FILE 27: `.gitignore`
OS
.DS_Store
Thumbs.db

Editors
.vscode/
.idea/
*.swp
*~

Node (if you add tooling later)
node_modules/
npm-debug.log*
yarn-error.log*

Build output
dist/
build/

Logs
*.log

text

---

## ✅ Final verification summary

| Requirement | Status |
|---|---|
| 5 complete, distinct levels | ✅ Forest / Castle / Lava / Factory / Nightmare |
| Double jump from level 1 | ✅ `jumpsUsed` model + aura FX + SFX |
| 12 trap types with reset | ✅ all in `traps.js`, `reset()` called on death |
| Checkpoints persist in-level | ✅ `LevelManager.registerCheckpoint` |
| Death → particle burst, sound, shake, respawn | ✅ `killPlayer()` / `respawn()` |
| Smooth clamped camera + shake | ✅ `camera.js` |
| Responsive canvas (no scroll, any device) | ✅ `engine.js` + `responsive.css`, `100dvh` |
| Mobile touch controls | ✅ `mobile-controls.js`, pointer events, no sticky buttons |
| Pause stops simulation | ✅ `state === 'paused'` skips `updatePlaying` |
| localStorage save/settings | ✅ `save-system.js` + `settings.js` |
| Procedural audio + music | ✅ `audio.js` (WebAudio) |
| All ES module imports resolve | ✅ verified against file list |
| No `TODO`s, no placeholders, no missing files | ✅ |

Drop the 27 files into a folder, run `python -m http.server 8080`, and TRAP WORLD is live.
