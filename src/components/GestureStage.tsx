import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Hand,
  Maximize2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  CeremonyConfig,
  GimmickPhase,
  GimmickState,
  InputMode,
  Point2D,
} from '../types/ceremony';
import { useHandTracker } from '../hooks/useHandTracker';
import { ceremonialAudio } from '../utils/ceremonialAudio';
import {
  DOCK_RADIUS,
  LAUNCH_CLIMAX_DURATION,
  PICKUP_RADIUS,
  createInitialGimmickState,
  stepGimmickState,
} from '../utils/gestureEngine';
import type {
  ProcessedLogoAsset,
  ProcessedPedestalLogoAsset,
} from '../utils/logoProcessor';

interface GestureStageProps {
  config: CeremonyConfig;
  inputMode: InputMode;
  logoAsset: ProcessedLogoAsset | null;
  pedestalAsset: ProcessedPedestalLogoAsset | null;
  muted: boolean;
  isFullscreen: boolean;
  onChangeMode: (mode: InputMode) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onBackToStandby: () => void;
  onLaunchComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PHASE_GUIDE: Record<GimmickPhase, { title: string; subtitle: string; step: number }> = {
  waiting_palm: {
    title: 'Tunjukkan Tapak Tangan Anda',
    subtitle: 'Angkat tapak tangan terbuka ke arah kamera untuk mengaktifkan pentas hologram.',
    step: 1,
  },
  palm_detected: {
    title: 'Pegang Logo Malaysia MADANI',
    subtitle: 'Arahkan tapak tangan ke Logo Malaysia MADANI di sebelah kiri sehingga terkunci.',
    step: 2,
  },
  holding_logo: {
    title: 'Lengkapkan Logo Sekolah Angkat MADANI',
    subtitle: 'Bawa Logo Malaysia MADANI ke dalam ruang kosong pada Logo Sekolah Angkat MADANI.',
    step: 3,
  },
  charging: {
    title: 'Melengkapkan Logo Sekolah Angkat MADANI',
    subtitle: 'Logo Malaysia MADANI terkunci — mengesahkan akses hologram...',
    step: 3,
  },
  announcing: {
    title: 'Akses Diterima',
    subtitle:
      'Majlis Apresiasi Kecemerlangan dan Penyerahan Sekolah Angkat MADANI SK Merbau Pulas kini bermula.',
    step: 3,
  },
  countdown: {
    title: 'Kira Undur Pelancaran Rasmi',
    subtitle: 'Bersedia untuk tayangan video perasmian rasmi...',
    step: 3,
  },
  launching: {
    title: 'Pelancaran Rasmi Diaktifkan',
    subtitle: 'Memulakan video perasmian secara automatik...',
    step: 3,
  },
};

const PHASE_GUIDE_SIMULATE: Record<GimmickPhase, { title: string; subtitle: string; step: number }> = {
  waiting_palm: {
    title: 'Gerakkan Penunjuk Ke Pentas',
    subtitle: 'Gerakkan tetikus atau jari anda pada pentas untuk mengaktifkan tapak tangan hologram.',
    step: 1,
  },
  palm_detected: {
    title: 'Pegang Logo Malaysia MADANI',
    subtitle: 'Klik dan seret (atau tahan seketika) pada Logo Malaysia MADANI di sebelah kiri.',
    step: 2,
  },
  holding_logo: {
    title: 'Lengkapkan Logo Sekolah Angkat MADANI',
    subtitle: 'Seret Logo Malaysia MADANI ke ruang kosong pada Logo Sekolah Angkat MADANI di sebelah kanan.',
    step: 3,
  },
  charging: {
    title: 'Melengkapkan Logo Sekolah Angkat MADANI',
    subtitle: 'Logo Malaysia MADANI telah diletakkan pada tapaknya — mengesahkan akses hologram...',
    step: 3,
  },
  announcing: {
    title: 'Akses Diterima',
    subtitle:
      'Majlis Apresiasi Kecemerlangan dan Penyerahan Sekolah Angkat MADANI SK Merbau Pulas kini bermula.',
    step: 3,
  },
  countdown: {
    title: 'Kira Undur Pelancaran Rasmi',
    subtitle: 'Bersedia untuk tayangan video perasmian rasmi...',
    step: 3,
  },
  launching: {
    title: 'Pelancaran Rasmi Diaktifkan',
    subtitle: 'Memulakan video perasmian secara automatik...',
    step: 3,
  },
};

export function GestureStage({
  config,
  inputMode,
  logoAsset,
  pedestalAsset,
  muted,
  isFullscreen,
  onChangeMode,
  onToggleMute,
  onToggleFullscreen,
  onOpenSettings,
  onBackToStandby,
  onLaunchComplete,
}: GestureStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoAssetRef = useRef<ProcessedLogoAsset | null>(logoAsset);
  logoAssetRef.current = logoAsset;
  const pedestalAssetRef = useRef<ProcessedPedestalLogoAsset | null>(pedestalAsset);
  pedestalAssetRef.current = pedestalAsset;
  const isFullscreenRef = useRef<boolean>(isFullscreen);
  isFullscreenRef.current = isFullscreen;

  const inputModeRef = useRef<InputMode>(inputMode);
  inputModeRef.current = inputMode;

  const onLaunchCompleteRef = useRef(onLaunchComplete);
  onLaunchCompleteRef.current = onLaunchComplete;

  const { videoRef, handRef, status: trackerStatus, errorMessage } = useHandTracker(
    inputMode === 'camera',
  );

  const gimmickRef = useRef<GimmickState>(createInitialGimmickState());
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const launchTriggeredRef = useRef(false);
  const sequenceStartedRef = useRef(false);
  const sequenceTimersRef = useRef<number[]>([]);

  // Pointer simulation state (updated without React re-renders)
  const pointerRef = useRef<{
    active: boolean;
    down: boolean;
    pos: Point2D;
  }>({
    active: false,
    down: false,
    pos: { x: 0.5, y: 0.5 },
  });

  // Low-frequency UI state synced only when phase, countdown, or charge increments change
  const [uiPhase, setUiPhase] = useState<GimmickPhase>('waiting_palm');
  const [uiChargePct, setUiChargePct] = useState(0);
  const [countdownNum, setCountdownNum] = useState<3 | 2 | 1 | null>(null);

  const clearSequenceTimers = useCallback(() => {
    sequenceTimersRef.current.forEach((id) => window.clearTimeout(id));
    sequenceTimersRef.current = [];
  }, []);

  // Reset stage cleanly when switching modes or mounting
  useEffect(() => {
    clearSequenceTimers();
    gimmickRef.current = createInitialGimmickState();
    particlesRef.current = [];
    shockwavesRef.current = [];
    launchTriggeredRef.current = false;
    sequenceStartedRef.current = false;
    setUiPhase('waiting_palm');
    setUiChargePct(0);
    setCountdownNum(null);
    ceremonialAudio.stopChargeLoop();
    ceremonialAudio.stopSpeech();
    ceremonialAudio.startEpicMusic();
  }, [inputMode, clearSequenceTimers]);

  useEffect(() => {
    return () => {
      clearSequenceTimers();
      ceremonialAudio.stopChargeLoop();
      ceremonialAudio.stopSpeech();
    };
  }, [clearSequenceTimers]);

  const updatePointerPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerRef.current.pos = {
      x: Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width)),
      y: Math.max(0.04, Math.min(0.96, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (inputModeRef.current !== 'simulate') return;
      pointerRef.current.active = true;
      updatePointerPos(e.clientX, e.clientY);
    },
    [updatePointerPos],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      ceremonialAudio.unlock();
      if (inputModeRef.current !== 'simulate') return;
      pointerRef.current.active = true;
      pointerRef.current.down = true;
      updatePointerPos(e.clientX, e.clientY);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [updatePointerPos],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (inputModeRef.current !== 'simulate') return;
    pointerRef.current.down = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (inputModeRef.current !== 'simulate') return;
    if (!pointerRef.current.down) {
      pointerRef.current.active = false;
    }
  }, []);

  // Main 60fps Canvas Render & State Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let lastReportedPhase: GimmickPhase = 'waiting_palm';
    let lastReportedCharge = 0;

    const spawnParticles = (
      x: number,
      y: number,
      count: number,
      speedMin: number,
      speedMax: number,
      palette: string[],
    ) => {
      const arr = particlesRef.current;
      for (let i = 0; i < count; i++) {
        if (arr.length > 260) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        arr.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 18,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.75,
          size: 1.6 + Math.random() * 3.2,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    };

    const spawnShockwave = (x: number, y: number, maxRadius: number, color: string) => {
      shockwavesRef.current.push({
        x,
        y,
        radius: 18,
        maxRadius,
        alpha: 0.92,
        color,
      });
    };

    const draw14PointStar = (
      cx: number,
      cy: number,
      outerR: number,
      innerR: number,
      rotation: number,
    ) => {
      ctx.beginPath();
      const points = 14;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = rotation + (i * Math.PI) / points;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const renderFrame = (now: number) => {
      const dt = Math.min(0.25, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
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

      // Determine normalized anchor coordinates responsively so the held Logo Malaysia MADANI
      // snaps 1:1 into the missing left slot of the Logo Sekolah Angkat MADANI pedestal
      const isPortrait = width < 720;
      const pedAsset = pedestalAssetRef.current;
      const pedAspect = pedAsset ? pedAsset.width / pedAsset.height : 1458 / 652;
      const slotMeta = pedAsset
        ? pedAsset.slot
        : { cx: 0.1015, cy: 0.5023, w: 0.1872, h: 0.7086 };

      const compW = isPortrait
        ? Math.min(width * 0.88, height * 0.42 * pedAspect)
        : Math.min(width * 0.52, height * 0.88);
      const compH = compW / pedAspect;

      let compLeft: number;
      let compTop: number;
      let logoHome: Point2D;
      if (isPortrait) {
        compLeft = (width - compW) * 0.5;
        compTop = height * 0.63 - compH * 0.5;
        logoHome = { x: 0.5, y: 0.25 };
      } else {
        const slotTargetX = width * 0.44;
        const slotTargetY = height * 0.48;
        compLeft = slotTargetX - slotMeta.cx * compW;
        compTop = slotTargetY - slotMeta.cy * compH;
        logoHome = { x: 0.175, y: 0.48 };
      }

      const compCenterX = compLeft + compW * 0.5;
      const compCenterY = compTop + compH * 0.5;
      const slotPxW = slotMeta.w * compW;
      const slotPxH = slotMeta.h * compH;

      const pedestalPos: Point2D = {
        x: (compLeft + slotMeta.cx * compW) / Math.max(1, width),
        y: (compTop + slotMeta.cy * compH) / Math.max(1, height),
      };
      gimmickRef.current.logoHome = logoHome;
      gimmickRef.current.pedestalPos = pedestalPos;

      // Read live input (Camera MediaPipe OR Pointer Simulation)
      const isSim = inputModeRef.current === 'simulate';
      const hand = handRef.current;
      const ptr = pointerRef.current;

      const stepInput = isSim
        ? {
            handDetected: ptr.active,
            handPos: ptr.active ? ptr.pos : null,
            isOpenPalm: ptr.active && !ptr.down,
            isGrasping: ptr.active && ptr.down,
            isPointerDown: ptr.down,
          }
        : {
            handDetected: hand.detected,
            handPos: hand.detected ? hand.palmCenter : null,
            isOpenPalm: hand.isOpenPalm,
            isGrasping: hand.isPinchingOrGrasping,
            isPointerDown: false,
          };

      const { state, events } = stepGimmickState(gimmickRef.current, stepInput, dt);
      gimmickRef.current = state;

      // Handle audio & dramatic particle events
      const logoPxX = state.logoPos.x * width;
      const logoPxY = state.logoPos.y * height;
      const pedPxX = state.pedestalPos.x * width;
      const pedPxY = state.pedestalPos.y * height;
      const minDim = Math.min(width, height);

      for (const ev of events) {
        if (ev === 'palm_detected') {
          ceremonialAudio.playPalmDetected();
          if (stepInput.handPos) {
            spawnShockwave(
              stepInput.handPos.x * width,
              stepInput.handPos.y * height,
              minDim * 0.18,
              'rgba(251, 191, 36, 0.7)',
            );
          }
        } else if (ev === 'logo_grabbed') {
          ceremonialAudio.playLogoGrab();
          spawnShockwave(logoPxX, logoPxY, minDim * 0.24, 'rgba(251, 191, 36, 0.9)');
          spawnParticles(logoPxX, logoPxY, 34, 45, 190, [
            '#FBBF24',
            '#FEF08A',
            '#60A5FA',
            '#F87171',
          ]);
        } else if (ev === 'charge_started') {
          spawnShockwave(pedPxX, pedPxY, minDim * 0.32, 'rgba(251, 191, 36, 0.95)');
          spawnParticles(pedPxX, pedPxY, 44, 60, 240, ['#FBBF24', '#FDE047', '#3B82F6']);
        } else if (ev === 'access_granted' && !sequenceStartedRef.current) {
          sequenceStartedRef.current = true;
          // Duck epic soundtrack smoothly so the futuristic AI voice rings out clearly
          ceremonialAudio.fadeEpicMusic(0.16, 850);
          ceremonialAudio.playAccessGranted();
          spawnShockwave(pedPxX, pedPxY, Math.max(width, height) * 0.78, '#FEF08A');
          spawnShockwave(pedPxX, pedPxY, Math.max(width, height) * 0.52, '#60A5FA');
          spawnParticles(pedPxX, pedPxY, 95, 85, 360, [
            '#FFFBEB',
            '#FEF08A',
            '#FBBF24',
            '#60A5FA',
            '#F87171',
          ]);

          const beginCountdown = () => {
            gimmickRef.current = { ...gimmickRef.current, phase: 'countdown' };
            setUiPhase('countdown');

            const steps: Array<{ num: 3 | 2 | 1; delayMs: number }> = [
              { num: 3, delayMs: 0 },
              { num: 2, delayMs: 1180 },
              { num: 1, delayMs: 2360 },
            ];

            steps.forEach(({ num, delayMs }) => {
              const tid = window.setTimeout(() => {
                setCountdownNum(num);
                ceremonialAudio.playCountdownTick(num);
                ceremonialAudio.playMalayCountdown(num);
                const c = canvasRef.current;
                const cw = c ? c.clientWidth : width;
                const ch = c ? c.clientHeight : height;
                const px = gimmickRef.current.pedestalPos.x * cw;
                const py = gimmickRef.current.pedestalPos.y * ch;
                spawnShockwave(px, py, Math.max(cw, ch) * 0.72, num === 1 ? '#FEF08A' : '#FBBF24');
                spawnShockwave(cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.55, '#60A5FA');
                spawnParticles(cw * 0.5, ch * 0.5, 55, 70, 320, [
                  '#FFFBEB',
                  '#FEF08A',
                  '#FBBF24',
                  '#60A5FA',
                ]);
              }, delayMs);
              sequenceTimersRef.current.push(tid);
            });

            const launchTid = window.setTimeout(() => {
              setCountdownNum(null);
              ceremonialAudio.stopEpicMusic(350);
              ceremonialAudio.playLaunchClimax();
              gimmickRef.current = {
                ...gimmickRef.current,
                phase: 'launching',
                launchElapsed: 0,
              };
              setUiPhase('launching');
              const c = canvasRef.current;
              const cw = c ? c.clientWidth : width;
              const ch = c ? c.clientHeight : height;
              const px = gimmickRef.current.pedestalPos.x * cw;
              const py = gimmickRef.current.pedestalPos.y * ch;
              spawnShockwave(px, py, Math.max(cw, ch) * 0.95, '#FFFBEB');
              spawnParticles(px, py, 110, 100, 440, [
                '#FFFBEB',
                '#FEF08A',
                '#FBBF24',
                '#60A5FA',
                '#EF4444',
              ]);
            }, 3540);
            sequenceTimersRef.current.push(launchTid);
          };

          ceremonialAudio.playMalayAnnouncement(beginCountdown);
        }
      }

      // Sync continuous charging sound
      ceremonialAudio.updateChargeLoop(state.chargeProgress, state.phase === 'charging');

      // Continuous particle streams during active phases
      if (state.phase === 'holding_logo' && Math.random() < 0.65) {
        spawnParticles(logoPxX, logoPxY, 2, 16, 65, ['#FBBF24', '#93C5FD', '#FEF08A']);
      } else if (state.phase === 'charging') {
        const intensity = 1 + Math.floor(state.chargeProgress * 5);
        for (let i = 0; i < intensity; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = minDim * (0.16 + Math.random() * 0.14);
          const sx = pedPxX + Math.cos(angle) * dist;
          const sy = pedPxY + Math.sin(angle) * dist;
          particlesRef.current.push({
            x: sx,
            y: sy,
            vx: (pedPxX - sx) * 2.5,
            vy: (pedPxY - sy) * 2.5,
            life: 0,
            maxLife: 0.36,
            size: 2.2 + state.chargeProgress * 2.4,
            color: Math.random() > 0.3 ? '#FBBF24' : '#60A5FA',
          });
        }
      } else if (state.phase === 'announcing' || state.phase === 'countdown') {
        if (Math.random() < 0.85) {
          spawnParticles(pedPxX, pedPxY, 3, 45, 190, [
            '#FFFBEB',
            '#FEF08A',
            '#FBBF24',
            '#60A5FA',
          ]);
        }
      }

      // Low-frequency React state sync
      const chargePct = Math.round(state.chargeProgress * 100);
      if (state.phase !== lastReportedPhase) {
        lastReportedPhase = state.phase;
        setUiPhase(state.phase);
      }
      if (Math.abs(chargePct - lastReportedCharge) >= 3 || (chargePct === 100 && lastReportedCharge !== 100)) {
        lastReportedCharge = chargePct;
        setUiChargePct(chargePct);
      }

      if (state.completed && !launchTriggeredRef.current) {
        launchTriggeredRef.current = true;
        onLaunchCompleteRef.current();
      }

      // === VISUAL LAYER 1: Architectural Hologram Grid & Ambient Horizon ===
      ctx.save();
      const centerGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        minDim * 0.05,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.65,
      );
      centerGlow.addColorStop(0, 'rgba(15, 38, 108, 0.16)');
      centerGlow.addColorStop(0.65, 'rgba(4, 9, 24, 0.25)');
      centerGlow.addColorStop(1, 'rgba(3, 6, 16, 0.62)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // Subtle architectural frame corners
      const margin = Math.max(20, Math.min(44, width * 0.03));
      const topInset = isFullscreenRef.current ? margin : margin + 56;
      const cornerLen = 22;
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.32)';
      ctx.lineWidth = 1.25;
      const corners: Array<[number, number, number, number]> = [
        [margin, topInset, 1, 1],
        [width - margin, topInset, -1, 1],
        [margin, height - margin - 72, 1, -1],
        [width - margin, height - margin - 72, -1, -1],
      ];
      for (const [cx, cy, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy * cornerLen);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx * cornerLen, cy);
        ctx.stroke();
      }
      ctx.restore();

      // === VISUAL LAYER 2: Luminous Energy Conduit from Logo Cradle to Tapak Pelancaran ===
      const homePxX = state.logoHome.x * width;
      const homePxY = state.logoHome.y * height;

      ctx.save();
      const bridgeActive = state.phase === 'holding_logo' || state.phase === 'charging';
      const gradBridge = ctx.createLinearGradient(homePxX, homePxY, pedPxX, pedPxY);
      gradBridge.addColorStop(0, bridgeActive ? 'rgba(251, 191, 36, 0.52)' : 'rgba(148, 163, 184, 0.16)');
      gradBridge.addColorStop(0.5, bridgeActive ? 'rgba(96, 165, 250, 0.55)' : 'rgba(251, 191, 36, 0.18)');
      gradBridge.addColorStop(1, bridgeActive ? 'rgba(251, 191, 36, 0.85)' : 'rgba(251, 191, 36, 0.25)');

      const ctrlX = (homePxX + pedPxX) * 0.5;
      const ctrlY = Math.min(homePxY, pedPxY) - minDim * 0.1;

      ctx.beginPath();
      ctx.moveTo(state.phase === 'holding_logo' ? logoPxX : homePxX, state.phase === 'holding_logo' ? logoPxY : homePxY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, pedPxX, pedPxY);
      ctx.strokeStyle = gradBridge;
      ctx.lineWidth = bridgeActive ? 2.4 : 1.25;
      ctx.setLineDash([8, 10]);
      ctx.lineDashOffset = -t * (bridgeActive ? 85 : 28);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // === VISUAL LAYER 3: Floating Cradle Ring (Logo Origin Dock) ===
      const cradleRadius = minDim * 0.12;
      ctx.save();
      ctx.translate(homePxX, homePxY);
      ctx.strokeStyle =
        state.phase === 'holding_logo' || state.phase === 'charging' || state.phase === 'launching'
          ? 'rgba(148, 163, 184, 0.2)'
          : 'rgba(251, 191, 36, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, cradleRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(t * 0.35);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.34)';
      ctx.setLineDash([12, 16]);
      ctx.beginPath();
      ctx.arc(0, 0, cradleRadius * 1.14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (state.phase === 'waiting_palm' || state.phase === 'palm_detected') {
        ctx.save();
        ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
        ctx.textAlign = 'center';
        ctx.fillText('Logo Malaysia MADANI', homePxX, homePxY + cradleRadius + 28);
        ctx.restore();
      }

      // === VISUAL LAYER 4: Tapak Pelancaran — Logo Sekolah Angkat MADANI Hologram ===
      const pedRadius = Math.max(slotPxW, slotPxH) * 0.62;
      const charge = state.chargeProgress;
      const isLaunching = state.phase === 'launching';
      const isLogoDocked =
        state.phase === 'charging' ||
        state.phase === 'announcing' ||
        state.phase === 'countdown' ||
        isLaunching;
      const launchProg = isLaunching
        ? Math.min(1, state.launchElapsed / LAUNCH_CLIMAX_DURATION)
        : 0;

      // 4A. Wide Architectural 3D Holographic Pedestal Base cradling the full Logo Sekolah Angkat MADANI
      const stageBaseY = compTop + compH + Math.max(24, compH * 0.085);
      const stageBeamW = compW * (0.54 + charge * 0.08 + launchProg * 0.24);
      const stageBeamH = compH * (1.25 + charge * 0.45 + launchProg * 0.9);

      ctx.save();
      ctx.translate(compCenterX, stageBaseY);

      const beamGrad = ctx.createLinearGradient(0, 0, 0, -stageBeamH);
      beamGrad.addColorStop(0, 'rgba(251, 191, 36, 0.04)');
      beamGrad.addColorStop(
        0.18,
        isLaunching
          ? 'rgba(254, 240, 138, 0.6)'
          : isLogoDocked
            ? `rgba(251, 191, 36, ${0.18 + charge * 0.34})`
            : state.phase === 'holding_logo'
              ? 'rgba(251, 191, 36, 0.16)'
              : 'rgba(59, 130, 246, 0.13)',
      );
      beamGrad.addColorStop(0.72, 'rgba(37, 99, 235, 0.05)');
      beamGrad.addColorStop(1, 'rgba(4, 8, 20, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-stageBeamW * 0.88, 0);
      ctx.lineTo(-stageBeamW * 1.15, -stageBeamH);
      ctx.lineTo(stageBeamW * 1.15, -stageBeamH);
      ctx.lineTo(stageBeamW * 0.88, 0);
      ctx.closePath();
      ctx.fill();

      // Sculpted Wide Elliptical Hologram Stage Platform
      ctx.save();
      ctx.scale(1, 0.16);
      const wideBaseR = compW * 0.56;
      const baseFill = ctx.createRadialGradient(0, 0, 10, 0, 0, wideBaseR);
      baseFill.addColorStop(
        0,
        isLogoDocked ? 'rgba(251, 191, 36, 0.36)' : 'rgba(59, 130, 246, 0.24)',
      );
      baseFill.addColorStop(0.65, 'rgba(30, 64, 175, 0.18)');
      baseFill.addColorStop(1, 'rgba(4, 8, 20, 0)');
      ctx.fillStyle = baseFill;
      ctx.beginPath();
      ctx.arc(0, 0, wideBaseR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isLogoDocked
        ? 'rgba(253, 224, 71, 0.82)'
        : 'rgba(251, 191, 36, 0.58)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, wideBaseR * 0.94, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(147, 197, 253, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, wideBaseR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.restore();

      // 4B. Ambient Holographic Aura Behind "Sekolah Angkat MADANI" + Graduating Student
      ctx.save();
      const compAuraR = compW * 0.58;
      const compAura = ctx.createRadialGradient(
        compCenterX,
        compCenterY,
        12,
        compCenterX,
        compCenterY,
        compAuraR,
      );
      compAura.addColorStop(
        0,
        isLogoDocked
          ? `rgba(254, 240, 138, ${0.28 + charge * 0.32})`
          : 'rgba(59, 130, 246, 0.22)',
      );
      compAura.addColorStop(0.55, 'rgba(29, 78, 216, 0.16)');
      compAura.addColorStop(1, 'rgba(4, 8, 20, 0)');
      ctx.fillStyle = compAura;
      ctx.beginPath();
      ctx.arc(compCenterX, compCenterY, compAuraR, 0, Math.PI * 2);
      ctx.fill();

      // Render "Sekolah Angkat MADANI" + Graduating Student Hologram (left MADANI emblem removed)
      if (pedAsset) {
        ctx.globalAlpha = isLogoDocked ? 1 : 0.94;
        ctx.drawImage(pedAsset.hologramCanvas, compLeft, compTop, compW, compH);

        // Luminous golden completion pulse across the full Sekolah Angkat MADANI typography when docked
        if (isLogoDocked) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha =
            state.phase === 'charging'
              ? 0.14 + charge * 0.36
              : 0.32 + 0.12 * Math.sin(t * 5);
          ctx.drawImage(pedAsset.hologramCanvas, compLeft, compTop, compW, compH);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.restore();

      // 4C. Left Target Socket — Glowing Empty Blueprint Silhouette of the Removed MADANI Emblem
      ctx.save();
      ctx.translate(pedPxX, pedPxY);

      // Subtle glowing halo centered on the socket
      const sockGlow = ctx.createRadialGradient(0, 0, 6, 0, 0, pedRadius * 1.25);
      sockGlow.addColorStop(
        0,
        isLaunching
          ? 'rgba(254, 240, 138, 0.82)'
          : `rgba(251, 191, 36, ${0.14 + charge * 0.44 + (state.phase === 'holding_logo' ? 0.16 : 0)})`,
      );
      sockGlow.addColorStop(0.6, 'rgba(37, 99, 235, 0.18)');
      sockGlow.addColorStop(1, 'rgba(4, 8, 20, 0)');
      ctx.fillStyle = sockGlow;
      ctx.beginPath();
      ctx.arc(0, 0, pedRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Rotating 14-point Malaysian star sacred geometry inside the socket (before & during charge)
      if (!isLogoDocked || state.phase === 'charging') {
        ctx.save();
        const spinSpeed = 0.25 + charge * 3.0;
        draw14PointStar(0, 0, pedRadius * 0.56, pedRadius * 0.35, t * spinSpeed);
        ctx.strokeStyle =
          state.phase === 'charging'
            ? `rgba(254, 240, 138, ${0.38 + charge * 0.45})`
            : 'rgba(251, 191, 36, 0.24)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // Outer precision orbital ring around the socket
      ctx.save();
      ctx.rotate(-t * (0.45 + charge * 2.4));
      ctx.strokeStyle =
        state.phase === 'holding_logo' || state.phase === 'charging'
          ? 'rgba(253, 224, 71, 0.88)'
          : isLogoDocked
            ? 'rgba(253, 224, 71, 0.42)'
            : 'rgba(212, 175, 55, 0.52)';
      ctx.lineWidth = state.phase === 'holding_logo' ? 2.1 : 1.5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, pedRadius * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Radial Charge Progress Arc (0% -> 100%) around the docked MADANI emblem
      if (charge > 0.01 && state.phase === 'charging') {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.34)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, pedRadius * 1.0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
        ctx.stroke();

        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, pedRadius * 1.0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Draw the glowing empty blueprint silhouette of the removed MADANI logo until docked
      if (pedAsset && !isLogoDocked) {
        ctx.save();
        const pulse =
          state.phase === 'holding_logo'
            ? 0.76 + 0.24 * Math.sin(t * 5.2)
            : 0.56 + 0.26 * Math.sin(t * 3.0);
        ctx.globalAlpha = pulse;
        ctx.drawImage(pedAsset.slotSilhouetteCanvas, compLeft, compTop, compW, compH);
        ctx.restore();
      }

      // Clean Pedestal Labels & Charging Percentage
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 13px "Outfit", sans-serif';
      ctx.fillStyle =
        state.phase === 'holding_logo' || state.phase === 'charging'
          ? '#FDE68A'
          : 'rgba(226, 232, 240, 0.84)';
      ctx.fillText(
        isLogoDocked
          ? 'Logo Sekolah Angkat MADANI Lengkap'
          : 'Tapak Pelancaran · Sekolah Angkat MADANI',
        compCenterX,
        stageBaseY + 26,
      );
      if (!isLogoDocked) {
        ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle =
          state.phase === 'holding_logo'
            ? '#FDE047'
            : 'rgba(147, 197, 253, 0.82)';
        ctx.fillText('Letak Logo MADANI', pedPxX, pedPxY + slotPxH * 0.5 + 22);
      } else if (state.phase === 'charging') {
        ctx.font = '600 13px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FDE047';
        ctx.fillText(`${Math.round(charge * 100)}%`, pedPxX, pedPxY + slotPxH * 0.5 + 24);
      }
      ctx.restore();

      // === VISUAL LAYER 5: Floating / Held / Docked Logo Malaysia MADANI ===
      const hoverFloat =
        state.phase === 'waiting_palm' || state.phase === 'palm_detected'
          ? Math.sin(t * 2.4) * 7
          : 0;
      const drawLogoX = logoPxX;
      const drawLogoY = logoPxY + hoverFloat;
      const baseLogoH = isLogoDocked
        ? slotPxH * state.logoScale
        : slotPxH * (state.phase === 'holding_logo' ? 1.02 : 0.94);

      // Hover Lock-On Radial Indicator (when open palm approaches logo)
      if (state.hoverPickupProgress > 0.02 && state.phase === 'palm_detected') {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(
          drawLogoX,
          drawLogoY,
          minDim * PICKUP_RADIUS * 0.72,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * state.hoverPickupProgress,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Luminous Aura Behind Logo Malaysia MADANI
      ctx.save();
      const auraR = baseLogoH * (0.76 + state.logoGlow * 0.24);
      const aura = ctx.createRadialGradient(drawLogoX, drawLogoY, 6, drawLogoX, drawLogoY, auraR);
      aura.addColorStop(0, `rgba(254, 240, 138, ${Math.min(0.84, 0.25 * state.logoGlow)})`);
      aura.addColorStop(0.5, `rgba(37, 99, 235, ${Math.min(0.55, 0.22 * state.logoGlow)})`);
      aura.addColorStop(1, 'rgba(4, 8, 20, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(drawLogoX, drawLogoY, auraR, 0, Math.PI * 2);
      ctx.fill();

      const asset = logoAssetRef.current;
      if (asset) {
        const aspect = asset.width / asset.height;
        const drawH = baseLogoH;
        const drawW = drawH * aspect;
        ctx.drawImage(asset.canvas, drawLogoX - drawW / 2, drawLogoY - drawH / 2, drawW, drawH);
      } else {
        ctx.fillStyle = '#0A1D6E';
        ctx.beginPath();
        ctx.arc(drawLogoX, drawLogoY, baseLogoH * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // === VISUAL LAYER 6: VIP Hand Constellation / Holographic Palm Reticle ===
      if (!isSim && hand.detected && hand.landmarks.length === 21) {
        ctx.save();
        // Bone connections
        ctx.strokeStyle =
          state.phase === 'holding_logo'
            ? 'rgba(253, 224, 71, 0.85)'
            : 'rgba(147, 197, 253, 0.68)';
        ctx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
          const pa = hand.landmarks[a];
          const pb = hand.landmarks[b];
          ctx.beginPath();
          ctx.moveTo(pa.x * width, pa.y * height);
          ctx.lineTo(pb.x * width, pb.y * height);
          ctx.stroke();
        }

        // Precision joint nodes
        for (let i = 0; i < hand.landmarks.length; i++) {
          const pt = hand.landmarks[i];
          const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
          ctx.fillStyle = isTip ? '#FDE047' : '#E0F2FE';
          ctx.beginPath();
          ctx.arc(pt.x * width, pt.y * height, isTip ? 4.2 : 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Luminous palm energy core
        const px = hand.palmCenter.x * width;
        const py = hand.palmCenter.y * height;
        const coreR = Math.max(22, hand.palmScale * minDim * 0.42);
        ctx.strokeStyle = hand.isPinchingOrGrasping ? '#FBBF24' : '#93C5FD';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, coreR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (isSim && ptr.active && !isLaunching) {
        // Tactile Holographic Palm Reticle in Simulation Mode
        const px = ptr.pos.x * width;
        const py = ptr.pos.y * height;
        ctx.save();
        ctx.translate(px, py);
        const r = ptr.down ? 24 : 32;
        ctx.strokeStyle = ptr.down ? '#FDE047' : 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = ptr.down ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(t * 1.4);
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.75)';
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // === VISUAL LAYER 7: Particles & Shockwaves ===
      const shockwaves = shockwavesRef.current;
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 5.2) + dt * 65;
        sw.alpha -= dt * 1.15;
        if (sw.alpha <= 0.01) {
          shockwaves.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        const alpha = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // === VISUAL LAYER 7B: Radiant Golden-Sapphire Light Rays ("Cahaya Gilang Gemilang") ===
      if (state.phase === 'announcing' || state.phase === 'countdown' || isLaunching) {
        ctx.save();
        const rayCount = 14;
        const maxRayLen = Math.max(width, height) * 0.92;
        const rayIntensity =
          state.phase === 'countdown' ? 0.34 : isLaunching ? 0.45 : 0.26;

        ctx.translate(compCenterX, compCenterY);

        // Two shared radial gradients reused across all 14 beams (14x faster on CPU/integrated GPUs)
        const goldRayGrad = ctx.createRadialGradient(0, 0, 14, 0, 0, maxRayLen);
        goldRayGrad.addColorStop(0, `rgba(255, 251, 235, ${rayIntensity * 1.5})`);
        goldRayGrad.addColorStop(0.38, `rgba(251, 191, 36, ${rayIntensity * 0.62})`);
        goldRayGrad.addColorStop(1, 'rgba(4, 8, 20, 0)');

        const blueRayGrad = ctx.createRadialGradient(0, 0, 14, 0, 0, maxRayLen);
        blueRayGrad.addColorStop(0, `rgba(251, 191, 36, ${rayIntensity * 1.15})`);
        blueRayGrad.addColorStop(0.4, `rgba(59, 130, 246, ${rayIntensity * 0.55})`);
        blueRayGrad.addColorStop(1, 'rgba(4, 8, 20, 0)');

        ctx.fillStyle = goldRayGrad;
        ctx.beginPath();
        for (let i = 0; i < rayCount; i += 2) {
          const baseAngle = (i / rayCount) * Math.PI * 2 + t * 0.22;
          const spread = 0.068 + 0.018 * Math.sin(t * 2.6 + i);
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, maxRayLen, baseAngle - spread, baseAngle + spread);
          ctx.closePath();
        }
        ctx.fill();

        ctx.fillStyle = blueRayGrad;
        ctx.beginPath();
        for (let i = 1; i < rayCount; i += 2) {
          const baseAngle = (i / rayCount) * Math.PI * 2 + t * 0.22;
          const spread = 0.062 + 0.016 * Math.sin(t * 2.6 + i);
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, maxRayLen, baseAngle - spread, baseAngle + spread);
          ctx.closePath();
        }
        ctx.fill();

        // Brilliant radiant aura blooming behind the pedestal
        const bloomR = minDim * (state.phase === 'countdown' ? 0.62 : 0.5);
        const bloomGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, bloomR);
        bloomGrad.addColorStop(0, 'rgba(255, 251, 235, 0.65)');
        bloomGrad.addColorStop(0.32, 'rgba(251, 191, 36, 0.32)');
        bloomGrad.addColorStop(0.7, 'rgba(37, 99, 235, 0.14)');
        bloomGrad.addColorStop(1, 'rgba(4, 8, 20, 0)');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.arc(0, 0, bloomR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // === VISUAL LAYER 8: Golden Climax Supernova Dissolve into Launch Video ===
      if (isLaunching) {
        ctx.save();
        const flashAlpha = Math.pow(launchProg, 1.55);
        const flashGrad = ctx.createRadialGradient(
          pedPxX,
          pedPxY,
          10,
          pedPxX,
          pedPxY,
          Math.max(width, height) * (0.35 + launchProg * 0.95),
        );
        flashGrad.addColorStop(0, `rgba(255, 251, 235, ${Math.min(1, 0.65 + flashAlpha * 0.5)})`);
        flashGrad.addColorStop(0.45, `rgba(251, 191, 36, ${Math.min(0.95, flashAlpha * 0.88)})`);
        flashGrad.addColorStop(1, `rgba(4, 8, 20, ${Math.min(0.96, flashAlpha * 0.94)})`);
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [handRef]);

  const guide =
    inputMode === 'simulate' ? PHASE_GUIDE_SIMULATE[uiPhase] : PHASE_GUIDE[uiPhase];

  return (
    <div
      data-screen="stage"
      data-phase={uiPhase}
      data-mode={inputMode}
      data-charge={uiChargePct}
      data-countdown={countdownNum ?? ''}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      className="relative h-screen w-screen overflow-hidden bg-[#040814] text-slate-100 select-none"
    >
      {/* Background: Mirrored Live Camera OR Sleek Obsidian Hologram Grid */}
      {inputMode === 'camera' ? (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover -scale-x-100 opacity-45"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 ceremonial-grid opacity-80"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 50% 48%, rgba(16, 46, 132, 0.34) 0%, rgba(5, 11, 28, 0.88) 65%, #040814 100%)',
          }}
        />
      )}

      {/* Subtle Royal Vignette Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(4,8,20,0.72) 0%, rgba(4,8,20,0.08) 22%, rgba(4,8,20,0.12) 76%, rgba(4,8,20,0.86) 100%)',
        }}
      />

      {/* Interactive Full-Viewport VFX & Gesture Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="gesture-stage-canvas"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={`absolute inset-0 h-full w-full touch-none ${
          inputMode === 'simulate' ? 'cursor-crosshair' : ''
        }`}
      />

      {/* Top Minimal Ceremonial Bar (hidden cleanly in fullscreen presentation mode) */}
      {!isFullscreen && (
        <header className="relative z-20 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToStandby}
              aria-label="Kembali ke skrin utama"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-700/70 bg-slate-950/70 backdrop-blur-md text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Utama</span>
            </button>
            <span className="hidden md:inline font-display text-sm font-semibold text-slate-100 truncate">
              {config.eventTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Functional Segmented Input Mode Control */}
            <div
              role="group"
              aria-label="Mod input gerak isyarat"
              className="inline-flex items-center p-1 rounded-lg border border-slate-700/70 bg-slate-950/75 backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => onChangeMode('camera')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  inputMode === 'camera'
                    ? 'bg-amber-400 text-[#040814]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Kamera</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeMode('simulate')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  inputMode === 'simulate'
                    ? 'bg-amber-400 text-[#040814]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Hand className="h-3.5 w-3.5" />
                <span>Simulasi</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Aktifkan bunyi' : 'Senyapkan bunyi'}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-700/70 bg-slate-950/70 backdrop-blur-md text-slate-300 hover:text-amber-300 transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Mod skrin penuh"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-700/70 bg-slate-950/70 backdrop-blur-md text-slate-300 hover:text-amber-300 transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Buka tetapan pentas"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-700/70 bg-slate-950/70 backdrop-blur-md text-slate-300 hover:text-amber-300 transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {/* Graceful Camera Loading or Permission Fallback Banner */}
      {inputMode === 'camera' && trackerStatus === 'loading' && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950/85 backdrop-blur-md flex items-center gap-3 text-sm text-slate-200">
          <div className="h-4 w-4 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
          <span>Menyediakan kamera dan pengesan gerak isyarat tangan...</span>
        </div>
      )}

      {inputMode === 'camera' && trackerStatus === 'error' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-lg rounded-xl border border-amber-400/40 bg-[#070E21]/95 backdrop-blur-md px-5 py-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-display text-sm font-semibold text-amber-200">
              Kamera Tidak Dapat Diakses
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeMode('simulate')}
            className="px-4 py-2 rounded-lg bg-amber-400 text-[#040814] text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            Guna Mod Simulasi
          </button>
        </div>
      )}

      {/* Futuristic AI Announcement Overlay ("Akses Diterima") */}
      {uiPhase === 'announcing' && (
        <div
          data-testid="ai-announcement-overlay"
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6"
        >
          <div className="max-w-3xl w-full rounded-2xl border border-amber-300/45 bg-[#040A1E]/90 px-8 py-9 text-center shadow-[0_0_80px_rgba(251,191,36,0.28)] space-y-5">
            <div className="flex items-center justify-center gap-1.5 h-6" aria-hidden="true">
              {[0.55, 0.95, 0.7, 1, 0.8, 0.6, 0.9, 0.5].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-amber-300 animate-pulse"
                  style={{
                    height: `${Math.round(h * 22)}px`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            </div>

            <p className="font-display text-sm sm:text-base font-semibold tracking-[0.18em] text-amber-300">
              Akses Diterima
            </p>

            <h2
              className="font-display text-2xl sm:text-4xl font-semibold text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Majlis Apresiasi Kecemerlangan dan Penyerahan Sekolah Angkat MADANI SK Merbau Pulas Kini Bermula
            </h2>

            <div className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

            <p className="text-sm text-slate-300">
              {config.vipName} · {config.vipTitle}
            </p>
          </div>
        </div>
      )}

      {/* Futuristic Holographic 3 - 2 - 1 Countdown Overlay */}
      {uiPhase === 'countdown' && countdownNum !== null && (
        <div
          data-testid="ai-countdown-overlay"
          className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center px-6"
        >
          <div className="relative flex items-center justify-center h-64 w-64 sm:h-80 sm:w-80">
            <svg
              aria-hidden="true"
              viewBox="0 0 320 320"
              className="absolute inset-0 h-full w-full animate-spin-slow"
            >
              <circle
                cx="160"
                cy="160"
                r="146"
                fill="none"
                stroke="rgba(251, 191, 36, 0.78)"
                strokeWidth="2"
                strokeDasharray="16 10"
              />
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 320 320"
              className="absolute inset-5 h-[calc(100%-2.5rem)] w-[calc(100%-2.5rem)] animate-spin-reverse-slow"
            >
              <circle
                cx="160"
                cy="160"
                r="138"
                fill="none"
                stroke="rgba(96, 165, 250, 0.72)"
                strokeWidth="1.5"
                strokeDasharray="8 14"
              />
            </svg>
            <div
              aria-hidden="true"
              className="absolute h-44 w-44 rounded-full blur-3xl opacity-65"
              style={{
                background:
                  'radial-gradient(circle, rgba(254, 240, 138, 0.85) 0%, rgba(251, 191, 36, 0.38) 50%, transparent 100%)',
              }}
            />
            <span
              key={countdownNum}
              className="relative z-10 font-display font-bold tabular-nums text-white drop-shadow-[0_0_32px_rgba(254,240,138,0.85)]"
              style={{ fontSize: 'clamp(6rem, 15vw, 10rem)', lineHeight: 1 }}
            >
              {countdownNum}
            </span>
          </div>
          <p className="mt-5 font-display text-base sm:text-lg font-medium tracking-wide text-amber-200">
            Memulakan Video Pelancaran Rasmi...
          </p>
        </div>
      )}

      {/* Bottom Ceremonial Instruction Bar (hidden during full-screen announcement/countdown) */}
      {uiPhase !== 'announcing' && uiPhase !== 'countdown' && uiPhase !== 'launching' && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-2xl">
          <div className="rounded-2xl border border-slate-700/60 bg-[#050B1C]/82 backdrop-blur-md px-6 py-4 text-center space-y-2.5">
            {/* Clean Unboxed 3-Step Progression */}
            <div className="flex items-center justify-center gap-3 text-xs font-medium">
              <span className={guide.step >= 1 ? 'text-amber-300' : 'text-slate-500'}>
                01. Tapak Tangan
              </span>
              <span aria-hidden="true" className="text-slate-600">/</span>
              <span className={guide.step >= 2 ? 'text-amber-300' : 'text-slate-500'}>
                02. Pegang Logo
              </span>
              <span aria-hidden="true" className="text-slate-600">/</span>
              <span className={guide.step >= 3 ? 'text-amber-300' : 'text-slate-500'}>
                03. Lengkapkan Logo
              </span>
            </div>

            <h2 className="font-display text-lg sm:text-xl font-semibold text-white tracking-tight">
              {guide.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
              {guide.subtitle}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
