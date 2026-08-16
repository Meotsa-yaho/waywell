export type SensitivityId = 'uv' | 'temp' | 'dust' | 'balanced';

export interface SensitivityOption {
  id: SensitivityId;
  icon: string;
  title: string;
  category: string;
  description: string;
  tag: string;
  benefits: string[];
  metrics: {
    uvWeight: string;
    tempWeight: string;
    dustWeight: string;
  };
}

export interface OnboardingState {
  currentStep: 1 | 2 | 3;
  selectedSensitivity: SensitivityId;
  notificationsEnabled: boolean;
  isComplete: boolean;
  authMethod: 'kakao' | 'guest' | null;
}
