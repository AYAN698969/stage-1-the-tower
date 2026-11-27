/**
 * Compound + street: boundary wall + gate, guard room, driveway, garden,
 * trees, road + footpaths, neighbour blocks, poles + sagging wires,
 * Bangla shop signs, tea stall, bins, meter box, pump house, parking.
 * Returns the group + a ground-level Collider2D.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Collider2D } from '../core/collision.js';
import { normalizeModel } from '../core/assets.js';
import { signTexture, nameplateTexture } from '../core/materials.js';

function box(cx, cy, cz, sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return g;
}

/**
 * Build the street/compound.
 * @param {object} ctx { world, building, assets, mats }
 */
export function buildStreet(ctx) {
  const { world: w, building, assets, mats } = ctx;
  const group = new THREE.Group();
  group.name = 'street';
  const collider = new Collider2D();
  const plot = building.plot;

  // --- ground planes (layered to avoid z-fighting) ---
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mats.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.05;
  grass.receiveShadow = true;
  group.add(grass);
  const plotFloor = new THREE.Mesh(new THREE.PlaneGeometry(plot.x1 - plot.x0, plot.z1 - plot.z0), mats.footpath);
  plotFloor.rotation.x = -Math.PI / 2;
  plotFloor.position.set((plot.x0 + plot.x1) / 2, -0.02, (plot.z0 + plot.z1) / 2);
  plotFloor.receiveShadow = true;
  group.add(plotFloor);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 8.5), mats.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, 19.75);
  road.receiveShadow = true;
  group.add(road);
  for (const [fz, fw] of [[14.75, 1.5], [24.75, 1.5]]) {
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(90, fw), mats.footpath);
    fp.rotation.x = -Math.PI / 2;
    fp.position.set(0, 0.0, fz);
    fp.receiveShadow = true;
    group.add(fp);
  }

  // --- boundary wall (2.2 m) with a 4 m gate + 1 m pedestrian gate ---
  const wallGeos = [
    box((plot.x0 - 2) / 2, 1.1, 14, -2 - plot.x0, 2.2, 0.2), // south, west of gate
    box((3 + plot.x1) / 2, 1.1, 14, plot.x1 - 3, 2.2, 0.2), // south, east of ped gate
    box(plot.x0 + 0.1, 1.1, (plot.z0 + 14) / 2, 0.2, 2.2, 14 - plot.z0), // west side
    box(plot.x1 - 0.1, 1.1, (plot.z0 + 14) / 2, 0.2, 2.2, 14 - plot.z0), // east side
    box(0, 1.1, plot.z0 + 0.1, plot.x1 - plot.x0, 2.2, 0.2), // north side
    box(-2.1, 1.3, 14, 0.25, 2.6, 0.25), // gate pillar west
    box(2.1, 1.3, 14, 0.25, 2.6, 0.25), // gate pillar east
    box(3.1, 1.3, 14, 0.25, 2.6, 0.25), // ped gate pillar
  ];
  const wall = new THREE.Mesh(mergeGeometries(wallGeos, false), mats.plaster);
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);
  // Sliding gate panel, slid open to the west.
  const gate = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.0, 0.08), mats.railing);
  gate.position.set(-4.1, 1.0, 14.05);
  group.add(gate);
  // Nameplate on the wall next to the gate.
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: nameplateTexture(building.name, building.nameBn), roughness: 0.7 }));
  plate.position.set(6.5, 1.6, 14.12);
  group.add(plate);
  // Wall colliders (gate + ped gate openings stay passable).
  collider.addBox(plot.x0, 13.9, -2, 14.1);
  collider.addBox(3, 13.9, plot.x1, 14.1);
  collider.addBox(plot.x0 - 0.1, plot.z0, plot.x0 + 0.1, 14);
  collider.addBox(plot.x1 - 0.1, plot.z0, plot.x1 + 0.1, 14);
  collider.addBox(plot.x0, plot.z0 - 0.1, plot.x1, plot.z0 + 0.1);
  // Road ends are closed by invisible colliders.
  collider.addBox(-46, 14, -45, 25);
  collider.addBox(45, 14, 46, 25);

  // --- guard room (3x3) just inside the gate, west ---
  {
    const g = w.guardRoom;
    const [gx, gz] = g.pos;
    const geos = [
      box(gx, 1.35, gz - g.d / 2 + 0.075, g.w, 2.7, 0.15),
      box(gx, 1.35, gz + g.d / 2 - 0.075, g.w, 2.7, 0.15),
      box(gx - g.w / 2 + 0.075, 1.35, gz, 0.15, 2.7, g.d),
      box(gx + g.w / 2 - 0.075, 1.35, gz, 0.15, 2.7, g.d),
      box(gx, 2.8, gz, g.w + 0.3, 0.2, g.d + 0.3),
    ];
    const room = new THREE.Mesh(mergeGeometries(geos, false), mats.accent);
    room.castShadow = true; room.receiveShadow = true;
    group.add(room);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mats.glassClear);
    win.position.set(gx, 1.6, gz + g.d / 2 + 0.01);
    group.add(win);
    collider.addBox(gx - g.w / 2, gz - g.d / 2, gx + g.w / 2, gz + g.d / 2);
  }

  // --- trees ---
  for (const t of w.trees) {
    const obj = assets.clone(t.model);
    if (!obj) continue;
    const size = t.model === 'tree_palm' ? [2.5, 5, 2.5] : [3, 4.5, 3];
    const wrap = normalizeModel(obj, size);
    wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wrap.position.set(t.pos[0], 0, t.pos[1]);
    group.add(wrap);
    collider.addBox(t.pos[0] - 0.3, t.pos[1] - 0.3, t.pos[0] + 0.3, t.pos[1] + 0.3);
  }

  // --- poles + sagging wires ---
  {
    const poleGeos = [];
    const tops = [];
    for (const [px, pz] of w.poles) {
      poleGeos.push(box(px, 3, pz, 0.12, 6, 0.12));
      poleGeos.push(box(px, 5.6, pz, 1.6, 0.08, 0.08));
      tops.push(new THREE.Vector3(px, 5.6, pz));
    }
    const poles = new THREE.Mesh(mergeGeometries(poleGeos, false), mats.dark);
    poles.castShadow = true;
    group.add(poles);
    // Wires along each side (poles are ordered in pairs by z).
    const wireMat = mats.dark;
    const wireGroups = [[0, 2, 4, 6], [1, 3, 5, 7]]; // indices by z side
    for (const idxs of wireGroups) {
      for (let i = 0; i < idxs.length - 1; i++) {
        const a = tops[idxs[i]]; const b = tops[idxs[i + 1]];
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.6;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.015, 4), wireMat);
        group.add(wire);
      }
    }
    for (const [px, pz] of w.poles) collider.addBox(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15);
  }

  // --- neighbour blocks across the road + at the road ends ---
  {
    const geos = [];
    for (const n of w.neighbours) {
      geos.push(box(n.pos[0], n.h / 2, n.pos[1], n.w, n.h, n.d));
      geos.push(box(n.pos[0], n.h + 0.15, n.pos[1], n.w + 0.3, 0.3, n.d + 0.3));
      collider.addBox(n.pos[0] - n.w / 2, n.pos[1] - n.d / 2, n.pos[0] + n.w / 2, n.pos[1] + n.d / 2);
    }
    const nb = new THREE.Mesh(mergeGeometries(geos, false), mats.skyline);
    nb.castShadow = false; nb.receiveShadow = false;
    group.add(nb);
  }

  // --- Bangla shop signs ---
  for (const s of w.signs) {
    const sign = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshStandardMaterial({ map: signTexture(s.text, s.sub), roughness: 0.8 }));
    board.position.y = 0;
    sign.add(board);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.6, 0.08), mats.dark);
    backing.position.z = -0.05;
    sign.add(backing);
    // Posts from the ground up to the bottom of the board.
    const postH = s.pos[1] - 0.75;
    for (const px of [-1.2, 1.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, postH, 6), mats.metal);
      post.position.set(px, -0.75 - postH / 2, 0);
      sign.add(post);
    }
    sign.position.set(s.pos[0], s.pos[1], s.pos[2]);
    sign.rotation.y = (s.rotY * Math.PI) / 180;
    group.add(sign);
  }

  // --- tea stall (market-stall stand-in) ---
  {
    const obj = assets.clone('tea_stall');
    if (obj) {
      const wrap = normalizeModel(obj, [4, 3, 3]);
      wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      wrap.position.set(w.teaStall.pos[0], 0, w.teaStall.pos[1]);
      wrap.rotation.y = (w.teaStall.rotY * Math.PI) / 180;
      group.add(wrap);
      collider.addBox(w.teaStall.pos[0] - 1.8, w.teaStall.pos[1] - 1.2, w.teaStall.pos[0] + 1.8, w.teaStall.pos[1] + 1.2);
    }
  }

  // --- bins, meter box, pump house ---
  for (const [bx, bz] of w.bins) {
    const obj = assets.clone('bin');
    if (!obj) continue;
    const wrap = normalizeModel(obj, [0.6, 0.9, 0.6]);
    wrap.position.set(bx, 0, bz);
    group.add(wrap);
    collider.addBox(bx - 0.3, bz - 0.3, bx + 0.3, bz + 0.3);
  }
  for (const [key, size] of [['meterBox', [0.6, 1.0, 0.3]], ['pumpHouse', [1.2, 1.4, 1.0]]]) {
    const [px, pz] = w[key].pos;
    const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mats.base);
    m.position.set(px, size[1] / 2, pz);
    m.castShadow = true;
    group.add(m);
    collider.addBox(px - size[0] / 2, pz - size[2] / 2, px + size[0] / 2, pz + size[2] / 2);
  }

  // --- parked vehicles in the ground-floor parking ---
  for (const v of w.parking) {
    const obj = assets.clone(v.model);
    if (!obj) continue;
    const size = v.model === 'car' ? [1.8, 1.5, 4.2] : [0.7, 1.2, 2.0];
    const wrap = normalizeModel(obj, size);
    wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wrap.position.set(v.pos[0], 0, v.pos[1]);
    wrap.rotation.y = (v.rotY * Math.PI) / 180;
    group.add(wrap);
    const [pw, pd] = v.model === 'car' ? [1.8, 4.2] : [0.7, 2.0];
    const [rw, rd] = rotatedFootprint(pw, pd, (v.rotY * Math.PI) / 180);
    collider.addBox(v.pos[0] - rw / 2, v.pos[1] - rd / 2, v.pos[0] + rw / 2, v.pos[1] + rd / 2);
  }

  // --- extra static street vehicles (brief counts: 3 rickshaw-like, 2 CNG) ---
  const extra = [
    { model: 'bicycle', pos: [6.2, 17.5], rotY: 90 },
    { model: 'bicycle', pos: [-6.5, 22.5], rotY: -90 },
    { model: 'cng_tuktuk', pos: [-8, 17.8], rotY: 180 },
    { model: 'car', pos: [12, 22.8], rotY: 180 },
  ];
  for (const v of extra) {
    const obj = assets.clone(v.model);
    if (!obj) continue;
    const size = v.model === 'car' ? [1.8, 1.5, 4.2] : v.model === 'cng_tuktuk' ? [1.4, 1.6, 2.6] : [0.6, 1.1, 1.9];
    const wrap = normalizeModel(obj, size);
    wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wrap.position.set(v.pos[0], 0, v.pos[1]);
    wrap.rotation.y = (v.rotY * Math.PI) / 180;
    group.add(wrap);
    const [pw, pd] = v.model === 'car' ? [1.8, 4.2] : v.model === 'cng_tuktuk' ? [1.4, 2.6] : [0.6, 1.9];
    const [rw, rd] = rotatedFootprint(pw, pd, (v.rotY * Math.PI) / 180);
    collider.addBox(v.pos[0] - rw / 2, v.pos[1] - rd / 2, v.pos[0] + rw / 2, v.pos[1] + rd / 2);
  }

  return { group, collider };
}

function rotatedFootprint(w, d, rotY) {
  const c = Math.abs(Math.cos(rotY)); const s = Math.abs(Math.sin(rotY));
  return [w * c + d * s, w * s + d * c];
}
