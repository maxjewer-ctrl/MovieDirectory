# 3D Case Viewer — Dev Notes

## What we built

Replaced the CSS 3D rotating case in the detail panel with a Three.js WebGL renderer that loads `dvd_bd_game_case_with_sample_labels.glb` — a real DVD/BD case model.

The old CSS animation (`detail-case-rotate` keyframes) reset every time a movie was selected because `renderDetailPoster()` rebuilds the DOM from scratch, restarting the animation. The new viewer lives outside that rebuild cycle.

---

## How it works

**`case-viewer.js`** (ES module, loaded via importmap from CDN Three.js r164)

- Creates a single persistent `<div class="case-viewer-container">` and `<canvas>` once on boot. These never get destroyed.
- A `MutationObserver` on `#detail-poster` watches for `renderDetailPoster()` rebuilding the DOM, then re-inserts the canvas into the new wrapper — rotation state is preserved across movie selections.
- A `ResizeObserver` keeps the canvas sized to its container.
- Auto-rotates via a gentle idle yaw baseline (`AUTO_SPEED`) in the `requestAnimationFrame` loop, delta-time scaled so it's frame-rate independent.
- When a new movie is selected, triggers a smooth "swing to front" tween (lerp back to `rotation.y = 0`, and level the tilt to `rotation.x = 0`) so the cover art is visible immediately.

### Interaction (drag-to-spin + inertia)

The canvas has always advertised `cursor: grab`, but nothing listened for it. It
now has real pointer handling:

- **Drag** yaws the case (`DRAG_SENS` rad/px) and tilts it up/down
  (`TILT_SENS`, clamped to `±MAX_TILT`). Uses `setPointerCapture` so the drag
  keeps tracking outside the canvas, and `touch-action: none` (CSS) so touch
  drags rotate instead of scrolling the panel.
- **Fling / inertia** — the last pointer delta becomes a velocity. On release
  the yaw velocity decays (`SPIN_DAMPING`) *toward* the idle `AUTO_SPEED`
  baseline, so a flick coasts and then eases back into the slow auto-rotate
  rather than stopping dead. Pitch bleeds off and the case self-levels
  (`TILT_RECENTER`).

### Reflections

- `scene.environment` is a PMREM of the addon `RoomEnvironment`, giving the
  glossy `Car_plastic_dark` shell soft image-based reflections without an
  external HDR. Wrapped in try/catch — falls back to the directional lights if
  PMREM generation fails. Ambient light was lowered to `0.35` since the
  environment now supplies most of the ambient fill.
- Cover textures get max anisotropy for crisp poster art at grazing angles.

### Resource use (render-on-demand gating)

The loop no longer runs forever. An `IntersectionObserver` on the container
`stopLoop()`s when the case scrolls/tabs off-screen or no movie is selected, and
`startLoop()`s when it returns; a `visibilitychange` listener pauses it when the
browser tab is backgrounded. `resizeToContainer` re-renders a single still frame
while paused so the case stays sharp after a resize.

**`app.js`** change (one line at the end of `renderDetailPoster`):
```js
window.caseViewer?.updateMovie(movie);
```

---

## GLB mesh/material names

Extracted from the binary JSON chunk:

| Material | Face |
|---|---|
| `cover` | Front cover label |
| `spine` | Spine label |
| `back` | Back cover label |
| `Car_plastic_dark` | Case shell/body |

---

## Texture mapping

`updateMovie(movie)` traverses all meshes and targets by `node.material.name`:

- **`cover`** — loads `movie.posterUrl` directly into a `THREE.Texture` with `flipY = true` (vertical flip only). Cached by URL so repeated selections don't re-fetch.
- **`spine`** — generates a `CanvasTexture` with `movie.title · movie.year` drawn rotated 90° to read along the spine.
- **`back`** — set to a plain dark colour (`#1a1a2e`), no texture, removing the baked-in sample label from the GLB.

---

## Texture orientation (resolved)

Earlier theory: the cover mesh UV had "inverted winding (both U and V reversed)"
requiring a 180° flip. **This was wrong.** Inspecting the GLB directly, the cover
(`Object_1`, material `cover`) is a single quad with standard glTF UVs:

```
pos(-x,-y) uv(0,0)   pos(-x,+y) uv(0,1)
pos(+x,-y) uv(1,0)   pos(+x,+y) uv(1,1)
```

i.e. a clean `(0,0)→(1,1)` mapping, same convention the model's own sample-label
textures use. The GLB ships with correctly-oriented sample labels, and
`GLTFLoader` builds those textures with the image drawn **as-is** and
`flipY = false` (glTF's top-left UV origin).

Current (working) approach in `loadTexture`:

```js
const tex = new THREE.Texture(img);   // use the image directly, no canvas
tex.colorSpace = THREE.SRGBColorSpace;
tex.flipY = true;                     // vertical flip only — sets it upright
tex.needsUpdate = true;
```

Two things had to be right at once:

1. **Don't route the image through a canvas.** The old code drew the poster onto
   a `<canvas>` first; a cross-origin poster taints the canvas, and the resulting
   `CanvasTexture` uploads blank — that was the original "artwork not mapping to
   the object." Using `THREE.Texture(img)` directly avoids the taint.
2. **Flip the vertical axis only.** With `flipY = false` the raw poster renders
   upside-down but horizontally correct, so it only needs a vertical flip —
   `flipY = true` does exactly that.

> ### Correction (previous `rotation = Math.PI` was wrong)
> An earlier version used `flipY = false` + `center (0.5, 0.5)` +
> `rotation = Math.PI` and called it "resolved." A 180° rotation flips **both**
> axes, so while it looked upright, it silently **mirrored the cover
> left-to-right**. It went unnoticed until a poster with readable title text
> (*Room in Rome*) showed the title reversed. The rotation was the wrong tool:
> the poster only needed its vertical axis flipped, which is what `flipY` is
> for. Rule of thumb: `flipY` for an upside-down image; `repeat.x = -1` /
> `rotation = π` only when the artwork is genuinely mirrored or half-turned.

> Note: the spine label (`makeSpineTexture`) still uses a `CanvasTexture` at its
> default `flipY = true`. If the spine text ever reads flipped, apply the same
> `flipY = false` there for consistency with the glTF convention.

---

## Files changed

| File | What changed |
|---|---|
| `case-viewer.js` | New file — entire 3D viewer module |
| `app.js` | +1 line: `window.caseViewer?.updateMovie(movie)` in `renderDetailPoster` |
| `index.html` | Added Three.js importmap + `<script type="module" src="./case-viewer.js">` |
| `styles.css` | Added `.case-viewer-container` and `.case-viewer-canvas` rules |
