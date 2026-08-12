# 웨이웰 Frontend

노출 부하 기반 웰니스 내비게이션 PWA. Vite + React + TypeScript.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

개발 중에는 목업 모드로 돈다 — `.env.development`의 `VITE_USE_MOCK=true`면 `public/mock/*.json`을 읽고,
아니면 `/api/*`(프록시 → `http://localhost:8000`)로 실 API를 호출한다.

> `.env.development`는 `.gitignore`에 걸려 커밋되지 않는다. 클론 후 없으면 직접 만든다:
> `echo "VITE_USE_MOCK=true" > .env.development`

## 빌드

```bash
npm run build    # tsc + vite build → dist/
npm run preview  # 빌드 결과 미리보기
```

## 구조

```
src/
├─ api/         axios 인스턴스 + 목업 스위치 (client.ts)
├─ components/  공통 (Layout, TabBar)
├─ pages/       화면 SC-01 ~ SC-14
├─ store/       zustand — 게스트 device_id, 프리셋, 토큰 (session.ts)
├─ types/       API 응답 타입 (api.ts, API 명세서와 1:1)
└─ index.css    전역 스타일
public/mock/    목업 JSON (environment / routes.success / report.weekly)
```

## 화면

하단 탭 3개 — 홈(SC-03) / 리포트(SC-09) / 설정(SC-10).
핵심 화면: SC-03 홈, SC-05 경로 비교, SC-09 주간 리포트 (목업 연동됨).
나머지는 스텁 (연동 지점 주석 표시).

## 상태

- [ ] PWA 아이콘 `public/icon-192.png`, `icon-512.png` 추가 (manifest 참조)
- [ ] 목업 나머지 (routes.empty, arrival, shelters, report.empty 등)
- [ ] 스텁 화면 실제 구현
