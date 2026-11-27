/**
 * Building shell: walls, floors, slabs, facade, ground floor, roof.
 * Walls are generated from the room rectangles in floorplan.json.
 * Shared edges become interior walls; exterior edges become facade
 * walls (with window openings); veranda open edges become railings.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Collider2D } from '../core/collision.js';

const EPS = 0.01;
const MIRROR_EDGE = { N: 'S', S: 'N', E: 'W', W: 'E' };

function edgeOf(rect, edge) {
  const [x0, z0, x1, z1] = rect;
  if (edge === 'N') return { ax: x0, az: z0, bx: x1, bz: z0, axis: 'x', fixed: z0 };
  if (edge === 'S') return { ax: x0, az: z1, bx: x1, bz: z1, axis: 'x', fixed: z1 };
  if (edge === 'W') return { ax: x0, az: z0, bx: x0, bz: z1, axis: 'z', fixed: x0 };
  return { ax: x1, az: z0, bx: x1, bz: z1, axis: 'z', fixed: x1 };
}

/** Collect all zones (room rects) for one typical floor. */
export function collectZones(fp) {
  const zones = [];
  for (const [flatKey, flat] of Object.entries(fp.flats)) {
    for (const room of flat.rooms) {
      for (const rect of room.rects) {
        zones.push({ flat: flatKey, room: room.id, type: room.type, rect, openEdges: room.openEdges || [] });
      }
    }
  }
  zones.push({ flat: 'core', room: 'stair', type: 'core', rect: [fp.core.stair.x0, fp.core.stair.z0, fp.core.stair.x1, fp.core.stair.z1] });
  zones.push({ flat: 'core', room: 'lift', type: 'core', rect: [fp.core.lift.x0, fp.core.lift.z0, fp.core.lift.x1, fp.core.lift.z1] });
  for (const r of fp.core.lobby.rects) zones.push({ flat: 'core', room: 'lobby', type: 'core', rect: r });
  zones.push({ flat: 'core', room: 'solid', type: 'solid', rect: [fp.core.solid[0].x0, fp.core.solid[0].z0, fp.core.solid[0].x1, fp.core.solid[0].z1] });
  for (const s of fp.shafts) zones.push({ flat: 'shaft', room: 'shaft', type: 'shaft', rect: [s.x0, s.z0, s.x1, s.z1] });
  return zones;
}

function collectDoors(fp) {
  const byFlat = new Map();
  for (const [flatKey, flat] of Object.entries(fp.flats)) byFlat.set(flatKey, flat.doors.map((d) => ({ ...d, flat: flatKey })));
  byFlat.set('core', fp.coreDoors.map((d) => ({ ...d, flat: 'core' })));
  return byFlat;
}

function collectWindows(fp) {
  const byFlat = new Map();
  for (const [flatKey, flat] of Object.entries(fp.flats)) byFlat.set(flatKey, (flat.windows || []).map((w) => ({ ...w, flat: flatKey })));
  byFlat.set('core', (fp.coreWindows || []).map((w) => ({ ...w, flat: 'core' })));
  return byFlat;
}

/** Find the zone on the other side of `zone`'s `edge` overlapping [s0,s1] (along-axis). */
function findNeighbor(zones, zone, edge, s0, s1) {
  const [x0, z0, x1, z1] = zone.rect;
  for (const o of zones) {
    if (o === zone) continue;
    const [ox0, oz0, ox1, oz1] = o.rect;
    if (edge === 'N' && Math.abs(oz1 - z0) < EPS && ox0 < s1 - EPS && ox1 > s0 + EPS) return o;
    if (edge === 'S' && Math.abs(oz0 - z1) < EPS && ox0 < s1 - EPS && ox1 > s0 + EPS) return o;
    if (edge === 'W' && Math.abs(ox1 - x0) < EPS && oz0 < s1 - EPS && oz1 > s0 + EPS) return o;
    if (edge === 'E' && Math.abs(ox0 - x1) < EPS && oz0 < s1 - EPS && oz1 > s0 + EPS) return o;
  }
  return null;
}

function doorFor(doors, a, b, edge) {
  return doors.find((d) => (d.a === a && d.b === b && d.edge === edge) || (d.a === b && d.b === a && d.edge === MIRROR_EDGE[edge]));
}
function windowFor(wins, flat, room, edge) {
  return wins.find((w) => w.flat === flat && w.room === room && w.edge === edge);
}

function boxGeo(cx, cy, cz, sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return g;
}

/** Emit a wall segment (axis-aligned) from height h0 to h1 into a bucket. */
function emitWall(buckets, mat, x0, z0, x1, z1, t, h0, h1, y0 = 0) {
  if (h1 - h0 < 0.01) return;
  const alongX = Math.abs(z1 - z0) < EPS;
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  if (len < 0.01) return;
  const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2; const cy = y0 + (h0 + h1) / 2;
  const g = alongX ? boxGeo(cx, cy, cz, len, h1 - h0, t) : boxGeo(cx, cy, cz, t, h1 - h0, len);
  buckets[mat].push(g);
}

/**
 * Build one typical floor's shell (floors 1-9 are identical).
 * Returns merged geometries, glass specs, door specs and colliders.
 */
export function buildFloorShell(fp, mats) {
  const zones = collectZones(fp);
  const doorsByFlat = collectDoors(fp);
  const winsByFlat = collectWindows(fp);
  const H = fp.wallHeight;
  const buckets = { plaster: [], accent: [], wallInt: [], frame: [], railing: [], bath: [] };
  const floorBuckets = { tile: [], bath: [], paver: [] };
  const glassSpecs = [];
  const doorSpecs = [];
  const collider = new Collider2D();
  const seen = new Set();
  const sorted = [...zones].sort((a, b) => `${a.flat}/${a.room}/${a.rect}` < `${b.flat}/${b.room}/${b.rect}` ? -1 : 1);

  // ---- floors (one thin box per room rect) ----
  for (const z of zones) {
    if (z.type === 'shaft' || z.type === 'solid') continue;
    const [x0, z0, x1, z1] = z.rect;
    const mat = z.type === 'toilet' ? 'bath' : z.type === 'veranda' ? 'paver' : 'tile';
    floorBuckets[mat].push(boxGeo((x0 + x1) / 2, -0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0));
  }

  // ---- walls ----
  for (const z of sorted) {
    const isCore = z.flat === 'core';
    const isBath = z.type === 'toilet' || z.type === 'kitchen';
    for (const edge of ['N', 'S', 'W', 'E']) {
      const e = edgeOf(z.rect, edge);
      const [s0, s1] = e.axis === 'x' ? [e.ax, e.bx] : [e.az, e.bz];
      // breakpoints from neighbours sharing this edge line
      const cuts = new Set([s0, s1]);
      for (const o of zones) {
        if (o === z) continue;
        const [ox0, oz0, ox1, oz1] = o.rect;
        if (edge === 'N' && Math.abs(oz1 - e.fixed) < EPS) { cuts.add(Math.max(s0, ox0)); cuts.add(Math.min(s1, ox1)); }
        if (edge === 'S' && Math.abs(oz0 - e.fixed) < EPS) { cuts.add(Math.max(s0, ox0)); cuts.add(Math.min(s1, ox1)); }
        if (edge === 'W' && Math.abs(ox1 - e.fixed) < EPS) { cuts.add(Math.max(s0, oz0)); cuts.add(Math.min(s1, oz1)); }
        if (edge === 'E' && Math.abs(ox0 - e.fixed) < EPS) { cuts.add(Math.max(s0, oz0)); cuts.add(Math.min(s1, oz1)); }
      }
      const pts = [...cuts].filter((v) => v >= s0 - EPS && v <= s1 + EPS).sort((a, b) => a - b);
      for (let i = 0; i < pts.length - 1; i++) {
        const a0 = pts[i]; const a1 = pts[i + 1];
        if (a1 - a0 < EPS) continue;
        const key = `${e.axis}:${e.fixed.toFixed(2)}:${a0.toFixed(2)}:${a1.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const mid = (a0 + a1) / 2;
        const neighbor = findNeighbor(zones, z, edge, a0, a1);
        const sameRoom = neighbor && neighbor.flat === z.flat && neighbor.room === z.room;
        if (sameRoom) continue; // same room (multi-rect): no wall
        const isOpenEdge = (z.openEdges || []).includes(edge);
        if (isOpenEdge && !neighbor) {
          // Veranda open side: railing only.
          const t = 0.06;
          if (e.axis === 'x') {
            emitWall(buckets, 'railing', a0, e.fixed, a1, e.fixed, t, 0, 1.0);
            emitWall(buckets, 'railing', a0, e.fixed, a1, e.fixed, 0.09, 0.96, 1.04);
            collider.addBox(a0, e.fixed - t / 2, a1, e.fixed + t / 2);
          } else {
            emitWall(buckets, 'railing', e.fixed, a0, e.fixed, a1, t, 0, 1.0);
            emitWall(buckets, 'railing', e.fixed, a0, e.fixed, a1, 0.09, 0.96, 1.04);
            collider.addBox(e.fixed - t / 2, a0, e.fixed + t / 2, a1);
          }
          continue;
        }
        // Only the two flats that share this wall can own a door on it
        // (a wall never involves a third flat).
        const candidates = [...(doorsByFlat.get(z.flat) || []), ...(neighbor ? doorsByFlat.get(neighbor.flat) || [] : [])];
        let door = neighbor
          ? doorFor(candidates, z.room, neighbor.room, edge)
          : candidates.find((d) => d.a === z.room && d.b === 'outside' && d.edge === edge);
        let win = !neighbor ? windowFor(winsByFlat.get(z.flat) || [], z.flat, z.room, edge) : null;
        // A door/window only counts if its opening overlaps THIS sub-segment
        // (the same room pair can share several sub-segments along one edge).
        if (door && (door.at + door.w / 2 < a0 - EPS || door.at - door.w / 2 > a1 + EPS)) door = null;
        if (win && (win.at + win.w / 2 < a0 - EPS || win.at - win.w / 2 > a1 + EPS)) win = null;
        const exterior = !neighbor;
        const t = exterior ? fp.extWall : neighbor.flat !== z.flat || neighbor.type === 'shaft' || neighbor.type === 'solid' ? 0.25 : fp.intWall;
        const mat = exterior ? (isCore ? 'accent' : 'plaster') : 'wallInt';
        const seg = (x0, z0, x1, z1, h0, h1, m) => emitWall(buckets, m, x0, z0, x1, z1, t, h0, h1);
        const at = (v) => (e.axis === 'x' ? [v, e.fixed] : [e.fixed, v]);
        if (door) {
          const w = door.w;
          const g0 = door.at - w / 2; const g1 = door.at + w / 2;
          if (door.kind === 'open') {
            // Open plan: full-height wall beside the opening + beam above it.
            emitSegParts(seg, e, a0, a1, g0, g1, 0, H, mat);
            emitGapPart(seg, e, a0, a1, g0, g1, 2.4, H, mat);
          } else {
            // Full-height wall beside the opening + lintel above the door.
            emitSegParts(seg, e, a0, a1, g0, g1, 0, H, mat);
            emitGapPart(seg, e, a0, a1, g0, g1, 2.1, H, mat);
            // Frame jambs around the door gap.
            const [jx0, jz0] = at(g0); const [jx1, jz1] = at(g1);
            emitWall(buckets, 'frame', jx0 - 0.03, jz0 - 0.03, jx0 + 0.03, jz0 + 0.03, t + 0.04, 0, 2.1);
            emitWall(buckets, 'frame', jx1 - 0.03, jz1 - 0.03, jx1 + 0.03, jz1 + 0.03, t + 0.04, 0, 2.1);
            const dh = door.kind === 'toilet' ? 2.0 : 2.1;
            // The lift shaft doors belong to the lift system (sliding doors),
            // not to the swing-door panel system: cut the gap, add no panel.
            // The glass entrance ('outside') is an open doorway: no panel.
            if (door.kind !== 'lift' && door.b !== 'outside') {
              doorSpecs.push({ flat: z.flat, roomA: z.room, roomB: neighbor ? neighbor.room : 'outside', x: e.axis === 'x' ? door.at : e.fixed, z: e.axis === 'x' ? e.fixed : door.at, axis: e.axis, w, kind: door.kind, height: dh, edge });
            }
          }
        } else if (win) {
          const w = win.w; const sill = win.sill ?? 0.9; const wh = win.h ?? 1.2;
          const g0 = win.at - w / 2; const g1 = win.at + w / 2;
          // Sill below, header above (whole segment), sides beside the opening.
          emitSegParts(seg, e, a0, a1, g0, g1, 0, sill, mat);
          emitSegParts(seg, e, a0, a1, g0, g1, sill + wh, H, mat);
          emitSideParts(seg, e, a0, a1, g0, g1, sill, sill + wh, mat);
          // Frame around the opening.
          const [fx0, fz0] = at(g0); const [fx1, fz1] = at(g1);
          emitWall(buckets, 'frame', fx0 - 0.03, fz0 - 0.03, fx0 + 0.03, fz0 + 0.03, t + 0.06, sill, sill + wh);
          emitWall(buckets, 'frame', fx1 - 0.03, fz1 - 0.03, fx1 + 0.03, fz1 + 0.03, t + 0.06, sill, sill + wh);
          emitWall(buckets, 'frame', Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1), t + 0.06, sill + wh - 0.04, sill + wh);
          glassSpecs.push({ flat: z.flat, room: z.room, x: e.axis === 'x' ? win.at : e.fixed, z: e.axis === 'x' ? e.fixed : win.at, axis: e.axis, w, h: wh, sill });
        } else {
          // Solid wall, full height (bath tile on the lower part for wet rooms).
          if (isBath) {
            emitSegFull(seg, e, a0, a1, 0, 2.1, 'bath');
            emitSegFull(seg, e, a0, a1, 2.1, H, mat);
          } else {
            emitSegFull(seg, e, a0, a1, 0, H, mat);
          }
        }
        // Static collider for the solid parts of this segment.
        addColliderForSegment(collider, e, a0, a1, t, door, win);
      }
    }
  }

  const geos = {};
  for (const [k, list] of Object.entries(buckets)) geos[k] = list.length ? mergeGeometries(list, false) : null;
  const floorGeos = {};
  for (const [k, list] of Object.entries(floorBuckets)) floorGeos[k] = list.length ? mergeGeometries(list, false) : null;
  return { geos, floorGeos, glassSpecs, doorSpecs, collider };
}

/** Emit wall parts outside [g0,g1] between heights h0..h1 along a segment. */
function emitSegParts(seg, e, a0, a1, g0, g1, h0, h1, m) {
  const lo = Math.max(a0, g0); const hi = Math.min(a1, g1);
  if (e.axis === 'x') {
    if (lo > a0 + EPS) seg(a0, e.fixed, lo, e.fixed, h0, h1, m);
    if (hi < a1 - EPS) seg(hi, e.fixed, a1, e.fixed, h0, h1, m);
  } else {
    if (lo > a0 + EPS) seg(e.fixed, a0, e.fixed, lo, h0, h1, m);
    if (hi < a1 - EPS) seg(e.fixed, hi, e.fixed, a1, h0, h1, m);
  }
}
/** Emit the wall part inside [g0,g1] (lintel/beam) between heights h0..h1. */
function emitGapPart(seg, e, a0, a1, g0, g1, h0, h1, m) {
  const lo = Math.max(a0, g0); const hi = Math.min(a1, g1);
  if (hi - lo < EPS) return;
  if (e.axis === 'x') seg(lo, e.fixed, hi, e.fixed, h0, h1, m);
  else seg(e.fixed, lo, e.fixed, hi, h0, h1, m);
}
/** Emit wall parts beside the opening (left/right) between heights h0..h1. */
function emitSideParts(seg, e, a0, a1, g0, g1, h0, h1, m) {
  const lo = Math.max(a0, g0); const hi = Math.min(a1, g1);
  if (e.axis === 'x') {
    if (lo > a0 + EPS) seg(a0, e.fixed, lo, e.fixed, h0, h1, m);
    if (hi < a1 - EPS) seg(hi, e.fixed, a1, e.fixed, h0, h1, m);
  } else {
    if (lo > a0 + EPS) seg(e.fixed, a0, e.fixed, lo, h0, h1, m);
    if (hi < a1 - EPS) seg(e.fixed, hi, e.fixed, a1, h0, h1, m);
  }
}
/** Emit a full-height wall part for a whole segment. */
function emitSegFull(seg, e, a0, a1, h0, h1, m) {
  if (e.axis === 'x') seg(a0, e.fixed, a1, e.fixed, h0, h1, m);
  else seg(e.fixed, a0, e.fixed, a1, h0, h1, m);
}

/**
 * Add static colliders for a wall segment at floor level.
 * Door gaps are passable (the door panel blocks when closed);
 * window openings sit above a 0.9 m sill, so the whole segment blocks.
 */
function addColliderForSegment(collider, e, a0, a1, t, door, win) {
  if (door) {
    const g0 = Math.max(a0, door.at - door.w / 2);
    const g1 = Math.min(a1, door.at + door.w / 2);
    if (g0 > a0 + EPS) addBox(collider, e, a0, g0, t);
    if (g1 < a1 - EPS) addBox(collider, e, g1, a1, t);
    return;
  }
  addBox(collider, e, a0, a1, t);
}
function addBox(collider, e, s0, s1, t) {
  if (s1 - s0 < EPS) return;
  if (e.axis === 'x') collider.addBox(s0, e.fixed - t / 2, s1, e.fixed + t / 2);
  else collider.addBox(e.fixed - t / 2, s0, e.fixed + t / 2, s1);
}

/** Slab boxes (0.15 thick) with rectangular holes, built from boxes. */
export function slabBoxes(fp, holes) {
  const { x0, x1, z0, z1 } = fp.footprint;
  const boxes = [];
  // Split the footprint around the holes (holes are in the north strip).
  let regions = [{ x0, x1, z0, z1 }];
  for (const h of holes) {
    const next = [];
    for (const r of regions) {
      const ox0 = Math.max(r.x0, h.x0); const ox1 = Math.min(r.x1, h.x1);
      const oz0 = Math.max(r.z0, h.z0); const oz1 = Math.min(r.z1, h.z1);
      if (ox0 >= ox1 || oz0 >= oz1) { next.push(r); continue; }
      if (r.z0 < oz0) next.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: oz0 });
      if (oz1 < r.z1) next.push({ x0: r.x0, x1: r.x1, z0: oz1, z1: r.z1 });
      if (r.x0 < ox0) next.push({ x0: r.x0, x1: ox0, z0: oz0, z1: oz1 });
      if (ox1 < r.x1) next.push({ x0: ox1, x1: r.x1, z0: oz0, z1: oz1 });
    }
    regions = next;
  }
  for (const r of regions) boxes.push(r);
  return boxes;
}

/** Build the whole building group. Returns handles for the game. */
export function buildBuilding(ctx) {
  const { building, floorplan: fp, mats, assets } = ctx;
  const group = new THREE.Group();
  group.name = 'building';
  const shell = buildFloorShell(fp, mats);
  const matFor = (k) => ({ plaster: mats.plaster, accent: mats.accent, wallInt: mats.wallInt, frame: mats.frame, railing: mats.railing, bath: mats.bathTile })[k];
  const floorMatFor = (k) => ({ tile: mats.floorTile, bath: mats.bathFloor, paver: mats.footpath })[k];

  // --- one floor template, cloned per floor 1..9 (shared geometry) ---
  const floorTemplate = new THREE.Group();
  for (const [k, geo] of Object.entries(shell.geos)) {
    if (!geo) continue;
    const m = new THREE.Mesh(geo, matFor(k));
    m.castShadow = true; m.receiveShadow = true;
    floorTemplate.add(m);
  }
  for (const [k, geo] of Object.entries(shell.floorGeos)) {
    if (!geo) continue;
    const m = new THREE.Mesh(geo, floorMatFor(k));
    m.receiveShadow = true;
    floorTemplate.add(m);
  }
  // Slab band every floor (proud plaster edge).
  {
    const band = boxGeo(0, -0.1, 0, 18.29 + 0.16, 0.2, 15.24 + 0.16);
    const m = new THREE.Mesh(band, mats.plaster);
    m.castShadow = true;
    floorTemplate.add(m);
  }
  // Stair flights (merged steps) + handrails, per floor template.
  buildStairsInto(floorTemplate, fp, mats);

  const flatGroups = {}; // floor -> Group (furniture, culled)
  const glassByFlat = {}; // "floor:flat" -> [glass meshes]
  const doorSpecsByFloor = {};
  for (let f = 1; f <= building.floors; f++) {
    const y = f * fp.floorHeight;
    const fl = floorTemplate.clone();
    fl.position.y = y;
    group.add(fl);
    // Slab under this floor (top at y), with stair + lift holes.
    const slab = slabMesh(fp, [{ x0: fp.core.stair.x0, x1: fp.core.stair.x1, z0: fp.core.stair.z0, z1: fp.core.stair.z1 }, { x0: fp.core.lift.x0, x1: fp.core.lift.x1, z0: fp.core.lift.z0, z1: fp.core.lift.z1 }], mats.plaster);
    slab.position.y = y - fp.slab;
    group.add(slab);
    flatGroups[f] = new THREE.Group();
    flatGroups[f].position.y = y;
    group.add(flatGroups[f]);
    // Glass per flat on this floor.
    for (const spec of shell.glassSpecs) {
      const key = `${f}:${spec.flat}`;
      if (!glassByFlat[key]) glassByFlat[key] = [];
      const g = new THREE.PlaneGeometry(spec.w, spec.h);
      const mesh = new THREE.Mesh(g, mats.glassOpaque);
      mesh.position.set(spec.x, y + spec.sill + spec.h / 2, spec.z);
      if (spec.axis === 'z') mesh.rotation.y = Math.PI / 2;
      mesh.userData.flatKey = key;
      glassByFlat[key].push(mesh);
      group.add(mesh);
    }
    doorSpecsByFloor[f] = shell.doorSpecs.map((d) => ({ ...d, y }));
  }

  // --- ground floor: core enclosure + columns + parking floor ---
  const ground = buildGroundFloor(group, fp, mats, shell);
  // --- roof ---
  const roofDoor = buildRoof(group, fp, mats, building.floors);

  return { group, shell, flatGroups, glassByFlat, doorSpecsByFloor, floorTemplate, roofDoor, groundCollider: ground.collider, groundDoorSpecs: ground.doorSpecs };
}

function slabMesh(fp, holes, mat) {
  const boxes = slabBoxes(fp, holes);
  const geos = boxes.map((r) => boxGeo((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2, r.x1 - r.x0, fp.slab, r.z1 - r.z0));
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Stair steps + handrails inside the floor template (local coords, floor base y=0). */
function buildStairsInto(template, fp, mats) {
  const st = fp.stair;
  const stepGeos = [];
  const railGeos = [];
  const flightH = 3.05 / 2;
  const riser = st.rise;
  const tread = st.tread;
  // Flight A: west flight, rises going north from z=-3.96 to -6.30.
  for (let i = 0; i < 9; i++) {
    const z = st.flightA.zFrom - (i + 1) * tread + tread / 2;
    const y = (i + 1) * riser;
    stepGeos.push(boxGeo((st.flightA.x0 + st.flightA.x1) / 2, y - riser / 2, z, st.flightW, riser, tread + 0.02));
  }
  // Flight B: east flight, rises going south from z=-6.30 to -3.96.
  for (let i = 0; i < 9; i++) {
    const z = st.flightB.zFrom + (i + 1) * tread - tread / 2;
    const y = flightH + (i + 1) * riser;
    stepGeos.push(boxGeo((st.flightB.x0 + st.flightB.x1) / 2, y - riser / 2, z, st.flightW, riser, tread + 0.02));
  }
  // Landing slab at half height (north strip).
  stepGeos.push(boxGeo((st.x0 + st.x1) / 2, flightH - 0.07, (st.landing.z0 + st.landing.z1) / 2, st.x1 - st.x0, 0.14, st.landing.z1 - st.landing.z0));
  // Handrails: thin sloped boxes along both flights (approx as stepped rails).
  for (let i = 0; i < 9; i++) {
    const zA = st.flightA.zFrom - (i + 1) * tread + tread / 2;
    const yA = (i + 1) * riser + 0.9;
    railGeos.push(boxGeo(st.flightA.x0 + 0.03, yA, zA, 0.05, 0.05, tread + 0.02));
    railGeos.push(boxGeo(st.flightA.x1 - 0.03, yA, zA, 0.05, 0.05, tread + 0.02));
    const zB = st.flightB.zFrom + (i + 1) * tread - tread / 2;
    const yB = flightH + (i + 1) * riser + 0.9;
    railGeos.push(boxGeo(st.flightB.x0 + 0.03, yB, zB, 0.05, 0.05, tread + 0.02));
    railGeos.push(boxGeo(st.flightB.x1 - 0.03, yB, zB, 0.05, 0.05, tread + 0.02));
  }
  const steps = new THREE.Mesh(mergeGeometries(stepGeos, false), mats.base);
  steps.castShadow = false; steps.receiveShadow = true;
  template.add(steps);
  const rails = new THREE.Mesh(mergeGeometries(railGeos, false), mats.railing);
  template.add(rails);
}

function buildGroundFloor(group, fp, mats, shell) {
  const g = new THREE.Group();
  g.name = 'ground';
  // Parking floor (whole footprint, concrete).
  const floor = new THREE.Mesh(boxGeo(0, -0.05, 0, 18.29, 0.1, 15.24), mats.footpath);
  floor.receiveShadow = true;
  g.add(floor);
  // Core enclosure at ground: reuse the shell walls but only the core rooms.
  // (Simplest: clone the full floor template shell without furniture, at y=0,
  //  then the flat walls would wrongly enclose the parking. So build core-only
  //  walls from the shell data: re-run the wall generator on core zones only.)
  const coreOnly = { ...fp, flats: { A: { rooms: [], doors: [], windows: [] }, B: { rooms: [], doors: [], windows: [] }, C: { rooms: [], doors: [], windows: [] } } };
  const coreShell = buildFloorShell(coreOnly, mats);
  const matFor = (k) => ({ plaster: mats.plaster, accent: mats.accent, wallInt: mats.wallInt, frame: mats.frame, railing: mats.railing, bath: mats.bathTile })[k];
  for (const [k, geo] of Object.entries(coreShell.geos)) {
    if (!geo) continue;
    const m = new THREE.Mesh(geo, matFor(k));
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  // Lobby south wall is a glass entrance: side glass panels + a transom
  // above the 2.4 m opening (the opening itself stays clear to walk through).
  const glassWallL = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.6), mats.glassClear);
  glassWallL.position.set(-1.975, 1.3, 0.02);
  glassWallL.rotation.y = Math.PI;
  g.add(glassWallL);
  const glassWallR = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.6), mats.glassClear);
  glassWallR.position.set(1.975, 1.3, 0.02);
  glassWallR.rotation.y = Math.PI;
  g.add(glassWallR);
  const glassTransom = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), mats.glassClear);
  glassTransom.position.set(0, 2.35, 0.02);
  glassTransom.rotation.y = Math.PI;
  g.add(glassTransom);
  // Columns on a 3.05 m grid outside the core.
  const colGeos = [];
  for (let x = -9.15; x <= 9.15 + EPS; x += 3.05) {
    for (let z = -7.62; z <= 7.62 + EPS; z += 3.05) {
      if (x >= -2.75 - EPS && x <= 2.75 + EPS && z >= -7.62 - EPS && z <= 0 + EPS) continue; // core
      colGeos.push(boxGeo(x, 1.45, z, 0.3, 2.9, 0.3));
      coreShell.collider.addBox(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
    }
  }
  const cols = new THREE.Mesh(mergeGeometries(colGeos, false), mats.base);
  cols.castShadow = true; cols.receiveShadow = true;
  g.add(cols);
  group.add(g);
  // The core-only shell's door specs are the ground floor's doors
  // (lobby<->stair; the lift door is owned by the lift system, the glass
  // entrance has no panel). Give them floor 0.
  return { collider: coreShell.collider, doorSpecs: coreShell.doorSpecs.map((d) => ({ ...d, y: 0 })) };
}

function buildRoof(group, fp, mats, floors) {
  const y = floors * fp.floorHeight;
  const g = new THREE.Group();
  g.name = 'roof';
  g.position.y = y;
  // Roof slab (hole over stair only).
  const slab = slabMesh(fp, [{ x0: fp.core.stair.x0, x1: fp.core.stair.x1, z0: fp.core.stair.z0, z1: fp.core.stair.z1 }], mats.roof);
  slab.position.y = -fp.slab;
  g.add(slab);
  // Parapet 1.1 m around the roof edge.
  const { x0, x1, z0, z1 } = fp.footprint;
  const pGeos = [
    boxGeo((x0 + x1) / 2, 0.55, z0 + 0.075, x1 - x0, 1.1, 0.15),
    boxGeo((x0 + x1) / 2, 0.55, z1 - 0.075, x1 - x0, 1.1, 0.15),
    boxGeo(x0 + 0.075, 0.55, (z0 + z1) / 2, 0.15, 1.1, z1 - z0),
    boxGeo(x1 - 0.075, 0.55, (z0 + z1) / 2, 0.15, 1.1, z1 - z0),
  ];
  const parapet = new THREE.Mesh(mergeGeometries(pGeos, false), mats.plaster);
  parapet.castShadow = true;
  g.add(parapet);
  // Stair headroom: 4 walls over the stairwell (not a solid box) so the
  // player can climb to the top of the stairs. Its south wall carries the
  // LOCKED roof door: the roof is visible from outside but not walkable.
  const sh = fp.roof.stairHead;
  const doorCx = -1.83; const doorW = 0.9;
  const gapW0 = doorCx - doorW / 2; // -2.28
  const gapW1 = doorCx + doorW / 2; // -1.38
  const headGeos = [
    boxGeo((sh.x0 + sh.x1) / 2, sh.h / 2, sh.z0 + 0.075, sh.x1 - sh.x0, sh.h, 0.15),
    boxGeo(sh.x0 + 0.075, sh.h / 2, (sh.z0 + sh.z1) / 2, 0.15, sh.h, sh.z1 - sh.z0),
    boxGeo(sh.x1 - 0.075, sh.h / 2, (sh.z0 + sh.z1) / 2, 0.15, sh.h, sh.z1 - sh.z0),
    // South wall, split around the 0.9 m door gap (door centre x = -1.83).
    boxGeo((sh.x0 + gapW0) / 2, sh.h / 2, sh.z1 - 0.075, gapW0 - sh.x0, sh.h, 0.15),
    boxGeo((gapW1 + sh.x1) / 2, sh.h / 2, sh.z1 - 0.075, sh.x1 - gapW1, sh.h, 0.15),
    boxGeo(doorCx, (sh.h + 2.1) / 2, sh.z1 - 0.075, doorW, sh.h - 2.1, 0.15),
    // Cap slab on top of the headroom.
    boxGeo((sh.x0 + sh.x1) / 2, sh.h + 0.075, (sh.z0 + sh.z1) / 2, sh.x1 - sh.x0 + 0.2, 0.15, sh.z1 - sh.z0 + 0.2),
  ];
  const head = new THREE.Mesh(mergeGeometries(headGeos, false), mats.accent);
  head.castShadow = true;
  g.add(head);
  // The locked roof door panel (static, in the headroom's south wall).
  const roofDoor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.06), mats.doorWood);
  roofDoor.position.set(-1.83, 1.05, sh.z1 - 0.075);
  roofDoor.userData.locked = true;
  roofDoor.userData.label = 'Roof access closed';
  g.add(roofDoor);
  const mr = new THREE.Mesh(boxGeo((fp.core.lift.x0 + fp.core.lift.x1) / 2, 1.1, (fp.core.lift.z0 + fp.core.lift.z1) / 2, fp.core.lift.x1 - fp.core.lift.x0, 2.2, fp.core.lift.z1 - fp.core.lift.z0), mats.plaster);
  mr.castShadow = true;
  g.add(mr);
  // 2 water tanks (cylinders) + dishes.
  for (const [tx, tz] of fp.roof.tanks) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 16), mats.dark);
    tank.position.set(tx, 0.8, tz);
    tank.castShadow = true;
    g.add(tank);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 16), mats.metal);
    lid.position.set(tx, 1.65, tz);
    g.add(lid);
  }
  for (const [dx, dz] of fp.roof.dishes) {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), mats.white);
    dish.position.set(dx, 1.2, dz);
    dish.rotation.x = -Math.PI / 4;
    g.add(dish);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), mats.metal);
    pole.position.set(dx, 0.6, dz);
    g.add(pole);
  }
  group.add(g);
  return roofDoor;
}
