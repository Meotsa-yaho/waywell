import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { SensitivityId } from '../types/onboarding';
import { useTheme } from '../store/theme';
import { useSession } from '../store/session';
import { api } from '../api/client';
import { SENSITIVITY_TO_PRESET, PRESET_TO_SENSITIVITY } from '../lib/presets';
import { startKakaoLogin } from '../lib/kakaoAuth';
import { StepIndicator } from '../components/onboarding/StepIndicator';
import { Step1Framing } from '../components/onboarding/Step1Framing';
import { Step2Sensitivity } from '../components/onboarding/Step2Sensitivity';
import { Step3Auth } from '../components/onboarding/Step3Auth';

// Helper to determine system preference as default
export default function Onboarding() {
  const nav = useNavigate();
  const setPreset = useSession((s) => s.setPreset);
  const completeOnboarding = useSession((s) => s.completeOnboarding);
  const token = useSession((s) => s.token); // 이미 로그인했으면 인증 단계 생략
  const preset = useSession((s) => s.preset); // 재진입 시 현재 프리셋을 초기 선택으로 (설정↔온보딩 통일)

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedSensitivity, setSelectedSensitivity] = useState<SensitivityId>(
    PRESET_TO_SENSITIVITY[preset] || 'uv',
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [authSuccess, setAuthSuccess] = useState<'kakao' | 'guest' | null>(null);
  const [isKakaoLoading, setIsKakaoLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dark Mode State: Defaults to User Device / OS preference
  const toggleTheme = useTheme((s) => s.toggle);

  // Sync with system preferences if user hasn't manually overridden

  const handleToggleDarkMode = () => toggleTheme();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleStep1Next = () => {
    setCurrentStep(2);
  };

  const handleStep2Select = (id: SensitivityId) => {
    setSelectedSensitivity(id);
  };

  // 로그인 상태면 인증 단계 없이 프리셋만 저장하고 완료
  const finishForLoggedIn = (sensitivity: SensitivityId) => {
    const preset = SENSITIVITY_TO_PRESET[sensitivity] || 'normal';
    setPreset(preset);
    api.patchMe(preset).catch(() => {});
    completeOnboarding();
    localStorage.setItem('sensitivity_profile', sensitivity);
    showToast('프로필이 저장되었습니다.');
    setTimeout(() => nav('/', { replace: true }), 700);
  };

  const handleStep2Next = () => {
    if (token) return finishForLoggedIn(selectedSensitivity);
    setCurrentStep(3);
  };

  const handleStep2Skip = () => {
    setSelectedSensitivity('balanced');
    if (token) return finishForLoggedIn('balanced');
    setCurrentStep(3);
    showToast("'스마트 밸런스' 기본 프로필이 적용되었습니다.");
  };

  const handleStepBack = () => {
    if (isKakaoLoading) return;
    if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
  };

  const handleToggleNotifications = () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    showToast(nextState ? '🔔 실내 대기 3분 전 알림이 켜졌습니다.' : '🔕 실내 대기 알림이 꺼졌습니다.');
  };

  const finalizeOnboarding = (method: 'kakao' | 'guest') => {
    const preset = SENSITIVITY_TO_PRESET[selectedSensitivity] || 'normal';
    setPreset(preset);
    completeOnboarding();
    localStorage.setItem('auth_method', method);
    localStorage.setItem('sensitivity_profile', selectedSensitivity);
    localStorage.setItem('notifications_enabled', String(notificationsEnabled));

    setTimeout(() => {
      nav('/', { replace: true });
    }, 900);
  };

  const handleKakaoLogin = () => {
    if (isKakaoLoading) return;
    setIsKakaoLoading(true);
    // 선택한 프리셋을 로컬에 저장하고 카카오로 리다이렉트 → 콜백에서 계정에 반영
    const preset = SENSITIVITY_TO_PRESET[selectedSensitivity] || 'normal';
    setPreset(preset);
    completeOnboarding();
    localStorage.setItem('onboarding_preset', preset);
    startKakaoLogin();
  };

  const handleGuestEnter = () => {
    if (isKakaoLoading) return;
    setAuthSuccess('guest');
    showToast('게스트 모드로 노출 부하 프로필이 적용되었습니다.');
    finalizeOnboarding('guest');
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center font-sans transition-colors duration-200 selection:bg-emerald-500/30 selection:text-emerald-300 bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100`}>
      <main
        id="waywell-onboarding-container"
        className="w-full max-w-lg min-h-screen flex flex-col justify-between p-6 sm:p-8 relative mx-auto"
      >
        {/* Toast Notification Popup */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed sm:absolute top-5 left-4 right-4 sm:left-6 sm:right-6 z-50 bg-slate-900/95 text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center justify-center text-center backdrop-blur-xs border border-slate-700/50"
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Progress Header with Dark Mode Switch */}
        <StepIndicator 
          currentStep={currentStep} 
          onBack={handleStepBack} 
          authSuccess={authSuccess}
          onToggleDarkMode={handleToggleDarkMode}
        />

        {/* Step Content with AnimatePresence */}
        <div className="flex-1 flex flex-col justify-between py-2">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <Step1Framing key="step1" onNext={handleStep1Next} />
            )}
            {currentStep === 2 && (
              <Step2Sensitivity
                key="step2"
                selectedSensitivity={selectedSensitivity}
                      onSelect={handleStep2Select}
                onNext={handleStep2Next}
                onSkip={handleStep2Skip}
              />
            )}
            {currentStep === 3 && (
              <Step3Auth
                key="step3"
                selectedSensitivity={selectedSensitivity}
                notificationsEnabled={notificationsEnabled}
                      onToggleNotifications={handleToggleNotifications}
                onLoginKakao={handleKakaoLogin}
                onEnterGuest={handleGuestEnter}
                authSuccess={authSuccess}
                isKakaoLoading={isKakaoLoading}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
