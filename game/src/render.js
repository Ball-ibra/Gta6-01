// Drawing only: the world's state and the current screen in, pixels out. The
// camera follows the player across the city; the HUD shows cash, wanted
// stars, health, speed and the mission, and a minimap in the corner shows the
// player, the police and the mission marker. Flat colours, clear shapes.
import { CAR, FONT, PALETTE, PLAYER, ROADS_X, ROADS_Y, ROAD_W, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { w: 200, h: 150, margin: 16 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  let vw = 0;
  let vh = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * ratio);
    canvas.height = Math.round(vh * ratio);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, w, h);
  }
  function star(cx, cy, r, filled) {
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = filled ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    context.fill();
  }

  function camera(state) {
    const p = state.player;
    return {
      x: Math.max(0, Math.min(WORLD.width - vw, p.x - vw / 2)),
      y: Math.max(0, Math.min(WORLD.height - vh, p.y - vh / 2)),
    };
  }

  function drawCity(state, cam) {
    // Grass, then the bay and the beach along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, vw, vh);
    context.fillStyle = PALETTE.sand;
    context.fillRect(-cam.x, WATER_Y - 46 - cam.y, WORLD.width, 46);
    context.fillStyle = PALETTE.water;
    context.fillRect(-cam.x, WATER_Y - cam.y, WORLD.width, WORLD.height - WATER_Y);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 2;
    for (let x = 40; x < WORLD.width; x += 160) {
      context.beginPath();
      context.moveTo(x - cam.x, WATER_Y + 22 - cam.y);
      context.lineTo(x + 40 - cam.x, WATER_Y + 22 - cam.y);
      context.stroke();
    }
    // Parks.
    for (const park of state.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
    }
    // Roads: sidewalk border, asphalt, dashed centre line.
    for (const rx of ROADS_X) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_W / 2 - 8 - cam.x, -cam.y, ROAD_W + 16, WORLD.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD.height);
      context.strokeStyle = PALETTE.lane;
      context.lineWidth = 3;
      context.setLineDash([22, 26]);
      context.beginPath();
      context.moveTo(rx - cam.x, -cam.y);
      context.lineTo(rx - cam.x, WORLD.height - cam.y);
      context.stroke();
      context.setLineDash([]);
    }
    for (const ry of ROADS_Y) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(-cam.x, ry - ROAD_W / 2 - 8 - cam.y, WORLD.width, ROAD_W + 16);
      context.fillStyle = PALETTE.road;
      context.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD.width, ROAD_W);
      context.strokeStyle = PALETTE.lane;
      context.lineWidth = 3;
      context.setLineDash([22, 26]);
      context.beginPath();
      context.moveTo(-cam.x, ry - cam.y);
      context.lineTo(WORLD.width - cam.x, ry - cam.y);
      context.stroke();
      context.setLineDash([]);
    }
    // Trees.
    for (const t of state.trees) {
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
      context.fill();
    }
    // Buildings with a darker roof inset.
    for (const b of state.buildings) {
      context.fillStyle = b.color;
      context.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      context.fillStyle = PALETTE.roof;
      context.fillRect(b.x + 8 - cam.x, b.y + 8 - cam.y, b.w - 16, b.h - 16);
    }
  }

  function drawMarker(x, y, cam, color, label, pulse) {
    const px = x - cam.x;
    const py = y - cam.y;
    const r = 16 + (pulse ? Math.sin(performance.now() / 220) * 4 : 0);
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(px, py, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.arc(px, py, 6, 0, Math.PI * 2);
    context.fill();
    if (label) text(label, px, py - 26, 15, color, 'center', true);
  }

  function drawCar(car, cam, isPlayer) {
    const px = car.x - cam.x;
    const py = car.y - cam.y;
    context.save();
    context.translate(px, py);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    context.fillStyle = car.color;
    context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    // Windshield and rear window.
    context.fillStyle = 'rgba(20,30,45,0.85)';
    context.fillRect(-CAR.length / 2 + 9, -CAR.width / 2 + 3, 10, CAR.width - 6);
    context.fillRect(CAR.length / 2 - 15, -CAR.width / 2 + 3, 7, CAR.width - 6);
    // Headlights.
    context.fillStyle = '#fff8c0';
    context.fillRect(-CAR.length / 2, -CAR.width / 2 + 2, 3, 5);
    context.fillRect(-CAR.length / 2, CAR.width / 2 - 7, 3, 5);
    if (isPlayer) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.strokeRect(-CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4);
    }
    if (car.kind === 'police') {
      const flash = Math.floor(car.flash) % 2 === 0;
      context.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
      context.fillRect(-6, -CAR.width / 2 - 2, 12, 6);
      context.fillStyle = '#ffffff';
      context.font = `700 11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('PD', 0, 5);
    }
    context.restore();
  }

  function drawWorld(state, cam) {
    drawCity(state, cam);
    if (state.offer) drawMarker(state.offer.x, state.offer.y, cam, PALETTE.gold, state.offer.type.toUpperCase() + ' JOB', true);
    const m = state.mission;
    if (m && !(m.type === 'getaway' && m.stage === 'escape')) {
      drawMarker(m.target.x, m.target.y, cam, m.stage === 'hideout' ? '#58d68d' : PALETTE.gold, m.stage.toUpperCase(), true);
    }
    for (const ped of state.peds) {
      const px = ped.x - cam.x;
      const py = ped.y - cam.y;
      if (ped.down) {
        context.fillStyle = ped.color;
        context.beginPath();
        context.arc(px, py, 9, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#fff';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(px - 12, py - 12);
        context.lineTo(px + 12, py + 12);
        context.stroke();
      } else {
        context.fillStyle = ped.color;
        context.beginPath();
        context.arc(px, py, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#20242e';
        context.beginPath();
        context.arc(px, py, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const car of state.cars) drawCar(car, cam, car === state.playerCar);
    for (const cop of state.police) drawCar(cop, cam, false);
    if (!state.playerCar) {
      const p = state.player;
      const px = p.x - cam.x;
      const py = p.y - cam.y;
      context.fillStyle = '#ff8c42';
      context.beginPath();
      context.arc(px, py, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#20242e';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(px, py);
      context.lineTo(px + Math.sin(p.angle) * 18, py - Math.cos(p.angle) * 18);
      context.stroke();
    }
  }

  function drawHud(state) {
    panel(12, 12, 300, 96);
    text(`$${state.cash}`, 26, 44, 30, PALETTE.gold, 'left', true);
    text(`Missions ${state.missionsDone}`, 26, 72, 16, PALETTE.text, 'left');
    text(state.playerCar ? 'IN CAR — E to exit' : 'ON FOOT — E near a car to drive', 26, 96, 14, PALETTE.muted, 'left');
    // Wanted stars.
    panel(12, 118, 200, 44);
    for (let i = 0; i < 5; i += 1) star(36 + i * 36, 140, 13, i < state.wanted);
    // Health bar.
    panel(12, 172, 200, 30);
    context.fillStyle = '#5a2020';
    context.fillRect(22, 181, 180, 12);
    context.fillStyle = state.player.health > 30 ? '#58d68d' : PALETTE.red;
    context.fillRect(22, 181, 180 * (state.player.health / PLAYER.health), 12);
    text('HP', 22, 178, 12, PALETTE.text, 'left', true);
    // Speed.
    const speed = state.playerCar ? Math.round(Math.abs(state.playerCar.speed) * 0.22) : 0;
    text(`${speed} mph`, vw - 232, 44, 30, PALETTE.text, 'right', true);
    // Mission line and timer.
    const m = state.mission;
    if (m) {
      panel(vw / 2 - 260, 12, 520, 54);
      text(m.label, vw / 2, 36, 18, PALETTE.gold, 'center', true);
      text(`${Math.max(0, Math.ceil(m.timer))}s`, vw / 2, 58, 15, PALETTE.text, 'center');
    } else if (state.offer) {
      panel(vw / 2 - 260, 12, 520, 40);
      text('New job — drive to the yellow marker', vw / 2, 38, 17, PALETTE.text, 'center', true);
    }
    // Flash message.
    if (state.messageTimer > 0 && state.message) {
      panel(vw / 2 - 300, vh - 64, 600, 40);
      text(state.message, vw / 2, vh - 37, 17, PALETTE.text, 'center');
    }
    // Bust meter.
    if (state.bustTimer > 0) {
      panel(vw / 2 - 140, 76, 280, 30);
      text('BUSTED INCOMING…', vw / 2, 97, 16, PALETTE.red, 'center', true);
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mx = vw - MINIMAP.w - MINIMAP.margin;
    const my = MINIMAP.margin + 56;
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    panel(mx - 6, my - 6, MINIMAP.w + 12, MINIMAP.h + 12);
    context.fillStyle = '#20242e';
    context.fillRect(mx, my, MINIMAP.w, MINIMAP.h);
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(mx + rx * sx - 2, my, 4, MINIMAP.h);
    for (const ry of ROADS_Y) context.fillRect(mx, my + ry * sy, MINIMAP.w, 4);
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my + WATER_Y * sy, MINIMAP.w, MINIMAP.h - WATER_Y * sy);
    const dot = (x, y, r, color) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
      context.fill();
    };
    if (state.offer) dot(state.offer.x, state.offer.y, 4, PALETTE.gold);
    const mm = state.mission;
    if (mm && !(mm.type === 'getaway' && mm.stage === 'escape')) dot(mm.target.x, mm.target.y, 4, '#58d68d');
    for (const cop of state.police) dot(cop.x, cop.y, 3, '#2d7dff');
    dot(state.player.x, state.player.y, 4, '#ffffff');
    // Viewport frame.
    context.strokeStyle = 'rgba(255,255,255,0.6)';
    context.lineWidth = 1;
    const cam = camera(state);
    context.strokeRect(mx + cam.x * sx, my + cam.y * sy, vw * sx, vh * sy);
  }

  function drawScreenPanel(title, lines, prompt) {
    const w = Math.min(680, vw - 40);
    const h = 130 + lines.length * 36 + 70;
    const x = (vw - w) / 2;
    const y = (vh - h) / 2;
    panel(x, y, w, h);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, w, h);
    text(title, vw / 2, y + 72, 46, PALETTE.gold, 'center', true);
    for (let i = 0; i < lines.length; i += 1) text(lines[i], vw / 2, y + 128 + i * 36, 20, PALETTE.muted, 'center');
    text(prompt, vw / 2, y + h - 32, 22, PALETTE.text, 'center', true);
  }

  function draw(state, screen, best, muted) {
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, vw, vh);
    const cam = camera(state);
    drawWorld(state, cam);
    if (screen === SCREEN_TITLE) {
      drawScreenPanel('GRAND HEIST', [
        'Sunset City — drive, work, and outrun the law.',
        'WASD / arrows — move & drive · E — enter / exit car',
        'Space — handbrake · P — pause · R — restart · M — mute',
        'Steal cars, dodge the cops, finish jobs, get paid.',
        `Best cash: $${best}`,
      ], 'Press Enter or click to start');
      return;
    }
    drawHud(state);
    if (muted) text('MUTED', vw - 16, vh - 16, 14, PALETTE.muted, 'right');
    if (screen === SCREEN_PAUSED) {
      drawScreenPanel('PAUSED', [
        'WASD / arrows — move & drive · E — enter / exit car',
        'Space — handbrake · R — restart · M — mute',
        'Jobs pay cash. Stars mean the cops want you.',
      ], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const busted = state.overReason === 'BUSTED';
      drawScreenPanel(busted ? 'BUSTED!' : 'WASTED!', [
        `Cash earned: $${state.cash}`,
        `Missions completed: ${state.missionsDone}`,
        `Best cash: $${best}`,
        busted ? 'The Sunset City PD caught you.' : 'Sunset City got the better of you.',
      ], 'Press R or Enter to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
