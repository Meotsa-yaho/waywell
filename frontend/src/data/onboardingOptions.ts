import type { SensitivityOption } from '../types/onboarding';

export const SENSITIVITY_OPTIONS: SensitivityOption[] = [
  {
    id: 'uv',
    icon: '☀️',
    title: '햇빛·자외선 타는 게 제일 싫어요',
    category: '피부·자외선 민감',
    description: '그늘길, 빌딩 회랑, 지하 통로를 우선 배정하여 자외선(UV) 노출을 최대 80% 차단합니다.',
    tag: '자외선 집중 방어',
    benefits: ['지하철 연결통로 우선 경로', '빌딩 그늘 보행로 탐색', '실시간 UV 지수 알림'],
    metrics: {
      uvWeight: '최대 가중치 (80%)',
      tempWeight: '보통 (10%)',
      dustWeight: '보통 (10%)'
    }
  },
  {
    id: 'temp',
    icon: '🥵',
    title: '땀 흘리거나 오들오들 떠는 게 싫어요',
    category: '더위·추위 취약',
    description: '냉·난방 실내 쉘터와 에어컨 쉼터를 대기 장소로 매핑하여 급격한 체감온도 스트레스를 방지합니다.',
    tag: '체감온도 안심 케어',
    benefits: ['실내 버스 승강장 연계', '최소 도보 환승 동선', '스마트 쉼터 우선 대기'],
    metrics: {
      uvWeight: '보통 (15%)',
      tempWeight: '최대 가중치 (70%)',
      dustWeight: '보통 (15%)'
    }
  },
  {
    id: 'dust',
    icon: '😷',
    title: '답답한 미세먼지·황사가 제일 싫어요',
    category: '호흡기 케어',
    description: '대로변 차량 매연 도로를 우회하고 녹지·공원 통로 및 공기정화 구역을 경유합니다.',
    tag: '호흡기 클린 경로',
    benefits: ['차량 정체구간 매연 우회', '도시 숲·공원 안심길', '미세먼지 실시간 회피'],
    metrics: {
      uvWeight: '보통 (15%)',
      tempWeight: '보통 (15%)',
      dustWeight: '최대 가중치 (70%)'
    }
  },
  {
    id: 'balanced',
    icon: '⚖️',
    title: '다 비슷해요, 알아서 균형 있게 관리해 주세요',
    category: '스마트 밸런스 (기본값)',
    description: '현재 날씨(자외선, 기온, 공기질)와 이동 동선을 종합 분석하여 가장 쾌적한 밸런스를 계산합니다.',
    tag: '스마트 밸런스 추천',
    benefits: ['실시간 날씨 자동 가중치', '최적 쾌적/소요시간 밸런스', '스마트 실내 대기 알림'],
    metrics: {
      uvWeight: '균형 (33%)',
      tempWeight: '균형 (33%)',
      dustWeight: '균형 (34%)'
    }
  }
];

export const COMPARISON_DATA = {
  traditional: {
    title: '기존 최단시간 길찾기',
    waiting: '뙤약볕 정류장 25분 대기',
    temp: '체감 34℃ 직사광선',
    loadScore: 85,
    statusText: '노출 부하 85점 (위험 경고)',
    statusLevel: 'danger',
    drawbacks: ['자외선 직사 노출 25분', '땀 분비 및 체온 상승', '아스팔트 복사열 흡수']
  },
  waywell: {
    title: '웨이웰 웰니스 케어 길찾기',
    waiting: '실내 스마트 쉼터·카페 22분 대기',
    temp: '체감 24℃ 쾌적 실내',
    transit: '그늘 이동 3분',
    loadScore: 28,
    statusText: '노출 부하 28점 (쾌적·안전)',
    statusLevel: 'safe',
    benefits: ['자외선 98% 차단 실내 대기', '쾌적한 체온 유지', '도착 3분 전 스마트 출발 알림']
  }
};
