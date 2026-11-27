/** Collider2D.raycast: distance to the nearest wall box along a ray. */
import { Collider2D } from '../src/core/collision.js';

const col = new Collider2D();
col.addBox(0, 0, 2, 0.25); // a wall along x, z 0..0.25
col.addBox(5, -1, 5.25, 3); // a wall along z, x 5..5.25

// Ray east from (-1, 0.1) hits the first wall's west face at x=0 -> dist 1.
console.assert(Math.abs(col.raycast(-1, 0.1, 1, 0, 10) - 1) < 1e-9, 'east hit');
// Ray north from (1, -2) hits the first wall's south face at z=0 -> dist 2.
console.assert(Math.abs(col.raycast(1, -2, 0, 1, 10) - 2) < 1e-9, 'north hit');
// Ray west from (-1, 0.1) hits nothing.
console.assert(col.raycast(-1, 0.1, -1, 0, 10) === Infinity, 'west miss');
// Ray east from (3, 1) hits the second wall at x=5 -> dist 2.
console.assert(Math.abs(col.raycast(3, 1, 1, 0, 10) - 2) < 1e-9, 'second wall');
// Ray from inside a box returns 0 (already inside).
console.assert(col.raycast(1, 0.1, 1, 0, 10) === 0, 'inside');
// maxDist clamps: east from (-1, 0.1) with maxDist 0.5 -> Infinity.
console.assert(col.raycast(-1, 0.1, 1, 0, 0.5) === Infinity, 'maxDist');
// Diagonal ray from (-1, -1) toward (1, 1): hits the first wall's corner region.
// The wall spans x 0..2, z 0..0.25; the ray enters at x=0 (t=1) where z=0, on the edge.
const d = col.raycast(-1, -1, Math.SQRT1_2, Math.SQRT1_2, 10);
console.assert(Math.abs(d - Math.SQRT2) < 1e-9, `diagonal hit, got ${d}`);
console.log('raycast tests PASS');
