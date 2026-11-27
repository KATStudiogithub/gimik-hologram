export type AppScreen = 'standby' | 'stage' | 'video' | 'outro';

export type InputMode = 'camera' | 'simulate';

export type GimmickPhase =
  | 'waiting_palm'
  | 'palm_detected'
  | 'holding_logo'
  | 'charging'
  | 'announcing'
  | 'countdown'
  | 'launching';

export interface Point2D {
  x: number;
  y: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface HandAnalysis {
  detected: boolean;
  palmCenter: Point2D;
  indexTip: Point2D;
  isOpenPalm: boolean;
  isPinchingOrGrasping: boolean;
  palmScale: number;
  landmarks: Point2D[];
}

export interface CeremonyConfig {
  eventTitle: string;
  eventSubtitle: string;
  vipName: string;
  vipTitle: string;
  vipDepartment: string;
  eventDate: string;
  videoUrl: string;
}

export interface GimmickState {
  phase: GimmickPhase;
  logoPos: Point2D;
  logoHome: Point2D;
  pedestalPos: Point2D;
  logoScale: number;
  logoGlow: number;
  hoverPickupProgress: number;
  chargeProgress: number;
  launchElapsed: number;
  completed: boolean;
}

export interface GimmickStepInput {
  handDetected: boolean;
  handPos: Point2D | null;
  isOpenPalm: boolean;
  isGrasping: boolean;
  isPointerDown: boolean;
}

export type GimmickAudioEvent =
  | 'palm_detected'
  | 'logo_grabbed'
  | 'logo_released'
  | 'charge_started'
  | 'access_granted'
  | 'launch_triggered';

export interface GimmickStepResult {
  state: GimmickState;
  events: GimmickAudioEvent[];
}
