/** String dictionary: all UI text goes through here so Bangla can be added later. */
export const STRINGS = {
  tapToStart: 'Tap to Start',
  loading: 'Loading Shanti Neer…',
  objective: 'Objective',
  objectiveText: 'Go to Flat 4B',
  objectiveDone: 'You reached Flat 4B!',
  locationGround: 'Ground Floor — Lobby',
  locationFloor: 'Floor {n}',
  locationFlat: 'Floor {n} — Flat {f}',
  locationStreet: 'Street — Shanti Neer',
  promptOpenDoor: 'Tap to open door',
  promptCallLift: 'Tap to call the lift',
  promptLiftFloor: 'Choose a floor',
  promptLocked: 'Roof access closed',
  promptEnterFlat: 'Tap to enter Flat {f}',
  skip: 'Skip',
  pause: 'Paused',
  resume: 'Resume',
  restart: 'Restart',
  mute: 'Mute',
  unmute: 'Unmute',
  camera: 'Camera',
  camFirst: '1st Person',
  camThird: '3rd Person',
  camSecond: '2nd Person',
  menu: 'Menu',
  help: 'Help',
  helpText: 'Left stick: move • Drag right side: look • Interact button: use doors & lift • Camera button: change view',
  quality: 'Quality',
  qualityLow: 'Low',
  qualityMed: 'Medium',
  qualityHigh: 'High',
  floor: 'Floor',
  flat: 'Flat',
  youAreHere: 'You are here',
  liftGoingUp: 'Going up…',
  liftGoingDown: 'Going down…',
  liftArrived: 'Floor {n}',
  pressToStart: 'Tap anywhere to start',
  rotatePhone: 'Rotate your phone to landscape for the best view',
};

/** @param {string} key @param {Object} [vars] */
export function t(key, vars) {
  let s = STRINGS[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
