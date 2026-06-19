/* Native Web Audio — no external files */
const GameAudio = (() => {
  let ctx = null;
  let muted = false;
  let musicInterval = null;
  let musicStep = 0;

  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    if (muted) return;
    const c = ensure();
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol = 0.08) {
    if (muted) return;
    const c = ensure();
    const bufferSize = c.sampleRate * dur;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  return {
    init() { ensure(); },

    toggle() {
      muted = !muted;
      if (muted) this.stopMusic();
      else this.startMusic();
      return muted;
    },

    isMuted() { return muted; },

    startMusic() {
      if (muted || musicInterval) return;
      const notes = [523, 587, 659, 587, 523, 494, 440, 494];
      musicInterval = setInterval(() => {
        tone(notes[musicStep % notes.length], 0.25, 'triangle', 0.06);
        musicStep++;
      }, 500);
    },

    stopMusic() {
      if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
    },

    step() { tone(300, 0.05, 'square', 0.04); },

    jump() {
      tone(400, 0.1, 'sine', 0.1);
      tone(600, 0.15, 'sine', 0.08, 0.08);
    },

    siren() {
      if (muted) return;
      const c = ensure();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.linearRampToValueAtTime(900, t + 0.3);
      osc.frequency.linearRampToValueAtTime(600, t + 0.6);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    },

    fire() {
      noise(0.4, 0.06);
      tone(120, 0.3, 'sawtooth', 0.05);
    },

    water() {
      noise(0.2, 0.05);
      tone(800, 0.15, 'sine', 0.04);
    },

    arrest() {
      tone(880, 0.12, 'square', 0.1);
      tone(1100, 0.2, 'square', 0.08, 0.1);
    },

    star() {
      tone(523, 0.1, 'sine', 0.12);
      tone(659, 0.1, 'sine', 0.1, 0.1);
      tone(784, 0.2, 'sine', 0.1, 0.2);
    },

    cheer() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'triangle', 0.1, i * 0.08));
    },

    honk() {
      tone(350, 0.15, 'square', 0.08);
      tone(280, 0.2, 'square', 0.06, 0.12);
    },

    button() { tone(500, 0.08, 'sine', 0.08); },

    alert() {
      tone(440, 0.15, 'triangle', 0.1);
      tone(330, 0.2, 'triangle', 0.08, 0.12);
    }
  };
})();
