/**
 * Plan tiling validator: the union of all room rects (flats + core +
 * shafts + solid duct) must cover the building footprint exactly —
 * no gaps, no overlaps. Also checks every door/window "at" position
 * lies on its room's stated edge and inside the wall segment.
 * Run: node test/plan.test.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirrorFlat } from '../src/core/config.js';
import { collectZones } from '../src/building/plan.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const fp = read('config/floorplan.json');
if (fp.flats.C === 'mirror:A') fp.flats.C = mirrorFlat(fp.flats.A);
const zones = collectZones(fp);
const { x0: fx0, x1: fx1, z0: fz0, z1: fz1 } = fp.footprint;

// Rasterise at 1 cm: mark each cell with the zone that covers it.
const CELL = 0.01;
const nx = Math.round((fx1 - fx0) / CELL);
const nz = Math.round((fz1 - fz0) / CELL);
const cover = new Int16Array(nx * nz).fill(-1);
let overlaps = 0;
let overlapSamples = [];
zones.forEach((z, zi) => {
  const [rx0, rz0, rx1, rz1] = z.rect;
  const i0 = Math.round((rx0 - fx0) / CELL); const i1 = Math.round((rx1 - fx0) / CELL);
  const j0 = Math.round((rz0 - fz0) / CELL); const j1 = Math.round((rz1 - fz0) / CELL);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const idx = j * nx + i;
      if (cover[idx] !== -1) {
        overlaps++;
        if (overlapSamples.length < 10) overlapSamples.push({ x: fx0 + i * CELL, z: fz0 + j * CELL, a: zones[cover[idx]].flat + '/' + zones[cover[idx]].room, b: z.flat + '/' + z.room });
      } else cover[idx] = zi;
    }
  }
});
let gaps = 0;
let gapSamples = [];
for (let j = 0; j < nz; j++) {
  for (let i = 0; i < nx; i++) {
    if (cover[j * nx + i] === -1) {
      gaps++;
      if (gapSamples.length < 10) gapSamples.push({ x: +(fx0 + i * CELL).toFixed(2), z: +(fz0 + j * CELL).toFixed(2) });
    }
  }
}
console.log(`zones: ${zones.length}, cells: ${nx * nz}, overlaps: ${overlaps}, gaps: ${gaps}`);
if (overlaps) console.log('overlap samples:', JSON.stringify(overlapSamples));
if (gaps) console.log('gap samples:', JSON.stringify(gapSamples));

// Door/window placement checks.
function edgeRange(rect, edge) {
  const [x0, z0, x1, z1] = rect;
  return edge === 'N' || edge === 'S' ? [x0, x1] : [z0, z1];
}
let bad = 0;
function checkOpenings(list, kind, roomLookup) {
  for (const o of list) {
    const roomId = o.room || o.a;
    const rects = roomLookup(roomId, o.flat);
    if (!rects) { console.log(`BAD ${kind}: room ${roomId} not found (flat ${o.flat})`); bad++; continue; }
    // The gap may span several rects of the same room: check it against the
    // union of that room's segments on the stated edge.
    const segs = [];
    for (const rect of rects) {
      const [lo, hi] = edgeRange(rect, o.edge);
      segs.push([lo, hi]);
    }
    segs.sort((a, b) => a[0] - b[0]);
    let covered = o.at - o.w / 2;
    let ok = false;
    for (const [lo, hi] of segs) {
      if (lo <= covered + 0.001 && hi >= covered - 0.001) {
        covered = Math.max(covered, hi);
        if (covered >= o.at + o.w / 2 - 0.001) { ok = true; break; }
      }
    }
    if (!ok) { console.log(`BAD ${kind}: ${o.flat}/${roomId} edge ${o.edge} at ${o.at} w ${o.w} does not fit any rect`); bad++; }
  }
}
const flatLookup = (roomId, fk) => {
  const room = fp.flats[fk].rooms.find((r) => r.id === roomId);
  return room ? room.rects : null;
};
const coreLookup = (roomId) => {
  if (roomId === 'stair') return [[fp.core.stair.x0, fp.core.stair.z0, fp.core.stair.x1, fp.core.stair.z1]];
  if (roomId === 'lift') return [[fp.core.lift.x0, fp.core.lift.z0, fp.core.lift.x1, fp.core.lift.z1]];
  if (roomId === 'lobby') return fp.core.lobby.rects;
  if (roomId === 'outside') return null; // entrance: checked on the lobby side only
  return null;
};
for (const [fk, flat] of Object.entries(fp.flats)) {
  checkOpenings(flat.doors.map((d) => ({ ...d, flat: fk })), 'door', flatLookup);
  checkOpenings((flat.windows || []).map((w) => ({ ...w, flat: fk })), 'window', flatLookup);
}
checkOpenings(fp.coreDoors.filter((d) => d.b !== 'outside'), 'coreDoor', coreLookup);
// The entrance door: check it fits the lobby's south edge.
{
  const d = fp.coreDoors.find((x) => x.b === 'outside');
  const ok = fp.core.lobby.rects.some((rect) => {
    const [lo, hi] = edgeRange(rect, d.edge);
    return d.at - d.w / 2 >= lo - 0.001 && d.at + d.w / 2 <= hi + 0.001;
  });
  if (!ok) { console.log('BAD coreDoor: lobby/outside entrance does not fit'); bad++; }
}
// Every window must sit on an EXTERIOR edge (no neighbouring zone on the
// other side) — a window into a service shaft or another flat is a mistake.
{
  const allZones = zones;
  for (const [fk, flat] of Object.entries(fp.flats)) {
    for (const w of flat.windows || []) {
      const room = flat.rooms.find((r) => r.id === w.room);
      for (const rect of room.rects) {
        const [x0, z0, x1, z1] = rect;
        const lo = w.edge === 'N' || w.edge === 'S' ? w.at - w.w / 2 : w.at - w.w / 2;
        const hi = w.at + w.w / 2;
        const hasNeighbor = allZones.some((o) => {
          if (o === room) return false;
          const [ox0, oz0, ox1, oz1] = o.rect;
          if (w.edge === 'N') return Math.abs(oz1 - z0) < 0.01 && ox0 < hi && ox1 > lo;
          if (w.edge === 'S') return Math.abs(oz0 - z1) < 0.01 && ox0 < hi && ox1 > lo;
          if (w.edge === 'W') return Math.abs(ox1 - x0) < 0.01 && oz0 < hi && oz1 > lo;
          return Math.abs(ox0 - x1) < 0.01 && oz0 < hi && oz1 > lo;
        });
        if (hasNeighbor) { console.log(`BAD window: ${fk}/${w.room} edge ${w.edge} at ${w.at} faces another zone, not the outside`); bad++; }
      }
    }
  }
}
console.log(`opening errors: ${bad}`);
if (overlaps || gaps || bad) { console.log('PLAN TEST: FAIL'); process.exit(1); }
console.log('PLAN TEST: PASS');
