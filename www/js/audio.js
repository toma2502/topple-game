// ============================================================
// AudioSystem — WebAudio synth (no asset files, tiny APK)
// ============================================================
const AudioSystem = (() => {
  let ctx = null;

  function ensure() {
    if (!SaveSystem.get().settings.sound) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, slide = 0) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol = 0.3, lp = 900) {
    const c = ensure(); if (!c) return;
    const n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start();
  }

  function haptic(ms) {
    if (!ms || !SaveSystem.get().settings.haptics) return;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
  }

  return {
    unlock: () => ensure(),
    click(chainIdx) {           // domino tap — rising pitch cascade
      tone(300 + Math.min(chainIdx, 60) * CFG.domino.clickPitchStep, 0.05, 'square', 0.12);
    },
    place() { tone(520, 0.04, 'sine', 0.1); },
    crash() { noise(0.28, 0.4, 1200); haptic(CFG.juice.hapticMs.crash); },
    tnt() { noise(0.5, 0.6, 400); tone(70, 0.4, 'sine', 0.5, -40); haptic(CFG.juice.hapticMs.tnt); },
    gem() { tone(880, 0.1, 'sine', 0.25, 440); tone(1320, 0.18, 'sine', 0.18); },
    coin() { tone(988, 0.06, 'square', 0.12); tone(1319, 0.1, 'square', 0.1); },
    roll() { noise(0.15, 0.12, 500); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110)); haptic(CFG.juice.hapticMs.win); },
    lose() { tone(220, 0.3, 'sawtooth', 0.2, -80); setTimeout(() => tone(160, 0.4, 'sawtooth', 0.2, -60), 180); },
    ui() { tone(700, 0.03, 'sine', 0.12); },
    star(i) { tone(700 + i * 200, 0.2, 'triangle', 0.3); },
  };
})();
window.AudioSystem = AudioSystem;
