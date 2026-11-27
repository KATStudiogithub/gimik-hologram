import { computeExteriorWhiteMask } from './gestureEngine';

export const MADANI_LOGO_SRC = `${import.meta.env.BASE_URL}assets/aistudio/download__1__45744a2b.jpeg`;
export const SEKOLAH_ANGKAT_LOGO_SRC = `${import.meta.env.BASE_URL}assets/aistudio/Logo_Sekolah_Angkat_MADANI_ced02db7.jpg`;

export interface ProcessedLogoAsset {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ProcessedPedestalLogoAsset {
  /** Luminous platinum-white hologram of "Sekolah Angkat MADANI" + graduating student (with left MADANI emblem removed) */
  hologramCanvas: HTMLCanvasElement;
  /** Glowing golden-cyan blueprint outline of the removed left Malaysia MADANI emblem */
  slotSilhouetteCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Normalized slot center & bounding size inside the composite canvas where Logo MADANI locks in */
  slot: {
    cx: number;
    cy: number;
    w: number;
    h: number;
  };
}

let cachedMadaniPromise: Promise<ProcessedLogoAsset> | null = null;
let cachedPedestalPromise: Promise<ProcessedPedestalLogoAsset> | null = null;

/**
 * Loads the official Malaysia MADANI emblem and removes ONLY the exterior white backdrop
 * via flood-fill from image borders, preserving the crisp white stripes inside the emblem.
 */
export function loadProcessedMadaniLogo(): Promise<ProcessedLogoAsset> {
  if (cachedMadaniPromise) return cachedMadaniPromise;

  cachedMadaniPromise = new Promise((resolve, reject) => {
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

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const off = idx * 4;
            if (exteriorMask[idx] === 1) {
              data[off + 3] = 0;
            } else {
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

  return cachedMadaniPromise;
}

/**
 * Loads the uploaded Logo Sekolah Angkat MADANI, cleanly removes the left Malaysia MADANI
 * emblem (leaving an empty glowing holographic socket in its exact bounding box), strips
 * the white scan backdrop & stray dust specks, and renders "Sekolah Angkat MADANI" + the
 * graduating student emblem in crisp luminous holographic platinum-white for the dark stage.
 */
export function loadProcessedSekolahAngkatPedestal(): Promise<ProcessedPedestalLogoAsset> {
  if (cachedPedestalPromise) return cachedPedestalPromise;

  cachedPedestalPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // Normalized crop & separation measured on Logo_Sekolah_Angkat_MADANI_ced02db7.jpg (1748x1240):
        // - Left MADANI emblem:  x=[175..447], y=[379..840]
        // - Clean white gap:     x=[448..470]
        // - Right text+student:  x=[471..1609], y=[294..921]
        const cropX = Math.round(srcW * (163 / 1748));
        const cropY = Math.round(srcH * (282 / 1240));
        const cropW = Math.round(srcW * (1458 / 1748));
        const cropH = Math.round(srcH * (652 / 1240));
        const splitLocalX = Math.round(srcW * (459 / 1748)) - cropX;

        const workCanvas = document.createElement('canvas');
        workCanvas.width = cropW;
        workCanvas.height = cropH;
        const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
        if (!workCtx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        workCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const srcData = workCtx.getImageData(0, 0, cropW, cropH).data;

        // Precompute grayscale luminance buffer for fast despeckling
        const lumBuf = new Uint8Array(cropW * cropH);
        for (let i = 0; i < cropW * cropH; i++) {
          const off = i * 4;
          lumBuf[i] = Math.round(
            0.299 * srcData[off] + 0.587 * srcData[off + 1] + 0.114 * srcData[off + 2],
          );
        }

        // 1. Build hologramCanvas: ONLY "Sekolah Angkat MADANI" + Graduating Student (x >= splitLocalX)
        // Use fast connected-component pruning to eliminate 100% of tiny JPEG scan dust specks
        const totalPx = cropW * cropH;
        const inkMask = new Uint8Array(totalPx);
        for (let y = 1; y < cropH - 1; y++) {
          for (let x = splitLocalX; x < cropW - 1; x++) {
            const idx = y * cropW + x;
            if (lumBuf[idx] < 224) {
              inkMask[idx] = 1;
            }
          }
        }

        const visited = new Uint8Array(totalPx);
        const queue = new Int32Array(totalPx);
        const compBuf = new Int32Array(totalPx);
        const MIN_COMPONENT_PIXELS = 36;

        for (let y = 1; y < cropH - 1; y++) {
          for (let x = splitLocalX; x < cropW - 1; x++) {
            const startIdx = y * cropW + x;
            if (inkMask[startIdx] === 0 || visited[startIdx] === 1) continue;

            let qHead = 0;
            let qTail = 0;
            let compLen = 0;
            visited[startIdx] = 1;
            queue[qTail++] = startIdx;

            while (qHead < qTail) {
              const cur = queue[qHead++];
              compBuf[compLen++] = cur;
              const cx = cur % cropW;
              const cy = (cur - cx) / cropW;

              if (cx > splitLocalX && inkMask[cur - 1] === 1 && visited[cur - 1] === 0) {
                visited[cur - 1] = 1;
                queue[qTail++] = cur - 1;
              }
              if (cx + 1 < cropW - 1 && inkMask[cur + 1] === 1 && visited[cur + 1] === 0) {
                visited[cur + 1] = 1;
                queue[qTail++] = cur + 1;
              }
              if (cy > 1 && inkMask[cur - cropW] === 1 && visited[cur - cropW] === 0) {
                visited[cur - cropW] = 1;
                queue[qTail++] = cur - cropW;
              }
              if (cy + 1 < cropH - 1 && inkMask[cur + cropW] === 1 && visited[cur + cropW] === 0) {
                visited[cur + cropW] = 1;
                queue[qTail++] = cur + cropW;
              }
            }

            if (compLen < MIN_COMPONENT_PIXELS) {
              for (let k = 0; k < compLen; k++) {
                inkMask[compBuf[k]] = 0;
              }
            }
          }
        }

        const hologramCanvas = document.createElement('canvas');
        hologramCanvas.width = cropW;
        hologramCanvas.height = cropH;
        const holoCtx = hologramCanvas.getContext('2d');
        if (!holoCtx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        const holoImg = holoCtx.createImageData(cropW, cropH);
        const holoData = holoImg.data;

        for (let y = 1; y < cropH - 1; y++) {
          for (let x = splitLocalX; x < cropW - 1; x++) {
            const idx = y * cropW + x;
            if (inkMask[idx] === 0) continue;

            const lum = lumBuf[idx];
            const rawAlpha = Math.max(0, Math.min(1, (224 - lum) / 142));
            const alpha = Math.round(Math.pow(rawAlpha, 0.82) * 255);

            // Luminous holographic platinum-white with subtle ice-blue tint for high stage legibility
            const off = idx * 4;
            holoData[off] = 242;
            holoData[off + 1] = 247;
            holoData[off + 2] = 255;
            holoData[off + 3] = alpha;
          }
        }
        holoCtx.putImageData(holoImg, 0, 0);

        // 2. Build slotSilhouetteCanvas: ONLY the removed left MADANI emblem as a glowing blueprint socket
        const slotSilhouetteCanvas = document.createElement('canvas');
        slotSilhouetteCanvas.width = cropW;
        slotSilhouetteCanvas.height = cropH;
        const slotCtx = slotSilhouetteCanvas.getContext('2d');
        if (!slotCtx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Extract left-region RGBA to run exterior-white flood fill strictly around the left MADANI emblem
        const leftW = Math.max(2, splitLocalX);
        const leftRgba = new Uint8ClampedArray(leftW * cropH * 4);
        for (let y = 0; y < cropH; y++) {
          for (let x = 0; x < leftW; x++) {
            const sOff = (y * cropW + x) * 4;
            const dOff = (y * leftW + x) * 4;
            leftRgba[dOff] = srcData[sOff];
            leftRgba[dOff + 1] = srcData[sOff + 1];
            leftRgba[dOff + 2] = srcData[sOff + 2];
            leftRgba[dOff + 3] = 255;
          }
        }
        const leftExterior = computeExteriorWhiteMask(leftRgba, leftW, cropH, 224);

        const slotImg = slotCtx.createImageData(cropW, cropH);
        const slotData = slotImg.data;
        const borderThickness = 4;

        for (let y = 0; y < cropH; y++) {
          for (let x = 0; x < leftW; x++) {
            const lIdx = y * leftW + x;
            if (leftExterior[lIdx] === 1) continue;

            // Determine whether pixel is near the silhouette perimeter for a luminous blueprint contour
            let isBorder = false;
            for (let dy = -borderThickness; dy <= borderThickness && !isBorder; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= cropH) {
                isBorder = true;
                break;
              }
              for (let dx = -borderThickness; dx <= borderThickness; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= leftW) {
                  isBorder = true;
                  break;
                }
                if (leftExterior[ny * leftW + nx] === 1) {
                  isBorder = true;
                  break;
                }
              }
            }

            const dOff = (y * cropW + x) * 4;
            if (isBorder) {
              // Crisp glowing royal-gold perimeter contour
              slotData[dOff] = 253;
              slotData[dOff + 1] = 224;
              slotData[dOff + 2] = 71;
              slotData[dOff + 3] = 215;
            } else {
              // Subtle holographic glass interior fill with faint horizontal scanlines
              const scanline = y % 6 < 2 ? 0.22 : 0.11;
              slotData[dOff] = 96;
              slotData[dOff + 1] = 165;
              slotData[dOff + 2] = 250;
              slotData[dOff + 3] = Math.round(255 * scanline);
            }
          }
        }
        slotCtx.putImageData(slotImg, 0, 0);

        resolve({
          hologramCanvas,
          slotSilhouetteCanvas,
          width: cropW,
          height: cropH,
          slot: {
            cx: ((175 + 447) / 2 - 163) / 1458,
            cy: ((379 + 840) / 2 - 282) / 652,
            w: 273 / 1458,
            h: 462 / 652,
          },
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Gagal memuatkan imej Logo Sekolah Angkat MADANI'));
    };

    img.src = SEKOLAH_ANGKAT_LOGO_SRC;
  });

  return cachedPedestalPromise;
}
