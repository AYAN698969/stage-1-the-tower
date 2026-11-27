/**
 * Flat interiors: furniture templates (one per flat type) built from the
 * real CC0/CC-BY models in assets/, cloned per floor. Also ceiling fans
 * (spinning), a warm point light per flat with a hanging lamp + wall
 * light switch (interactable), and real models for the AC unit, drying
 * rack and curtains (Quaternius, CC0 — added in the 2026-11-27 polish
 * pass). Shoe rack: no free model exists — skipped, see PROGRESS.md.
 */
import * as THREE from 'three';
import { normalizeModel } from '../core/assets.js';
import { bus } from '../core/events.js';

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
    dressFlat(group, type, fp, ctx);
    // One warm point light per flat (living room, near the ceiling),
    // with a visible hanging lamp + a wall light switch (interactable).
    const living = fp.flats[type].rooms.find((r) => r.id === 'living');
    let light = null; let lampMat = null; let switchPos = null;
    if (living) {
      const [lx0, lz0, lx1, lz1] = living.rects[0];
      const lx = (lx0 + lx1) / 2; const lz = (lz0 + lz1) / 2;
      light = new THREE.PointLight(0xffe6b8, 10, 9, 2);
      light.position.set(lx, 2.45, lz);
      group.add(light);
      lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6b8 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lampMat);
      lamp.position.set(lx, 2.5, lz);
      lamp.userData.lamp = true;
      group.add(lamp);
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6),
        new THREE.MeshBasicMaterial({ color: 0x333333 }),
      );
      cord.position.set(lx, 2.7, lz);
      group.add(cord);
      switchPos = [lx + 0.8, lz0 + 0.06];
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.04), ctx.mats.white);
      sw.position.set(switchPos[0], 1.25, switchPos[1]);
      group.add(sw);
    }
    templates[type] = { group, fans, colliders, light, lampMat, switchPos };
  }
  return templates;
}

/** AC unit + drying rack + curtains — real Quaternius CC0 models. */
function dressFlat(group, type, fp, ctx) {
  const { assets, mats } = ctx;
  const flat = fp.flats[type];
  const rooms = Object.fromEntries(flat.rooms.map((r) => [r.id, r]));
  const clothMats = [mats.accent, mats.plaster];
  const place = (obj, x, y, z, rotY = 0) => {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    group.add(obj);
  };
  // AC unit: on the wall beside the first veranda's door, at y 2.2.
  const ver = flat.rooms.find((r) => r.type === 'veranda');
  if (ver) {
    const [vx0, vz0, vx1, vz1] = ver.rects[0];
    const cx = (vx0 + vx1) / 2; const cz = (vz0 + vz1) / 2;
    const ac = assets.clone('ac_unit');
    if (ac) place(normalizeModel(ac, [0.8, 0.3, 0.25]), cx, 2.2, vz0 + 0.18);
    // Drying rack across the veranda + 2 folded cloths on top.
    const rack = assets.clone('drying_line');
    if (rack) {
      place(normalizeModel(rack, [0.9, 1.0, 0.35]), cx, 0, cz);
      for (let i = 0; i < 2; i++) {
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.28), clothMats[i % 2]);
        cloth.position.set(cx - 0.2 + i * 0.4, 0.98, cz);
        cloth.rotation.y = (i - 0.5) * 0.15;
        group.add(cloth);
      }
    }
  }
  // Curtains across the first bedroom window (interior side).
  const win = (flat.windows || []).find((w) => {
    const room = rooms[w.room];
    return room && room.type === 'bedroom';
  });
  if (win) {
    const room = rooms[win.room];
    const [rx0, rz0, rx1, rz1] = room.rects[0];
    const cur = assets.clone('curtains');
    if (cur) {
      const wrap = normalizeModel(cur, [win.w + 0.5, 1.9, 0.1]);
      if (win.edge === 'N' || win.edge === 'S') {
        place(wrap, win.at, 1.35, win.edge === 'N' ? rz0 + 0.12 : rz1 - 0.12);
      } else {
        place(wrap, win.edge === 'W' ? rx0 + 0.12 : rx1 - 0.12, 1.35, win.at, Math.PI / 2);
      }
    }
  }
}

/**
 * Instantiate a flat template for one floor/flat.
 * Clones the template (shared geometry/materials), applies a seeded
 * sofa/bed tint, and returns the group + its spinning fans + the
 * per-instance light, lamp material and light-switch plan position.
 */
export function instantiateFlat(template, floor, flatKey, tintCache) {
  const group = template.group.clone();
  const fans = [];
  let light = null; let lampMat = null;
  group.traverse((o) => {
    if (o.userData.spin) fans.push(o);
    if (o.isLight) { light = o; o.userData.lightId = `light_${floor}${flatKey}`; }
    if (o.userData.lamp) { o.material = o.material.clone(); lampMat = o.material; }
  });
  const paletteIdx = (floor * 3 + 'ABC'.indexOf(flatKey)) % PALETTE.length;
  group.traverse((o) => {
    if (o.isMesh && TINT_MODELS.has(o.userData.model) && o.material && o.material.isMeshStandardMaterial) {
      o.material = tintedMaterial(o.material, paletteIdx, tintCache);
    }
  });
  return { group, fans, light, lampMat, switchPos: template.switchPos };
}

/**
 * Toggle one flat's living-room light. Returns the new state (true = on).
 * Emits 'mission:light' when flat 4B's light is switched on.
 */
export function toggleFlatLight(lights, id) {
  const entry = lights.get(id);
  if (!entry) return false;
  const on = !entry.light.visible;
  entry.light.visible = on;
  entry.lampMat.color.setHex(on ? 0xffe6b8 : 0x3a3a3a);
  bus.emit('audio:click');
  if (id === 'light_4B' && on) bus.emit('mission:light');
  return on;
}
