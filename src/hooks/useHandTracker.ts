import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandAnalysis } from '../types/ceremony';
import { analyzeHandLandmarks } from '../utils/gestureEngine';

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error';

const EMPTY_HAND: HandAnalysis = {
  detected: false,
  palmCenter: { x: 0.5, y: 0.5 },
  indexTip: { x: 0.5, y: 0.5 },
  isOpenPalm: false,
  isPinchingOrGrasping: false,
  palmScale: 0,
  landmarks: [],
};

const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export function useHandTracker(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handRef = useRef<HandAnalysis>(EMPTY_HAND);
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      handRef.current = EMPTY_HAND;
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let rafId = 0;
    let lastVideoTime = -1;

    async function init() {
      setStatus('loading');
      setErrorMessage(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Peranti atau pelayar ini tidak menyokong akses kamera.');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => {});
        }

        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        if (cancelled) return;

        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        if (cancelled) {
          landmarker.close();
          return;
        }

        setStatus('ready');

        const detectLoop = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && landmarker && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            try {
              const res = landmarker.detectForVideo(v, performance.now());
              if (res.landmarks && res.landmarks.length > 0) {
                handRef.current = analyzeHandLandmarks(res.landmarks[0], true);
              } else {
                handRef.current = EMPTY_HAND;
              }
            } catch {
              handRef.current = EMPTY_HAND;
            }
          }
          rafId = requestAnimationFrame(detectLoop);
        };

        rafId = requestAnimationFrame(detectLoop);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Kebenaran kamera tidak diberikan. Sila benarkan kamera atau gunakan Mod Simulasi Interaktif.'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'Tiada kamera ditemui pada peranti ini. Gunakan Mod Simulasi Interaktif untuk meneruskan.'
              : err instanceof Error
                ? err.message
                : 'Gagal mengaktifkan kamera. Gunakan Mod Simulasi Interaktif.';
        setErrorMessage(msg);
        setStatus('error');
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      handRef.current = EMPTY_HAND;
      if (landmarker) {
        try {
          landmarker.close();
        } catch {
          // Ignore close error
        }
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [enabled]);

  return { videoRef, handRef, status, errorMessage };
}
