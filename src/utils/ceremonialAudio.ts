/**
 * Procedural Web Audio API sound designer for the Malaysia MADANI launch ceremony.
 * Zero external audio URLs—reliable, zero-latency dramatic SFX & festive concert-hall applause.
 */
class CeremonialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  // Continuous charging drone nodes
  private chargeOsc1: OscillatorNode | null = null;
  private chargeOsc2: OscillatorNode | null = null;
  private chargeFilter: BiquadFilterNode | null = null;
  private chargeGain: GainNode | null = null;
  private chargeActive = false;

  // Applause scheduling state
  private applauseTimers: number[] = [];
  private applauseNodes: AudioNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.88;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.88, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const duration = 3;
    const length = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 1.4));
      }
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /** Ethereal crystalline chime when open palm is recognized */
  public playPalmDetected(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.055);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.085, now + idx * 0.055 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.85);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.9);
    });
  }

  /** Deep futuristic magnetic lock-on resonance when VIP grabs the Logo MADANI */
  public playLogoGrab(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Sub impact sweep
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(52, now + 0.35);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.32, now + 0.025);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.5);

    // Majestic rising harmonic fifth
    [293.66, 440, 587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.94, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.075, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.15);
    });
  }

  /** Continuous dramatic rising synth/orchestral swell during pedestal docking charge (0..1) */
  public updateChargeLoop(progress: number, active: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    if (active && !this.chargeActive) {
      this.chargeActive = true;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(73.42, now); // D2
      osc2.frequency.setValueAtTime(146.83, now); // D3

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      filter.Q.setValueAtTime(4.5, now);

      gain.gain.setValueAtTime(0.001, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);

      this.chargeOsc1 = osc1;
      this.chargeOsc2 = osc2;
      this.chargeFilter = filter;
      this.chargeGain = gain;
    }

    if (active && this.chargeActive && this.chargeOsc1 && this.chargeOsc2 && this.chargeFilter && this.chargeGain) {
      const p = Math.max(0, Math.min(1, progress));
      // Pitch rises dramatically as charge approaches 100%
      const baseFreq = 73.42 * (1 + p * 1.15);
      this.chargeOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.chargeOsc2.frequency.setTargetAtTime(baseFreq * 2.005, now, 0.05);
      this.chargeFilter.frequency.setTargetAtTime(240 + Math.pow(p, 1.7) * 3200, now, 0.05);
      this.chargeGain.gain.setTargetAtTime(0.06 + p * 0.22, now, 0.05);
    } else if (!active && this.chargeActive) {
      this.stopChargeLoop();
    }
  }

  public stopChargeLoop(): void {
    if (!this.chargeActive) return;
    this.chargeActive = false;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;

    if (this.chargeGain && ctx) {
      this.chargeGain.gain.setTargetAtTime(0.0001, now, 0.06);
    }
    const o1 = this.chargeOsc1;
    const o2 = this.chargeOsc2;
    this.chargeOsc1 = null;
    this.chargeOsc2 = null;
    this.chargeFilter = null;
    this.chargeGain = null;

    setTimeout(() => {
      try {
        o1?.stop();
        o2?.stop();
        o1?.disconnect();
        o2?.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    }, 260);
  }

  /** Monumental ceremonial launch ignition boom + brass/bell crescendo */
  public playLaunchClimax(): void {
    this.stopChargeLoop();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // 1. Cinematic deep sub-bass drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(115, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 1.35);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.55, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 1.85);

    // 2. Whoosh energy burst (filtered noise)
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(3600, now + 0.35);
    filter.frequency.exponentialRampToValueAtTime(280, now + 1.4);
    filter.Q.value = 1.4;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.38, now + 0.06);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 1.55);

    // 3. Royal D-Major ceremonial chord swell + golden shimmer arpeggio
    const chord = [146.83, 220.0, 293.66, 369.99, 440.0, 587.33, 739.99, 1174.66];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = idx < 4 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.025);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400 + idx * 350, now);
      lp.frequency.exponentialRampToValueAtTime(520, now + 2.2);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.025);
      gain.gain.linearRampToValueAtTime(idx < 4 ? 0.095 : 0.065, now + idx * 0.025 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.025);
      osc.stop(now + 2.35);
    });
  }

  /** Rich, festive auditorium applause + warm ceremonial closing fanfare */
  public playFestiveApplause(durationSec = 10): void {
    this.stopApplause();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // 1. Uplifting ceremonial closing chime chord
    const fanfareNotes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0];
    fanfareNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i < 3 ? 'triangle' : 'sine';
      const start = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.6);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 2.7);
      this.applauseNodes.push(osc, gain);
    });

    // 2. Dense stereo audience applause bed (3 layered bandpass noise streams)
    const buffer = this.getNoiseBuffer(ctx);
    const bedConfigs = [
      { freq: 1050, q: 0.75, pan: -0.45, level: 0.24 },
      { freq: 1550, q: 0.85, pan: 0.45, level: 0.24 },
      { freq: 2150, q: 1.1, pan: 0.0, level: 0.16 },
    ];

    bedConfigs.forEach((cfg) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(cfg.freq, now);
      bp.Q.value = cfg.q;

      // Subtle organic room swell LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.65 + Math.random() * 0.5;
      lfoGain.gain.value = 0.04;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(cfg.level, now + 0.75);
      gain.gain.setValueAtTime(cfg.level * 1.08, now + durationSec * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = cfg.pan;
        src.connect(bp);
        bp.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain!);
        this.applauseNodes.push(panner);
      } else {
        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.masterGain!);
      }

      src.start(now, Math.random() * 1.5);
      src.stop(now + durationSec + 0.1);
      lfo.start(now);
      lfo.stop(now + durationSec + 0.1);
      this.applauseNodes.push(src, bp, lfo, lfoGain, gain);
    });

    // 3. Individual crisp hand-clap transients scattered in stereo across the hall
    const startMs = performance.now();
    const totalMs = durationSec * 1000;

    const triggerClapBurst = () => {
      const elapsed = performance.now() - startMs;
      if (elapsed >= totalMs - 400 || !this.ctx || !this.masterGain) return;

      const env =
        elapsed < 900
          ? elapsed / 900
          : elapsed > totalMs - 2600
            ? Math.max(0, (totalMs - elapsed) / 2600)
            : 1;

      const clapsInWave = 2 + Math.floor(Math.random() * 4);
      const t0 = this.ctx.currentTime;

      for (let i = 0; i < clapsInWave; i++) {
        const offset = Math.random() * 0.09;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 950 + Math.random() * 1750;
        bp.Q.value = 1.6 + Math.random() * 1.8;

        const g = this.ctx.createGain();
        const amp = (0.08 + Math.random() * 0.13) * env;
        const decay = 0.025 + Math.random() * 0.035;
        g.gain.setValueAtTime(0.0001, t0 + offset);
        g.gain.linearRampToValueAtTime(amp, t0 + offset + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + decay);

        if (this.ctx.createStereoPanner) {
          const pan = this.ctx.createStereoPanner();
          pan.pan.value = Math.random() * 1.7 - 0.85;
          src.connect(bp);
          bp.connect(g);
          g.connect(pan);
          pan.connect(this.masterGain);
        } else {
          src.connect(bp);
          bp.connect(g);
          g.connect(this.masterGain);
        }

        src.start(t0 + offset, Math.random() * 2.2, decay + 0.02);
      }

      const nextDelay = 55 + Math.random() * 85;
      const tid = window.setTimeout(triggerClapBurst, nextDelay);
      this.applauseTimers.push(tid);
    };

    const initialTid = window.setTimeout(triggerClapBurst, 120);
    this.applauseTimers.push(initialTid);
  }

  public stopApplause(): void {
    this.applauseTimers.forEach((id) => window.clearTimeout(id));
    this.applauseTimers = [];
    this.applauseNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    });
    this.applauseNodes = [];
  }

  public stopAll(): void {
    this.stopChargeLoop();
    this.stopApplause();
  }
}

export const ceremonialAudio = new CeremonialAudioEngine();
