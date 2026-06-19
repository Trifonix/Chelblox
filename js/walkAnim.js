/**
 * Цикл ходьбы: ключевые позы (pose-to-pose) + сжатие/растяжение корпуса.
 * Темп привязан к скорости движения, переход в покой — плавный.
 */

const TORSO_Y = 3;
const HEAD_Y = 4.6;

/** Контакт → опора → перенос → отталкивание (полный цикл 0–1). */
const WALK_KEYS = [
  {
    t: 0,
    leftLeg: -0.38,
    rightLeg: 0.28,
    leftArm: 0.20,
    rightArm: -0.16,
    bob: 0,
    squash: 0.96,
    torsoPitch: 0.03,
    torsoRoll: -0.02,
  },
  {
    t: 0.25,
    leftLeg: -0.06,
    rightLeg: 0.42,
    leftArm: 0.06,
    rightArm: -0.26,
    bob: -0.06,
    squash: 0.91,
    torsoPitch: 0.05,
    torsoRoll: -0.04,
  },
  {
    t: 0.5,
    leftLeg: 0.38,
    rightLeg: -0.28,
    leftArm: -0.20,
    rightArm: 0.16,
    bob: 0,
    squash: 0.96,
    torsoPitch: 0.03,
    torsoRoll: 0.02,
  },
  {
    t: 0.75,
    leftLeg: 0.06,
    rightLeg: -0.42,
    leftArm: -0.06,
    rightArm: 0.26,
    bob: -0.06,
    squash: 0.91,
    torsoPitch: 0.05,
    torsoRoll: 0.04,
  },
];

const CYCLE_PER_SPEED = 0.11;
const WALK_BLEND_IN = 8;
const WALK_BLEND_OUT = 5;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function getWalkState(mesh) {
  if (!mesh.userData.walkState) {
    mesh.userData.walkState = { phase: 0, blend: 0 };
  }
  return mesh.userData.walkState;
}

function samplePose(cycle) {
  let c = ((cycle % 1) + 1) % 1;
  let i = WALK_KEYS.length - 1;
  for (let k = 0; k < WALK_KEYS.length; k++) {
    if (WALK_KEYS[k].t <= c) i = k;
  }

  const a = WALK_KEYS[i];
  const b = WALK_KEYS[(i + 1) % WALK_KEYS.length];
  let span = b.t - a.t;
  if (span <= 0) span += 1;
  let local = c - a.t;
  if (local < 0) local += 1;
  const t = smoothstep(local / span);

  const pose = {};
  for (const key of ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'bob', 'squash', 'torsoPitch', 'torsoRoll']) {
    pose[key] = lerp(a[key], b[key], t);
  }
  return pose;
}

export function markWalking(mesh, speed = 6) {
  mesh.userData.walkMoving = true;
  mesh.userData.walkSpeed = speed;
}

export function updateCharacterWalk(mesh, dt) {
  const parts = mesh.userData.parts;
  if (!parts) return;

  const anim = getWalkState(mesh);
  const moving = Boolean(mesh.userData.walkMoving);
  const speed = mesh.userData.walkSpeed || 0;
  mesh.userData.walkMoving = false;

  const targetBlend = moving ? 1 : 0;
  const blendRate = moving ? WALK_BLEND_IN : WALK_BLEND_OUT;
  anim.blend = lerp(anim.blend, targetBlend, clamp(dt * blendRate, 0, 1));

  if (moving && anim.blend > 0.02) {
    anim.phase += dt * speed * CYCLE_PER_SPEED;
  }

  const pose = moving || anim.blend > 0.001 ? samplePose(anim.phase) : null;
  const b = anim.blend;

  if (!pose || b < 0.001) {
    resetNeutralPose(parts);
    anim.blend = 0;
    return;
  }

  parts.leftLeg.rotation.x = lerp(0, pose.leftLeg, b);
  parts.rightLeg.rotation.x = lerp(0, pose.rightLeg, b);
  parts.leftArm.rotation.x = lerp(0, pose.leftArm, b);
  parts.rightArm.rotation.x = lerp(0, pose.rightArm, b);

  const squashY = lerp(1, pose.squash, b);
  const squashXZ = lerp(1, 1 + (1 - pose.squash) * 0.45, b);
  parts.torso.scale.set(squashXZ, squashY, squashXZ);
  parts.torso.position.y = lerp(TORSO_Y, TORSO_Y + pose.bob, b);
  parts.torso.rotation.x = lerp(0, pose.torsoPitch, b);
  parts.torso.rotation.z = lerp(0, pose.torsoRoll, b);

  const headBob = pose.bob * 0.55;
  parts.head.position.y = lerp(HEAD_Y, HEAD_Y + headBob, b);
}

function resetNeutralPose(parts) {
  parts.leftLeg.rotation.x = 0;
  parts.rightLeg.rotation.x = 0;
  parts.leftArm.rotation.x = 0;
  parts.rightArm.rotation.x = 0;
  parts.torso.rotation.x = 0;
  parts.torso.rotation.z = 0;
  parts.torso.scale.set(1, 1, 1);
  parts.torso.position.y = TORSO_Y;
  parts.head.position.y = HEAD_Y;
}

export function tickWalkAnimations(meshes, dt) {
  for (const mesh of meshes) {
    updateCharacterWalk(mesh, dt);
  }
}

export function getWalkPhase(mesh) {
  return getWalkState(mesh).phase;
}
