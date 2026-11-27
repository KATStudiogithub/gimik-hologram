/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type { AppScreen, CeremonyConfig, InputMode } from './types/ceremony';
import { DEFAULT_VIDEO_URL } from './utils/gestureEngine';
import {
  loadProcessedMadaniLogo,
  loadProcessedSekolahAngkatPedestal,
  type ProcessedLogoAsset,
  type ProcessedPedestalLogoAsset,
} from './utils/logoProcessor';
import { ceremonialAudio } from './utils/ceremonialAudio';
import { StandbyScreen } from './components/StandbyScreen';
import { GestureStage } from './components/GestureStage';
import { VideoCeremony } from './components/VideoCeremony';
import { OutroScreen } from './components/OutroScreen';
import { StageSettingsModal } from './components/StageSettingsModal';

const DEFAULT_CONFIG: CeremonyConfig = {
  eventTitle:
    'Majlis Apresiasi Kecemerlangan dan Penyerahan Sekolah Angkat MADANI',
  eventSubtitle:
    'Majlis Apresiasi Kecemerlangan dan Penyerahan Sekolah Angkat MADANI di SK Merbau Pulas 2026.',
  vipName: 'Yang Berbahagia Encik Erwin Khairul Bin Ahmad',
  vipTitle: 'Ketua Pengarah Jabatan Penerangan Malaysia',
  vipDepartment: 'Kementerian Komunikasi',
  eventDate: 'SK Merbau Pulas · 2026',
  videoUrl: DEFAULT_VIDEO_URL,
};

function readInitialNavigation(): { screen: AppScreen; mode: InputMode } {
  if (typeof window === 'undefined') {
    return { screen: 'standby', mode: 'camera' };
  }
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode') === 'simulate' ? 'simulate' : 'camera';
  const screenParam = params.get('screen');
  if (screenParam === 'video' || screenParam === 'outro' || screenParam === 'stage') {
    return { screen: screenParam, mode: modeParam };
  }
  if (params.get('autostart') === '1') {
    return { screen: 'stage', mode: modeParam };
  }
  return { screen: 'standby', mode: modeParam };
}

function detectIsFullscreen(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  if (Boolean(document.fullscreenElement || doc.webkitFullscreenElement)) {
    return true;
  }
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) {
    return true;
  }
  if (new URLSearchParams(window.location.search).get('fullscreen') === '1') {
    return true;
  }
  return false;
}

export default function App() {
  const initialNav = readInitialNavigation();
  const [screen, setScreen] = useState<AppScreen>(initialNav.screen);
  const [inputMode, setInputMode] = useState<InputMode>(initialNav.mode);
  const [config, setConfig] = useState<CeremonyConfig>(DEFAULT_CONFIG);
  const [logoAsset, setLogoAsset] = useState<ProcessedLogoAsset | null>(null);
  const [pedestalAsset, setPedestalAsset] = useState<ProcessedPedestalLogoAsset | null>(null);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => detectIsFullscreen());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Track both Fullscreen API and F11 browser fullscreen cleanly
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(detectIsFullscreen());
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    window.addEventListener('resize', syncFullscreen);
    const mq = window.matchMedia?.('(display-mode: fullscreen)');
    mq?.addEventListener?.('change', syncFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      window.removeEventListener('resize', syncFullscreen);
      mq?.removeEventListener?.('change', syncFullscreen);
    };
  }, []);

  // Pre-process both Malaysia MADANI draggable emblem and Sekolah Angkat MADANI pedestal logo
  useEffect(() => {
    let active = true;
    loadProcessedMadaniLogo()
      .then((asset) => {
        if (active) setLogoAsset(asset);
      })
      .catch(() => {
        // Fallback built into components
      });
    loadProcessedSekolahAngkatPedestal()
      .then((asset) => {
        if (active) setPedestalAsset(asset);
      })
      .catch(() => {
        // Fallback built into GestureStage
      });
    return () => {
      active = false;
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      ceremonialAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleStartCeremony = useCallback((mode: InputMode) => {
    ceremonialAudio.unlock();
    ceremonialAudio.stopAll();
    ceremonialAudio.startEpicMusic();
    setInputMode(mode);
    setScreen('stage');
  }, []);

  const handleLaunchComplete = useCallback(() => {
    ceremonialAudio.stopEpicMusic(250);
    ceremonialAudio.stopSpeech();
    setScreen('video');
  }, []);

  const handleVideoEnded = useCallback(() => {
    ceremonialAudio.stopChargeLoop();
    ceremonialAudio.stopEpicMusic(0);
    setScreen('outro');
  }, []);

  const handleBackToStage = useCallback(() => {
    ceremonialAudio.stopAll();
    ceremonialAudio.startEpicMusic();
    setScreen('stage');
  }, []);

  const handleBackToStandby = useCallback(() => {
    ceremonialAudio.stopAll();
    setScreen('standby');
  }, []);

  const handleTestAiVoice = useCallback(() => {
    ceremonialAudio.unlock();
    ceremonialAudio.playAccessGranted();
    ceremonialAudio.playMalayAnnouncement();
  }, []);

  const handleTestApplause = useCallback(() => {
    ceremonialAudio.unlock();
    ceremonialAudio.playFestiveApplause(5.5);
  }, []);

  return (
    <>
      {screen === 'standby' && (
        <StandbyScreen
          config={config}
          logoUrl={logoAsset?.dataUrl ?? null}
          muted={muted}
          isFullscreen={isFullscreen}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenSettings={() => setSettingsOpen(true)}
          onStartCeremony={handleStartCeremony}
        />
      )}

      {screen === 'stage' && (
        <GestureStage
          config={config}
          inputMode={inputMode}
          logoAsset={logoAsset}
          pedestalAsset={pedestalAsset}
          muted={muted}
          isFullscreen={isFullscreen}
          onChangeMode={setInputMode}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenSettings={() => setSettingsOpen(true)}
          onBackToStandby={handleBackToStandby}
          onLaunchComplete={handleLaunchComplete}
        />
      )}

      {screen === 'video' && (
        <VideoCeremony
          videoUrl={config.videoUrl}
          eventTitle={config.eventTitle}
          isFullscreen={isFullscreen}
          onVideoEnded={handleVideoEnded}
          onBackToStage={handleBackToStage}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {screen === 'outro' && (
        <OutroScreen
          config={config}
          logoUrl={logoAsset?.dataUrl ?? null}
          muted={muted}
          isFullscreen={isFullscreen}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onReplayVideo={() => setScreen('video')}
          onBackToStage={handleBackToStage}
        />
      )}

      <StageSettingsModal
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={setConfig}
        onTestAiVoice={handleTestAiVoice}
        onTestApplause={handleTestApplause}
        onJumpToVideo={() => {
          ceremonialAudio.stopAll();
          setScreen('video');
        }}
        onJumpToOutro={() => {
          ceremonialAudio.stopAll();
          setScreen('outro');
        }}
      />
    </>
  );
}
