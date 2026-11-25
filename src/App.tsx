/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type { AppScreen, CeremonyConfig, InputMode } from './types/ceremony';
import { DEFAULT_YOUTUBE_URL } from './utils/gestureEngine';
import {
  loadProcessedMadaniLogo,
  type ProcessedLogoAsset,
} from './utils/logoProcessor';
import { ceremonialAudio } from './utils/ceremonialAudio';
import { StandbyScreen } from './components/StandbyScreen';
import { GestureStage } from './components/GestureStage';
import { VideoCeremony } from './components/VideoCeremony';
import { OutroScreen } from './components/OutroScreen';
import { StageSettingsModal } from './components/StageSettingsModal';

const DEFAULT_CONFIG: CeremonyConfig = {
  eventTitle: 'Majlis Perasmian Malaysia MADANI',
  eventSubtitle:
    'Memacu inovasi, kemampanan dan kesejahteraan negara menerusi pelancaran digital berwawasan.',
  vipName: 'Yang Berhormat Perasmi Kehormat',
  vipTitle: 'Tetamu Kehormat Majlis',
  eventDate: 'Putrajaya, Malaysia',
  youtubeUrl: DEFAULT_YOUTUBE_URL,
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

export default function App() {
  const initialNav = readInitialNavigation();
  const [screen, setScreen] = useState<AppScreen>(initialNav.screen);
  const [inputMode, setInputMode] = useState<InputMode>(initialNav.mode);
  const [config, setConfig] = useState<CeremonyConfig>(DEFAULT_CONFIG);
  const [logoAsset, setLogoAsset] = useState<ProcessedLogoAsset | null>(null);
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pre-process uploaded Malaysia MADANI emblem once to remove exterior white backdrop
  useEffect(() => {
    let active = true;
    loadProcessedMadaniLogo()
      .then((asset) => {
        if (active) setLogoAsset(asset);
      })
      .catch(() => {
        // Fallback to direct image URL is built into components
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
    setInputMode(mode);
    setScreen('stage');
  }, []);

  const handleLaunchComplete = useCallback(() => {
    setScreen('video');
  }, []);

  const handleVideoEnded = useCallback(() => {
    ceremonialAudio.stopChargeLoop();
    setScreen('outro');
  }, []);

  const handleBackToStage = useCallback(() => {
    ceremonialAudio.stopAll();
    setScreen('stage');
  }, []);

  const handleBackToStandby = useCallback(() => {
    ceremonialAudio.stopAll();
    setScreen('standby');
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
          muted={muted}
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
          youtubeUrl={config.youtubeUrl}
          eventTitle={config.eventTitle}
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
