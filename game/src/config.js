// Grand Heist: Sunset City — every tuning number and colour in one place.
// The world is a fixed 2400x1800 city; the renderer follows the player with a
// camera, so nothing below depends on the window size.
export const STEP = 1 / 60;

export const WORLD = { width: 2400, height: 1800 };
export const ROAD_W = 90;
// Road centrelines: a grid of avenues (vertical) and streets (horizontal).
export const ROADS_X = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];
export const ROADS_Y = [150, 450, 750, 1050, 1350, 1650];
export const WATER_Y = 1700; // the bay along the south edge

export const PLAYER = {
  radius: 13,
  walkSpeed: 190,
  health: 100,
};

export const CAR = {
  width: 26,
  length: 48,
  accel: 320,
  brake: 520,
  reverseAccel: 200,
  maxSpeed: 430,
  maxReverse: 140,
  turnRate: 2.6,
  drag: 0.55,
  handbrakeDrag: 2.6,
};

export const TRAFFIC_COUNT = 10;
export const PARKED_COUNT = 9;
export const PED_COUNT = 16;

export const WANTED = {
  stealCar: 1,
  hitPed: 2,
  hitTraffic: 1,
  max: 5,
  decayDelay: 8, // seconds with no crime before stars start to fall
  decayEvery: 5, // seconds per star once decaying
  bustTime: 1.2, // seconds pinned by police before BUSTED
};

// Mission pay and timers, in seconds.
export const MISSIONS = {
  taxi: { pay: 150, time: 80 },
  delivery: { pay: 120, time: 65 },
  getaway: { pay: 300, time: 130 },
};
export const MISSION_TYPES = ['taxi', 'delivery', 'getaway'];

export const PALETTE = {
  grass: '#79c25f',
  park: '#4f9e4d',
  road: '#3a3f4a',
  roadEdge: '#565c6b',
  sidewalk: '#c9cdd6',
  lane: '#e8e6c8',
  water: '#3d8fd1',
  sand: '#e8d9a0',
  building: ['#b5654a', '#7a6fae', '#c9a227', '#5b8c5a', '#a85d6e', '#4a7a9e', '#8a6d4b', '#6e7f80'],
  roof: 'rgba(0,0,0,0.18)',
  tree: '#2f7d32',
  text: '#f5f7fa',
  muted: '#c8ccd4',
  panel: 'rgba(12,16,24,0.72)',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'grand-heist.best';
