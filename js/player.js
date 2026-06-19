import * as THREE from 'three';
import { INFLUENCE_CONFIG } from './config.js';
import { getTier } from './influence.js';

const SKIN = 0xffcc80;

const OUTFIT_STYLES = [
  { shirt: 0x00b06f, pants: 0x2d3436, hat: 0x0984e3, vest: null, glasses: null },
  { shirt: 0x3498db, pants: 0x2d3436, hat: 0x1a5276, vest: null, glasses: null },
  { shirt: 0x9b59b6, pants: 0x212121, hat: null, vest: 0xf1c40f, glasses: null },
  { shirt: 0xe67e22, pants: 0x212121, hat: null, vest: 0xffd600, glasses: 0x111111 },
  { shirt: 0x2ecc71, pants: 0x1a1a2e, hat: null, vest: 0xc0c0c0, glasses: 0x111111 },
];

function setPartColor(part, color) {
  if (!part?.material) return;
  part.material.color.setHex(color);
}

function clearOutfitExtras(mesh) {
  const extras = mesh.userData.outfitExtras;
  if (!extras) return;
  extras.forEach((obj) => mesh.remove(obj));
  mesh.userData.outfitExtras = [];
}

function addExtra(mesh, extra) {
  if (!mesh.userData.outfitExtras) mesh.userData.outfitExtras = [];
  mesh.add(extra);
  mesh.userData.outfitExtras.push(extra);
}

function outfitBox(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.castShadow = true;
  return m;
}

export function applyOutfit(mesh, tier = null) {
  if (!mesh?.userData?.parts) return tier ?? 0;

  const level = tier ?? getTier('player');
  const style = OUTFIT_STYLES[Math.min(level, OUTFIT_STYLES.length - 1)];
  const parts = mesh.userData.parts;

  setPartColor(parts.torso, style.shirt);
  setPartColor(parts.leftArm, style.shirt);
  setPartColor(parts.rightArm, style.shirt);
  setPartColor(parts.leftLeg, style.pants);
  setPartColor(parts.rightLeg, style.pants);
  setPartColor(parts.head, SKIN);

  clearOutfitExtras(mesh);

  if (style.hat) {
    const hat = outfitBox(1.3, 0.4, 1.3, style.hat);
    hat.position.y = 5.3;
    addExtra(mesh, hat);
  }

  if (style.vest) {
    const vest = outfitBox(2.1, 1.4, 1.15, style.vest);
    vest.position.y = 3.1;
    addExtra(mesh, vest);
  }

  if (style.glasses) {
    const glasses = outfitBox(1.0, 0.2, 0.15, style.glasses);
    glasses.position.set(0, 4.55, 0.62);
    addExtra(mesh, glasses);
  }

  mesh.userData.outfitTier = level;
  return level;
}

export function getOutfitTier(mesh) {
  return mesh?.userData?.outfitTier ?? 0;
}

export function getOutfitThresholds() {
  return [...INFLUENCE_CONFIG.outfitTiers];
}
