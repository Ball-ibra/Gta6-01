// The game's rules and state, with no drawing and no browser in it: the city,
// the player on foot and in cars, traffic, pedestrians, police, the wanted
// system and the three mission types. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds, screen
// changes) without the world knowing about screens or sound.
import { CAR, MISSIONS, MISSION_TYPES, PALETTE, PED_COUNT, PARKED_COUNT, PLAYER, ROADS_X, ROADS_Y, TRAFFIC_COUNT, WANTED, WATER_Y, WORLD } from './config.js';

export const EVENT_CRASH = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CASH = 4;
export const EVENT_OVER = 8;

const CAR_COLORS = ['#e5534b', '#4fc3f7', '#f2c94c', '#9b7ede', '#e8e8e8', '#5b8c5a', '#ff8c42', '#c0c8d0'];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(bx - ax, -(by - ay)); }
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Push a circle out of a rectangle; returns the penetration depth, or 0.
function circleRectPush(c, r, rect) {
  const cx = clamp(c.x, rect.x, rect.x + rect.w);
  const cy = clamp(c.y, rect.y, rect.y + rect.h);
  const dx = c.x - cx;
  const dy = c.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  const d = Math.sqrt(d2) || 0.001;
  const push = r - d;
  c.x += (dx / d) * push;
  c.y += (dy / d) * push;
  return push;
}

export function createWorld(random) {
  // ---- city generation (seeded, so the same seed builds the same city) ----
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let bx = 0; bx < ROADS_X.length - 1; bx += 1) {
    for (let by = 0; by < ROADS_Y.length - 1; by += 1) {
      const x0 = ROADS_X[bx] + 60;
      const y0 = ROADS_Y[by] + 60;
      const w = ROADS_X[bx + 1] - ROADS_X[bx] - 120;
      const h = ROADS_Y[by + 1] - ROADS_Y[by] - 120;
      if (random() < 0.22) {
        // A park instead of buildings, with a few trees.
        parks.push({ x: x0, y: y0, w, h });
        const n = 3 + Math.floor(random() * 4);
        for (let i = 0; i < n; i += 1) trees.push({ x: x0 + 20 + random() * (w - 40), y: y0 + 20 + random() * (h - 40), r: 12 + random() * 8 });
        continue;
      }
      const n = random() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i += 1) {
        const bw = 70 + random() * 80;
        const bh = 55 + random() * 70;
        const px = x0 + (n === 1 ? (w - bw) / 2 : i * (w - bw) + 8);
        const py = y0 + (h - bh) / 2 + (random() - 0.5) * 20;
        buildings.push({ x: px, y: py, w: bw, h: bh, color: PALETTE.building[Math.floor(random() * PALETTE.building.length)] });
      }
    }
  }

  const state = {
    buildings, parks, trees,
    player: { x: 450, y: 450, angle: 0, health: PLAYER.health },
    playerCar: null,
    cars: [],
    peds: [],
    police: [],
    cash: 0,
    score: 0,
    missionsDone: 0,
    wanted: 0,
    lastCrime: -999,
    wantedTimer: 0,
    bustTimer: 0,
    mission: null,
    offer: null,
    offerTimer: 2,
    offerIndex: 0,
    message: '',
    messageTimer: 0,
    elapsed: 0,
    overReason: '',
    trafficHitCd: 0,
  };

  function randomIntersection() {
    return { x: ROADS_X[Math.floor(random() * ROADS_X.length)], y: ROADS_Y[Math.floor(random() * ROADS_Y.length)] };
  }
  function randomRoadPoint() {
    if (random() < 0.5) return { x: ROADS_X[Math.floor(random() * ROADS_X.length)] + (random() < 0.5 ? -22 : 22), y: 60 + random() * (WORLD.height - 200) };
    return { x: 60 + random() * (WORLD.width - 200), y: ROADS_Y[Math.floor(random() * ROADS_Y.length)] + (random() < 0.5 ? -22 : 22) };
  }
  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const road = vertical ? ROADS_X[Math.floor(random() * ROADS_X.length)] : ROADS_Y[Math.floor(random() * ROADS_Y.length)];
    const dir = random() < 0.5 ? 1 : -1;
    const lane = random() < 0.5 ? -22 : 22;
    return {
      kind: 'traffic', x: vertical ? road + lane : 60 + random() * (WORLD.width - 120),
      y: vertical ? 60 + random() * (WORLD.height - 200) : road + lane,
      angle: vertical ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 120 + random() * 70, color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
      axis: vertical ? 'v' : 'h', dir, hitCd: 0,
    };
  }
  function spawnParkedCar() {
    const p = randomRoadPoint();
    const vertical = Math.abs(p.x - ROADS_X.reduce((a, b) => Math.abs(p.x - b) < Math.abs(p.x - a) ? b : a)) < 40;
    // Parked on the road itself (in a lane), so a car you climb into is
    // already on tarmac and never starts inside a city block.
    return {
      kind: 'parked', x: p.x, y: p.y,
      angle: vertical ? 0 : Math.PI / 2, speed: 0,
      color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], axis: vertical ? 'v' : 'h', dir: 1, hitCd: 0,
    };
  }
  function spawnPed() {
    const vertical = random() < 0.5;
    const road = vertical ? ROADS_X[Math.floor(random() * ROADS_X.length)] : ROADS_Y[Math.floor(random() * ROADS_Y.length)];
    const side = random() < 0.5 ? -58 : 58;
    return {
      x: vertical ? road + side : 80 + random() * (WORLD.width - 160),
      y: vertical ? 80 + random() * (WORLD.height - 220) : road + side,
      angle: 0, speed: 35 + random() * 25, down: false, downTimer: 0,
      axis: vertical ? 'v' : 'h', dir: random() < 0.5 ? 1 : -1,
      color: ['#f2c94c', '#e8e8e8', '#4fc3f7', '#ff8c42'][Math.floor(random() * 4)],
    };
  }
  function spawnPolice() {
    // Appear on a road a little way from the player, never on top of them.
    let p = randomRoadPoint();
    let tries = 0;
    while (dist(p.x, p.y, state.player.x, state.player.y) < 550 && tries < 12) { p = randomRoadPoint(); tries += 1; }
    const car = {
      kind: 'police', x: p.x, y: p.y, angle: 0, speed: 0, color: '#20242e',
      axis: 'v', dir: 1, hitCd: 0, flash: random() * 10,
    };
    state.police.push(car);
    return car;
  }

  function setMessage(text) { state.message = text; state.messageTimer = 4; }
  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, WANTED.max);
    state.lastCrime = state.elapsed;
    state.wantedTimer = 0;
  }
  function damage(amount) {
    state.player.health = Math.max(0, state.player.health - amount);
    if (state.player.health <= 0) {
      state.overReason = 'WASTED';
      return true;
    }
    return false;
  }

  function startMission(type) {
    const def = MISSIONS[type];
    if (type === 'getaway') {
      addWanted(3);
      state.mission = { type, stage: 'escape', target: randomIntersection(), pay: def.pay, timer: def.time, label: 'GETAWAY — lose the cops!' };
      setMessage('GETAWAY! Lose the cops, then reach the hideout.');
    } else {
      const first = randomIntersection();
      state.mission = { type, stage: 'pickup', target: first, pay: def.pay, timer: def.time, label: type === 'taxi' ? 'TAXI — pick up the fare' : 'DELIVERY — collect the package' };
      setMessage(type === 'taxi' ? 'Taxi job: pick up the fare at the marker.' : 'Delivery: collect the package at the marker.');
    }
  }

  function reset() {
    state.player.x = 450;
    state.player.y = 480;
    state.player.angle = 0;
    state.player.health = PLAYER.health;
    state.playerCar = null;
    state.cars = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < PARKED_COUNT; i += 1) state.cars.push(spawnParkedCar());
    state.police = [];
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed());
    state.cash = 0;
    state.score = 0;
    state.missionsDone = 0;
    state.wanted = 0;
    state.lastCrime = -999;
    state.wantedTimer = 0;
    state.bustTimer = 0;
    state.mission = null;
    state.offer = null;
    state.offerTimer = 2;
    state.offerIndex = 0;
    state.message = 'Welcome to Sunset City. Grab a car and find work!';
    state.messageTimer = 5;
    state.elapsed = 0;
    state.overReason = '';
    state.trafficHitCd = 0;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      const d = dist(car.x, car.y, state.player.x, state.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  /** E key: get in the nearest car, or step out of the one being driven. */
  function tryEnterExit() {
    if (state.playerCar) {
      const car = state.playerCar;
      car.kind = 'parked';
      car.speed = 0;
      state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      state.player.angle = car.angle;
      state.playerCar = null;
      return 'exit';
    }
    const car = nearestCar(85);
    if (!car) return null;
    if (car.kind === 'traffic') {
      addWanted(WANTED.stealCar);
      setMessage('Car stolen! The cops are on to you.');
    }
    car.kind = 'player';
    state.playerCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    return 'enter';
  }

  function setWanted(n) {
    state.wanted = clamp(n, 0, WANTED.max);
    state.lastCrime = state.elapsed;
    while (state.police.length < state.wanted) spawnPolice();
  }

  /** Where a cop drives next: the road grid when far from the player (so
   * they drive around blocks instead of into them), straight at the player
   * once close enough to ram. */
  function chaseWaypoint(x, y, tx, ty) {
    let xv = ROADS_X[0];
    let dxv = Infinity;
    for (const rx of ROADS_X) { const d = Math.abs(x - rx); if (d < dxv) { dxv = d; xv = rx; } }
    let yh = ROADS_Y[0];
    let dyh = Infinity;
    for (const ry of ROADS_Y) { const d = Math.abs(y - ry); if (d < dyh) { dyh = d; yh = ry; } }
    if (dxv < 50 && Math.abs(y - ty) > 70) return { x: xv, y: ty };
    if (dyh < 50 && Math.abs(x - tx) > 70) return { x: tx, y: yh };
    if (dxv < 50 || dyh < 50) return { x: tx, y: ty };
    return dxv < dyh ? { x: xv, y } : { x, y: yh };
  }

  function forceOver(reason) {
    state.overReason = reason;
    return EVENT_OVER;
  }

  function moveCar(car, dt) {
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.y -= Math.cos(car.angle) * car.speed * dt;
  }
  function collideBuildingsCircle(c, r, speedRef) {
    let hit = false;
    for (const b of buildings) {
      if (circleRectPush(c, r, b) > 0) hit = true;
    }
    return hit;
  }

  function step(dt, ctrl, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.trafficHitCd > 0) state.trafficHitCd -= dt;

    // ---- traffic: straight down their road, wrapping at the far end ----
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      if (car.axis === 'v') {
        car.y += car.dir * car.speed * dt;
        if (car.y > WORLD.height - 60) car.y = 60;
        if (car.y < 60) car.y = WORLD.height - 60;
      } else {
        car.x += car.dir * car.speed * dt;
        if (car.x > WORLD.width - 60) car.x = 60;
        if (car.x < 60) car.x = WORLD.width - 60;
      }
      if (car.hitCd > 0) car.hitCd -= dt;
    }

    // ---- pedestrians: stroll the sidewalks ----
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) { Object.assign(ped, spawnPed()); }
        continue;
      }
      if (ped.axis === 'v') {
        ped.y += ped.dir * ped.speed * dt;
        if (ped.y > WORLD.height - 220) ped.dir = -1;
        if (ped.y < 80) ped.dir = 1;
        ped.angle = ped.dir > 0 ? Math.PI : 0;
      } else {
        ped.x += ped.dir * ped.speed * dt;
        if (ped.x > WORLD.width - 80) ped.dir = -1;
        if (ped.x < 80) ped.dir = 1;
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }

    if (harmless) return events;

    // ---- the player ----
    const car = state.playerCar;
    if (car) {
      const steer = (ctrl.left ? -1 : 0) + (ctrl.right ? 1 : 0);
      if (ctrl.up) car.speed += CAR.accel * dt;
      if (ctrl.down) {
        car.speed = car.speed > 0 ? car.speed - CAR.brake * dt : car.speed - CAR.reverseAccel * dt;
      }
      if (ctrl.handbrake) car.speed -= car.speed * CAR.handbrakeDrag * dt;
      else car.speed -= car.speed * CAR.drag * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const grip = clamp(Math.abs(car.speed) / 120, 0, 1);
      car.angle += steer * CAR.turnRate * grip * dt * (car.speed >= 0 ? 1 : -1);
      const prevX = car.x;
      const prevY = car.y;
      moveCar(car, dt);
      // Buildings: bounce off, hard hits hurt.
      if (collideBuildingsCircle(car, 20, car)) {
        if (Math.abs(car.speed) > 200) {
          if (damage((Math.abs(car.speed) - 200) / 22)) events |= EVENT_OVER;
          events |= EVENT_CRASH;
          setMessage('Crash! Watch the buildings.');
        }
        car.speed *= -0.25;
        if (Math.abs(car.x - prevX) < 0.5 && Math.abs(car.y - prevY) < 0.5) { car.x = prevX; car.y = prevY; }
      }
      car.x = clamp(car.x, 30, WORLD.width - 30);
      car.y = clamp(car.y, 30, WATER_Y - 12);
      state.player.x = car.x;
      state.player.y = car.y;
      state.player.angle = car.angle;

      // Hit a pedestrian at speed: they go down, the law notices.
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.abs(car.speed) > 60 && dist(car.x, car.y, ped.x, ped.y) < 30) {
          ped.down = true;
          ped.downTimer = 12;
          addWanted(WANTED.hitPed);
          events |= EVENT_CRASH;
          setMessage('You hit a pedestrian! Wanted level up.');
        }
      }
      // Hit a traffic car: a shunt, and a star if it was hard.
      for (const other of state.cars) {
        if (other.kind !== 'traffic' || other.hitCd > 0) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 44 && d > 0.01) {
          const nx = (car.x - other.x) / d;
          const ny = (car.y - other.y) / d;
          const rel = Math.abs(car.speed - other.speed);
          car.x += nx * (44 - d) / 2;
          car.y += ny * (44 - d) / 2;
          other.x -= nx * (44 - d) / 2;
          other.y -= ny * (44 - d) / 2;
          if (rel > 150) {
            other.hitCd = 1;
            if (damage((rel - 150) / 30)) events |= EVENT_OVER;
            events |= EVENT_CRASH;
            if (state.trafficHitCd <= 0) {
              addWanted(WANTED.hitTraffic);
              state.trafficHitCd = 2;
              setMessage('You smashed into traffic! Wanted level up.');
            }
          }
          car.speed *= 0.6;
          other.speed *= 0.5;
        }
      }
    } else {
      // On foot: WASD moves in screen directions, buildings block the way.
      const dx = (ctrl.right ? 1 : 0) - (ctrl.left ? 1 : 0);
      const dy = (ctrl.down ? 1 : 0) - (ctrl.up ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        state.player.x += (dx / len) * PLAYER.walkSpeed * dt;
        state.player.y += (dy / len) * PLAYER.walkSpeed * dt;
        state.player.angle = Math.atan2(dx / len, -(dy / len));
      }
      for (const b of buildings) circleRectPush(state.player, PLAYER.radius, b);
      state.player.x = clamp(state.player.x, 20, WORLD.width - 20);
      state.player.y = clamp(state.player.y, 20, WATER_Y - 12);
    }

    // ---- police: spawn to match the wanted level, chase, ram, arrest ----
    if (state.wanted > 0) {
      while (state.police.length < state.wanted) spawnPolice();
      let nearest = Infinity;
      for (const cop of state.police) {
        cop.flash += dt * 6;
        const d = dist(cop.x, cop.y, state.player.x, state.player.y);
        nearest = Math.min(nearest, d);
        const wp = d > 260 ? chaseWaypoint(cop.x, cop.y, state.player.x, state.player.y) : state.player;
        const want = angleTo(cop.x, cop.y, wp.x, wp.y);
        cop.angle += clamp(angleDiff(cop.angle, want), -2.4 * dt, 2.4 * dt);
        const target = 300 + state.wanted * 18;
        cop.speed += (target - cop.speed) * Math.min(1, 1.4 * dt);
        moveCar(cop, dt);
        collideBuildingsCircle(cop, 20);
        cop.x = clamp(cop.x, 30, WORLD.width - 30);
        cop.y = clamp(cop.y, 30, WATER_Y - 12);
        if (cop.hitCd > 0) cop.hitCd -= dt;
        if (d < 46 && cop.hitCd <= 0) {
          cop.hitCd = 0.8;
          cop.speed *= 0.4;
          if (damage(7)) events |= EVENT_OVER;
          events |= EVENT_CRASH;
          setMessage('The cops are ramming you!');
        }
      }
      // Pinned by a cop while slow or on foot: the bust meter fills.
      const slow = !car || Math.abs(car.speed) < 40;
      if (nearest < 55 && slow) {
        state.bustTimer += dt;
        if (state.bustTimer > WANTED.bustTime) {
          state.overReason = 'BUSTED';
          events |= EVENT_OVER;
        }
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
      // Lay low: no crime for a while and no cop close, stars fall one by one.
      if (state.elapsed - state.lastCrime > WANTED.decayDelay && nearest > 450) {
        state.wantedTimer += dt;
        if (state.wantedTimer >= WANTED.decayEvery) {
          state.wantedTimer = 0;
          state.wanted -= 1;
          if (state.wanted === 0) {
            state.police = [];
            if (state.mission && state.mission.type === 'getaway' && state.mission.stage === 'escape') {
              state.mission.stage = 'hideout';
              state.mission.target = randomIntersection();
              state.mission.label = 'GETAWAY — reach the hideout';
              setMessage('You lost them! Now reach the hideout.');
            }
          }
        }
      }
    } else if (state.player.health < PLAYER.health) {
      // Catch a breath while the heat is off.
      state.player.health = Math.min(PLAYER.health, state.player.health + 2 * dt);
    }

    // ---- missions: an offer appears, walk/drive to it to take the job ----
    if (!state.mission) {
      state.offerTimer -= dt;
      if (!state.offer && state.offerTimer <= 0) {
        const type = MISSION_TYPES[state.offerIndex % MISSION_TYPES.length];
        state.offerIndex += 1;
        const at = randomIntersection();
        state.offer = { type, x: at.x, y: at.y };
        setMessage(type === 'taxi' ? 'Taxi job available — drive to the yellow marker.' : type === 'delivery' ? 'Delivery job available — drive to the yellow marker.' : 'Getaway job available — drive to the yellow marker.');
      } else if (state.offer && dist(state.player.x, state.player.y, state.offer.x, state.offer.y) < 60) {
        const type = state.offer.type;
        state.offer = null;
        state.offerTimer = 4;
        startMission(type);
        events |= EVENT_PICKUP;
      }
    } else {
      const m = state.mission;
      m.timer -= dt;
      if (m.timer <= 0) {
        state.mission = null;
        state.offerTimer = 3;
        setMessage('Mission failed — out of time.');
      } else if (dist(state.player.x, state.player.y, m.target.x, m.target.y) < 58) {
        if (m.type === 'getaway' && m.stage === 'escape') {
          // Reaching the marker while still wanted does nothing; escape first.
        } else if (m.stage === 'pickup') {
          m.stage = 'dropoff';
          m.target = randomIntersection();
          m.label = m.type === 'taxi' ? 'TAXI — drop off the fare' : 'DELIVERY — deliver the package';
          setMessage(m.type === 'taxi' ? 'Fare picked up! Drop them off at the marker.' : 'Package collected! Deliver it to the marker.');
          events |= EVENT_PICKUP;
        } else {
          state.cash += m.pay;
          state.score = state.cash;
          state.missionsDone += 1;
          setMessage(`Mission complete! +$${m.pay}`);
          state.mission = null;
          state.offerTimer = 4;
          events |= EVENT_CASH;
        }
      }
    }

    if (events & EVENT_OVER) return events;
    return events;
  }

  reset();
  return { state, reset, step, tryEnterExit, setWanted, forceOver };
}
