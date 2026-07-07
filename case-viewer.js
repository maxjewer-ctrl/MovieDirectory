import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const GLB_PATH = "./dvd_bd_game_case_with_sample_labels.glb";
const DEFAULT_W = 280;
const DEFAULT_H = 389;

// Motion tuning (all rotation deltas are expressed per-frame at 60fps and
// scaled by delta-time so behaviour is frame-rate independent).
const AUTO_SPEED = 0.008;   // idle spin, radians/frame @60fps
const DRAG_SENS = 0.01;     // radians of yaw per pixel dragged
const TILT_SENS = 0.006;    // radians of pitch per pixel dragged
const MAX_TILT = 0.5;       // clamp on the pitch axis
const SPIN_DAMPING = 0.94;  // fling decay toward the auto baseline
const TILT_RECENTER = 0.06; // how fast pitch eases back to level
const TAP_MOVE = 8;         // px of travel under which a pointer counts as a tap
const DOUBLE_MS = 320;      // max gap between taps to register a double-tap

let renderer, scene, camera, model, animFrameId;
let viewerDiv = null;
let canvasEl = null;
let currentMovie = null;
let pendingMovie = null;
let returningToFront = false;
let flipped = false;        // showing the back cover (toggled by double-tap)
let isVisible = true;
let running = false;

// Interaction / inertia state
let dragging = false;
let pointerId = null;
let lastX = 0, lastY = 0;
let downX = 0, downY = 0;   // pointer-down position (for tap detection)
let movedFar = false;       // whether this pointer session moved beyond a tap
let lastTapTime = 0;        // timestamp of the previous tap (double-tap detect)
let velY = AUTO_SPEED;  // yaw velocity (carries fling momentum)
let velX = 0;           // pitch velocity

const textureCache = new Map();

// Material names from the GLB: "cover", "spine", "back", "Car_plastic_dark"

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Ease the case toward a resting yaw (0 = front, π = back) along the shortest
// path, and toward a target pitch. Returns true once it has settled.
function easeToRestYaw(targetYaw, targetTilt, ease) {
  const twoPi = Math.PI * 2;
  const cur = ((model.rotation.y % twoPi) + twoPi) % twoPi;
  let diff = targetYaw - cur;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  model.rotation.y += diff * ease;
  model.rotation.x += (targetTilt - model.rotation.x) * ease;
  return Math.abs(diff) < 0.01 && Math.abs(model.rotation.x - targetTilt) < 0.01;
}

function makeSpineTexture(title, year) {
  // The canvas WIDTH maps to the spine's narrow on-screen dimension (~25px).
  // Keep cw small so the font fills that width — a 256px canvas shrunk to
  // 25px makes a 42px font appear as only ~4px tall, which is unreadable.
  // 64×1024 means 42px font fills ~65% of the narrow axis: legible.
  const cw = 64, ch = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, cw, ch);

  // Rotate CCW so text flows bottom-to-top along the spine.
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(Math.PI / 2);

  const label = year ? `${title}  ·  ${year}` : title;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f0e8d8";
  ctx.font = "bold 42px sans-serif";

  ctx.fillText(label, 0, 0, ch - 64);

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // flipY = true (CanvasTexture default) is correct here — the GLTFLoader
  // transforms mesh UVs to OpenGL convention, so our custom textures must
  // also use the standard Three.js (OpenGL) flipY = true orientation.
  return tex;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxY) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      if (y + lineHeight > maxY) {
        let tail = line;
        while (ctx.measureText(tail + "…").width > maxWidth && tail.length > 1) {
          tail = tail.slice(0, -1);
        }
        ctx.fillText(tail + "…", x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (ctx.measureText(t + "…").width > maxWidth && t.length > 1) t = t.slice(0, -1);
  return t + "…";
}

function getCaseFormatInfo(movie) {
  const fmt = String(movie.primaryFormat || "").toLowerCase();
  if (fmt.includes("4k"))      return { bg: "#060608", fg: "#e8e4dc", accent: "rgba(255,255,255,0.07)", sep: "rgba(255,255,255,0.14)", label: "4K ULTRA HD",               spacing: 5 };
  if (movie.criterion)         return { bg: "#121212", fg: "#e8e0d0", accent: "rgba(255,255,255,0.04)", sep: "rgba(255,255,255,0.10)", label: "THE CRITERION COLLECTION", spacing: 3 };
  if (movie.steelbook)         return { bg: "#252c38", fg: "#cdd8e8", accent: "rgba(200,220,255,0.07)", sep: "rgba(200,220,255,0.16)", label: "COLLECTOR'S EDITION",       spacing: 4 };
  return                              { bg: "#010c38", fg: "#b8d4f8", accent: "rgba(100,150,255,0.10)", sep: "rgba(80,130,230,0.35)",  label: "BLU-RAY DISC",             spacing: 5 };
}

function drawSpacedText(ctx, text, centerX, centerY, spacing) {
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = centerX - total / 2;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, centerY);
    x += widths[i] + spacing;
  }
}

function drawFormatBand(ctx, cw, bandH, fmt) {
  ctx.fillStyle = fmt.bg;
  ctx.fillRect(0, 0, cw, bandH);
  ctx.fillStyle = fmt.accent;
  ctx.fillRect(0, 0, cw, 3);
  ctx.fillStyle = fmt.sep;
  ctx.fillRect(0, bandH - 1, cw, 1);
  const fontSize = Math.max(12, Math.round(bandH * 0.24));
  ctx.fillStyle = fmt.fg;
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = "middle";
  drawSpacedText(ctx, fmt.label, cw / 2, bandH / 2, fmt.spacing);
}

function coverFit(ctx, img, dx, dy, dw, dh) {
  const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
}

function makeBackCoverTexture(movie, img) {
  const cw = 512, ch = 730;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const fmt = getCaseFormatInfo(movie);
  const bandH = Math.round(ch * 0.20);
  drawFormatBand(ctx, cw, bandH, fmt);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bandH, cw, ch - bandH);
  ctx.clip();
  coverFit(ctx, img, 0, bandH, cw, ch - bandH);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  tex.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() || 1;
  return tex;
}

function makeFrontCoverTexture(movie, img) {
  const cw = 512, ch = 730;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  coverFit(ctx, img, 0, 0, cw, ch);
  const fmt = getCaseFormatInfo(movie);
  const bandH = Math.round(ch * 0.10);
  drawFormatBand(ctx, cw, bandH, fmt);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  tex.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() || 1;
  return tex;
}

function makeBackTexture(movie) {
  const cw = 512, ch = 730;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0e0e1c";
  ctx.fillRect(0, 0, cw, ch);

  // Subtle accent bar at top
  ctx.fillStyle = "rgba(240,232,216,0.07)";
  ctx.fillRect(0, 0, cw, 6);

  const pad = 36;
  const maxW = cw - pad * 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Title
  ctx.fillStyle = "#f0e8d8";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText(truncate(ctx, movie.title, maxW), pad, 38);

  // Meta row
  const metaParts = [
    movie.year,
    movie.director ? `Dir. ${movie.director}` : null,
    movie.runtime ? `${movie.runtime} min` : null,
  ].filter(Boolean);

  if (metaParts.length) {
    ctx.fillStyle = "#8a8070";
    ctx.font = "23px sans-serif";
    let meta = metaParts.join("  ·  ");
    if (ctx.measureText(meta).width > maxW) meta = metaParts.slice(0, 2).join("  ·  ");
    ctx.fillText(truncate(ctx, meta, maxW), pad, 96);
  }

  // Separator
  ctx.strokeStyle = "rgba(240,232,216,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 138);
  ctx.lineTo(cw - pad, 138);
  ctx.stroke();

  // Overview
  if (movie.overview) {
    ctx.fillStyle = "#c0b8a8";
    ctx.font = "25px sans-serif";
    wrapText(ctx, movie.overview, pad, 162, maxW, 36, ch - pad);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadTexture(url) {
  if (!url) return Promise.resolve(null);
  if (textureCache.has(url)) return Promise.resolve(textureCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Use the image directly (no intermediate canvas) so a cross-origin
      // poster can't taint a canvas and come back blank.
      // The cover quad only needs a VERTICAL flip: with flipY=false the raw
      // poster comes out upside-down but horizontally correct, so flipY=true
      // sets it upright. (The old `rotation = Math.PI` flipped BOTH axes, which
      // looked upright but left the artwork mirrored left-to-right.)
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      tex.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() || 1;
      tex.needsUpdate = true;
      textureCache.set(url, tex);
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function applyMovieTextures(movie) {
  if (!model || !movie) return;

  const frontUrl = movie.posterUrl || null;
  const spineTex = makeSpineTexture(movie.title, movie.year);

  model.traverse((node) => {
    if (!node.isMesh) return;
    const matName = (node.material?.name || "").toLowerCase();

    if (matName === "cover" && frontUrl) {
      const applyTex = (tex) => {
        if (!tex) return;
        const mat = node.material.clone();
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        node.material = mat;
      };
      const img = new Image();
      img.onload = () => {
        try { applyTex(makeFrontCoverTexture(movie, img)); }
        catch (_) { loadTexture(frontUrl).then(applyTex); }
      };
      img.onerror = () => loadTexture(frontUrl).then(applyTex);
      img.src = frontUrl;
    } else if (matName === "spine") {
      const mat = node.material.clone();
      mat.map = spineTex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
      node.material = mat;
    } else if (matName === "back") {
      if (movie.backCoverUrl) {
        const img = new Image();
        img.onload = () => {
          const tex = makeBackCoverTexture(movie, img);
          const mat = node.material.clone();
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          node.material = mat;
        };
        img.src = movie.backCoverUrl;
      } else {
        const mat = node.material.clone();
        mat.map = makeBackTexture(movie);
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        node.material = mat;
      }
    }
  });
}

function updateMovie(movie) {
  currentMovie = movie;
  flipped = false;
  if (!dragging) returningToFront = true;
  if (model) {
    applyMovieTextures(movie);
  } else {
    pendingMovie = movie;
  }
}

/* ------------------------------ interaction ------------------------------ */

function onPointerDown(e) {
  if (pointerId !== null) return;
  dragging = true;
  returningToFront = false;
  pointerId = e.pointerId;
  lastX = e.clientX;
  lastY = e.clientY;
  downX = e.clientX;
  downY = e.clientY;
  movedFar = false;
  velY = 0;
  velX = 0;
  canvasEl.setPointerCapture?.(pointerId);
  startLoop();
  e.preventDefault();
}

function toggleFlip() {
  flipped = !flipped;
  returningToFront = false;
  velY = 0;
  velX = 0;
  startLoop();
}

function onPointerMove(e) {
  if (!dragging || e.pointerId !== pointerId || !model) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  // Yaw (rotation around the vertical axis) stays inverted; pitch (the
  // horizontal tilt axis) uses the normal direction.
  model.rotation.y += -dx * DRAG_SENS;
  model.rotation.x = clamp(model.rotation.x - dy * TILT_SENS, -MAX_TILT, MAX_TILT);

  // Track total travel so a small, near-stationary press still reads as a tap.
  if (!movedFar && Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MOVE) {
    movedFar = true;
  }

  // Remember the last movement as the fling velocity for release.
  velY = -dx * DRAG_SENS;
  velX = -dy * TILT_SENS;
}

function endDrag(e) {
  if (!dragging || (e && e.pointerId !== pointerId)) return;
  dragging = false;
  if (pointerId !== null) canvasEl.releasePointerCapture?.(pointerId);
  pointerId = null;

  // A near-stationary press is a tap; two taps in quick succession flip the
  // case between its front and back cover.
  if (e && e.type === "pointerup" && !movedFar) {
    const now = performance.now();
    if (now - lastTapTime < DOUBLE_MS) {
      lastTapTime = 0;
      toggleFlip();
    } else {
      lastTapTime = now;
    }
  }
}

/* -------------------------------- viewer --------------------------------- */

function createViewer() {
  viewerDiv = document.createElement("div");
  viewerDiv.className = "case-viewer-container";

  canvasEl = document.createElement("canvas");
  canvasEl.className = "case-viewer-canvas";
  viewerDiv.append(canvasEl);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setSize(DEFAULT_W, DEFAULT_H);

  scene = new THREE.Scene();

  // Image-based lighting: a PMREM of the built-in room gives the glossy
  // plastic shell realistic soft reflections without loading an external HDR.
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  } catch (err) {
    console.warn("Environment map unavailable, falling back to lights only:", err);
  }

  camera = new THREE.PerspectiveCamera(32, DEFAULT_W / DEFAULT_H, 0.1, 100);
  camera.position.set(0, 0.1, 2.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(2, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb0c4de, 0.45);
  fill.position.set(-2, 1, -2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, -1, -3);
  scene.add(rim);

  const loader = new GLTFLoader();
  loader.load(
    GLB_PATH,
    (gltf) => {
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.2 / maxDim;
      model.scale.setScalar(scale);
      model.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale,
      );

      scene.add(model);

      const target = pendingMovie || currentMovie;
      if (target) applyMovieTextures(target);
      pendingMovie = null;
    },
    undefined,
    (err) => console.error("GLB load error:", err),
  );

  canvasEl.addEventListener("pointerdown", onPointerDown);
  canvasEl.addEventListener("pointermove", onPointerMove);
  canvasEl.addEventListener("pointerup", endDrag);
  canvasEl.addEventListener("pointercancel", endDrag);
  canvasEl.addEventListener("lostpointercapture", endDrag);

  startLoop();
}

const clock = new THREE.Clock();

function tick() {
  animFrameId = null;
  const dt = Math.min(clock.getDelta(), 0.05);
  const f = dt * 60; // frame-normalised factor

  if (model) {
    if (dragging) {
      // Direct manipulation handled in onPointerMove; nothing to integrate.
    } else if (returningToFront) {
      // Swing the cover back to face front and level out the tilt.
      if (easeToRestYaw(0, 0, Math.min(1, f * 0.1))) {
        returningToFront = false;
        velY = AUTO_SPEED;
      }
    } else if (flipped) {
      // Double-tap hold: ease to the back cover and stay there until the
      // next double-tap flips back to the front (then the idle spin resumes).
      easeToRestYaw(Math.PI, 0, Math.min(1, f * 0.15));
      velY = 0;
      velX = 0;
    } else {
      // Free spin with fling momentum that settles into the gentle auto-rotate.
      model.rotation.y += velY * f;
      model.rotation.x += velX * f;
      // Yaw velocity decays toward the idle baseline (a fling coasts, then
      // eases into the slow auto-rotate rather than stopping dead).
      velY = AUTO_SPEED + (velY - AUTO_SPEED) * Math.pow(SPIN_DAMPING, f);
      // Pitch bleeds off and the case self-levels.
      velX *= Math.pow(SPIN_DAMPING, f);
      model.rotation.x += (0 - model.rotation.x) * Math.min(1, TILT_RECENTER * f);
    }
  }

  renderer.render(scene, camera);
  if (running) animFrameId = requestAnimationFrame(tick);
}

function startLoop() {
  if (running || !isVisible) return;
  running = true;
  clock.getDelta(); // discard the gap accumulated while paused
  animFrameId = requestAnimationFrame(tick);
}

function stopLoop() {
  running = false;
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function resizeToContainer() {
  if (!viewerDiv || !renderer || !camera) return;
  const w = viewerDiv.clientWidth || DEFAULT_W;
  const h = viewerDiv.clientHeight || DEFAULT_H;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!running) renderer.render(scene, camera); // keep the still frame fresh
}

function insertViewer() {
  const posterEl = document.getElementById("detail-poster");
  if (!posterEl) return;
  const wrapper = posterEl.querySelector(".detail-poster-wrap");
  if (!wrapper) return;
  if (viewerDiv.parentElement === wrapper) return;

  wrapper.querySelectorAll(".detail-case").forEach((el) => {
    el.style.display = "none";
  });

  wrapper.prepend(viewerDiv);
  requestAnimationFrame(() => requestAnimationFrame(resizeToContainer));
}

function boot() {
  createViewer();

  const posterEl = document.getElementById("detail-poster");
  if (!posterEl) return;

  insertViewer();

  const observer = new MutationObserver(() => insertViewer());
  observer.observe(posterEl, { childList: true });

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => requestAnimationFrame(resizeToContainer)).observe(viewerDiv);
  }

  // Only render while the case is actually on-screen — stops the GPU/CPU
  // loop when no movie is selected or the panel is scrolled/tabbed away.
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      isVisible = entries.some((entry) => entry.isIntersecting);
      if (isVisible) startLoop();
      else stopLoop();
    }, { threshold: 0.01 }).observe(viewerDiv);
  }

  // Pause when the tab is backgrounded.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLoop();
    } else if (isVisible) {
      startLoop();
    }
  });
}

window.caseViewer = { updateMovie };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 120));
} else {
  setTimeout(boot, 120);
}
