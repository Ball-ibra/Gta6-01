// Generated WebAudio sounds — no audio files. A low engine hum that follows
// the car's speed, a two-tone siren while wanted, and short bleeps for
// pickups, crashes and mission pay. Everything is lazy (the context is only
// created after a user gesture) and wrapped so a browser without audio just
// stays silent instead of throwing.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (muted || !ensure()) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* silent */ }
  }

  return {
    get muted() { return muted; },
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
    pickup() { blip(880, 0.12, 'sine', 0.14); setTimeout(() => blip(1320, 0.15, 'sine', 0.14), 90); },
    cash() { blip(660, 0.1, 'triangle', 0.14); setTimeout(() => blip(990, 0.18, 'triangle', 0.14), 100); },
    crash() { blip(90, 0.25, 'sawtooth', 0.2); },
    busted() { blip(220, 0.4, 'square', 0.12); setTimeout(() => blip(165, 0.5, 'square', 0.12), 250); },
    /** Called every frame: engine follows speed, siren wails while wanted. */
    update(dt, speed, inCar, wanted) {
      if (muted || !ctx) return;
      try {
        if (ctx.state === 'suspended') return;
        if (engineGain) engineGain.gain.value = inCar ? 0.02 + Math.min(0.05, Math.abs(speed) / 8000) : 0;
        if (engineOsc) engineOsc.frequency.value = 50 + Math.abs(speed) * 0.35;
        if (sirenGain) {
          sirenGain.gain.value = wanted > 0 ? 0.02 : 0;
          if (wanted > 0) {
            sirenTimer += dt;
            if (sirenTimer > 0.45) {
              sirenTimer = 0;
              sirenHigh = !sirenHigh;
              sirenOsc.frequency.value = sirenHigh ? 950 : 700;
            }
          }
        }
      } catch { /* silent */ }
    },
  };
}
