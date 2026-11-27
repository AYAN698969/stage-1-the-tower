/**
 * Collision: axis-aligned wall boxes + circle-vs-box sliding.
 * Pure JS (no three.js) so it runs in Node for tests.
 * Walls are AABBs; the player circle is treated as a point against
 * boxes expanded by the player radius. X and Z are resolved separately
 * so the player slides along walls.
 */
export class Collider2D {
  constructor() { this.boxes = []; }
  clear() { this.boxes.length = 0; }
  /** @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 */
  addBox(x0, z0, x1, z1) {
    this.boxes.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }
  /** True if point (x,z) is inside any box (expanded by r). */
  hits(x, z, r = 0) {
    for (const b of this.boxes) {
      if (x >= b.x0 - r && x <= b.x1 + r && z >= b.z0 - r && z <= b.z1 + r) return true;
    }
    return false;
  }
  /**
   * Raycast in 2D: distance from (x,z) along unit direction (dx,dz) to the
   * nearest box, or Infinity if none within maxDist. Used to pull the
   * third/second-person camera in when a wall is behind the player.
   * @param {number} x @param {number} z @param {number} dx @param {number} dz @param {number} maxDist
   */
  raycast(x, z, dx, dz, maxDist) {
    let best = Infinity;
    for (const b of this.boxes) {
      // Slab method per axis.
      let tmin = 0; let tmax = maxDist;
      let ok = true;
      for (const [o, d, lo, hi] of [[x, dx, b.x0, b.x1], [z, dz, b.z0, b.z1]]) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) { ok = false; break; }
        } else {
          let t1 = (lo - o) / d;
          let t2 = (hi - o) / d;
          if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }
  /**
   * Move circle (x,z,r) by (dx,dz). Returns { x, z, hitX, hitZ }.
   * @param {number} x @param {number} z @param {number} dx @param {number} dz @param {number} r
   */
  move(x, z, dx, dz, r) {
    let nx = x; let nz = z; let hitX = false; let hitZ = false;
    if (dx !== 0) {
      const tx = x + dx;
      for (const b of this.boxes) {
        if (tx >= b.x0 - r && tx <= b.x1 + r && z >= b.z0 - r && z <= b.z1 + r) {
          nx = dx > 0 ? b.x0 - r : b.x1 + r;
          hitX = true;
          break;
        }
      }
      if (!hitX) nx = tx;
    }
    if (dz !== 0) {
      const tz = z + dz;
      for (const b of this.boxes) {
        if (nx >= b.x0 - r && nx <= b.x1 + r && tz >= b.z0 - r && tz <= b.z1 + r) {
          nz = dz > 0 ? b.z0 - r : b.z1 + r;
          hitZ = true;
          break;
        }
      }
      if (!hitZ) nz = tz;
    }
    return { x: nx, z: nz, hitX, hitZ };
  }
}

/**
 * Height above the floor base inside the dog-leg stairwell, else 0.
 * Flight A (west) rises going north; flight B (east) rises going south;
 * the north landing is at half height. `stair` is floorplan.stair.
 * @param {number} x @param {number} z @param {object} stair
 */
export function stairHeightAt(x, z, stair) {
  const { x0, x1, z0, z1, flightA, flightB, landing } = stair;
  if (x < x0 || x > x1 || z < z0 || z > z1) return 0;
  const half = 3.05 / 2; // 1.525
  const run = 2.34;
  if (x >= flightA.x0 && x <= flightA.x1) {
    const t = Math.min(1, Math.max(0, (flightA.zFrom - z) / run));
    return t * half;
  }
  if (x >= flightB.x0 && x <= flightB.x1) {
    const t = Math.min(1, Math.max(0, (z - flightB.zFrom) / run));
    return half + t * half;
  }
  if (z <= landing.z1) return half; // north landing
  return half; // central well strip: keep at landing height (railings block entry)
}

/** True when (x,z) is inside the stairwell footprint. */
export function inStairwell(x, z, stair) {
  return x >= stair.x0 && x <= stair.x1 && z >= stair.z0 && z <= stair.z1;
}
