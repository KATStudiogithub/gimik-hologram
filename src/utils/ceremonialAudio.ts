export const EPIC_MUSIC_SRC = `${import.meta.env.BASE_URL}assets/aistudio/Cinematic_Epic_Music_by_Infraction__No_Copyright_Music__Action_7dd0a834.mp3`;

export const AI_VOICE_FILES = {
  announcement: `${import.meta.env.BASE_URL}assets/audio/ai-announcement-ms-my.mp3`,
  count3: `${import.meta.env.BASE_URL}assets/audio/ai-countdown-3.mp3`,
  count2: `${import.meta.env.BASE_URL}assets/audio/ai-countdown-2.mp3`,
  count1: `${import.meta.env.BASE_URL}assets/audio/ai-countdown-1.mp3`,
} as const;

type AiVoiceKey = keyof typeof AI_VOICE_FILES;

/**
 * Procedural Web Audio API + Epic Soundtrack + Authentic Bahasa Melayu Malaysia (ms-MY) AI Voice
 * for the Majlis Apresiasi Kecemerlangan & Penyerahan Sekolah Angkat MADANI ceremony.
 */
class CeremonialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  // Epic background music element & fade timer
  private epicAudio: HTMLAudioElement | null = null;
  private epicFadeInterval: number | null = null;
  private epicTargetVolume = 0.78;

  // Authentic ms-MY AI voice audio elements & fallback timers
  private voiceClips: Partial<Record<AiVoiceKey, HTMLAudioElement>> = {};
  private activeVoiceClip: HTMLAudioElement | null = null;
  private speechFallbackTimer: number | null = null;

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
    this.preloadAiVoices();
  }

  private getVoiceClip(key: AiVoiceKey): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.voiceClips[key]) {
      const audio = new Audio(AI_VOICE_FILES[key]);
      audio.preload = 'auto';
      audio.muted = this.muted;
      this.voiceClips[key] = audio;
    }
    return this.voiceClips[key] ?? null;
  }

  private preloadAiVoices(): void {
    if (typeof window === 'undefined') return;
    (Object.keys(AI_VOICE_FILES) as AiVoiceKey[]).forEach((key) => {
      this.getVoiceClip(key);
    });
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.88, this.ctx.currentTime, 0.04);
    }
    if (this.epicAudio) {
      this.epicAudio.muted = muted;
    }
    Object.values(this.voiceClips).forEach((clip) => {
      if (clip) clip.muted = muted;
    });
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Start playing the continuous cinematic epic soundtrack on ceremony start */
  public startEpicMusic(): void {
    if (typeof window === 'undefined') return;
    this.clearEpicFade();

    if (!this.epicAudio) {
      const audio = new Audio(EPIC_MUSIC_SRC);
      audio.loop = true;
      audio.preload = 'auto';
      this.epicAudio = audio;
    }

    this.epicAudio.muted = this.muted;
    this.epicTargetVolume = 0.78;
    this.epicAudio.volume = 0.78;
    if (this.epicAudio.paused) {
      this.epicAudio.currentTime = 0;
      this.epicAudio.play().catch(() => {});
    }
  }

  /** Smoothly duck or fade epic music volume (e.g. during futuristic AI announcement) */
  public fadeEpicMusic(targetVolume: number, durationMs = 700, stopAtZero = false): void {
    if (!this.epicAudio) return;
    this.clearEpicFade();
    const startVol = this.epicAudio.volume;
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    this.epicTargetVolume = clampedTarget;
    const startTime = performance.now();

    this.epicFadeInterval = window.setInterval(() => {
      if (!this.epicAudio) {
        this.clearEpicFade();
        return;
      }
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / Math.max(50, durationMs));
      this.epicAudio.volume = Math.max(0, Math.min(1, startVol + (clampedTarget - startVol) * t));
      if (t >= 1) {
        this.clearEpicFade();
        if (stopAtZero && clampedTarget <= 0.01) {
          this.epicAudio.pause();
          this.epicAudio.currentTime = 0;
        }
      }
    }, 30);
  }

  public stopEpicMusic(fadeMs = 400): void {
    if (!this.epicAudio) return;
    if (fadeMs <= 0 || this.epicAudio.paused) {
      this.clearEpicFade();
      this.epicAudio.pause();
      this.epicAudio.currentTime = 0;
      return;
    }
    this.fadeEpicMusic(0, fadeMs, true);
  }

  public getEpicMusicState(): { src: string; playing: boolean; volume: number } {
    return {
      src: EPIC_MUSIC_SRC,
      playing: Boolean(this.epicAudio && !this.epicAudio.paused),
      volume: this.epicAudio ? this.epicAudio.volume : this.epicTargetVolume,
    };
  }

  private clearEpicFade(): void {
    if (this.epicFadeInterval !== null) {
      window.clearInterval(this.epicFadeInterval);
      this.epicFadeInterval = null;
    }
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

  /** Sleek futuristic holographic "Akses Diterima" biometric verification chime */
  public playAccessGranted(): void {
    this.stopChargeLoop();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Luminous futuristic rising tri-tone + shimmer pad
    const tones = [587.33, 880.0, 1174.66, 1760.0];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i < 2 ? 'triangle' : 'sine';
      const t0 = now + i * 0.075;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.35);
    });

    // Warm futuristic resonant chord bed beneath the AI voice
    [146.83, 293.66, 440.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(780, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 4.9);
    });
  }

  /** Dramatic futuristic countdown beat (3 -> 2 -> 1) */
  public playCountdownTick(count: 3 | 2 | 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Deep heartbeat sub-impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(105 + (3 - count) * 18, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.45, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.6);

    // Crystalline futuristic ping rising in tension from 3 -> 2 -> 1
    const pingFreq = count === 3 ? 659.25 : count === 2 ? 783.99 : 1046.5;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pingFreq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.78);
  }

  /** Plays the authentic Bahasa Melayu Malaysia (ms-MY) futuristic AI launch announcement */
  public playMalayAnnouncement(onDone?: () => void): void {
    this.stopSpeech();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.speechFallbackTimer !== null) {
        window.clearTimeout(this.speechFallbackTimer);
        this.speechFallbackTimer = null;
      }
      if (this.activeVoiceClip) {
        this.activeVoiceClip.onended = null;
        this.activeVoiceClip.onerror = null;
      }
      onDone?.();
    };

    const clip = this.getVoiceClip('announcement');
    if (!clip) {
      this.speechFallbackTimer = window.setTimeout(finish, 3800);
      return;
    }

    this.activeVoiceClip = clip;
    clip.muted = this.muted;
    clip.volume = 1.0;
    clip.currentTime = 0;

    // Guaranteed ceiling so the sequence always advances smoothly even if playback stalls
    this.speechFallbackTimer = window.setTimeout(finish, 12800);

    clip.onended = finish;
    clip.onerror = () => {
      // If static MP3 somehow fails, fall back strictly to ms-MY speech (never Indonesian)
      this.speakMalayFallback(
        'Akses diterima. Majlis Apresiasi Kecemerlangan dan penyerahan sekolah angkat madani SK Merbau Pulas kini bermula.',
        { minDurationMs: 3800, fallbackMs: 9000, onDone: finish },
      );
    };

    const playPromise = clip.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Browser autoplay policy blocked audio (e.g. headless test without gesture) -> hold overlay cleanly
        if (this.speechFallbackTimer !== null) {
          window.clearTimeout(this.speechFallbackTimer);
        }
        this.speechFallbackTimer = window.setTimeout(finish, 3600);
      });
    }
  }

  /** Plays the authentic Bahasa Melayu Malaysia (ms-MY) futuristic AI countdown number (3, 2, 1) */
  public playMalayCountdown(count: 3 | 2 | 1): void {
    const key: AiVoiceKey =
      count === 3 ? 'count3' : count === 2 ? 'count2' : 'count1';
    const clip = this.getVoiceClip(key);
    if (!clip) return;

    if (this.activeVoiceClip && this.activeVoiceClip !== clip) {
      this.activeVoiceClip.pause();
      this.activeVoiceClip.currentTime = 0;
    }
    this.activeVoiceClip = clip;
    clip.muted = this.muted;
    clip.volume = 1.0;
    clip.currentTime = 0;
    clip.onended = null;
    clip.onerror = null;
    clip.play().catch(() => {});
  }

  /** Strict Bahasa Melayu Malaysia (ms-MY) TTS fallback — explicitly excludes Indonesian (id-ID) voices */
  private speakMalayFallback(
    text: string,
    options?: {
      minDurationMs?: number;
      fallbackMs?: number;
      onDone?: () => void;
    },
  ): void {
    const minDurationMs = options?.minDurationMs ?? 3600;
    const fallbackMs = Math.max(minDurationMs, options?.fallbackMs ?? 9000);
    const startedAt = performance.now();
    let finished = false;

    const completeNow = () => {
      if (finished) return;
      finished = true;
      if (this.speechFallbackTimer !== null) {
        window.clearTimeout(this.speechFallbackTimer);
        this.speechFallbackTimer = null;
      }
      options?.onDone?.();
    };

    const scheduleComplete = () => {
      if (finished) return;
      const remaining = Math.max(0, minDurationMs - (performance.now() - startedAt));
      if (remaining <= 20) {
        completeNow();
      } else {
        if (this.speechFallbackTimer !== null) {
          window.clearTimeout(this.speechFallbackTimer);
        }
        this.speechFallbackTimer = window.setTimeout(completeNow, remaining);
      }
    };

    if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.muted) {
      this.speechFallbackTimer = window.setTimeout(completeNow, minDurationMs);
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const voices = synth.getVoices();
      // Strictly match Malay (Malaysia) only — NEVER select id / id-ID / Indonesian
      const malayMyVoice = voices.find((v) => {
        const lang = v.lang.toLowerCase();
        const name = v.name.toLowerCase();
        const isIndonesian = lang.startsWith('id') || name.includes('indonesia');
        if (isIndonesian) return false;
        return (
          lang === 'ms-my' ||
          lang.startsWith('ms-') ||
          lang === 'ms' ||
          name.includes('malay') ||
          name.includes('yasmin') ||
          name.includes('osman')
        );
      });

      if (!malayMyVoice) {
        this.speechFallbackTimer = window.setTimeout(completeNow, minDurationMs);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ms-MY';
      utterance.voice = malayMyVoice;
      utterance.rate = 0.94;
      utterance.pitch = 0.92;
      utterance.volume = 1;
      utterance.onend = scheduleComplete;
      utterance.onerror = scheduleComplete;

      this.speechFallbackTimer = window.setTimeout(completeNow, fallbackMs);
      synth.speak(utterance);
    } catch {
      this.speechFallbackTimer = window.setTimeout(completeNow, minDurationMs);
    }
  }

  public stopSpeech(): void {
    if (this.speechFallbackTimer !== null) {
      window.clearTimeout(this.speechFallbackTimer);
      this.speechFallbackTimer = null;
    }
    if (this.activeVoiceClip) {
      this.activeVoiceClip.onended = null;
      this.activeVoiceClip.onerror = null;
      this.activeVoiceClip.pause();
      this.activeVoiceClip.currentTime = 0;
      this.activeVoiceClip = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public stopAll(): void {
    this.stopChargeLoop();
    this.stopApplause();
    this.stopSpeech();
    this.stopEpicMusic(0);
  }
}

export const ceremonialAudio = new CeremonialAudioEngine();
