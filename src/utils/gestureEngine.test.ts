import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VIDEO_URL,
  DEFAULT_YOUTUBE_URL,
  analyzeHandLandmarks,
  computeExteriorWhiteMask,
  createInitialGimmickState,
  extractYouTubeVideoId,
  isDirectVideoUrl,
  stepGimmickState,
} from './gestureEngine';
import type { NormalizedLandmark } from '../types/ceremony';

test('extractYouTubeVideoId and isDirectVideoUrl distinguish MP4 and YouTube launch videos', () => {
  assert.equal(isDirectVideoUrl(DEFAULT_VIDEO_URL), true);
  assert.equal(isDirectVideoUrl('/assets/video/pelancaran.mp4'), true);
  assert.equal(isDirectVideoUrl('https://cdn.example.com/clip.mp4?v=1'), true);
  assert.equal(isDirectVideoUrl(DEFAULT_YOUTUBE_URL), false);
  assert.equal(extractYouTubeVideoId(DEFAULT_YOUTUBE_URL), 'ZJzvtK7-prw');
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=ZJzvtK7-prw&t=10s'),
    'ZJzvtK7-prw',
  );
  assert.equal(
    extractYouTubeVideoId('https://youtu.be/ItXTuf-SHaA?si=ZW1HOAAHTpgLbEIw'),
    'ItXTuf-SHaA',
  );
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/embed/ZJzvtK7-prw'),
    'ZJzvtK7-prw',
  );
  assert.equal(extractYouTubeVideoId('ZJzvtK7-prw'), 'ZJzvtK7-prw');
  assert.equal(extractYouTubeVideoId('https://example.com/not-youtube'), null);
  assert.equal(extractYouTubeVideoId(''), null);
});

test('computeExteriorWhiteMask strips exterior white while preserving interior white enclosed by dark outline', () => {
  // 5x5 image:
  // Row 0 & 4, Col 0 & 4: white background (255,255,255)
  // Row 1..3, Col 1..3 border: dark navy (10,29,110)
  // Center (2,2): pure white stripe inside the outline (255,255,255)
  const w = 5;
  const h = 5;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const isOutline =
        (x === 1 || x === 3 || y === 1 || y === 3) &&
        x >= 1 &&
        x <= 3 &&
        y >= 1 &&
        y <= 3;
      if (isOutline) {
        rgba[idx] = 10;
        rgba[idx + 1] = 29;
        rgba[idx + 2] = 110;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      }
    }
  }

  const mask = computeExteriorWhiteMask(rgba, w, h);
  assert.equal(mask[0], 1, 'Top-left exterior white must be transparent');
  assert.equal(mask[4], 1, 'Top-right exterior white must be transparent');
  assert.equal(mask[1 * w + 1], 0, 'Navy outline must stay opaque');
  assert.equal(mask[2 * w + 2], 0, 'Interior white stripe must stay opaque');
});

function makeSyntheticHand(open: boolean): NormalizedLandmark[] {
  const pts: NormalizedLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  // Wrist at bottom
  pts[0] = { x: 0.5, y: 0.8 };
  // Thumb
  pts[3] = { x: 0.42, y: 0.65 };
  pts[4] = open ? { x: 0.34, y: 0.58 } : { x: 0.47, y: 0.60 };
  // MCP knuckles
  pts[5] = { x: 0.44, y: 0.6 };
  pts[9] = { x: 0.5, y: 0.58 };
  pts[13] = { x: 0.56, y: 0.6 };
  pts[17] = { x: 0.62, y: 0.63 };

  // PIP and Tips
  const fingers: Array<[number, number, number]> = [
    [6, 8, 0.44],
    [10, 12, 0.5],
    [14, 16, 0.56],
    [18, 20, 0.62],
  ];
  for (const [pip, tip, x] of fingers) {
    pts[pip] = { x, y: 0.48 };
    pts[tip] = open ? { x, y: 0.3 } : { x, y: 0.62 };
  }
  return pts;
}

test('analyzeHandLandmarks distinguishes open palm from closed grasp', () => {
  const openRes = analyzeHandLandmarks(makeSyntheticHand(true), true);
  assert.equal(openRes.detected, true);
  assert.equal(openRes.isOpenPalm, true);
  assert.equal(openRes.isPinchingOrGrasping, false);

  const closedRes = analyzeHandLandmarks(makeSyntheticHand(false), true);
  assert.equal(closedRes.detected, true);
  assert.equal(closedRes.isOpenPalm, false);
  assert.equal(closedRes.isPinchingOrGrasping, true);
});

test('stepGimmickState runs full ceremony flow: palm -> grab -> dock -> charge -> launch', () => {
  let state = createInitialGimmickState({ x: 0.28, y: 0.46 }, { x: 0.72, y: 0.56 });
  assert.equal(state.phase, 'waiting_palm');

  // 1. Open palm shown away from logo -> palm_detected
  let res = stepGimmickState(
    state,
    {
      handDetected: true,
      handPos: { x: 0.5, y: 0.5 },
      isOpenPalm: true,
      isGrasping: false,
      isPointerDown: false,
    },
    0.016,
  );
  state = res.state;
  assert.equal(state.phase, 'palm_detected');
  assert.deepEqual(res.events, ['palm_detected']);

  // 2. Move onto logo and grasp -> holding_logo
  res = stepGimmickState(
    state,
    {
      handDetected: true,
      handPos: { x: 0.28, y: 0.46 },
      isOpenPalm: false,
      isGrasping: true,
      isPointerDown: true,
    },
    0.016,
  );
  state = res.state;
  assert.equal(state.phase, 'holding_logo');
  assert.deepEqual(res.events, ['logo_grabbed']);

  // 3. Drag logo across stage to pedestal -> charging
  for (let i = 0; i < 40 && state.phase === 'holding_logo'; i++) {
    res = stepGimmickState(
      state,
      {
        handDetected: true,
        handPos: { x: 0.72, y: 0.56 },
        isOpenPalm: false,
        isGrasping: true,
        isPointerDown: true,
      },
      0.05,
    );
    state = res.state;
  }
  assert.equal(state.phase, 'charging');

  // 4. Charging progresses to 1.0 -> announcing (access_granted)
  let sawAccessGranted = false;
  for (let i = 0; i < 40 && state.phase === 'charging'; i++) {
    res = stepGimmickState(
      state,
      {
        handDetected: true,
        handPos: { x: 0.72, y: 0.56 },
        isOpenPalm: true,
        isGrasping: false,
        isPointerDown: false,
      },
      0.06,
    );
    state = res.state;
    if (res.events.includes('access_granted')) sawAccessGranted = true;
  }
  assert.equal(state.phase, 'announcing');
  assert.equal(sawAccessGranted, true);

  // 5. After AI announcement and 3-2-1 countdown, stage enters launching -> completed = true
  state = { ...state, phase: 'launching', launchElapsed: 0 };
  for (let i = 0; i < 30 && !state.completed; i++) {
    res = stepGimmickState(
      state,
      {
        handDetected: false,
        handPos: null,
        isOpenPalm: false,
        isGrasping: false,
        isPointerDown: false,
      },
      0.06,
    );
    state = res.state;
  }
  assert.equal(state.completed, true);
});
