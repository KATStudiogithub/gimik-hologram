import { useEffect, useRef, useState } from 'react';
import { Maximize2, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { CeremonyConfig } from '../types/ceremony';
import { ceremonialAudio } from '../utils/ceremonialAudio';
import { MADANI_LOGO_SRC } from '../utils/logoProcessor';

interface OutroScreenProps {
  config: CeremonyConfig;
  logoUrl: string | null;
  muted: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onReplayVideo: () => void;
  onBackToStage: () => void;
}

interface CelebratoryParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  color: string;
}

export function OutroScreen({
  config,
  logoUrl,
  muted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
  onReplayVideo,
  onBackToStage,
}: OutroScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [applausePlaying, setApplausePlaying] = useState(true);

  const triggerApplause = () => {
    ceremonialAudio.unlock();
    ceremonialAudio.playFestiveApplause(10.5);
    setApplausePlaying(true);
  };

  useEffect(() => {
    ceremonialAudio.unlock();
    ceremonialAudio.playFestiveApplause(10.5);
    setApplausePlaying(true);

    const endTimer = window.setTimeout(() => {
      setApplausePlaying(false);
    }, 10500);

    return () => {
      window.clearTimeout(endTimer);
      ceremonialAudio.stopApplause();
    };
  }, []);

  // Celebratory Golden Gala Starlight & Light-Ray Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const palette = ['#FDE047', '#FBBF24', '#F59E0B', '#93C5FD', '#FCA5A5', '#FFFBEB'];
    const particles: CelebratoryParticle[] = Array.from({ length: 85 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.018,
      vy: -(0.012 + Math.random() * 0.032),
      size: 1.5 + Math.random() * 3.8,
      alpha: 0.3 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));

    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now * 0.001;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Sweeping royal light beams from bottom stage horizon
      const cx = width * 0.5;
      const baseY = height * 1.05;
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + Math.sin(t * 0.35 + i * 1.1) * 0.55 + (i - 2.5) * 0.19;
        const len = Math.max(width, height) * 1.15;
        const ex = cx + Math.cos(angle) * len;
        const ey = baseY + Math.sin(angle) * len;

        const rayGrad = ctx.createLinearGradient(cx, baseY, ex, ey);
        rayGrad.addColorStop(
          0,
          i % 2 === 0 ? 'rgba(251, 191, 36, 0.14)' : 'rgba(59, 130, 246, 0.12)',
        );
        rayGrad.addColorStop(0.6, 'rgba(251, 191, 36, 0.03)');
        rayGrad.addColorStop(1, 'rgba(4, 8, 20, 0)');

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(cx, baseY);
        ctx.lineTo(ex - Math.sin(angle) * 95, ey + Math.cos(angle) * 95);
        ctx.lineTo(ex + Math.sin(angle) * 95, ey - Math.cos(angle) * 95);
        ctx.closePath();
        ctx.fill();
      }

      // Rising celebratory golden & national palette embers
      for (const p of particles) {
        p.x += p.vx * dt + Math.sin(t * 0.9 + p.phase) * 0.004 * dt;
        p.y += p.vy * dt;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;

        const twinkle = 0.55 + 0.45 * Math.sin(t * 3.1 + p.phase);
        const px = p.x * width;
        const py = p.y * height;
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * twinkle * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = p.alpha * twinkle;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      data-screen="outro"
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      className="relative min-h-screen w-full overflow-hidden bg-[#040814] text-slate-100 flex flex-col justify-between"
    >
      {/* Celebratory Background Gradient & Canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 74% 62% at 50% 42%, rgba(28, 63, 170, 0.36) 0%, rgba(12, 22, 54, 0.82) 55%, #040814 100%)',
        }}
      />
      <canvas
        ref={canvasRef}
        data-testid="outro-celebration-canvas"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Minimal Top Bar (controls hidden cleanly in fullscreen mode) */}
      {!isFullscreen && (
        <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
          <span className="font-display text-base font-semibold tracking-tight text-slate-100">
            Malaysia MADANI
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Aktifkan bunyi' : 'Senyapkan bunyi'}
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-700/70 bg-slate-950/65 text-slate-300 hover:text-amber-300 transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Mod skrin penuh"
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-700/70 bg-slate-950/65 text-slate-300 hover:text-amber-300 transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {/* Center Grand Closing Tribute */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-6">
        {/* Radiant Logo Emblem */}
        <div className="relative mb-7 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute h-52 w-52 rounded-full blur-3xl opacity-55"
            style={{
              background:
                'radial-gradient(circle, rgba(251, 191, 36, 0.55) 0%, rgba(37, 99, 235, 0.35) 60%, transparent 100%)',
            }}
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 240 240"
            className="absolute h-56 w-56 animate-spin-slow opacity-70"
          >
            <circle
              cx="120"
              cy="120"
              r="108"
              fill="none"
              stroke="rgba(251, 191, 36, 0.55)"
              strokeWidth="1.2"
              strokeDasharray="10 8"
            />
          </svg>
          <img
            src={logoUrl ?? MADANI_LOGO_SRC}
            alt="Logo Rasmi Malaysia MADANI"
            referrerPolicy="no-referrer"
            className="relative z-10 h-36 sm:h-44 w-auto object-contain drop-shadow-[0_12px_36px_rgba(251,191,36,0.45)] animate-float-slow select-none"
          />
        </div>

        <p className="text-sm sm:text-base font-medium tracking-wide text-amber-300 mb-3">
          Dengan Rasminya Dilancarkan
        </p>

        <h1
          className="font-display font-semibold tracking-tight text-white max-w-4xl leading-[1.12]"
          style={{
            fontSize: 'clamp(1.85rem, 3.8vw, 3.35rem)',
            textWrap: 'balance',
          }}
        >
          {config.eventTitle}
        </h1>

        <div className="mt-5 h-px w-28 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

        <p className="mt-5 text-base sm:text-xl font-medium text-slate-100 max-w-2xl">
          Sekalung Penghargaan &amp; Terima Kasih
        </p>

        <div className="mt-3 space-y-1 text-sm text-slate-300 max-w-2xl">
          <p className="font-semibold text-amber-200/95">{config.vipName}</p>
          <p className="text-slate-300">
            {config.vipTitle}
            {config.vipDepartment ? ` · ${config.vipDepartment}` : ''}
          </p>
          <p className="text-slate-400">{config.eventDate}</p>
        </div>

        {/* Subtle Applause Audio Cue + Understated Closing Actions (hidden in fullscreen mode) */}
        {!isFullscreen && (
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={triggerApplause}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-amber-400 text-[#040814] text-sm font-semibold shadow-[0_0_28px_rgba(251,191,36,0.28)] hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              <Volume2 className="h-4 w-4" />
              <span>{applausePlaying ? 'Tepukan Sedang Bergema' : 'Ulang Tepukan Meriah'}</span>
            </button>

            <button
              type="button"
              onClick={onReplayVideo}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700/80 bg-slate-900/60 text-sm font-medium text-slate-200 hover:border-amber-400/50 hover:text-amber-200 transition-colors whitespace-nowrap"
            >
              <Play className="h-4 w-4" />
              <span>Tonton Semula Video</span>
            </button>

            <button
              type="button"
              onClick={onBackToStage}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700/80 bg-slate-900/60 text-sm font-medium text-slate-200 hover:border-amber-400/50 hover:text-amber-200 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Kembali ke Pentas</span>
            </button>
          </div>
        )}
      </main>

      {/* Quiet Ceremonial Footer (hidden in fullscreen mode) */}
      {!isFullscreen && (
        <footer className="relative z-10 w-full px-6 py-5 text-center text-xs text-slate-400">
          {config.eventSubtitle}
        </footer>
      )}
    </div>
  );
}
