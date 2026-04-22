// SoundManager - Web Audio API synthesized sounds (no external files needed)
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.4;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  createGain(volume = 1) {
    const gain = this.ctx.createGain();
    gain.gain.value = volume * this.masterVolume;
    gain.connect(this.ctx.destination);
    return gain;
  }

  // === TITLE SCREEN - Deep gong/bell ===
  playTitleGong() {
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Low fundamental
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 80;
    const g1 = this.createGain(0.6);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 4);
    osc1.connect(g1);
    osc1.start(now);
    osc1.stop(now + 4);

    // Mid harmonic
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 160;
    const g2 = this.createGain(0.3);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 3);
    osc2.connect(g2);
    osc2.start(now);
    osc2.stop(now + 3);

    // High shimmer
    const osc3 = this.ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.value = 440;
    osc3.frequency.exponentialRampToValueAtTime(220, now + 3);
    const g3 = this.createGain(0.15);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 3);
    osc3.connect(g3);
    osc3.start(now);
    osc3.stop(now + 3);

    // Noise burst for impact
    this.playNoiseBurst(0.3, 0.1);
  }

  // === MENU CLICK ===
  playClick() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
    const g = this.createGain(0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // === DICE ROLL ===
  playDiceRoll() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 200 + Math.random() * 400;
      const g = this.createGain(0.08);
      g.gain.setValueAtTime(0.08 * this.masterVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  // === HIT / DAMAGE ===
  playHit() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    const g = this.createGain(0.35);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.25);
    this.playNoiseBurst(0.2, 0.08);
  }

  // === CRITICAL HIT ===
  playCrit() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    // Heavy impact
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    const g = this.createGain(0.5);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.5);
    // Flash tone
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 800;
    const g2 = this.createGain(0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(g2);
    osc2.start(now);
    osc2.stop(now + 0.15);
    this.playNoiseBurst(0.4, 0.15);
  }

  // === DEATH ===
  playDeath() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
    const g = this.createGain(0.4);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 2);
  }

  // === VICTORY FANFARE ===
  playVictory() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const t = now + i * 0.25;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = this.createGain(0.3);
      g.gain.setValueAtTime(0.3 * this.masterVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  // === KEY PICKUP - Chime ===
  playKeyPickup() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    [880, 1100, 1320].forEach((f, i) => {
      const t = now + i * 0.1;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.createGain(0.2);
      g.gain.setValueAtTime(0.2 * this.masterVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // === TELEPORT - Whoosh ===
  playTeleport() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
    const g = this.createGain(0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // === MONSTER ENCOUNTER ===
  playMonsterEncounter() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 100;
    osc.frequency.setValueAtTime(120, now + 0.1);
    osc.frequency.setValueAtTime(80, now + 0.2);
    osc.frequency.setValueAtTime(100, now + 0.3);
    const g = this.createGain(0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // === HEAL ===
  playHeal() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    [440, 554, 659].forEach((f, i) => {
      const t = now + i * 0.15;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.createGain(0.15);
      g.gain.setValueAtTime(0.15 * this.masterVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // === SHUFFLE (Pictomancer) ===
  playShuffle() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 300 + Math.random() * 600;
      const g = this.createGain(0.06);
      g.gain.setValueAtTime(0.06 * this.masterVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  // === STEP / MOVE ===
  playStep() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 100 + Math.random() * 50;
    const g = this.createGain(0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // === SKILL USE ===
  playSkill() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    const g = this.createGain(0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // === TURN CHANGE ===
  playTurnChange() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;
    const g = this.createGain(0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // === Utility: Noise Burst ===
  playNoiseBurst(volume = 0.1, duration = 0.1) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const g = this.createGain(volume);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(g);
    source.start();
  }
}
