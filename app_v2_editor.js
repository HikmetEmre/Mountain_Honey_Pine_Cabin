// ===================== IMPORTS ============================

console.log("app_v2_editor.js loaded");

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

console.log("V2 script loaded ✅");

// ===================== ASSET PATHS ============================
const ASSETS = {
  terrain: "assets/terrain/pine.glb",

  cabin: "assets/shop/scandi_log_cabin.glb",
  tableInside: "assets/props/wooden_table_low_poly.glb",

  honeyPot1: "assets/props/honey_pot.glb",
  honeyPot2: "assets/props/honey_pot2.glb",
  honeyDipper: "assets/props/honey_dipper.glb",

  picnicTable: "assets/outside/picnic_table.glb",
  bear: "assets/outside/bear_wood.glb",

  bee: "assets/fx/lowpoly_bee.glb",

  // audio
  forest: "assets/audio/forest_loop.mp3",
  wind: "assets/audio/forest_wind.mp3",
  bees: "assets/audio/bee_loop.mp3",
  doorSfx: "assets/audio/door_open_and_close.mp3",
  welcomeSfx: "assets/audio/welcome_travaller.mp3",
};

// ===================== BASIC SETUP ============================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd6c5);
scene.fog = new THREE.Fog(0xaec6cf, 200, 900);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  3000
);
camera.position.set(0, 40, 160);

// Orbit controls (editor camera)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.rotateSpeed = 0.1;
controls.zoomSpeed = 0.30;
controls.panSpeed = 0.20;
controls.minPolarAngle = 0.01;
controls.maxPolarAngle = Math.PI - 0.01;
controls.autoRotate = false;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};
controls.target.set(0, 20, 0);
controls.enableZoom = true;
controls.update();




// ===================== ORBIT KEY MOVE (WASD + SPACE/SHIFT) =====
const moveKeys = { w: false, a: false, s: false, d: false, up: false, down: false };
const ORBIT_MOVE_SPEED = 18;       // tune
const ORBIT_VERTICAL_SPEED = 45;   // tune
const ORBIT_MOVE_ACCEL = 10;  // how fast it reaches speed
const ORBIT_MOVE_DAMP  = 14;  // how fast it stops

const orbitVel = new THREE.Vector3();


// Terrain clamp tuning (camera never below)
const EYE_HEIGHT = 3;

window.addEventListener("keydown", (e) => {
  // movement keys always active
  if (e.code === "KeyW") moveKeys.w = true;
  if (e.code === "KeyA") moveKeys.a = true;
  if (e.code === "KeyS") moveKeys.s = true;
  if (e.code === "KeyD") moveKeys.d = true;

  if (e.code === "Space" || e.code === "KeyE") moveKeys.up = true;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyQ") moveKeys.down = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") moveKeys.w = false;
  if (e.code === "KeyA") moveKeys.a = false;
  if (e.code === "KeyS") moveKeys.s = false;
  if (e.code === "KeyD") moveKeys.d = false;

  if (e.code === "Space" || e.code === "KeyE") moveKeys.up = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyQ") moveKeys.down = false;
});

// ===================== LIGHTING ===============================
scene.add(new THREE.AmbientLight(0xffffff, 1.15));

const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.color.setHex(0xfff1d6);
sun.position.set(200, 300, 150);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.02;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 900;
sun.shadow.camera.left = -350;
sun.shadow.camera.right = 350;
sun.shadow.camera.top = 350;
sun.shadow.camera.bottom = -350;
scene.add(sun);

// ===================== LOADERS / CACHE ========================
const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

async function loadGLB(path) {
  if (gltfCache.has(path)) return gltfCache.get(path);
  const gltf = await new Promise((resolve, reject) => {
    gltfLoader.load(path, resolve, undefined, reject);
  });
  gltfCache.set(path, gltf);
  return gltf;
}

function cloneGLTFScene(gltf) {
  return gltf.scene.clone(true);
}

// ===================== TERRAIN STATE ==========================
let terrainRoot = null;
const terrainMeshes = [];
const groundMeshes = [];


function normalizeModel(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim < 0.0001) {
    console.warn("normalizeModel skipped (invalid bounds)");
    return;
  }

  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.sub(center);

  const scale = targetSize / maxDim;
  model.scale.setScalar(scale);
  model.position.y = 0;
}


function collectMeshes(root, outArray, opts = {}, filterFn = null) {
  outArray.length = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;

    if (filterFn && !filterFn(o)) return;

    if (opts.receiveShadow !== undefined) o.receiveShadow = opts.receiveShadow;
    if (opts.castShadow !== undefined) o.castShadow = opts.castShadow;
    outArray.push(o);
  });
}


// ===================== RAYCAST / PICKING ======================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function ndcFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  return { x, y };
}

// ===================== AUDIO =================================
let listener = null;

let forestSound = null;
let beeSound = null;
let windSound = null;

let forestBuffer = null;
let beeBuffer = null;
let windBuffer = null;

let doorSfxBuffer = null;
let welcomeSfxBuffer = null;

let audioArmed = false;

function ensureAudioListener() {
  if (listener) return listener;
  listener = new THREE.AudioListener();
  camera.add(listener);
  return listener;
}

async function loadAudioBuffer(url) {
  ensureAudioListener();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio fetch failed: ${url} (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return await listener.context.decodeAudioData(arrayBuffer);
}

function startAudio() {
  if (audioArmed) return;
  audioArmed = true;

  if (!forestSound && forestBuffer) {
    forestSound = new THREE.Audio(listener);
    forestSound.setBuffer(forestBuffer);
    forestSound.setLoop(true);
    forestSound.setVolume(0.07);
    forestSound.play();
  }

  if (!windSound && windBuffer) {
    windSound = new THREE.Audio(listener);
    windSound.setBuffer(windBuffer);
    windSound.setLoop(true);
    windSound.setVolume(0.6);
    windSound.play();
  }

  if (!beeSound && beeBuffer) {
    beeSound = new THREE.PositionalAudio(listener);
    beeSound.setBuffer(beeBuffer);
    beeSound.setLoop(true);
    beeSound.setVolume(0.12);
    beeSound.setRefDistance(40);
    beeSound.setMaxDistance(400);
    beeSound.setRolloffFactor(1.0);

    const anchor = objects.cabin ? objects.cabin : scene;
    anchor.add(beeSound);
    beeSound.play();
  }

  console.log("Audio started ✅");
}

function armAudioStart() {
  const onFirst = () => {
    startAudio();
    window.removeEventListener("pointerdown", onFirst);
    window.removeEventListener("keydown", onFirst);
  };
  window.addEventListener("pointerdown", onFirst, { once: true });
  window.addEventListener("keydown", onFirst, { once: true });
}

function playOneShot(buffer, volume = 0.6) {
  if (!buffer) return;
  if (!listener) {
    console.warn("AudioListener not ready yet.");
    return;
  }
  if (!audioArmed) startAudio();

  const s = new THREE.Audio(listener);
  s.setBuffer(buffer);
  s.setLoop(false);
  s.setVolume(volume);
  s.play();
}

// ===================== SCENE OBJECTS ==========================
let selected = null;
let selectionBox = null;
let mode = "move";
let tool = "select";

let lastTerrainHit = null;
let lastTableHit = null;

const objects = {
  cabin: null,
  tableInside: null,
  honeyPot1: null,
  honeyPot2: null,
  honeyDipper: null,
  picnic: null,
  bear: null,
};

// Door
const DOOR_NAME_REGEX = /door|gate/i;
let doorMesh = null;
let doorMixer = null;
let doorClip = null;
let doorAction = null;
let doorIsOpen = false;
const DOOR_OPEN_ANGLE = THREE.MathUtils.degToRad(90);

// Bees (visual)
const BEE_COUNT = 8;
const bees = [];
const treeSway = [];

// ===================== HELPERS ================================
function setupTreeWind(root) {
  treeSway.length = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;

    const objName = (mesh.name || "").toLowerCase();
    const matName = (mesh.material?.name || "").toLowerCase();

    const looksLikeFoliage =
      objName.includes("leaf") ||
      objName.includes("leaves") ||
      objName.includes("canopy") ||
      objName.includes("needle") ||
      objName.includes("needles") ||
      objName.includes("branch") ||
      objName.includes("branches") ||
      matName.includes("leaf") ||
      matName.includes("leaves") ||
      matName.includes("foliage") ||
      matName.includes("needle") ||
      matName.includes("needles");

    if (!looksLikeFoliage) return;

    treeSway.push({
      obj: mesh,
      baseRotY: mesh.rotation.y,
      baseRotZ: mesh.rotation.z,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.35,
      ampY: 0.003 + Math.random() * 0.007,
      ampZ: 0.006 + Math.random() * 0.014,
    });
  });

  console.log("Foliage wind targets:", treeSway.length);
}

function snapToTerrain(obj, lift = 0.0) {
  if (!terrainMeshes.length) return false;
  const down = new THREE.Raycaster();
  const origin = obj.position.clone().add(new THREE.Vector3(0, 400, 0));
  down.set(origin, new THREE.Vector3(0, -1, 0));
  const hits = down.intersectObjects(groundMeshes, true);
  if (!hits.length) return false;
  obj.position.y = hits[0].point.y + lift;
  return true;
}

function faceTowardCameraXZ(obj) {
  const toCam = new THREE.Vector3().subVectors(camera.position, obj.position);
  toCam.y = 0;
  if (toCam.lengthSq() < 1e-6) return;
  obj.rotation.y = Math.atan2(toCam.x, toCam.z);
}

function setSelected(obj) {
  selected = obj || null;

  if (selectionBox) {
    scene.remove(selectionBox);
    selectionBox = null;
  }
}

function updateSelectionBox() {

}

function updateBeeAudioAnchor() {
  if (!beeSound) return;
  if (objects.cabin && beeSound.parent !== objects.cabin) {
    beeSound.parent?.remove(beeSound);
    objects.cabin.add(beeSound);
  }
}


function moveOrbitRig(dt) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize();

  const desired = new THREE.Vector3();

  if (moveKeys.w) desired.add(forward);
  if (moveKeys.s) desired.sub(forward);
  if (moveKeys.a) desired.add(right);
  if (moveKeys.d) desired.sub(right);

  

  // ❌ strongly recommended: DISABLE vertical orbit movement
  // (this is what causes most floating confusion)
  // if (moveKeys.up) desired.y += 1;
  // if (moveKeys.down) desired.y -= 1;

  if (desired.lengthSq() > 0) {
    desired.normalize().multiplyScalar(ORBIT_MOVE_SPEED);
  }

  // Smooth acceleration
  orbitVel.lerp(desired, 1 - Math.exp(-ORBIT_MOVE_ACCEL * dt));

  // Extra damping when no input
  if (desired.lengthSq() === 0) {
    orbitVel.multiplyScalar(Math.exp(-ORBIT_MOVE_DAMP * dt));
  }

  const delta = orbitVel.clone().multiplyScalar(dt);

  camera.position.add(delta);
  controls.target.add(delta);

  // Clamp camera ONLY (prevents rising near cabin)
  if (terrainMeshes.length) {
    const down = new THREE.Raycaster(
      new THREE.Vector3(camera.position.x, 500, camera.position.z),
      new THREE.Vector3(0, -1, 0)
    );
    const hit = down.intersectObjects(groundMeshes, true)[0];
    if (hit) {
      const minY = hit.point.y + EYE_HEIGHT;
      if (camera.position.y < minY) camera.position.y = minY;
    }
  }
}


// ===================== POPUP UI ===============================
let infoPopup = null;
let infoPopupTimer = null;

function ensureInfoPopup() {
  if (infoPopup) return infoPopup;

  infoPopup = document.createElement("div");
  infoPopup.style.position = "fixed";
  infoPopup.style.bottom = "auto";
  infoPopup.style.left = "24px";
  infoPopup.style.top = "24px";
  infoPopup.style.padding = "14px 16px";
  infoPopup.style.borderRadius = "12px";
  infoPopup.style.background = "rgba(20,20,20,0.72)";
  infoPopup.style.backdropFilter = "blur(6px)";
  infoPopup.style.color = "#fff";
  infoPopup.style.fontFamily =
    "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  infoPopup.style.fontSize = "16px";
  infoPopup.style.lineHeight = "1.35";
  infoPopup.style.letterSpacing = "0.2px";
  infoPopup.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
  infoPopup.style.opacity = "0";
  infoPopup.style.transform = "translateY(6px)";
  infoPopup.style.transition = "opacity 180ms ease, transform 180ms ease";
  infoPopup.style.pointerEvents = "none";
  infoPopup.style.zIndex = "9999";

  document.body.appendChild(infoPopup);
  return infoPopup;
}

function showProductPopup() {
  const el = ensureInfoPopup();

  el.innerHTML = `
    <div style="font-weight:700; font-size:15px; margin-bottom:6px;">Product Info</div>
    <div><span style="opacity:.75;">Product:</span> Target Company</div>
    <div><span style="opacity:.75;">Honey Kind:</span> Flower Honey</div>
    <div><span style="opacity:.75;">Certificates & Awards:</span> Award-winning raw honey</div>
    <div><span style="opacity:.75;">Volume:</span> 1 Lt</div>
    <div><span style="opacity:.75;">Price:</span> €12</div>
  `;

  el.style.opacity = "1";
  el.style.transform = "translateY(0)";

  clearTimeout(infoPopupTimer);
  infoPopupTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
  }, 7200);
}

// ===================== BEES: SPAWN (VISUAL) ===================
async function spawnBees(count = BEE_COUNT, centerPos = null) {
  if (bees.length) {
    if (centerPos) {
      for (const b of bees) {
        b.mesh.position.x = centerPos.x + Math.cos(b.angle) * b.radius;
        b.mesh.position.z = centerPos.z + Math.sin(b.angle) * b.radius;
        b.mesh.position.y = centerPos.y + b.height;
      }
    }
    return bees;
  }

  const gltf = await loadGLB(ASSETS.bee);

  for (let i = 0; i < count; i++) {
    const bee = cloneGLTFScene(gltf);

    bee.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });

    normalizeModel(bee, 3.5);
    scene.add(bee);

    bees.push({
      mesh: bee,
      angle: (i / count) * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.6,
      radius: 16 + Math.random() * 6,
      height: 12 + Math.random() * 4,
    });
  }

  const c =
    centerPos ||
    (objects.cabin ? objects.cabin.position : new THREE.Vector3(0, 0, 0));

  for (const b of bees) {
    b.mesh.position.set(
      c.x + Math.cos(b.angle) * b.radius,
      c.y + b.height,
      c.z + Math.sin(b.angle) * b.radius
    );
  }

  console.log(`Spawned ${bees.length} bees`);
  return bees;
}

// ===================== PLACE / LOAD OBJECTS ===================
async function ensureCabin() {
  if (objects.cabin) return objects.cabin;

  const gltf = await loadGLB(ASSETS.cabin);
  const cabin = cloneGLTFScene(gltf);

  cabin.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = false;
  });

  doorMesh = null;
  cabin.traverse((o) => {
    if (o.isMesh && DOOR_NAME_REGEX.test(o.name)) doorMesh = o;
  });

  doorMixer = null;
  doorClip = null;
  doorAction = null;
  if (gltf.animations && gltf.animations.length) {
    doorMixer = new THREE.AnimationMixer(cabin);
    doorClip =
      gltf.animations.find(
        (a) => DOOR_NAME_REGEX.test(a.name) || /open/i.test(a.name)
      ) || gltf.animations[0];

    doorAction = doorMixer.clipAction(doorClip);
    doorAction.clampWhenFinished = true;
    doorAction.setLoop(THREE.LoopOnce, 1);

    doorAction.reset();
    doorAction.play();
    doorAction.paused = true;
    doorAction.time = 0;
  }

  normalizeModel(cabin, 25);
  scene.add(cabin);

  objects.cabin = cabin;
  return cabin;
}

async function ensureTableInsideCabin() {
  if (objects.tableInside) return objects.tableInside;
  if (!objects.cabin) await ensureCabin();

  const gltf = await loadGLB(ASSETS.tableInside);
  const table = cloneGLTFScene(gltf);

  table.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  normalizeModel(table, 2.6);
  objects.cabin.add(table);

  table.position.set(2.0, 0.0, -1.5);
  table.rotation.set(0, 0, 0);

  objects.tableInside = table;
  return table;
}

async function ensureHoney(kind) {
  const key = kind;
  if (objects[key]) return objects[key];
  if (!objects.tableInside) await ensureTableInsideCabin();

  const path =
    kind === "honeyPot1"
      ? ASSETS.honeyPot1
      : kind === "honeyPot2"
      ? ASSETS.honeyPot2
      : ASSETS.honeyDipper;

  const gltf = await loadGLB(path);
  const obj = cloneGLTFScene(gltf);

  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  objects.tableInside.add(obj);
  obj.position.set(0, 0.1, 0);
  obj.rotation.set(0, 0, 0);

  objects[key] = obj;
  return obj;
}

async function ensureOutdoor(kind) {
  const key = kind;
  if (objects[key]) return objects[key];

  const path = kind === "picnic" ? ASSETS.picnicTable : ASSETS.bear;
  const gltf = await loadGLB(path);
  const obj = cloneGLTFScene(gltf);

  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  normalizeModel(obj, 12);
  scene.add(obj);

  objects[key] = obj;
  return obj;
}

// ===================== DOOR TOGGLE ============================
function toggleDoor() {
  playOneShot(doorSfxBuffer, 0.55);

  if (doorAction && doorClip) {
    doorIsOpen = !doorIsOpen;

    doorAction.paused = false;
    doorAction.enabled = true;
    doorAction.timeScale = doorIsOpen ? 1 : -1;

    const dur = doorClip.duration;
    if (!doorIsOpen && doorAction.time <= 0.001) doorAction.time = dur;
    if (doorIsOpen && doorAction.time >= dur - 0.001) doorAction.time = 0;

    doorAction.play();
    return true;
  }

  if (!doorMesh) return false;
  doorIsOpen = !doorIsOpen;
  doorMesh.rotation.y = doorIsOpen ? DOOR_OPEN_ANGLE : 0;
  return true;
}

// ===================== SCENE SAVE / LOAD ======================
function getTRS(obj) {
  return {
    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
  };
}

function applyTRS(obj, trs) {
  obj.position.set(trs.position.x, trs.position.y, trs.position.z);
  obj.rotation.set(trs.rotation.x, trs.rotation.y, trs.rotation.z);
  obj.scale.set(trs.scale.x, trs.scale.y, trs.scale.z);
}

function saveSceneState() {
  const state = {
    version: 2,
    objects: [],
    bees: { count: bees.length },
  };

  if (objects.cabin)
    state.objects.push({
      id: "cabin",
      asset: ASSETS.cabin,
      parent: "scene",
      trs: getTRS(objects.cabin),
    });

  if (objects.tableInside)
    state.objects.push({
      id: "tableInside",
      asset: ASSETS.tableInside,
      parent: "cabin",
      trs: getTRS(objects.tableInside),
    });

  if (objects.honeyPot1)
    state.objects.push({
      id: "honeyPot1",
      asset: ASSETS.honeyPot1,
      parent: "tableInside",
      trs: getTRS(objects.honeyPot1),
    });

  if (objects.honeyPot2)
    state.objects.push({
      id: "honeyPot2",
      asset: ASSETS.honeyPot2,
      parent: "tableInside",
      trs: getTRS(objects.honeyPot2),
    });

  if (objects.honeyDipper)
    state.objects.push({
      id: "honeyDipper",
      asset: ASSETS.honeyDipper,
      parent: "tableInside",
      trs: getTRS(objects.honeyDipper),
    });

  if (objects.picnic)
    state.objects.push({
      id: "picnic",
      asset: ASSETS.picnicTable,
      parent: "scene",
      trs: getTRS(objects.picnic),
    });

  if (objects.bear)
    state.objects.push({
      id: "bear",
      asset: ASSETS.bear,
      parent: "scene",
      trs: getTRS(objects.bear),
    });

  localStorage.setItem("sceneStateV2", JSON.stringify(state));
  console.log("Saved sceneStateV2");
}

function exportSceneJSON() {
  saveSceneState();
  const raw = localStorage.getItem("sceneStateV2");
  if (!raw) return;

  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "sceneStateV2.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  console.log("Downloaded sceneStateV2.json");
}

async function loadSceneStateFromFile() {
  try {
    const res = await fetch("assets/sceneStateV2.json");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("No default sceneStateV2.json found");
    return null;
  }
}


async function restoreSceneState() {
let raw = localStorage.getItem("sceneStateV2");

if (!raw) {
  const fileState = await loadSceneStateFromFile();
  if (!fileState) return;
  raw = JSON.stringify(fileState);
  localStorage.setItem("sceneStateV2", raw);
}


  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return;
  }
  if (!state?.objects?.length) return;

  const hasCabin = state.objects.some((o) => o.id === "cabin");
  if (hasCabin) await ensureCabin();

  const cabinEntry = state.objects.find((o) => o.id === "cabin");
  if (cabinEntry && objects.cabin) applyTRS(objects.cabin, cabinEntry.trs);

  const hasTable = state.objects.some((o) => o.id === "tableInside");
  if (hasTable) await ensureTableInsideCabin();

  const tableEntry = state.objects.find((o) => o.id === "tableInside");
  if (tableEntry && objects.tableInside)
    applyTRS(objects.tableInside, tableEntry.trs);

  for (const id of ["honeyPot1", "honeyPot2", "honeyDipper"]) {
    const entry = state.objects.find((o) => o.id === id);
    if (!entry) continue;
    await ensureHoney(id);
    if (objects[id]) applyTRS(objects[id], entry.trs);
  }

  for (const id of ["picnic", "bear"]) {
    const entry = state.objects.find((o) => o.id === id);
    if (!entry) continue;
    await ensureOutdoor(id);
    if (objects[id]) applyTRS(objects[id], entry.trs);
  }

  const beeCount = state?.bees?.count ?? BEE_COUNT;
  await spawnBees(Math.max(beeCount, BEE_COUNT));

  console.log("Restored sceneStateV2");
}

// ===================== INPUT (EDITOR) ==========================
window.addEventListener("keydown", async (e) => {
  if (!audioArmed) startAudio();

  // Editor transforms/tools
  if (e.code === "KeyG") {
    mode = "move";
    console.log("Mode: move");
    return;
  }
  if (e.code === "KeyR") {
    mode = "rotate";
    console.log("Mode: rotate");
    return;
  }
  if (e.code === "KeyS") {
    mode = "scale";
    console.log("Mode: scale");
    return;
  }

  if (e.code === "KeyC") {
    tool = "placeCabin";
    console.log("Tool: place cabin (click terrain)");
    return;
  }
  if (e.code === "KeyT") {
    await ensureTableInsideCabin();
    setSelected(objects.tableInside);
    console.log("Table ensured (selected)");
    return;
  }

  if (e.code === "Digit1") {
    tool = "placeHoneyPot1";
    console.log("Tool: honey pot 1 (click table top)");
    return;
  }
  if (e.code === "Digit2") {
    tool = "placeHoneyPot2";
    console.log("Tool: honey pot 2 (click table top)");
    return;
  }
  if (e.code === "Digit3") {
    tool = "placeHoneyDipper";
    console.log("Tool: honey dipper (click table top)");
    return;
  }

  if (e.code === "KeyB") {
    tool = "placeBear";
    console.log("Tool: bear (click terrain)");
    return;
  }
  if (e.code === "KeyN") {
    tool = "placePicnic";
    console.log("Tool: picnic table (click terrain)");
    return;
  }
  if (e.code === "KeyM") {
    tool = "placeBee";
    console.log("Tool: bees (click terrain for orbit center)");
    return;
  }

  if (e.code === "KeyZ") {
    saveSceneState();
    return;
  }
  if (e.code === "KeyX") {
    exportSceneJSON();
    return;
  }

  // Transform selected
  if (!selected) return;

  const fine = e.shiftKey ? 0.05 : 0.25;
  const rotStep = THREE.MathUtils.degToRad(e.shiftKey ? 1 : 5);
  const sUp = e.shiftKey ? 1.01 : 1.05;
  const sDown = e.shiftKey ? 0.99 : 0.95;

  if (mode === "move") {
    switch (e.code) {
      case "KeyI":
        selected.position.z -= fine;
        break;
      case "KeyK":
        selected.position.z += fine;
        break;
      case "KeyJ":
        selected.position.x -= fine;
        break;
      case "KeyL":
        selected.position.x += fine;
        break;
      case "KeyU":
        selected.position.y += fine;
        break;
      case "KeyO":
        selected.position.y -= fine;
        break;
      default:
        return;
    }
  } else if (mode === "rotate") {
    if (e.code === "KeyF") selected.rotation.y += rotStep;
    else if (e.code === "KeyR") selected.rotation.y -= rotStep;
    else return;
  } else if (mode === "scale") {
    if (e.key === "+" || e.key === "=") selected.scale.multiplyScalar(sUp);
    else if (e.key === "-" || e.key === "_") selected.scale.multiplyScalar(sDown);
    else return;
  }

  updateSelectionBox();
});

// ===================== CLICK HANDLER ==========================
renderer.domElement.addEventListener("pointerdown", async (event) => {
  if (!audioArmed) startAudio();

  // 1) Update terrain hit
  {
    const p = ndcFromEvent(event);
    mouse.set(p.x, p.y);
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(terrainMeshes, true);
    if (hits.length) lastTerrainHit = hits[0].point.clone();
  }

  // 2) Update table hit
  if (objects.tableInside) {
    const p = ndcFromEvent(event);
    mouse.set(p.x, p.y);
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObject(objects.tableInside, true);
    if (hits.length) lastTableHit = hits[0].point.clone();
  }

  // 3) Ctrl+Click on door toggles door
  if (event.ctrlKey && objects.cabin) {
    const p = ndcFromEvent(event);
    mouse.set(p.x, p.y);
    raycaster.setFromCamera(mouse, camera);

    const targets = doorMesh ? [doorMesh] : [objects.cabin];
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length) {
      const ok = toggleDoor();
      if (ok) return;
    }
  }

  // 4) Tool placements
  if (tool === "placeCabin") {
    if (!lastTerrainHit) return;
    const cabin = await ensureCabin();
    cabin.position.copy(lastTerrainHit);
    snapToTerrain(cabin, 0.25);
    faceTowardCameraXZ(cabin);
    setSelected(cabin);
    tool = "select";
    console.log("Cabin placed.");
    return;
  }

  if (tool === "placeBear") {
    if (!lastTerrainHit) return;
    const bear = await ensureOutdoor("bear");
    bear.position.copy(lastTerrainHit);
    snapToTerrain(bear, 0.0);
    setSelected(bear);
    tool = "select";
    console.log("Bear placed.");
    return;
  }

  if (tool === "placePicnic") {
    if (!lastTerrainHit) return;
    const picnic = await ensureOutdoor("picnic");
    picnic.position.copy(lastTerrainHit);
    snapToTerrain(picnic, 0.0);
    setSelected(picnic);
    tool = "select";
    console.log("Picnic placed.");
    return;
  }

  if (tool === "placeBee") {
    if (!lastTerrainHit) return;
    await spawnBees(BEE_COUNT, lastTerrainHit.clone());
    setSelected(bees[0]?.mesh || null);
    tool = "select";
    console.log("Bees spawned/repositioned.");
    return;
  }

  if (tool === "placeHoneyPot1" || tool === "placeHoneyPot2" || tool === "placeHoneyDipper") {
    if (!lastTableHit) {
      console.warn("Click on the TABLE top to place honey items.");
      return;
    }

    const id =
      tool === "placeHoneyPot1"
        ? "honeyPot1"
        : tool === "placeHoneyPot2"
        ? "honeyPot2"
        : "honeyDipper";

    const obj = await ensureHoney(id);
    const local = objects.tableInside.worldToLocal(lastTableHit.clone());
    obj.position.copy(local);
    obj.position.y += 0.02;
    setSelected(obj);

    tool = "select";
    console.log(`${id} placed on table.`);
    return;
  }

  // 5) Selection
  const pickTargets = [];
  for (const key of Object.keys(objects)) {
    if (objects[key]) pickTargets.push(objects[key]);
  }
  for (const b of bees) pickTargets.push(b.mesh);

  if (!pickTargets.length) return;

  const p = ndcFromEvent(event);
  mouse.set(p.x, p.y);
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(pickTargets, true);
  if (!hits.length) return;

  let root = hits[0].object;
  while (
    root &&
    root.parent &&
    root.parent !== scene &&
    root.parent !== terrainRoot &&
    root.parent !== objects.cabin &&
    root.parent !== objects.tableInside
  ) {
    root = root.parent;
  }

  setSelected(root);

  // honeyPot2 click => welcome + popup
  if (objects.honeyPot2) {
    let p2 = root;
    let isHoney2 = false;
    while (p2) {
      if (p2 === objects.honeyPot2) {
        isHoney2 = true;
        break;
      }
      p2 = p2.parent;
    }

    if (isHoney2) {
      playOneShot(welcomeSfxBuffer, 0.75);
      showProductPopup();
    }
  }

  tool = "select";
  console.log("Selected:", root.name || root.uuid);
});

// ===================== LOAD TERRAIN + RESTORE =================
async function init() {
  const terrainGLTF = await loadGLB(ASSETS.terrain);
  const terrain = cloneGLTFScene(terrainGLTF);

  terrainRoot = terrain;
  terrain.traverse((o) => {
    if (o.isMesh) {
      o.receiveShadow = true;
      o.castShadow = false;
    }
  });

  normalizeModel(terrain, 500);
  scene.add(terrain);
  setupTreeWind(terrain);

// everything (for clicking/placing etc.)
collectMeshes(terrain, terrainMeshes, { receiveShadow: true, castShadow: false });

// ONLY ground-like meshes (for height clamp)
collectMeshes(
  terrain,
  groundMeshes,
  { receiveShadow: true, castShadow: false },
  (m) => {
    const n = (m.name || "").toLowerCase();
    const mat = (m.material?.name || "").toLowerCase();

    // ✅ Keep only “terrain/ground” meshes
    // You can tweak these keywords to match your GLB naming.
    const looksGround =
      n.includes("ground") ||
      n.includes("terrain") ||
      n.includes("land") ||
      mat.includes("ground") ||
      mat.includes("terrain") ||
      mat.includes("land");

    return looksGround;
  }
);

// ===== INITIAL CAMERA VIEW (START POINT) =====
const START_POS = new THREE.Vector3(95.31234758140852, 0.2830629616751459, -80.06476356255584);
const START_TARGET = new THREE.Vector3(-52.12391063288498, 20, 53.64021973480991);

camera.position.copy(START_POS);
controls.target.copy(START_TARGET);
controls.update();



console.log("Terrain ready. All meshes:", terrainMeshes.length, "Ground meshes:", groundMeshes.length);


  await restoreSceneState();
  if (!bees.length) await spawnBees(BEE_COUNT);

  async function initAudio() {
    ensureAudioListener();
    forestBuffer = await loadAudioBuffer(ASSETS.forest);
    beeBuffer = await loadAudioBuffer(ASSETS.bees);
    windBuffer = await loadAudioBuffer(ASSETS.wind);
    doorSfxBuffer = await loadAudioBuffer(ASSETS.doorSfx);
    welcomeSfxBuffer = await loadAudioBuffer(ASSETS.welcomeSfx);

    armAudioStart();
    console.log("Audio buffers loaded ✅ (waiting for user gesture)");
  }

  initAudio().catch(err => {
  console.warn("Audio failed to preload:", err);
});

}

let sceneReady = false;

(async () => {
  try {
    await init();
    sceneReady = true;
    console.log("Scene ready ✅");
  } catch (e) {
    console.error("Init failed:", e);
  }
})();


// ===================== ANIMATE ================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  if (!sceneReady) return; // ✅ ONLY ADDITION (prevents black frame / Edge issues)

  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // wind sway
  if (treeSway.length) {
    for (const tr of treeSway) {
      const w1 = Math.sin(t * tr.speed + tr.phase);
      const w2 = Math.sin(t * (tr.speed * 0.7) + tr.phase * 1.7);
      tr.obj.rotation.y = tr.baseRotY + w1 * tr.ampY * 0.9;
      tr.obj.rotation.z = tr.baseRotZ + w2 * tr.ampZ * 1.1;
    }
  }

  // door animation update
  if (doorMixer) doorMixer.update(dt);

  // bees orbit
  if (bees.length) {
    const center = objects.cabin
      ? objects.cabin.position
      : new THREE.Vector3(0, 0, 0);

    for (const b of bees) {
      b.angle += dt * b.speed;
      b.mesh.position.x = center.x + Math.cos(b.angle) * b.radius;
      b.mesh.position.z = center.z + Math.sin(b.angle) * b.radius;
      b.mesh.position.y =
        center.y + b.height + Math.sin(b.angle * 3) * 1.2;
      b.mesh.rotation.y = Math.atan2(
        Math.cos(b.angle),
        -Math.sin(b.angle)
      );
    }
  }

  // orbit movement + controls
  moveOrbitRig(dt);
  controls.update();

  updateSelectionBox();
  updateBeeAudioAnchor();

  renderer.render(scene, camera);
}

animate(); // ✅ only once


// ===================== RESIZE ================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});











