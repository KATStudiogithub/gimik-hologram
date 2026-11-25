import { useEffect, useRef, useState } from 'react';
import {
  FastForward,
  Maximize2,
  RotateCcw,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/gestureEngine';

interface VideoCeremonyProps {
  youtubeUrl: string;
  eventTitle: string;
  onVideoEnded: () => void;
  onBackToStage: () => void;
  onToggleFullscreen: () => void;
}

interface YTPlayerInstance {
  playVideo: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window unavailable'));
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Masa menunggu YouTube Player tamat.'));
    }, 10000);

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeoutId);
      if (prevCallback) prevCallback();
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube API gagal dimulakan.'));
      }
    };

    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error('Gagal memuatkan skrip YouTube Player.'));
      };
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
}

export function VideoCeremony({
  youtubeUrl,
  eventTitle,
  onVideoEnded,
  onBackToStage,
  onToggleFullscreen,
}: VideoCeremonyProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const onEndedRef = useRef(onVideoEnded);
  onEndedRef.current = onVideoEnded;

  const [playerReady, setPlayerReady] = useState(false);
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [curtainVisible, setCurtainVisible] = useState(true);

  const videoId = extractYouTubeVideoId(youtubeUrl) ?? 'ItXTuf-SHaA';

  useEffect(() => {
    const timer = window.setTimeout(() => setCurtainVisible(false), 650);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let fallbackCheckTimer = 0;

    setPlayerReady(false);
    setNeedsManualPlay(false);
    setEmbedError(null);

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (disposed || !containerRef.current) return;

        // Create a fresh mount node inside containerRef so React doesn't conflict with iframe replacement
        containerRef.current.innerHTML = '';
        const mountEl = document.createElement('div');
        mountEl.className = 'w-full h-full';
        containerRef.current.appendChild(mountEl);

        playerRef.current = new YT.Player(mountEl, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev) => {
              if (disposed) return;
              setPlayerReady(true);
              try {
                ev.target.playVideo();
              } catch {
                setNeedsManualPlay(true);
              }
              // If browser blocked autoplay with sound, detect after 1.6s and offer 1-click play
              fallbackCheckTimer = window.setTimeout(() => {
                if (!disposed) {
                  // No-op if already playing; state change handler clears needsManualPlay
                }
              }, 1600);
            },
            onStateChange: (ev) => {
              if (disposed) return;
              if (ev.data === YT.PlayerState.PLAYING) {
                setNeedsManualPlay(false);
              } else if (ev.data === YT.PlayerState.ENDED) {
                onEndedRef.current();
              }
            },
            onError: () => {
              if (disposed) return;
              setEmbedError(
                'Video YouTube tidak dapat dimainkan dalam persekitaran ini. Anda boleh meneruskan ke Outro penutup majlis.',
              );
            },
          },
        });
      })
      .catch((err) => {
        if (disposed) return;
        setEmbedError(
          err instanceof Error
            ? err.message
            : 'Gagal menyambung ke pemain video YouTube.',
        );
      });

    return () => {
      disposed = true;
      window.clearTimeout(fallbackCheckTimer);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  const handleManualPlay = () => {
    try {
      playerRef.current?.unMute();
      playerRef.current?.playVideo();
      setNeedsManualPlay(false);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      data-screen="video"
      className="relative h-screen w-screen overflow-hidden bg-black flex flex-col"
    >
      {/* Golden Ignition Curtain Dissolve */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-700 ${
          curtainVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at center, rgba(254, 243, 199, 0.96) 0%, rgba(212, 175, 55, 0.72) 45%, rgba(4, 8, 20, 0.98) 100%)',
        }}
      />

      {/* Fullscreen YouTube Player Canvas */}
      <div className="relative flex-1 w-full h-full bg-black">
        <div
          ref={containerRef}
          data-testid="youtube-player-container"
          className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
        />

        {!playerReady && !embedError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[#040814]/90 text-slate-200 gap-4">
            <div className="h-11 w-11 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
            <p className="font-display text-base tracking-wide text-amber-200">
              Memainkan Video Perasmian Rasmi...
            </p>
          </div>
        )}

        {needsManualPlay && !embedError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-xs">
            <button
              type="button"
              onClick={handleManualPlay}
              className="inline-flex items-center gap-3 px-7 py-4 rounded-xl bg-amber-400 text-[#040814] font-semibold text-base shadow-2xl hover:bg-amber-300 transition-colors"
            >
              <Volume2 className="h-5 w-5" />
              <span>Mainkan Video Dengan Audio</span>
            </button>
          </div>
        )}

        {embedError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#040814]/95 px-6">
            <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-7 text-center space-y-5">
              <AlertCircle className="h-10 w-10 text-amber-400 mx-auto" />
              <div className="space-y-2">
                <h2 className="font-display text-xl font-semibold text-white">
                  Paparan Video Perasmian
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">{embedError}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onVideoEnded}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-400 text-[#040814] text-sm font-semibold hover:bg-amber-300 transition-colors"
                >
                  <FastForward className="h-4 w-4" />
                  <span>Terus Ke Outro Penutup</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToStage}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-200 hover:border-slate-500 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Kembali ke Pentas</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Discreet Operator Footer Bar (low visual clutter, immediately accessible) */}
      <div className="relative z-30 bg-[#040814]/92 border-t border-slate-800/80 px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-sm font-medium text-slate-200 truncate">
            {eventTitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBackToStage}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700/80 bg-slate-900/70 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Ulang Gimik</span>
          </button>
          <button
            type="button"
            onClick={onVideoEnded}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 text-[#040814] text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span>Tamatkan &amp; Ke Outro</span>
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label="Mod skrin penuh"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-700/80 bg-slate-900/70 text-slate-300 hover:text-amber-300 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
