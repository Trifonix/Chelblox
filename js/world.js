const DEFAULT_CFG = {
  worldSize: 280,
  roadWidth: 10,
  blockSize: 36,
  playerRadius: 1.1,
};

let cfg = { ...DEFAULT_CFG };
let colliders = [];
let spawnPoints = [];

function isSafe(x, z, r) {
  const lim = cfg.worldSize - 5;
  if (x < -lim || x > lim || z < -lim || z > lim) return false;
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return false;
  }
  return true;
}

function buildSpawnPoints() {
  const half = cfg.worldSize;
  const roads = [];
  for (let i = -half; i <= half; i += cfg.blockSize) roads.push(i);

  const points = [];
  const seen = new Set();
  const add = (x, z) => {
    const key = `${Math.round(x * 10)}:${Math.round(z * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ x, z });
  };

  for (const x of roads) {
    for (const z of roads) add(x, z);
  }

  const margin = cfg.roadWidth / 2 + 1;
  for (const z of roads) {
    for (let x = -half + margin; x <= half - margin; x += 12) add(x, z);
  }
  for (const x of roads) {
    for (let z = -half + margin; z <= half - margin; z += 12) add(x, z);
  }

  return points;
}

export function initSpawnSystem(colliderList, worldConfig = {}) {
  colliders = colliderList;
  cfg = { ...DEFAULT_CFG, ...worldConfig };
  spawnPoints = buildSpawnPoints().filter((p) => isSafe(p.x, p.z, cfg.playerRadius));
}

export function getRandomSpawn(radius = cfg.playerRadius) {
  if (!spawnPoints.length) {
    return { x: 0, z: 0 };
  }

  const shuffled = spawnPoints.slice().sort(() => Math.random() - 0.5);
  for (const p of shuffled) {
    if (isSafe(p.x, p.z, radius)) return { x: p.x, z: p.z };
  }

  for (let i = 0; i < 80; i++) {
    const p = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const x = p.x + (Math.random() - 0.5) * 4;
    const z = p.z + (Math.random() - 0.5) * 4;
    if (isSafe(x, z, radius)) return { x, z };
  }

  return { ...spawnPoints[0] };
}

export function isPositionSafe(x, z, radius = cfg.playerRadius) {
  return isSafe(x, z, radius);
}
