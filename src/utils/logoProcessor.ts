import { computeExteriorWhiteMask } from './gestureEngine';

export const MADANI_LOGO_SRC = '/assets/aistudio/download__1__45744a2b.jpeg';

export interface ProcessedLogoAsset {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
}

let cachedPromise: Promise<ProcessedLogoAsset> | null = null;

/**
 * Loads the official Malaysia MADANI emblem and removes ONLY the exterior white backdrop
 * via flood-fill from image borders, preserving the crisp white stripes inside the emblem.
 */
export function loadProcessedMadaniLogo(): Promise<ProcessedLogoAsset> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const exteriorMask = computeExteriorWhiteMask(data, width, height, 224);

        // Strip exterior background and soften 1px fringe adjacent to exterior
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const off = idx * 4;
            if (exteriorMask[idx] === 1) {
              data[off + 3] = 0;
            } else {
              // Check if adjacent to exterior mask for gentle anti-aliased de-fringing
              const nearExterior =
                (x > 0 && exteriorMask[idx - 1] === 1) ||
                (x + 1 < width && exteriorMask[idx + 1] === 1) ||
                (y > 0 && exteriorMask[idx - width] === 1) ||
                (y + 1 < height && exteriorMask[idx + width] === 1);

              if (nearExterior) {
                const r = data[off];
                const g = data[off + 1];
                const b = data[off + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum > 185) {
                  const factor = Math.max(0, Math.min(1, (240 - lum) / 55));
                  data[off + 3] = Math.round(data[off + 3] * factor);
                }
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ canvas, dataUrl, width, height });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Gagal memuatkan imej Logo Malaysia MADANI'));
    };

    img.src = MADANI_LOGO_SRC;
  });

  return cachedPromise;
}
