/**
 * Distant Dhaka skyline + sky gradient dome.
 * Replaces the old flat grey-blue neighbour blocks: from any veranda the
 * player now sees varied low-poly towers with lit windows, and a warm
 * gradient sky instead of a flat background colour.
 * Cheap for mobile GPUs: the whole skyline is 3 draw calls
 * (dome, merged buildings, merged windows), fog:false so it stays
 * readable at 60-115 m.
 * Returns { group, collider } — the near row (just across the road)
 * blocks the player like the old neighbour blocks did.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Collider2D } from '../core/collision.js';

/** Deterministic RNG so the skyline is the same every load. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLORS = [
  new THREE.Color(0xd8cdb8), // sand
  new THREE.Color(0xc9b8a3), // warm beige
  new THREE.Color(0xb8a88f), // brick-ish
  new THREE.Color(0x9fb4a8), // pale green
  new THREE.Color(0xa8b8c8), // pale blue-grey
  new THREE.Color(0xd0c0a8), // cream
  new THREE.Color(0x8f9aa8), // slate
];

const SKY_TOP = new THREE.Color(0x4f8fd0);
const SKY_MID = new THREE.Color(0x9cc3e5);
const SKY_HORIZON = new THREE.Color(0xf2dfba);

/** Sky gradient dome (BackSide sphere, vertex-coloured, fog off). */
function buildSkyDome() {
  const geo = new THREE.SphereGeometry(300, 24, 12);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 300, -0.1, 1); // 0 = horizon, 1 = zenith
    if (t < 0.25) c.copy(SKY_HORIZON).lerp(SKY_MID, t / 0.25);
    else c.copy(SKY_MID).lerp(SKY_TOP, (t - 0.25) / 0.75);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1;
  dome.name = 'sky-dome';
  return dome;
}

/**
 * Add one building to the merged lists.
 * @param {object} acc { geos: [], winPos: [], winIdx: [], winCount }
 * Windows go on the face that looks towards the plot centre (0,0).
 */
function addBuilding(acc, rng, x, z, w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, h / 2, z);
  const col = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  acc.geos.push(geo);
  // Rooftop water tank on some buildings (silhouette variety).
  if (rng() < 0.4) {
    const tank = new THREE.BoxGeometry(1.6, 1.1, 1.6);
    tank.translate(x + (rng() - 0.5) * w * 0.4, h + 0.55, z + (rng() - 0.5) * d * 0.4);
    const tc = new THREE.Color(0x5a5f66);
    const tn = tank.attributes.position.count;
    const tcol = new Float32Array(tn * 3);
    for (let i = 0; i < tn; i++) { tcol[i * 3] = tc.r; tcol[i * 3 + 1] = tc.g; tcol[i * 3 + 2] = tc.b; }
    tank.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
    acc.geos.push(tank);
  }
  // Windows on the face towards the centre.
  const faceX = Math.abs(x) > Math.abs(z); // face is E/W if |x| dominates
  const nx = faceX ? -Math.sign(x) : 0;
  const nz = faceX ? 0 : -Math.sign(z);
  const faceW = faceX ? d : w; // width of the facing side
  const cols = Math.max(1, Math.floor(faceW / 2.2));
  const rows = Math.max(1, Math.floor((h - 3) / 2.6));
  const ww = 0.7; const wh = 1.0;
  for (let r = 0; r < rows; r++) {
    for (let colI = 0; colI < cols; colI++) {
      const y = 2.2 + r * 2.6;
      if (y + wh > h - 0.6) continue;
      const along = -faceW / 2 + (colI + 0.5) * (faceW / cols);
      // Centre of the window on the face plane, pushed 0.06 out.
      const cx = faceX ? x + nx * (w / 2 + 0.06) : x + along;
      const cz = faceX ? z + along : z + nz * (d / 2 + 0.06);
      // Quad corners: u axis along the face, v axis up.
      const ux = faceX ? 0 : 1; const uz = faceX ? 1 : 0;
      const hw = ww / 2; const hh = wh / 2;
      const base = acc.winCount * 4;
      acc.winPos.push(
        cx - ux * hw, y - hh, cz - uz * hw,
        cx + ux * hw, y - hh, cz + uz * hw,
        cx + ux * hw, y + hh, cz + uz * hw,
        cx - ux * hw, y + hh, cz - uz * hw,
      );
      acc.winIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      acc.winCount++;
    }
  }
}

/**
 * Build the skyline.
 * @param {object} ctx { building }
 */
export function buildSkyline(ctx) {
  const group = new THREE.Group();
  group.name = 'skyline';
  const collider = new Collider2D();
  const rng = mulberry32(ctx.building?.seed ?? 7);
  group.add(buildSkyDome());

  const acc = { geos: [], winPos: [], winIdx: [], winCount: 0 };
  // Near row just across the road (south, z 30-38): enclosed street feel.
  for (let i = 0; i < 8; i++) {
    const x = -42 + i * 12 + rng() * 4;
    const z = 31 + rng() * 6;
    const w = 7 + rng() * 4;
    const h = 8 + rng() * 10;
    const d = 7 + rng() * 2;
    addBuilding(acc, rng, x, z, w, h, d);
    collider.addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  }
  // Far ring in all directions (radius 55-115).
  for (let i = 0; i < 30; i++) {
    const ang = (i / 30) * Math.PI * 2 + rng() * 0.15;
    const r = 58 + rng() * 55;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    // Keep the road corridor open at the ends (x beyond +-45, near z 20).
    if (Math.abs(z - 19.75) < 8 && Math.abs(x) > 45) continue;
    const w = 8 + rng() * 8;
    const h = 12 + rng() * 30;
    const d = 8 + rng() * 8;
    addBuilding(acc, rng, x, z, w, h, d);
  }
  const buildings = new THREE.Mesh(
    mergeGeometries(acc.geos, false),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, fog: false }),
  );
  buildings.name = 'skyline-buildings';
  group.add(buildings);

  const winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute('position', new THREE.Float32BufferAttribute(acc.winPos, 3));
  winGeo.setIndex(acc.winIdx);
  const windows = new THREE.Mesh(winGeo, new THREE.MeshBasicMaterial({ color: 0xffe6a0, fog: false, side: THREE.DoubleSide }));
  windows.name = 'skyline-windows';
  group.add(windows);

  return { group, collider };
}
