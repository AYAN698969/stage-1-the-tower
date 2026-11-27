/**
 * Lift state machine test (Node, no WebGL): call from G to floor 3,
 * ride back to G, verify states, door slide and car Y.
 * Run: node test/lift.test.js
 */
import { Lift } from '../src/building/lift.js';

const mats = { metal: {}, plaster: {}, railing: {}, dark: {} };
const ctx = {
  building: { floors: 9, floorHeight: 3.05 },
  floorplan: { lift: { x0: 0.92, x1: 2.75, z0: -7.62, z1: -5.49, car: { w: 1.5, d: 1.8 } } },
  mats,
};
const lift = new Lift(ctx);
const step = (n, dt = 0.1) => { for (let i = 0; i < n; i++) lift.update(dt); };
const assert = (c, msg) => { if (!c) { console.log('FAIL:', msg, '| state=', lift.state, 'floor=', lift.currentFloor, 'doorT=', lift.doorT.toFixed(2), 'carY=', lift.carY.toFixed(2)); process.exit(1); } };

assert(lift.state === 'idle' && lift.currentFloor === 0, 'starts idle at G');
lift.call(3);
step(5); // doors already closed, should start moving
assert(lift.state === 'moving', 'moves after call');
// 3 floors = 9.15 m at 1.2 m/s = ~7.6 s
step(80);
assert(lift.currentFloor === 3 && lift.state === 'opening', 'arrives at floor 3 and opens');
step(15);
assert(lift.state === 'open' && lift.doorT === 1, 'doors fully open at 3');
assert(Math.abs(lift.carY - 9.15) < 0.01, 'car Y is 9.15');
// Ride back down via the panel.
lift.select(0);
step(15);
assert(lift.state === 'moving', 'closes and moves back to G');
step(80);
assert(lift.currentFloor === 0 && lift.state === 'opening', 'arrives at G');
step(15);
assert(lift.state === 'open', 'doors open at G');
// Auto-close after the hold time.
step(90);
assert(lift.state === 'idle' && lift.doorT === 0, 'auto-closes and idles');
// Call to the floor it is already on: just opens.
lift.call(0);
step(15);
assert(lift.state === 'open', 'call to current floor opens the doors');
console.log('containsPoint inside:', lift.containsPoint(1.83, -6.55), '| outside:', lift.containsPoint(0, 0));
console.log('LIFT TEST: PASS');
