import * as THREE from 'three';
import {
  AUTOSAVE_INTERVAL_MS,
  GAME_NAME_RU,
  INFLUENCE_CONFIG,
  SAVE_KEY,
  SPAWN_CONFIG,
} from './config.js';
import {
  addInfluence,
  applyCityEvent,
  getAllInfluence,
  getCityStats,
  getMultiplier,
  getSnapshot,
  getTier,
  initInfluence,
  resetInfluence,
} from './influence.js';
import { applyOutfit, getOutfitTier } from './player.js';
import { loadSettings, saveSettings } from './settings.js';
import { clear, hasSave, load, save } from './storage.js';
import { initInfluenceHUD, updateInfluenceHUD } from './ui.js';
import { getRandomSpawn, initSpawnSystem } from './world.js';

/* ═══════════════════════════════════════════
   ЧелБлокс — Roblox-style city game
   ═══════════════════════════════════════════ */

const $ = (s) => document.querySelector(s);

const CFG = {
  worldSize: 280,
  roadWidth: 10,
  blockSize: 36,
  gravity: 28,
  walkSpeed: 10,
  runSpeed: 18,
  jumpForce: 11,
  camDist: 14,
  camHeight: 5,
  playerRadius: 1.1,
};

const COLORS = {
  skin: 0xffcc80,
  grass: 0x3d9e48,
  road: 0x4a5568,
  houses: [0xe74c3c, 0x9b59b6, 0x3498db, 0x2ecc71, 0xf39c12, 0x1abc9c, 0xe91e63, 0x795548],
};

const state = {
  running: false,
  paused: false,
  score: 0,
  keys: {},
  mouseDown: false,
  pointerLocked: false,
  camYaw: 0,
  camPitch: 0.25,
  sprint: false,
  buildings: [],
  colliders: [],
  npcs: [],
  cars: [],
  lastFire: 0,
  lastCrime: 0,
  lastSave: 0,
};

const SERVICE_NPC_TYPES = new Set(['police', 'firefighter', 'taxi', 'military']);

let npcIdCounter = 0;

let scene, camera, renderer, clock;
let player;
let playerVel = new THREE.Vector3();
let onGround = true;
let playerAnimPhase = 0;
let worldSeed = 1;
let worldRng = null;

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setWorldSeed(seed) {
  worldSeed = (seed >>> 0) || 1;
  worldRng = createRng(worldSeed);
}

function rng() {
  return worldRng ? worldRng() : Math.random();
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

const canvas = $('#game-canvas');
const gameSettings = loadSettings();

function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  if (!gameSettings.lowQuality) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  return m;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function randomPatrolTarget() {
  const pos = getRandomSpawn(0.9);
  return { x: pos.x, z: pos.z };
}

function awardSuccess(serviceType) {
  addInfluence(serviceType, INFLUENCE_CONFIG.servicePerSuccess);
  addInfluence('player', INFLUENCE_CONFIG.playerPerEvent);
}

function onInfluenceChange(snapshot) {
  updateInfluenceHUD(snapshot);
  if (player) applyOutfit(player, snapshot.playerTier);
}

function getNpcSpeed(npc, chased = false) {
  if (npc.type === 'criminal') return chased ? 10 : 7;
  const base = 6;
  if (SERVICE_NPC_TYPES.has(npc.type)) {
    return base * getMultiplier(npc.type);
  }
  return base;
}

function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function createCharacter(opts) {
  const g = new THREE.Group();
  const parts = {};

  parts.leftLeg = box(0.9, 2, 0.9, opts.pants);
  parts.leftLeg.position.set(-0.5, 1, 0);
  parts.rightLeg = box(0.9, 2, 0.9, opts.pants);
  parts.rightLeg.position.set(0.5, 1, 0);

  parts.torso = box(2, 2, 1, opts.shirt);
  parts.torso.position.y = 3;

  parts.leftArm = box(0.8, 2, 0.8, opts.shirt);
  parts.leftArm.position.set(-1.4, 3, 0);
  parts.rightArm = box(0.8, 2, 0.8, opts.shirt);
  parts.rightArm.position.set(1.4, 3, 0);

  parts.head = box(1.2, 1.2, 1.2, opts.skin);
  parts.head.position.y = 4.6;

  if (opts.hat) {
    const hat = box(1.3, 0.4, 1.3, opts.hat);
    hat.position.y = 5.3;
    g.add(hat);
  }
  if (opts.type === 'police') {
    const cap = box(1.3, 0.35, 1.3, 0x1565c0);
    cap.position.y = 5.25;
    g.add(cap);
    const badge = box(0.4, 0.4, 0.1, 0xffd700);
    badge.position.set(0, 3.2, 0.55);
    g.add(badge);
  }
  if (opts.type === 'criminal') {
    const mask = box(1.0, 0.35, 0.15, 0x212121);
    mask.position.set(0, 4.5, 0.55);
    g.add(mask);
  }
  if (opts.type === 'firefighter') {
    const helmet = box(1.35, 0.5, 1.35, 0xffd600);
    helmet.position.y = 5.35;
    g.add(helmet);
  }

  Object.values(parts).forEach((p) => g.add(p));
  g.userData.parts = parts;
  return g;
}

function buildWorld() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.worldSize * 2, CFG.worldSize * 2),
    mat(COLORS.grass)
  );
  ground.rotation.x = -Math.PI / 2;
  if (!gameSettings.lowQuality) ground.receiveShadow = true;
  scene.add(ground);

  if (!gameSettings.lowQuality) {
    const grid = new THREE.GridHelper(CFG.worldSize * 2, 40, 0x2d6a35, 0x358a40);
    grid.position.y = 0.02;
    scene.add(grid);
  }

  const buildingSkip = gameSettings.lowQuality ? 0.38 : 0.2;
  const maxFloorRoll = gameSettings.lowQuality ? 2 : 4;
  const treeCount = gameSettings.lowQuality ? 18 : 40;

  const half = CFG.worldSize;
  const roads = [];
  for (let i = -half; i <= half; i += CFG.blockSize) roads.push(i);

  roads.forEach((coord) => {
    const rh = box(CFG.worldSize * 2, 0.15, CFG.roadWidth, COLORS.road);
    rh.position.set(0, 0.08, coord);
    scene.add(rh);

    const rv = box(CFG.roadWidth, 0.15, CFG.worldSize * 2, COLORS.road);
    rv.position.set(coord, 0.08, 0);
    scene.add(rv);
  });

  let ci = 0;
  for (let x = -half + CFG.blockSize; x < half - CFG.blockSize / 2; x += CFG.blockSize) {
    for (let z = -half + CFG.blockSize; z < half - CFG.blockSize / 2; z += CFG.blockSize) {
      const nearRoad = roads.some((r) => Math.abs(x - r) < CFG.roadWidth + 6 || Math.abs(z - r) < CFG.roadWidth + 6);
      if (!nearRoad) continue;
      if (rng() < buildingSkip) continue;

      const bx = x + (rng() - 0.5) * 8;
      const bz = z + (rng() - 0.5) * 8;
      const bw = 10 + rng() * 8;
      const bd = 10 + rng() * 8;
      const floors = 2 + Math.floor(rng() * maxFloorRoll);
      const bh = floors * 4 + 2;
      const color = COLORS.houses[ci++ % COLORS.houses.length];

      const building = new THREE.Group();
      const body = box(bw, bh, bd, color);
      body.position.y = bh / 2;
      building.add(body);

      const roof = box(bw + 0.6, 0.8, bd + 0.6, darken(color, 30));
      roof.position.y = bh + 0.4;
      building.add(roof);

      if (!gameSettings.lowQuality) {
        for (let f = 1; f <= floors; f++) {
          for (const wx of [-1, 1]) {
            for (const wz of [-1, 1]) {
              if (rng() < 0.35) continue;
              const win = box(1.8, 2, 0.2, rng() > 0.6 ? 0xfff9c4 : 0x37474f);
              win.position.set(wx * (bw / 2 - 0.5), f * 4 - 1, wz * (bd / 2));
              building.add(win);
            }
          }
        }
      }

      building.position.set(bx, 0, bz);
      scene.add(building);

      state.buildings.push({
        id: `b-${state.buildings.length}`,
        mesh: building,
        x: bx,
        z: bz,
        height: bh,
        onFire: false,
        fireGroup: null,
      });
      state.colliders.push({
        minX: bx - bw / 2 - 1,
        maxX: bx + bw / 2 + 1,
        minZ: bz - bd / 2 - 1,
        maxZ: bz + bd / 2 + 1,
      });
    }
  }

  for (let i = 0; i < treeCount; i++) {
    const tx = (rng() - 0.5) * CFG.worldSize * 1.6;
    const tz = (rng() - 0.5) * CFG.worldSize * 1.6;
    const tree = new THREE.Group();
    const trunk = box(1.2, 3, 1.2, 0x5d4037);
    trunk.position.y = 1.5;
    const leaves = box(4, 4, 4, 0x2e7d32);
    leaves.position.y = 5;
    tree.add(trunk, leaves);
    tree.position.set(tx, 0, tz);
    scene.add(tree);
    state.colliders.push({ minX: tx - 1, maxX: tx + 1, minZ: tz - 1, maxZ: tz + 1 });
  }
}

function darken(hex, amt) {
  const r = ((hex >> 16) & 255) - amt;
  const g = ((hex >> 8) & 255) - amt;
  const b = (hex & 255) - amt;
  return (Math.max(0, r) << 16) | (Math.max(0, g) << 8) | Math.max(0, b);
}

function createCar(color, path, speed) {
  const g = new THREE.Group();
  const body = box(4, 1.5, 7, color);
  body.position.y = 1.2;
  const cabin = box(3.2, 1.4, 3.5, darken(color, 20));
  cabin.position.set(0, 2.3, -0.3);
  const w1 = box(0.8, 0.8, 0.8, 0x111111);
  w1.position.set(-1.8, 0.8, 2.2);
  const w2 = w1.clone();
  w2.position.x = 1.8;
  const w3 = w1.clone();
  w3.position.z = -2.2;
  const w4 = w3.clone();
  w4.position.x = 1.8;
  g.add(body, cabin, w1, w2, w3, w4);

  if (color === 0xffffff) {
    const siren1 = box(0.6, 0.4, 0.6, 0xf44336);
    siren1.position.set(-0.5, 3.2, 0);
    const siren2 = box(0.6, 0.4, 0.6, 0x2196f3);
    siren2.position.set(0.5, 3.2, 0);
    g.add(siren1, siren2);
  }

  g.position.copy(path[0]);
  scene.add(g);
  state.cars.push({ mesh: g, path, idx: 0, t: 0, speed });
}

function setupCars() {
  const mkPath = (a, b) => [new THREE.Vector3(a[0], 0, a[1]), new THREE.Vector3(b[0], 0, b[1])];
  createCar(0xffffff, mkPath([-120, 0], [120, 0]), 0.15);
  createCar(0xf1c40f, mkPath([120, 40], [-120, 40]), 0.12);
  createCar(0xe74c3c, mkPath([0, -120], [0, 120]), 0.14);
  createCar(0x3498db, mkPath([-80, -120], [-80, 120]), 0.13);
  createCar(0xf1c40f, mkPath([-120, -40], [120, -40]), 0.11);
  createCar(0x9b59b6, mkPath([80, 120], [80, -120]), 0.15);
}

function nextNpcId(type) {
  npcIdCounter += 1;
  return `${type}-${npcIdCounter}`;
}

function spawnNPC(type, x, z, saved = {}) {
  const configs = {
    police: { shirt: 0x1565c0, pants: 0x212121, skin: COLORS.skin, type: 'police' },
    criminal: { shirt: 0x424242, pants: 0x212121, skin: COLORS.skin, type: 'criminal' },
    firefighter: { shirt: 0xe65100, pants: 0x212121, skin: COLORS.skin, type: 'firefighter' },
    civilian: {
      shirt: COLORS.houses[Math.floor(Math.random() * COLORS.houses.length)],
      pants: 0x37474f,
      skin: COLORS.skin,
    },
  };
  const mesh = createCharacter(configs[type]);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const npc = {
    id: saved.id || nextNpcId(type),
    type,
    mesh,
    x,
    z,
    speed: type === 'criminal' ? 7 : 6,
    target: null,
    state: saved.state || 'idle',
    timer: saved.timer ?? Math.floor(Math.random() * 30) + 5,
    arrested: saved.arrested || false,
    fightTimer: 0,
    animPhase: 0,
  };
  state.npcs.push(npc);
  return npc;
}

function initNPCsRandom() {
  for (const [type, cfg] of Object.entries(SPAWN_CONFIG)) {
    const count = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));
    for (let i = 0; i < count; i++) {
      const pos = getRandomSpawn(0.9);
      spawnNPC(type, pos.x, pos.z);
    }
  }
}

function restoreNPCs(savedNpcs) {
  savedNpcs.forEach((data) => {
    if (!data.type || data.arrested) return;
    const unstable = ['going', 'fighting', 'chase', 'patrol'];
    const npcState = unstable.includes(data.state) ? 'idle' : data.state;
    const timer = npcState === 'idle' ? 5 : data.timer;
    spawnNPC(data.type, data.x, data.z, { ...data, state: npcState, timer });
  });
}

function canMove(x, z, r = CFG.playerRadius) {
  const lim = CFG.worldSize - 5;
  if (x < -lim || x > lim || z < -lim || z > lim) return false;
  for (const c of state.colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return false;
  }
  return true;
}

function startFire(building, silent = false) {
  if (building.onFire) return;
  building.onFire = true;

  const fg = new THREE.Group();
  const light = new THREE.PointLight(0xff6600, 2, 30);
  light.position.y = building.height + 2;
  fg.add(light);

  for (let i = 0; i < 6; i++) {
    const flame = box(1.5 + Math.random(), 2 + Math.random() * 2, 1.5 + Math.random(), 0xff5722);
    flame.position.set((Math.random() - 0.5) * 4, building.height + 1 + Math.random(), (Math.random() - 0.5) * 4);
    flame.userData.baseY = flame.position.y;
    flame.userData.phase = Math.random() * Math.PI * 2;
    fg.add(flame);
  }
  building.mesh.add(fg);
  building.fireGroup = fg;

  if (!silent) {
    GameAudio.fire();
    GameAudio.alert();
    notify('Пожар на здании! Нажми 2 или кнопку «Пожарные»', 'warn');
    pulseBtn('#btn-fire');
    applyCityEvent('fireSafety', -8);
    assignFirefighter(building);
    persistGame();
  }
}

function extinguishFire(building) {
  if (!building.onFire) return;
  building.onFire = false;
  if (building.fireGroup) {
    building.mesh.remove(building.fireGroup);
    building.fireGroup = null;
  }
  addScore(15);
  GameAudio.water();
  GameAudio.star();
  notify('Пожар потушен! +15 очков', 'ok');
  awardSuccess('firefighter');
  persistGame();
}

function assignFirefighter(building) {
  const free = state.npcs.filter((n) => n.type === 'firefighter' && n.state !== 'fighting');
  if (!free.length) return;
  const ff = free.reduce((a, b) => (dist2d(a, building) < dist2d(b, building) ? a : b));
  ff.target = building;
  ff.state = 'going';
}

function spawnCriminal() {
  const active = state.npcs.filter((n) => n.type === 'criminal' && !n.arrested);
  if (active.length >= 5) return;
  const pos = getRandomSpawn(0.9);
  spawnNPC('criminal', pos.x, pos.z);
  GameAudio.alert();
  notify('Преступник в городе! Нажми 1 или «Полиция»', 'warn');
  pulseBtn('#btn-police');
  applyCityEvent('order', -6);
}

function arrestCriminal(npc, police) {
  if (npc.arrested) return;
  npc.arrested = true;
  npc.state = 'arrested';
  addScore(20);
  GameAudio.arrest();
  GameAudio.siren();
  notify('Преступник арестован! +20 очков', 'ok');
  awardSuccess('police');

  setTimeout(() => {
    scene.remove(npc.mesh);
    state.npcs = state.npcs.filter((n) => n !== npc);
  }, 2500);

  if (police) {
    police.state = 'idle';
    police.target = null;
    police.timer = 80;
  }
  persistGame();
}

function setWalkAnim(mesh, walking, phase = 0) {
  const p = mesh.userData.parts;
  if (!p) return;
  if (walking) {
    const s = Math.sin(phase * 10) * 0.5;
    p.leftLeg.rotation.x = s;
    p.rightLeg.rotation.x = -s;
    p.leftArm.rotation.x = -s;
    p.rightArm.rotation.x = s;
  } else {
    p.leftLeg.rotation.x = 0;
    p.rightLeg.rotation.x = 0;
    p.leftArm.rotation.x = 0;
    p.rightArm.rotation.x = 0;
  }
}

function moveNPC(npc, tx, tz, dt) {
  const dx = tx - npc.x;
  const dz = tz - npc.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.5) {
    setWalkAnim(npc.mesh, false);
    return true;
  }

  const chased = npc.type === 'criminal'
    && state.npcs.some((p) => p.type === 'police' && p.state === 'chase' && p.target === npc);
  npc.speed = getNpcSpeed(npc, chased);

  const step = Math.min(npc.speed * dt, d);
  const nx = npc.x + (dx / d) * step;
  const nz = npc.z + (dz / d) * step;
  const oldX = npc.x;
  const oldZ = npc.z;

  if (canMove(nx, nz, 0.9)) {
    npc.x = nx;
    npc.z = nz;
  }

  const moved = npc.x !== oldX || npc.z !== oldZ;
  npc.mesh.position.set(npc.x, 0, npc.z);
  npc.mesh.rotation.y = Math.atan2(dx, dz);

  if (moved) {
    npc.animPhase = (npc.animPhase ?? 0) + dt * 10;
    setWalkAnim(npc.mesh, true, npc.animPhase);
  } else {
    setWalkAnim(npc.mesh, false);
  }
  return false;
}

function updateNPCs(dt) {
  state.npcs.forEach((npc) => {
    if (npc.arrested) return;
    if (npc.type === 'police') updatePolice(npc, dt);
    else if (npc.type === 'criminal') updateCriminal(npc, dt);
    else if (npc.type === 'firefighter') updateFirefighter(npc, dt);
    else updateCivilian(npc, dt);
  });
}

function updatePolice(npc, dt) {
  if (npc.timer > 0) {
    npc.timer--;
    return;
  }

  if (npc.state === 'idle' || !npc.target || npc.target.arrested) {
    const criminals = state.npcs.filter((n) => n.type === 'criminal' && !n.arrested);
    if (criminals.length) {
      npc.target = criminals.reduce((a, b) => (dist2d(npc, a) < dist2d(npc, b) ? a : b));
      npc.state = 'chase';
    } else {
      npc.target = randomPatrolTarget();
      npc.state = 'patrol';
    }
  }

  if (npc.state === 'chase' && npc.target && !npc.target.arrested) {
    if (dist2d(npc, npc.target) < 3) {
      arrestCriminal(npc.target, npc);
      return;
    }
    if (Math.random() < 0.01) GameAudio.siren();
    moveNPC(npc, npc.target.x, npc.target.z, dt);
    return;
  }

  const t = npc.target;
  if (t && moveNPC(npc, t.x, t.z, dt)) npc.state = 'idle';
}

function updateCriminal(npc, dt) {
  npc.timer--;
  if (npc.timer <= 0) {
    npc.target = randomPatrolTarget();
    npc.timer = 60 + Math.random() * 80;
  }
  if (npc.target) {
    if (moveNPC(npc, npc.target.x, npc.target.z, dt)) npc.target = null;
  }
}

function updateFirefighter(npc, dt) {
  if (npc.state === 'idle') {
    npc.timer--;
    if (npc.timer <= 0) {
      npc.target = randomPatrolTarget();
      npc.state = 'patrol';
      npc.timer = 80;
    }
    return;
  }

  if (npc.state === 'going' && npc.target) {
    if (dist2d(npc, npc.target) < 8) {
      npc.state = 'fighting';
      npc.fightTimer = Math.max(30, Math.floor(100 / getMultiplier('firefighter')));
      return;
    }
    moveNPC(npc, npc.target.x, npc.target.z, dt);
    return;
  }

  if (npc.state === 'fighting') {
    npc.fightTimer--;
    if (Math.random() < 0.05) GameAudio.water();
    if (npc.fightTimer <= 0) {
      if (npc.target && npc.target.onFire) extinguishFire(npc.target);
      npc.target = null;
      npc.state = 'idle';
      npc.timer = 40;
    }
    return;
  }

  if (npc.state === 'patrol' && npc.target) {
    if (moveNPC(npc, npc.target.x, npc.target.z, dt)) npc.state = 'idle';
  }
}

function updateCivilian(npc, dt) {
  npc.timer--;
  if (npc.timer <= 0) {
    npc.target = randomPatrolTarget();
    npc.timer = 80 + Math.random() * 100;
  }
  if (npc.target && moveNPC(npc, npc.target.x, npc.target.z, dt)) npc.target = null;
}

function updateCars() {
  state.cars.forEach((car) => {
    const from = car.path[car.idx];
    const to = car.path[(car.idx + 1) % car.path.length];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    car.t += car.speed / len;

    if (car.t >= 1) {
      car.t = 0;
      car.idx = (car.idx + 1) % car.path.length;
      if (Math.random() < 0.02) GameAudio.honk();
    }

    const f = car.path[car.idx];
    const t = car.path[(car.idx + 1) % car.path.length];
    car.mesh.position.x = f.x + (t.x - f.x) * car.t;
    car.mesh.position.z = f.z + (t.z - f.z) * car.t;
    car.mesh.rotation.y = Math.atan2(t.x - f.x, t.z - f.z);
  });
}

function animateFires(t) {
  state.buildings.forEach((b) => {
    if (!b.fireGroup) return;
    b.fireGroup.children.forEach((c, i) => {
      if (i === 0) return;
      c.position.y = c.userData.baseY + Math.sin(t * 5 + c.userData.phase) * 0.4;
      c.scale.y = 1 + Math.sin(t * 8 + c.userData.phase) * 0.2;
    });
  });
}

function updateEvents() {
  const now = performance.now();
  if (now - state.lastFire > 14000 + Math.random() * 6000) {
    const free = state.buildings.filter((b) => !b.onFire);
    if (free.length) {
      startFire(free[Math.floor(Math.random() * free.length)]);
      state.lastFire = now;
    }
  }
  if (now - state.lastCrime > 16000 + Math.random() * 8000) {
    spawnCriminal();
    state.lastCrime = now;
  }
  updateMissionUI();
}

function initPlayer(pos, savedPlayer = {}) {
  player = createCharacter({ shirt: 0x00b06f, pants: 0x2d3436, skin: COLORS.skin });
  const valid = pos && Number.isFinite(pos.x) && Number.isFinite(pos.z);
  if (valid) {
    player.position.set(pos.x, pos.y ?? 0, pos.z);
  } else {
    const spawn = getRandomSpawn();
    player.position.set(spawn.x, 0, spawn.z);
  }
  scene.add(player);
  const tier = savedPlayer.outfitTier ?? getTier('player');
  applyOutfit(player, tier);
}

function collectGameState() {
  const snapshot = getSnapshot();
  return {
    worldSeed,
    influence: snapshot.influence,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotationY: player.rotation.y,
      outfitTier: snapshot.playerTier,
      isMilitary: false,
    },
    npcs: state.npcs.map((n) => ({
      id: n.id,
      type: n.type,
      x: n.x,
      z: n.z,
      state: n.state,
      arrested: n.arrested,
      timer: n.timer,
    })),
    events: state.buildings
      .filter((b) => b.onFire)
      .map((b) => ({ id: `fire-${b.id}`, type: 'fire', buildingId: b.id })),
    cityStats: snapshot.cityStats,
    score: state.score,
    camYaw: state.camYaw,
    camPitch: state.camPitch,
    lastFire: state.lastFire,
    lastCrime: state.lastCrime,
  };
}

function persistGame(force = false) {
  if (sessionStorage.getItem('chelblox_restarting')) return;
  if (sessionStorage.getItem('chelblox_settings_reload')) return;
  if (!force && !state.running) return;
  if (!player) return;
  save(collectGameState());
  state.lastSave = performance.now();
}

function applySave(data) {
  initInfluence(data, onInfluenceChange);
  state.score = data.score ?? 0;
  state.camYaw = data.camYaw ?? 0;
  state.camPitch = data.camPitch ?? 0.25;
  state.lastFire = data.lastFire ?? performance.now();
  state.lastCrime = data.lastCrime ?? performance.now() - 8000;

  $('#score').textContent = state.score;

  const savedNpcs = data.npcs || [];
  const maxId = savedNpcs.reduce((max, n) => {
    const match = n.id?.match(/-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  npcIdCounter = maxId;

  initPlayer(data.player, data.player);
  if (data.player?.rotationY != null) player.rotation.y = data.player.rotationY;
  restoreNPCs(savedNpcs);
  snapCamera();

  (data.events || []).forEach((event) => {
    if (event.type !== 'fire') return;
    const building = state.buildings.find((b) => b.id === event.buildingId);
    if (building) {
      startFire(building, true);
      assignFirefighter(building);
    }
  });
}

function doJump() {
  if (onGround) {
    playerVel.y = CFG.jumpForce;
    onGround = false;
    GameAudio.jump();
  }
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw));
  const right = new THREE.Vector3(Math.cos(state.camYaw), 0, -Math.sin(state.camYaw));

  let mx = 0;
  let mz = 0;
  if (state.keys.KeyW || state.keys.ArrowUp) { mx += forward.x; mz += forward.z; }
  if (state.keys.KeyS || state.keys.ArrowDown) { mx -= forward.x; mz -= forward.z; }
  if (state.keys.KeyA || state.keys.ArrowLeft) { mx -= right.x; mz -= right.z; }
  if (state.keys.KeyD || state.keys.ArrowRight) { mx += right.x; mz += right.z; }

  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    const spd = (state.sprint || state.keys.ShiftLeft || state.keys.ShiftRight) ? CFG.runSpeed : CFG.walkSpeed;
    const nx = player.position.x + mx * spd * dt;
    const nz = player.position.z + mz * spd * dt;
    if (canMove(nx, player.position.z)) player.position.x = nx;
    if (canMove(player.position.x, nz)) player.position.z = nz;
    player.rotation.y = Math.atan2(mx, mz);
    setWalkAnim(player, true, playerAnimPhase);
    playerAnimPhase += dt * ((state.sprint || state.keys.ShiftLeft) ? 14 : 10);
    if (Math.random() < 0.05) GameAudio.step();
  } else {
    setWalkAnim(player, false);
  }

  playerVel.y -= CFG.gravity * dt;
  player.position.y += playerVel.y * dt;
  if (player.position.y <= 0) {
    player.position.y = 0;
    playerVel.y = 0;
    onGround = true;
  }

  updateCamera();
}

function updateCamera() {
  const px = player.position.x;
  const py = player.position.y;
  const pz = player.position.z;
  const pitch = state.camPitch;
  const yaw = state.camYaw;

  const cx = px + Math.sin(yaw) * Math.cos(pitch) * CFG.camDist;
  const cy = py + CFG.camHeight + Math.sin(pitch) * CFG.camDist;
  const cz = pz + Math.cos(yaw) * Math.cos(pitch) * CFG.camDist;

  camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.15);
  camera.lookAt(px, py + 3, pz);
}

function snapCamera() {
  if (!player || !camera) return;
  const px = player.position.x;
  const py = player.position.y;
  const pz = player.position.z;
  const pitch = state.camPitch;
  const yaw = state.camYaw;

  const cx = px + Math.sin(yaw) * Math.cos(pitch) * CFG.camDist;
  const cy = py + CFG.camHeight + Math.sin(pitch) * CFG.camDist;
  const cz = pz + Math.cos(yaw) * Math.cos(pitch) * CFG.camDist;

  camera.position.set(cx, cy, cz);
  camera.lookAt(px, py + 3, pz);
}

function callPolice() {
  GameAudio.button();
  const criminals = state.npcs.filter((n) => n.type === 'criminal' && !n.arrested);
  if (!criminals.length) {
    spawnCriminal();
    return;
  }
  state.npcs.filter((n) => n.type === 'police').forEach((p, i) => {
    if (criminals[i]) {
      p.target = criminals[i];
      p.state = 'chase';
    }
  });
  GameAudio.siren();
  notify('Полиция выехала на задание', 'info');
}

function callFirefighters() {
  GameAudio.button();
  const burning = state.buildings.filter((b) => b.onFire);
  if (!burning.length) {
    const free = state.buildings.filter((b) => !b.onFire);
    if (free.length) startFire(free[Math.floor(Math.random() * free.length)]);
    return;
  }
  burning.forEach((b) => assignFirefighter(b));
  notify('Пожарные направлены к пожару', 'info');
}

function notify(text, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  $('#notifications').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function addScore(n) {
  state.score += n;
  $('#score').textContent = state.score;
}

function updateMissionUI() {
  const crimes = state.npcs.filter((n) => n.type === 'criminal' && !n.arrested).length;
  const fires = state.buildings.filter((b) => b.onFire).length;
  $('#crime-count').textContent = `${crimes} активных`;
  $('#fire-count').textContent = `${fires} активных`;
  $('#mission-crime').classList.toggle('alert', crimes > 0);
  $('#mission-fire').classList.toggle('alert', fires > 0);
}

function pulseBtn(sel) {
  const b = $(sel);
  b.classList.add('pulse');
  setTimeout(() => b.classList.remove('pulse'), 4000);
}

function flashBtn(sel) {
  const b = $(sel);
  b.classList.add('active');
  setTimeout(() => b.classList.remove('active'), 200);
}

function syncSettingsUI() {
  document.querySelectorAll('.setting-low-quality').forEach((el) => {
    el.checked = gameSettings.lowQuality;
  });
}

function onLowQualityToggle(checked) {
  if (checked === gameSettings.lowQuality) return;
  saveSettings({ lowQuality: checked });
  sessionStorage.setItem('chelblox_settings_reload', '1');
  location.reload();
}

function setupSettingsUI() {
  syncSettingsUI();
  document.querySelectorAll('.setting-low-quality').forEach((el) => {
    el.addEventListener('change', (e) => onLowQualityToggle(e.target.checked));
  });
}

function setupInput() {
  setupSettingsUI();
  window.addEventListener('keydown', (e) => {
    state.keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); doJump(); }
    if (e.code === 'Digit1') callPolice();
    if (e.code === 'Digit2') callFirefighters();
    if (e.code === 'KeyC') {
      state.camYaw = player ? player.rotation.y : 0;
      state.camPitch = 0.25;
      GameAudio.button();
    }
    if (e.code === 'Escape') {
      if (state.pointerLocked) document.exitPointerLock();
      else togglePause();
    }
  });
  window.addEventListener('keyup', (e) => { state.keys[e.code] = false; });

  let lastMX = 0;
  let lastMY = 0;
  canvas.addEventListener('mousedown', (e) => {
    if (!state.running || state.paused) return;
    state.mouseDown = true;
    lastMX = e.clientX;
    lastMY = e.clientY;
    if (!state.pointerLocked) canvas.requestPointerLock();
  });
  window.addEventListener('mouseup', () => { state.mouseDown = false; });

  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    canvas.classList.toggle('locked', state.pointerLocked);
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.running || state.paused) return;
    if (state.pointerLocked) {
      state.camYaw -= e.movementX * 0.003;
      state.camPitch = clamp(state.camPitch + e.movementY * 0.003, -0.3, 1.0);
    } else if (state.mouseDown) {
      state.camYaw -= (e.clientX - lastMX) * 0.005;
      state.camPitch = clamp(state.camPitch + (e.clientY - lastMY) * 0.005, -0.3, 1.0);
      lastMX = e.clientX;
      lastMY = e.clientY;
    }
  });

  $('#btn-play').addEventListener('click', startGame);
  $('#btn-police').addEventListener('click', callPolice);
  $('#btn-fire').addEventListener('click', callFirefighters);
  $('#btn-jump').addEventListener('click', () => { doJump(); flashBtn('#btn-jump'); });
  $('#btn-sprint').addEventListener('mousedown', () => { state.sprint = true; flashBtn('#btn-sprint'); });
  $('#btn-sprint').addEventListener('mouseup', () => { state.sprint = false; });
  $('#btn-sprint').addEventListener('mouseleave', () => { state.sprint = false; });
  $('#btn-camera').addEventListener('click', () => {
    state.camYaw = player ? player.rotation.y : 0;
    state.camPitch = 0.25;
    GameAudio.button();
    flashBtn('#btn-camera');
    notify('Камера сброшена', 'info');
  });
  $('#btn-sound').addEventListener('click', () => {
    const muted = GameAudio.toggle();
    $('#btn-sound').textContent = muted ? '🔇' : '🔊';
    GameAudio.button();
  });
  $('#btn-help').addEventListener('click', () => { $('#overlay-help').classList.remove('hidden'); GameAudio.button(); });
  $('#btn-help-close').addEventListener('click', () => { $('#overlay-help').classList.add('hidden'); GameAudio.button(); });
  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-resume').addEventListener('click', () => { togglePause(false); GameAudio.button(); });
  $('#btn-restart').addEventListener('click', () => {
    sessionStorage.setItem('chelblox_restarting', '1');
    clear();
    location.reload();
  });

  window.addEventListener('resize', onResize);
}

function showLoading() {
  document.documentElement.classList.add('game-loading');
  $('#overlay-start').classList.add('hidden');
  $('#overlay-loading').classList.remove('hidden');
}

function hideLoading() {
  document.documentElement.classList.remove('game-loading');
  $('#overlay-loading').classList.add('hidden');
}

function showStartScreen() {
  document.documentElement.classList.remove('game-loading');
  $('#overlay-loading').classList.add('hidden');
  $('#overlay-start').classList.remove('hidden');
}

function hideAllOverlays() {
  document.documentElement.classList.remove('game-loading');
  $('#overlay-start').classList.add('hidden');
  $('#overlay-loading').classList.add('hidden');
}

function togglePause(force) {
  state.paused = force !== undefined ? force : !state.paused;
  $('#overlay-pause').classList.toggle('hidden', !state.paused);
  if (state.paused && state.pointerLocked) document.exitPointerLock();
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 80, 350);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 500);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: !gameSettings.lowQuality });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    gameSettings.lowQuality ? 1 : Math.min(window.devicePixelRatio, 2),
  );
  renderer.shadowMap.enabled = !gameSettings.lowQuality;
  if (!gameSettings.lowQuality) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
  sun.position.set(80, 120, 60);
  if (!gameSettings.lowQuality) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
  }
  scene.add(sun);

  clock = new THREE.Clock();
  buildWorld();
  initSpawnSystem(state.colliders, {
    worldSize: CFG.worldSize,
    roadWidth: CFG.roadWidth,
    blockSize: CFG.blockSize,
    playerRadius: CFG.playerRadius,
  });
  setupCars();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function startGame(opts = {}) {
  const { resumed = false } = opts;

  if (!resumed) {
    initPlayer();
    initNPCsRandom();
    snapCamera();
  }

  state.running = true;
  if (!resumed) {
    state.lastFire = performance.now();
    state.lastCrime = performance.now() - 8000;
  }
  state.lastSave = performance.now();

  hideAllOverlays();

  GameAudio.init();
  GameAudio.startMusic();
  canvas.requestPointerLock();
  animate();

  if (resumed) notify('Сессия восстановлена', 'info');
  else notify(`Добро пожаловать в ${GAME_NAME_RU}!`, 'ok');

  persistGame(true);
}

function animate() {
  requestAnimationFrame(animate);
  if (!state.running || state.paused) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateNPCs(dt);
  updateCars();
  updateEvents();
  animateFires(clock.elapsedTime);
  renderer.render(scene, camera);

  const now = performance.now();
  if (now - state.lastSave >= AUTOSAVE_INTERVAL_MS) persistGame();
}

function registerSaveHandlers() {
  const flush = () => persistGame(true);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

async function bootstrap() {
  setupInput();
  registerSaveHandlers();
  exposeTestApi();
  sessionStorage.removeItem('chelblox_restarting');
  sessionStorage.removeItem('chelblox_settings_reload');

  initInfluenceHUD();
  initInfluence({}, onInfluenceChange);

  let saved = null;
  const savedSession = hasSave();

  if (savedSession) {
    showLoading();
    await waitForPaint();
    saved = load();
    if (saved) setWorldSeed(saved.worldSeed);
    else setWorldSeed((Math.random() * 0x7fffffff) | 0);
  } else {
    showStartScreen();
    setWorldSeed((Math.random() * 0x7fffffff) | 0);
  }

  initScene();
  onResize();

  if (savedSession) {
    if (saved) {
      applySave(saved);
      hideLoading();
      startGame({ resumed: true });
      return;
    }
    clear();
    hideLoading();
    showStartScreen();
  }
}

function exposeTestApi() {
  if (!new URLSearchParams(location.search).has('e2e')) return;

  window.__CHELBLOX_TEST__ = {
    isRunning: () => state.running,
    getPlayerPosition: () => (
      player
        ? { x: player.position.x, y: player.position.y, z: player.position.z, rotationY: player.rotation.y }
        : null
    ),
    getNpcs: () => state.npcs.map((n) => ({ id: n.id, type: n.type, x: n.x, z: n.z })),
    getNpcCounts: () => state.npcs.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {}),
    getWorldSeed: () => worldSeed,
    getSpawnConfig: () => ({ ...SPAWN_CONFIG }),
    isPositionSafe: (x, z, r = CFG.playerRadius) => canMove(x, z, r),
    flushSave: () => persistGame(true),
    getLocalSave: () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    getScore: () => state.score,
    getInfluence: () => getAllInfluence(),
    getCityStats: () => getCityStats(),
    getOutfitTier: () => (player ? getOutfitTier(player) : 0),
    getNpcAnimPhases: () => state.npcs.map((n) => ({ id: n.id, phase: n.animPhase ?? 0 })),
    getMultiplier: (type) => getMultiplier(type),
    addInfluence: (type, amount) => addInfluence(type, amount),
    getSettings: () => ({ ...gameSettings }),
  };
}

bootstrap();
