/**
 * Shell generation test: builds the full building shell in Node (no WebGL)
 * with stub materials and reports geometry stats, door/glass counts and
 * collider counts. Run: node test/shell.test.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirrorFlat } from '../src/core/config.js';
import { buildFloorShell, buildBuilding } from '../src/building/plan.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const building = read('config/building.json');
const fp = read('config/floorplan.json');
if (fp.flats.C === 'mirror:A') fp.flats.C = mirrorFlat(fp.flats.A);

// Stub materials: merging/rendering is never done in Node; only the
// material reference is stored on each mesh.
const stub = (name) => ({ name, isMaterial: true });
const mats = {};
for (const k of ['plaster', 'accent', 'wallInt', 'frame', 'railing', 'bathTile', 'bathFloor', 'floorTile', 'footpath', 'glassOpaque', 'glassClear', 'base', 'roof', 'dark', 'metal', 'white', 'doorWood']) mats[k] = stub(k);

const shell = buildFloorShell(fp, mats);
let totalTris = 0;
for (const [k, geo] of Object.entries(shell.geos)) {
  if (!geo) { console.log(`bucket ${k}: empty`); continue; }
  const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  totalTris += tris;
  console.log(`bucket ${k}: ${geo.attributes.position.count} verts, ${tris} tris`);
}
for (const [k, geo] of Object.entries(shell.floorGeos)) {
  if (!geo) continue;
  const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  totalTris += tris;
  console.log(`floor ${k}: ${geo.attributes.position.count} verts, ${tris} tris`);
}
console.log(`shell total tris: ${totalTris}`);
console.log(`door specs: ${shell.doorSpecs.length} (kinds: ${[...new Set(shell.doorSpecs.map((d) => d.kind))].join(', ')})`);
console.log(`glass specs: ${shell.glassSpecs.length}`);
console.log(`collider boxes: ${shell.collider.boxes.length}`);
console.log(`door specs by flat: A=${shell.doorSpecs.filter((d) => d.flat === 'A').length} B=${shell.doorSpecs.filter((d) => d.flat === 'B').length} C=${shell.doorSpecs.filter((d) => d.flat === 'C').length} core=${shell.doorSpecs.filter((d) => d.flat === 'core').length}`);
console.log(`glass specs by flat: A=${shell.glassSpecs.filter((d) => d.flat === 'A').length} B=${shell.glassSpecs.filter((d) => d.flat === 'B').length} C=${shell.glassSpecs.filter((d) => d.flat === 'C').length} core=${shell.glassSpecs.filter((d) => d.flat === 'core').length}`);

// Full building assembly (all 9 floors + ground + roof).
const built = buildBuilding({ building, floorplan: fp, mats, assets: null });
let meshes = 0;
let allTris = 0;
built.group.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    const g = o.geometry;
    allTris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }
});
console.log(`building meshes: ${meshes}, total tris (all floors, shared geometry counted per instance): ${allTris}`);
console.log(`roof door present: ${!!built.roofDoor}`);
console.log(`flat groups: ${Object.keys(built.flatGroups).length}`);
console.log('SHELL TEST: PASS');
