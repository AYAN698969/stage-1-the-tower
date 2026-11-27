/** Shared PBR materials and canvas-generated textures (no downloaded textures). */
import * as THREE from 'three';

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 0.6 m floor tiles, world-scale UV (1 UV unit = 1 m). */
function floorTileTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#C9BFA9'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#B3A78D'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.03)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 30, 30);
  }, 1, 1);
}

function roadTexture() {
  return canvasTex(512, 128, (g) => {
    g.fillStyle = '#4A4A4D'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 512, Math.random() * 128, 4, 2);
    g.fillStyle = '#6B5B4A';
    g.fillRect(0, 0, 512, 8); g.fillRect(0, 120, 512, 8); // dusty edges
    g.fillStyle = '#E8D44D';
    for (let x = 0; x < 512; x += 64) g.fillRect(x, 62, 32, 4); // centre dashes
  });
}

function paverTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#B9AFA0'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#9C917F'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
    }
  });
}

function grassTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#5E8F3E'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#6FA344';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 4);
  });
}

function bathTileTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#BFD4D6'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#9FBEC2'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
    }
  });
}

/** Text sign: Bangla line + English line on a coloured board. */
export function signTexture(text, sub, bg = '#1F6F3B', fg = '#FFFFFF') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = fg; g.textAlign = 'center';
  g.font = 'bold 72px sans-serif'; g.fillText(text, 256, 115);
  g.font = 'bold 40px sans-serif'; g.fillText(sub, 256, 185);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Building nameplate for the boundary wall. */
export function nameplateTexture(name, nameBn) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2E2A26'; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#C9A227'; g.lineWidth = 6; g.strokeRect(12, 12, 1000, 232);
  g.fillStyle = '#F5EFE0'; g.textAlign = 'center';
  g.font = 'bold 84px sans-serif'; g.fillText(nameBn, 512, 105);
  g.font = 'bold 56px sans-serif'; g.fillText(name.toUpperCase(), 512, 195);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lobby directory board: floor list. */
export function directoryTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = '#F5EFE0'; g.fillRect(0, 0, 512, 640);
  g.fillStyle = '#2E2A26'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center';
  g.fillText('SHANTI NEER', 256, 60);
  g.font = '32px sans-serif'; g.textAlign = 'left';
  const rows = ['G  Lobby • Parking', '1  Flats 1A  1B  1C', '2  Flats 2A  2B  2C', '3  Flats 3A  3B  3C', '4  Flats 4A  4B  4C', '5  Flats 5A  5B  5C', '6  Flats 6A  6B  6C', '7  Flats 7A  7B  7C', '8  Flats 8A  8B  8C', '9  Flats 9A  9B  9C'];
  rows.forEach((r, i) => g.fillText(r, 40, 130 + i * 48));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the shared material set. Textures use world-scale UVs. */
export function createMaterials(building) {
  const f = building.facade;
  const M = (o) => new THREE.MeshStandardMaterial(o);
  return {
    plaster: M({ color: f.plaster, roughness: 0.9 }),
    accent: M({ color: f.accent, roughness: 0.85 }),
    base: M({ color: f.base, roughness: 0.95 }),
    frame: M({ color: f.frame, roughness: 0.6, metalness: 0.4 }),
    railing: M({ color: f.railing, roughness: 0.4, metalness: 0.7 }),
    glassOpaque: M({ color: f.glassOpaque, roughness: 0.15, metalness: 0.6 }),
    glassClear: M({ color: f.glassClear, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    wallInt: M({ color: building.interior.wall, roughness: 0.95 }),
    floorTile: M({ map: floorTileTexture(), roughness: 0.7 }),
    bathTile: M({ map: bathTileTexture(), roughness: 0.4 }),
    bathFloor: M({ color: '#8FA8AD', roughness: 0.5 }),
    doorWood: M({ color: building.interior.door, roughness: 0.6 }),
    doorFrame: M({ color: building.interior.doorFrame, roughness: 0.6 }),
    brass: M({ color: '#C9A227', roughness: 0.3, metalness: 0.8 }),
    roof: M({ color: '#8A8580', roughness: 0.95 }),
    road: M({ map: roadTexture(), roughness: 0.95 }),
    footpath: M({ map: paverTexture(), roughness: 0.9 }),
    grass: M({ map: grassTexture(), roughness: 1 }),
    soil: M({ color: '#7A5C3E', roughness: 1 }),
    trunk: M({ color: '#6B4A2F', roughness: 1 }),
    leaf: M({ color: '#4E7A32', roughness: 1 }),
    skyline: M({ color: '#8FA3B5', roughness: 1 }),
    dark: M({ color: '#2E2A26', roughness: 0.8 }),
    white: M({ color: '#F5F5F2', roughness: 0.9 }),
    metal: M({ color: '#8A8F93', roughness: 0.4, metalness: 0.7 }),
  };
}
