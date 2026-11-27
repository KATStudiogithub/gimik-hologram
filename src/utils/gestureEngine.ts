import type {
  GimmickAudioEvent,
  GimmickState,
  GimmickStepInput,
  GimmickStepResult,
  HandAnalysis,
  NormalizedLandmark,
  Point2D,
} from '../types/ceremony';

const BASE_URL =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL
    ? (import.meta as unknown as { env?: { BASE_URL?: string } }).env!.BASE_URL!
    : '/';

export const DEFAULT_VIDEO_URL = `${BASE_URL}assets/aistudio/Video_Perasmian_Sekolah_Angkat_MADANI_c9dd4d1f.mp4`;

export const DEFAULT_YOUTUBE_URL =
  'https://www.youtube.com/watch?v=ZJzvtK7-prw';

export const PICKUP_RADIUS = 0.145;
export const DOCK_RADIUS = 0.135;
export const HOVER_PICKUP_DURATION = 0.42;
export const CHARGE_DURATION = 1.65;
export const LAUNCH_CLIMAX_DURATION = 0.95;

export function isDirectVideoUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (extractYouTubeVideoId(trimmed)) return false;
  if (/^(blob:|data:video\/)/i.test(trimmed)) return true;
  const clean = trimmed.split(/[?#]/)[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg)$/.test(clean);
}

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (
        segments.length >= 2 &&
        (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live')
      ) {
        const id = segments[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function distance2D(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Flood-fills near-white pixels strictly connected to the outer border of an image.
 * Exterior pixels become 1 (transparent background), while interior white regions
 * enclosed by darker outlines (like the white stripes inside the Malaysia MADANI emblem)
 * remain 0 (opaque).
 */
export function computeExteriorWhiteMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  whiteThreshold = 232,
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);
  if (total === 0) return mask;

  const isNearWhite = (idx: number): boolean => {
    const off = idx * 4;
    const r = rgba[off];
    const g = rgba[off + 1];
    const b = rgba[off + 2];
    const a = rgba[off + 3];
    if (a < 20) return true;
    const minChannel = Math.min(r, g, b);
    const maxChannel = Math.max(r, g, b);
    return minChannel >= whiteThreshold && maxChannel - minChannel <= 26;
  };

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (mask[idx] === 1) return;
    if (isNearWhite(idx)) {
      mask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) tryEnqueue(x - 1, y);
    if (x + 1 < width) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y + 1 < height) tryEnqueue(x, y + 1);
  }

  return mask;
}

export function analyzeHandLandmarks(
  rawLandmarks: NormalizedLandmark[] | null | undefined,
  mirrorX = true,
): HandAnalysis {
  if (!rawLandmarks || rawLandmarks.length < 21) {
    return {
      detected: false,
      palmCenter: { x: 0.5, y: 0.5 },
      indexTip: { x: 0.5, y: 0.5 },
      isOpenPalm: false,
      isPinchingOrGrasping: false,
      palmScale: 0,
      landmarks: [],
    };
  }

  const landmarks: Point2D[] = rawLandmarks.map((pt) => ({
    x: mirrorX ? 1 - pt.x : pt.x,
    y: pt.y,
  }));

  const wrist = landmarks[0];
  const palmAnchors = [0, 5, 9, 13, 17];
  let sumX = 0;
  let sumY = 0;
  for (const idx of palmAnchors) {
    sumX += landmarks[idx].x;
    sumY += landmarks[idx].y;
  }
  const palmCenter: Point2D = {
    x: sumX / palmAnchors.length,
    y: sumY / palmAnchors.length,
  };

  const palmScale = Math.max(0.04, distance2D(wrist, landmarks[9]));

  const fingerPairs: Array<[number, number]> = [
    [8, 6],   // Index
    [12, 10], // Middle
    [16, 14], // Ring
    [20, 18], // Pinky
  ];

  let extendedCount = 0;
  for (const [tipIdx, pipIdx] of fingerPairs) {
    const tipDist = distance2D(wrist, landmarks[tipIdx]);
    const pipDist = distance2D(wrist, landmarks[pipIdx]);
    if (tipDist > pipDist * 1.12) {
      extendedCount++;
    }
  }

  const thumbExtended =
    distance2D(landmarks[4], landmarks[17]) > distance2D(landmarks[3], landmarks[17]) * 1.08;
  const totalExtended = extendedCount + (thumbExtended ? 1 : 0);

  const pinchDist = distance2D(landmarks[4], landmarks[8]);
  const isPinching = pinchDist < palmScale * 0.42;
  const isFistGrasp = extendedCount <= 1;

  return {
    detected: true,
    palmCenter,
    indexTip: landmarks[8],
    isOpenPalm: totalExtended >= 4 || extendedCount >= 3,
    isPinchingOrGrasping: isPinching || isFistGrasp,
    palmScale,
    landmarks,
  };
}

export function createInitialGimmickState(
  logoHome: Point2D = { x: 0.28, y: 0.46 },
  pedestalPos: Point2D = { x: 0.72, y: 0.56 },
): GimmickState {
  return {
    phase: 'waiting_palm',
    logoPos: { ...logoHome },
    logoHome: { ...logoHome },
    pedestalPos: { ...pedestalPos },
    logoScale: 1,
    logoGlow: 0.25,
    hoverPickupProgress: 0,
    chargeProgress: 0,
    launchElapsed: 0,
    completed: false,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function stepGimmickState(
  prev: GimmickState,
  input: GimmickStepInput,
  rawDt: number,
): GimmickStepResult {
  const dt = Math.min(0.25, Math.max(0, rawDt));
  const events: GimmickAudioEvent[] = [];

  if (prev.completed) {
    return { state: prev, events };
  }

  let {
    phase,
    logoScale,
    logoGlow,
    hoverPickupProgress,
    chargeProgress,
    launchElapsed,
  } = prev;
  let completed: boolean = prev.completed;
  let logoPos: Point2D = { ...prev.logoPos };
  const { logoHome, pedestalPos } = prev;

  const smoothFollow = 1 - Math.exp(-12 * dt);
  const smoothReturn = 1 - Math.exp(-5.5 * dt);

  if (phase === 'waiting_palm') {
    logoPos = {
      x: lerp(logoPos.x, logoHome.x, smoothReturn),
      y: lerp(logoPos.y, logoHome.y, smoothReturn),
    };
    logoScale = lerp(logoScale, 1, smoothReturn);
    logoGlow = lerp(logoGlow, 0.28, smoothReturn);
    hoverPickupProgress = Math.max(0, hoverPickupProgress - dt * 2.5);
    chargeProgress = 0;

    if (
      input.handDetected &&
      (input.isOpenPalm || input.isGrasping || input.isPointerDown)
    ) {
      if (
        input.handPos &&
        (input.isGrasping || input.isPointerDown) &&
        distance2D(input.handPos, logoPos) <= PICKUP_RADIUS
      ) {
        phase = 'holding_logo';
        hoverPickupProgress = 1;
        events.push('logo_grabbed');
      } else {
        phase = 'palm_detected';
        events.push('palm_detected');
      }
    }
  } else if (phase === 'palm_detected') {
    logoPos = {
      x: lerp(logoPos.x, logoHome.x, smoothReturn),
      y: lerp(logoPos.y, logoHome.y, smoothReturn),
    };
    logoScale = lerp(logoScale, 1.04, smoothReturn);
    logoGlow = lerp(logoGlow, 0.45, smoothReturn);

    if (!input.handDetected || !input.handPos) {
      phase = 'waiting_palm';
      hoverPickupProgress = 0;
    } else {
      const distToLogo = distance2D(input.handPos, logoPos);
      if (distToLogo <= PICKUP_RADIUS) {
        if (input.isGrasping || input.isPointerDown) {
          phase = 'holding_logo';
          hoverPickupProgress = 1;
          events.push('logo_grabbed');
        } else if (input.isOpenPalm) {
          hoverPickupProgress = Math.min(1, hoverPickupProgress + dt / HOVER_PICKUP_DURATION);
          logoGlow = lerp(logoGlow, 0.78, smoothFollow);
          if (hoverPickupProgress >= 1) {
            phase = 'holding_logo';
            events.push('logo_grabbed');
          }
        }
      } else {
        hoverPickupProgress = Math.max(0, hoverPickupProgress - dt * 2.2);
      }
    }
  } else if (phase === 'holding_logo') {
    if (!input.handDetected || !input.handPos) {
      phase = 'waiting_palm';
      hoverPickupProgress = 0;
      events.push('logo_released');
    } else {
      logoPos = {
        x: lerp(logoPos.x, input.handPos.x, smoothFollow),
        y: lerp(logoPos.y, input.handPos.y, smoothFollow),
      };
      logoScale = lerp(logoScale, 1.12, smoothFollow);
      logoGlow = lerp(logoGlow, 0.85, smoothFollow);

      const distToPedestal = distance2D(logoPos, pedestalPos);
      if (distToPedestal <= DOCK_RADIUS) {
        phase = 'charging';
        chargeProgress = Math.max(chargeProgress, 0.04);
        events.push('charge_started');
      }
    }
  } else if (phase === 'charging') {
    // Magnetic lock directly into the exact left slot of Logo Sekolah Angkat MADANI
    const dockSnap = 1 - Math.exp(-10 * dt);
    logoPos = {
      x: lerp(logoPos.x, pedestalPos.x, dockSnap),
      y: lerp(logoPos.y, pedestalPos.y, dockSnap),
    };
    chargeProgress = Math.min(1, chargeProgress + dt / CHARGE_DURATION);
    logoScale = lerp(logoScale, 1.0, dockSnap);
    logoGlow = 0.85 + chargeProgress * 0.65;

    if (chargeProgress >= 1) {
      phase = 'announcing';
      launchElapsed = 0;
      events.push('access_granted');
    }
  } else if (phase === 'announcing' || phase === 'countdown') {
    const dockSnap = 1 - Math.exp(-10 * dt);
    logoPos = {
      x: lerp(logoPos.x, pedestalPos.x, dockSnap),
      y: lerp(logoPos.y, pedestalPos.y, dockSnap),
    };
    logoScale = lerp(logoScale, 1.0, dockSnap);
    logoGlow = phase === 'countdown' ? 2.1 : 1.75;
  } else if (phase === 'launching') {
    launchElapsed += dt;
    const progress = Math.min(1, launchElapsed / LAUNCH_CLIMAX_DURATION);
    logoPos = {
      x: pedestalPos.x,
      y: pedestalPos.y,
    };
    logoScale = 1.0 + progress * 0.12;
    logoGlow = 2.1 + progress * 1.1;

    if (launchElapsed >= LAUNCH_CLIMAX_DURATION) {
      completed = true;
    }
  }

  return {
    state: {
      phase,
      logoPos,
      logoHome,
      pedestalPos,
      logoScale,
      logoGlow,
      hoverPickupProgress,
      chargeProgress,
      launchElapsed,
      completed,
    },
    events,
  };
}
