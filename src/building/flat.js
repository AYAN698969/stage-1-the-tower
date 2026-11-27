/**
 * Flat interiors: furniture templates (one per flat type) built from the
 * real CC0/CC-BY models in assets/, cloned per floor. Also ceiling fans
 * (spinning), a warm point light per flat, and simple stand-in dressing
 * (AC unit, drying line, curtains) — no free models exist for those three,
 * so they are plain boxes, clearly noted in PROGRESS.md.
 */
import * as THREE from 'three';
import { normalizeModel } from '../core/assets.js';

/** Seeded sofa/bed colour palette (one of three per flat). */
const PALETTE = [0x8a6d4b, 0x5b7a8c, 0x7a5b6e];
const TINT_MODELS = new Set(['sofa', 'bed_double']);

/** Axis-aligned box of a [w,d] footprint rotated by rotY (radians). */
function rotatedFootprint(w, d, rotY) {
  const c = Math.abs(Math.cos(rotY)); const s = Math.abs(Math.sin(rotY));
  return [w * c + d * s, w * s + d * c];
}

/** Tinted copy of a material (cached per material + palette index). */
function tintedMaterial(mat, paletteIdx, cache) {
  const key = `${mat.uuid}:${paletteIdx}`;
  if (cache.has(key)) return cache.get(key);
  const m = mat.clone();
  m.color = new THREE.Color(PALETTE[paletteIdx]);
  cache.set(key, m);
  return m;
}

/**
 * Build one furniture template group per flat type.
 * Returns { A: {group, fans, colliders}, B: {...}, C: {...} }.
 * Colliders are [x0,z0,x1,z1] in plan coordinates (same on every floor).
 */
export function buildFlatTemplates(ctx) {
  const { furniture, assets, floorplan: fp } = ctx;
  const templates = {};
  for (const type of ['A', 'B', 'C']) {
    const group = new THREE.Group();
    group.name = `flat-${type}`;
    const fans = [];
    const colliders = [];
    for (const item of furniture[type]) {
      const obj = assets.clone(item.model);
      if (!obj) { console.warn('[flat] missing model', item.model); continue; }
      const size = furniture.fit[item.model] || [1, 1, 1];
      const wrap = normalizeModel(obj, size);
      wrap.userData.model = item.model;
      wrap.traverse((o) => { if (o.isMesh) { o.userData.model = item.model; o.castShadow = false; o.receiveShadow = true; } });
      const [x, z] = item.pos;
      const rotY = ((item.rotY || 0) * Math.PI) / 180;
      if (item.ceiling) {
        const h = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3()).y;
        wrap.position.set(x, fp.wallHeight - h, z);
      } else {
        wrap.position.set(x, 0, z);
      }
      wrap.rotation.y = rotY;
      if (item.spin) { wrap.userData.spin = true; fans.push(wrap); }
      group.add(wrap);
      const foot = furniture.colliders[item.model];
      if (foot && !item.ceiling) {
        const [w, d] = rotatedFootprint(foot[0], foot[1], rotY);
        colliders.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
      }
    }
    dressFlat(group, type, fp, ctx.mats);
    // One warm point light per flat (living room, near the ceiling).
    const living = fp.flats[type].rooms.find((r) => r.id === 'living');
    if (living) {
      const [lx0, lz0, lx1, lz1] = living.rects[0];
      const light = new THREE.PointLight(0xffe6b8, 10, 9, 2);
      light.position.set((lx0 + lx1) / 2, 2.4, (lz0 + lz1) / 2);
      group.add(light);
    }
    templates[type] = { group, fans, colliders };
  }
  return templates;
}

/** AC unit + drying line + curtains (simple stand-in boxes). */
function dressFlat(group, type, fp, mats) {
  const flat = fp.flats[type];
  const rooms = Object.fromEntries(flat.rooms.map((r) => [r.id, r]));
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const acMat = mats.white;
  const clothMats = [mats.accent, mats.plaster];
  // AC unit: on the wall beside the first veranda's door, at y 2.2.
  const ver = flat.rooms.find((r) => r.type === 'veranda');
  if (ver) {
    const [vx0, vz0, vx1, vz1] = ver.rects[0];
    const cx = (vx0 + vx1) / 2; const cz = (vz0 + vz1) / 2;
    const ac = box(0.8, 0.3, 0.25, acMat);
    // Mount on the veranda's north wall (interior side) if it has one.
    ac.position.set(cx, 2.2, vz0 + 0.18);
    ac.userData.standin = 'ac-unit';
    group.add(ac);
    // Drying line across the veranda + 2 cloth pieces (seeded colours).
    const lineLen = Math.min(vx1 - vx0, vz1 - vz0) * 0.8;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, lineLen, 6), mats.metal);
    line.rotation.z = Math.PI / 2;
    line.position.set(cx, 1.8, cz);
    line.userData.standin = 'drying-line';
    group.add(line);
    for (let i = 0; i < 2; i++) {
      const cloth = box(0.4, 0.5, 0.02, clothMats[i % 2]);
      cloth.position.set(cx - lineLen / 4 + (i * lineLen) / 2, 1.55, cz);
      cloth.userData.standin = 'drying-cloth';
      group.add(cloth);
    }
  }
  // Curtains flanking the first bedroom window (interior side).
  const win = (flat.windows || []).find((w) => {
    const room = rooms[w.room];
    return room && room.type === 'bedroom';
  });
  if (win) {
    const room = rooms[win.room];
    const [rx0, rz0, rx1, rz1] = room.rects[0];
    const curtainMat = mats.accent;
    for (const side of [-1, 1]) {
      const c = box(0.45, 1.9, 0.06, curtainMat);
      if (win.edge === 'N' || win.edge === 'S') {
        c.position.set(win.at + side * (win.w / 2 + 0.25), 1.35, win.edge === 'N' ? rz0 + 0.12 : rz1 - 0.12);
      } else {
        c.position.set(win.edge === 'W' ? rx0 + 0.12 : rx1 - 0.12, 1.35, win.at + side * (win.w / 2 + 0.25));
      }
      c.userData.standin = 'curtain';
      group.add(c);
    }
  }
}

/**
 * Instantiate a flat template for one floor/flat.
 * Clones the template (shared geometry/materials), applies a seeded
 * sofa/bed tint, and returns the group + its spinning fans.
 */
export function instantiateFlat(template, floor, flatKey, tintCache) {
  const group = template.group.clone();
  const fans = [];
  group.traverse((o) => { if (o.userData.spin) fans.push(o); });
  const paletteIdx = (floor * 3 + 'ABC'.indexOf(flatKey)) % PALETTE.length;
  group.traverse((o) => {
    if (o.isMesh && TINT_MODELS.has(o.userData.model) && o.material && o.material.isMeshStandardMaterial) {
      o.material = tintedMaterial(o.material, paletteIdx, tintCache);
    }
  });
  return { group, fans };
}
