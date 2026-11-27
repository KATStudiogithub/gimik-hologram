import { Camera, Hand, Maximize2, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import type { CeremonyConfig, InputMode } from '../types/ceremony';
import { MADANI_LOGO_SRC } from '../utils/logoProcessor';

interface StandbyScreenProps {
  config: CeremonyConfig;
  logoUrl: string | null;
  muted: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onStartCeremony: (mode: InputMode) => void;
}

export function StandbyScreen({
  config,
  logoUrl,
  muted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
  onOpenSettings,
  onStartCeremony,
}: StandbyScreenProps) {
  return (
    <div
      data-screen="standby"
      className="relative min-h-screen w-full overflow-hidden bg-[#040814] text-slate-100 flex flex-col justify-between"
    >
      {/* Subtle Architectural Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 ceremonial-grid opacity-75"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 58% at 50% 42%, rgba(16, 46, 132, 0.34) 0%, rgba(7, 15, 38, 0.72) 56%, rgba(4, 8, 20, 0.98) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-18%] left-1/2 -translate-x-1/2 h-[420px] w-[760px] rounded-full blur-3xl opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(212, 175, 55, 0.45) 0%, rgba(28, 63, 170, 0.12) 60%, transparent 100%)',
        }}
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between gap-6">
        <div className="font-display text-base sm:text-lg font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          Malaysia MADANI
        </div>

        {!isFullscreen && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Aktifkan bunyi' : 'Senyapkan bunyi'}
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-amber-300 hover:border-amber-400/50 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Mod skrin penuh"
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-amber-300 hover:border-amber-400/50 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-700/70 bg-slate-900/60 text-sm font-medium text-slate-200 hover:text-amber-200 hover:border-amber-400/50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Tetapan Pentas</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Ceremonial Centerpiece */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-10 py-8">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left: Dignified Ceremonial Headline & Actions */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-7">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-amber-300/90 font-medium tracking-wide">
              <span>Gimik Pelancaran Rasmi</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">{config.eventDate}</span>
            </div>

            <div className="space-y-4">
              <h1
                className="font-display font-semibold tracking-tight text-white leading-[1.1]"
                style={{
                  fontSize: 'clamp(1.9rem, 3.6vw, 3.3rem)',
                  textWrap: 'balance',
                }}
              >
                {config.eventTitle}
              </h1>
              <p className="text-base sm:text-lg text-slate-300/90 max-w-xl leading-relaxed">
                {config.eventSubtitle}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 w-full max-w-xl space-y-1 text-sm">
              <p className="text-xs font-medium tracking-wide text-amber-300/90">
                Disempurnakan Oleh
              </p>
              <p className="text-base font-semibold text-white">
                {config.vipName}
              </p>
              <p className="text-slate-300">
                {config.vipTitle}
                {config.vipDepartment ? ` · ${config.vipDepartment}` : ''}
              </p>
            </div>

            {/* Single Primary CTA + Quiet Rehearsal Alternative */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onStartCeremony('camera')}
                className="group inline-flex items-center gap-3 px-7 py-3.5 rounded-xl bg-amber-400 text-[#040814] font-semibold text-base shadow-[0_0_32px_rgba(245,190,65,0.28)] hover:bg-amber-300 transition-all duration-200 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                <Camera className="h-5 w-5 transition-transform duration-200 group-hover:scale-105" />
                <span>Mulakan Gimik Perasmian</span>
              </button>

              <button
                type="button"
                onClick={() => onStartCeremony('simulate')}
                className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl border border-slate-700/80 bg-slate-900/50 text-slate-200 font-medium text-sm hover:border-amber-400/50 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <Hand className="h-4 w-4 text-amber-300/90" />
                <span>Mod Simulasi Interaktif</span>
              </button>
            </div>
          </div>

          {/* Right: Dominant Focal Anchor — Holographic Floating Malaysia MADANI Emblem */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="relative w-72 h-80 sm:w-88 sm:h-96 flex items-center justify-center">
              {/* Outer Orbital Holographic Ring */}
              <svg
                aria-hidden="true"
                viewBox="0 0 360 360"
                className="absolute inset-0 w-full h-full animate-spin-slow opacity-70"
              >
                <defs>
                  <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <circle
                  cx="180"
                  cy="180"
                  r="164"
                  fill="none"
                  stroke="url(#goldRing)"
                  strokeWidth="1.2"
                  strokeDasharray="10 8"
                />
                <circle
                  cx="180"
                  cy="180"
                  r="142"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.2)"
                  strokeWidth="1"
                />
              </svg>

              {/* Inner Counter-Rotating Precision Ring */}
              <svg
                aria-hidden="true"
                viewBox="0 0 360 360"
                className="absolute inset-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] animate-spin-reverse-slow opacity-55"
              >
                <circle
                  cx="180"
                  cy="180"
                  r="148"
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.45)"
                  strokeWidth="1"
                  strokeDasharray="4 14"
                />
              </svg>

              {/* Soft Radial Energy Aura */}
              <div
                aria-hidden="true"
                className="absolute w-52 h-52 rounded-full blur-2xl opacity-45"
                style={{
                  background:
                    'radial-gradient(circle, rgba(251, 191, 36, 0.42) 0%, rgba(29, 78, 216, 0.35) 55%, transparent 100%)',
                }}
              />

              {/* Isolated Malaysia MADANI Logo */}
              <div className="relative z-10 animate-float-slow flex flex-col items-center">
                <img
                  src={logoUrl ?? MADANI_LOGO_SRC}
                  alt="Logo Rasmi Malaysia MADANI"
                  referrerPolicy="no-referrer"
                  className="h-52 sm:h-60 w-auto object-contain drop-shadow-[0_12px_36px_rgba(251,191,36,0.34)] select-none"
                  style={
                    logoUrl
                      ? undefined
                      : {
                          borderRadius: '18px',
                        }
                  }
                />
              </div>

              {/* Architectural Light Pedestal Base */}
              <div
                aria-hidden="true"
                className="absolute bottom-2 left-1/2 -translate-x-1/2 w-56 h-8 rounded-full"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.4) 0%, rgba(30, 64, 175, 0.18) 55%, transparent 78%)',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 w-40 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Editorial 3-Step Protocol Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 pb-8 pt-4">
        <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-display font-semibold text-slate-200">
              01. Tunjuk Tapak Tangan
            </p>
            <p className="text-slate-400 mt-1">
              Angkat tapak tangan ke arah kamera untuk mengaktifkan pengesan gerak isyarat.
            </p>
          </div>
          <div>
            <p className="font-display font-semibold text-slate-200">
              02. Pegang Logo MADANI
            </p>
            <p className="text-slate-400 mt-1">
              Arahkan tapak tangan ke Logo Malaysia MADANI sehingga ia terkunci secara magnetik.
            </p>
          </div>
          <div>
            <p className="font-display font-semibold text-slate-200">
              03. Lengkapkan Logo Sekolah Angkat MADANI
            </p>
            <p className="text-slate-400 mt-1">
              Letakkan Logo MADANI ke dalam tapak Logo Sekolah Angkat MADANI untuk memulakan video perasmian.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
