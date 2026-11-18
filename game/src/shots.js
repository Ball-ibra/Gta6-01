// The screenshot scenes behind ?shot=start|play|end. Each one drives the real
// rules forward from a fresh world, steered by a simple autopilot that heads
// for the mission marker, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { ROADS_X, ROADS_Y, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 7;
const END_LIMIT_SECONDS = 40;

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Where to drive next: follow the road grid instead of cutting straight
 * across city blocks (and their buildings). On a vertical road, drive to the
 * target's street; on a horizontal road, drive to the target's avenue; off
 * the roads, head for the nearest centreline first.
 */
function roadWaypoint(state) {
  const p = state.player;
  const target = state.mission ? state.mission.target : state.offer;
  if (!target) return null;
  let xv = ROADS_X[0];
  let dxv = Infinity;
  for (const x of ROADS_X) { const d = Math.abs(p.x - x); if (d < dxv) { dxv = d; xv = x; } }
  let yh = ROADS_Y[0];
  let dyh = Infinity;
  for (const y of ROADS_Y) { const d = Math.abs(p.y - y); if (d < dyh) { dyh = d; yh = y; } }
  const onV = dxv < 50;
  const onH = dyh < 50;
  if (onV && Math.abs(p.y - target.y) > 45) return { x: xv, y: target.y };
  if (onH && Math.abs(p.x - target.x) > 45) return { x: target.x, y: yh };
  if (onV || onH) return target;
  return dxv < dyh ? { x: xv, y: p.y } : { x: p.x, y: yh };
}

/** Steer the player's car (or feet) toward the mission / offer marker. */
function autopilot(state) {
  const target = roadWaypoint(state);
  const ctrl = { up: false, down: false, left: false, right: false, handbrake: false };
  if (!target) { ctrl.up = true; return ctrl; }
  const p = state.player;
  const want = Math.atan2(target.x - p.x, -(target.y - p.y));
  const diff = angleDiff(p.angle, want);
  if (state.playerCar) {
    if (Math.abs(diff) > 2.4) {
      // Facing the wrong way: reverse to spin around instead of stalling.
      // Steering is reversed while backing up, so left and right swap.
      ctrl.down = true;
      if (diff > 0.25) ctrl.left = true;
      else if (diff < -0.25) ctrl.right = true;
    } else {
      ctrl.up = true;
      if (diff > 0.25) ctrl.right = true;
      else if (diff < -0.25) ctrl.left = true;
    }
  } else {
    ctrl.up = diff > -1.2 && diff < 1.2;
    ctrl.down = diff > 2 || diff < -2;
    ctrl.left = diff < -0.4;
    ctrl.right = diff > 0.4;
  }
  return ctrl;
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { up: false, down: false, left: false, right: false, handbrake: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Park the player beside a parked car, get in, take the first job, and
    // drive at it with two wanted stars for a busy frame.
    const parked = state.cars.find((c) => c.kind === 'parked');
    if (parked) {
      state.player.x = parked.x + 30;
      state.player.y = parked.y;
      world.tryEnterExit();
    }
    // No wanted level here: this shot is the clean drive to the job, with
    // traffic and the mission marker. The cops star in the end shot.
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.overReason) break;
    }
    return { screen: state.overReason ? SCREEN_OVER : SCREEN_PLAY, best: state.cash };
  }
  // End: five stars, cops all over the player, health nearly gone — the
  // autopilot runs away on foot until the bust lands (or it is forced).
  world.setWanted(5);
  state.player.health = 8;
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const events = world.step(STEP, { up: true, down: false, left: i % 240 < 120, right: i % 240 >= 120, handbrake: false }, false);
    if (events & EVENT_OVER) break;
  }
  if (!state.overReason) world.forceOver('BUSTED');
  return { screen: SCREEN_OVER, best: state.cash };
}
