/** Loads the JSON configs. Type-C is the mirror of Type-A across x = 0. */

/** @param {string} path */
export async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return r.json();
}

function mirrorRect([x0, z0, x1, z1]) { return [-x1, z0, -x0, z1]; }
function mirrorEdge(e) { return e === 'E' ? 'W' : e === 'W' ? 'E' : e; }

/** Mirror a flat definition (rooms, doors, windows) across x = 0. */
export function mirrorFlat(flat) {
  const rooms = flat.rooms.map((r) => ({
    ...r,
    rects: r.rects.map(mirrorRect),
    openEdges: r.openEdges ? r.openEdges.map(mirrorEdge) : undefined,
  }));
  const doors = flat.doors.map((d) => ({
    ...d,
    edge: mirrorEdge(d.edge),
    // "at" is an x-coordinate on N/S edges (negate) and a z-coordinate on E/W edges (keep)
    at: d.edge === 'N' || d.edge === 'S' ? -d.at : d.at,
  }));
  const windows = (flat.windows || []).map((w) => ({
    ...w,
    edge: mirrorEdge(w.edge),
    at: w.edge === 'N' || w.edge === 'S' ? -w.at : w.at,
  }));
  return { rooms, doors, windows };
}

function mirrorFurniture(list) {
  return list.map((f) => ({ ...f, pos: [-f.pos[0], f.pos[1]], rotY: f.rotY == null ? f.rotY : -f.rotY }));
}

/** Load every config file and resolve mirrors. */
export async function loadConfigs() {
  const [building, floorplan, furniture, npcs, cutscenes, world] = await Promise.all([
    loadJSON('config/building.json'),
    loadJSON('config/floorplan.json'),
    loadJSON('config/furniture.json'),
    loadJSON('config/npcs.json'),
    loadJSON('config/cutscenes.json'),
    loadJSON('config/world.json'),
  ]);
  if (floorplan.flats.C === 'mirror:A') floorplan.flats.C = mirrorFlat(floorplan.flats.A);
  if (furniture.C === 'mirror:A') furniture.C = mirrorFurniture(furniture.A);
  return { building, floorplan, furniture, npcs, cutscenes, world };
}
