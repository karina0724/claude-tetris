# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript with HTML5 Canvas and CSS. No dependencies, no build process, no `package.json`.

## Running the game

There is no build/lint/test tooling. To run:

```bash
open index.html          # or: python3 -m http.server 8000, then visit localhost:8000
```

Any static file server works since there's no bundler or transpilation step. Changes to `game.js`/`style.css`/`index.html` take effect on browser reload — no compile step required.

## Architecture

Three files, each with a single responsibility:

- **`index.html`** — DOM structure: the main `#board` canvas (300×600, i.e. `COLS × BLOCK` by `ROWS × BLOCK`), the `#next-canvas` preview canvas, HUD elements (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- **`style.css`** — dark/retro arcade visual theme.
- **`game.js`** — all game logic, structured around a single module-level state object (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) with no classes — plain functions operating on shared top-level `let` variables.

### Core mechanics in `game.js`

- **Board model**: a `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: defined as square matrices in `PIECES` (indexed 1–7 for I/O/T/S/Z/J/L). Rotation is computed via matrix transpose + row reverse (`rotateCW`), not stored per-orientation.
- **Collision** (`collide`): checks board bounds and overlap with locked cells.
- **Wall kicks** (`tryRotate`): on rotation collision, tries offsets `[0, -1, 1, -2, 2]` before giving up on the rotation.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time (`dropAccum`) and advances the piece one row once it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by current `level`; hard drop adds 2 points/row dropped, soft drop adds 1 point/row.
- **Leveling/speed**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

Game flow: `init()` builds the board, seeds `next`, calls `spawn()`, and starts the `loop`. `spawn()` promotes `next` to `current` and generates a new `next`; if the newly spawned piece immediately collides, `endGame()` fires and the Game Over overlay is shown. Input is handled by a single `keydown` listener (arrows to move, `↑`/`X` to rotate, `Space` for hard drop, `P` to pause).

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell size in px), `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK` by `ROWS × BLOCK`).
