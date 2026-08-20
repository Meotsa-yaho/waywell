# waywell 가비아 클라우드 배포 런북

> 가비아 제공 사양: **High CPU 2vCore / 4GB / 100GB / 트래픽 1TB / 공인IP 1개**
> 서버 제공 기간: **~8/28(금) 23:59 일괄 삭제** · 기술지원: **~8/21(금) 18:00** (gajet@gabia.com)

구성: 서버 1대에서 Nginx가 프론트 정적파일을 서빙하고 `/api`를 gunicorn으로 프록시.
공인IP가 팀당 1개라 이 구성이 사실상 유일한 선택이고, axios `baseURL`이 `'/api'` 상대경로라
같은 오리진이면 CORS·카카오 도메인 등록이 한 벌로 끝난다.

```
[가비아 VM]  Nginx :443 ──┬─ /        → /opt/waywell/frontend/dist
                          ├─ /api/    → 127.0.0.1:8000 (gunicorn)
                          └─ /static/ → /opt/waywell/server/staticfiles (admin용)
```

---

## 0. 코드 준비 상태

배포에 필요한 서버 설정은 레포에 반영돼 있다(`feat/deploy-config`).

| 항목 | 상태 |
| --- | --- |
| `STATIC_ROOT` (collectstatic 대상) | 반영됨 |
| `CACHES` 파일 기반 (워커 간 캐시 공유) | 반영됨 |
| `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` 빈 값·공백 방어 | 반영됨 |
| `server/.env` | **서버에서 직접 작성** (6단계) |
| `frontend/.env.production` | **서버에서 직접 작성** (8단계) |

`.env` 두 개는 `.gitignore` 대상이라 레포에 없다. 서버에서 만들어야 한다.

## 1. 서버 생성 (관리 콘솔)

- **컴퓨팅 → 서버 → 서버 생성**
- OS: **Ubuntu** (Rocky도 가능하나 아래 명령은 Ubuntu 기준). 가능하면 **24.04** — Django 6.1이 Python 3.12+ 요구
- 서버 타입: High CPU / 2vCore / 4GB
- 스토리지: **루트 100GB** (데이터 분리 불필요, 단순한 쪽이 낫다)
- 로그인 방식: **비밀번호 접속 방식** 권장
  → 매뉴얼상 브라우저 터미널은 SSH 키페어로 로그인이 **불가**하고 관리자 비밀번호 발급이 별도로 필요하다
- 네트워크: VPC 생성(사설IP 자동 할당) + **공인IP 1개** 할당

## 2. 보안그룹 (보안 → 보안그룹)

| 포트 | 용도 | 소스 |
| --- | --- | --- |
| 22 | SSH | 가능하면 팀원 IP만 |
| 80 | HTTP (certbot 인증 + HTTPS 리다이렉트) | 0.0.0.0/0 |
| 443 | HTTPS | 0.0.0.0/0 |

**8000번은 절대 열지 않는다.** gunicorn은 `127.0.0.1`에만 바인딩하고 Nginx만 통해서 접근한다.

## 3. 첫 접속

콘솔 → 서버 선택 → **브라우저 터미널로 접속**. 계정 `root`, 비밀번호는
"[가비아클라우드] 서버가 생성되었습니다" 메일에 있다.

> 터미널 창을 닫아도 세션은 안 끊긴다. 작업 끝나면 반드시 `exit`.
> **Ctrl+Alt+Del 금지** — 로그아웃이 아니라 재부팅/종료로 이어진다.

이후 작업은 로컬 PC에서 `ssh root@공인IP`로 붙는 게 편하다(복붙이 자유롭다).

### 브라우저 콘솔의 붙여넣기 제약

가비아 브라우저 터미널은 긴 줄을 붙여넣으면 **뒤가 잘리고**, 역슬래시가 `|`로 들어간다.
배포 중 이 두 가지로 gunicorn이 두 번 실패했다.

- 긴 파일(`.env`, nginx 설정)은 `nano`로 열어 붙여넣는다. 셸 명령보다 안전하다
- 붙여넣은 뒤 반드시 확인한다:
  `awk -F= 'NF>1 {print $1": "length($2)}' .env` (값 길이) / `cat 파일` (잘림·`|` 확인)
- 가능하면 로컬 PC에서 `ssh root@공인IP`로 접속해 작업한다. 붙여넣기가 정상 동작한다

## 4. 기본 패키지

```bash
apt update && apt -y upgrade
apt -y install python3-venv python3-pip nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt -y install nodejs
python3 --version   # 3.12 이상인지 확인. 3.10~3.11이면 아래 deadsnakes 필요
```

Python이 3.12 미만일 때만:

```bash
add-apt-repository -y ppa:deadsnakes/ppa && apt update && apt -y install python3.12 python3.12-venv
```

## 5. 코드 받기 (비공개 레포 → deploy key)

```bash
ssh-keygen -t ed25519 -C "waywell-deploy" -f /root/.ssh/id_ed25519 -N ""
cat /root/.ssh/id_ed25519.pub
```

출력된 공개키를 GitHub 레포 **Settings → Deploy keys → Add deploy key** 에 등록(쓰기 권한 불필요).

```bash
git clone git@github.com:Meotsa-yaho/waywell.git /opt/waywell
```

## 6. 백엔드

```bash
cd /opt/waywell/server
python3 -m venv venv
venv/bin/pip install -r requirements-prod.txt   # requirements.txt + gunicorn
```

`.env` 작성 (`nano /opt/waywell/server/.env`) — 로컬 `.env`에서 값을 옮기되 아래 4개는 **반드시 다르게**:

```
DEBUG=False
ALLOWED_HOSTS=배포도메인,공인IP
CORS_ALLOWED_ORIGINS=https://배포도메인
ODSAY_REFERER=https://배포도메인
# SECURE_HTTPS=True   ← 10단계(HTTPS 발급)까지 끝낸 뒤에 주석 해제
```

나머지(카카오·Tmap·ODsay·data.go.kr·OPENAI_API_KEY)는 로컬과 동일. 권한을 잠근다:

```bash
chmod 600 /opt/waywell/server/.env
venv/bin/python manage.py migrate
venv/bin/python manage.py collectstatic --noinput
```

## 7. gunicorn systemd

```bash
useradd -r -s /usr/sbin/nologin waywell
chown -R waywell:www-data /opt/waywell/server
```

`/etc/systemd/system/waywell.service`:

```ini
[Unit]
Description=waywell gunicorn
After=network.target

[Service]
User=waywell
Group=www-data
WorkingDirectory=/opt/waywell/server
ExecStart=/opt/waywell/server/venv/bin/gunicorn config.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

- `WorkingDirectory`가 `server/`여야 두 가지가 동작한다: `load_dotenv()`의 `.env` 탐색,
  그리고 gunicorn이 `server/gunicorn.conf.py`(bind·workers·timeout)를 자동으로 읽는 것
- **옵션을 ExecStart에 늘어놓지 말 것.** 가비아 브라우저 콘솔은 긴 줄을 붙여넣을 때 뒤를 잘라먹고,
  줄바꿈용 역슬래시가 `|`로 들어간다. 실제로 `--bind` 뒤가 잘려 기동이 두 번 실패했다
- 워커 3개 → `CACHES` 설정이 없으면 캐시가 3벌로 쪼개진다

```bash
systemctl daemon-reload && systemctl enable --now waywell
systemctl status waywell --no-pager
curl -s localhost:8000/api/health/     # {"success": true} 나오면 성공
```

## 8. 프론트 빌드

```bash
cd /opt/waywell/frontend
cat > .env.production << 'EOF'
VITE_USE_MOCK=false
VITE_KAKAO_JS_KEY=(카카오 JavaScript 키)
VITE_KAKAO_REST_KEY=(카카오 REST API 키 — 서버 KAKAO_REST_API_KEY와 동일)
EOF
npm ci && npm run build      # → frontend/dist
```

**`.env.development`가 아니라 `.env.production`이다.** Vite는 `npm run build` 시 production 모드로
동작해서 `.env.development`를 읽지 않는다. 빼먹으면 키가 `undefined`로 박혀서
배포판에서만 지도와 카카오 로그인이 조용히 죽는다.

## 9. Nginx

`/etc/nginx/sites-available/waywell`:

```nginx
server {
    listen 80;
    server_name 배포도메인;   # certbot이 이 값으로 블록을 찾는다. `_`(와일드카드)면
                             # "Could not automatically find a matching server block" 로 실패한다

    root /opt/waywell/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # SECURE_HTTPS=True가 이걸 본다
        proxy_read_timeout 90s;                       # 외부 API 지연 대비
    }

    location /static/ { alias /opt/waywell/server/staticfiles/; }

    location = /sw.js { add_header Cache-Control "no-cache"; }   # PWA 갱신 반영
    location / { try_files $uri $uri/ /index.html; }             # SPA 라우팅
}
```

```bash
ln -s /etc/nginx/sites-available/waywell /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 10. 도메인 + HTTPS (건너뛸 수 없음)

PWA 서비스워커와 위치 권한(geolocation)은 **HTTPS에서만** 동작한다.
IP로만 띄우면 홈 화면 설치도, "현재 위치"도, 카카오 로그인도 막힌다.

1. 가비아 DNS에서 **A레코드 → 공인IP** (호스트에 서브도메인만, 값에 IP만)
   - 저장 즉시 권한 네임서버에 반영된다. 전파를 기다릴 필요 없다:
     `nslookup 배포도메인 ns.gabia.co.kr`
   - 레코드 없이 certbot을 돌리면 `NXDOMAIN`으로 실패한다
2. 위 9단계의 `server_name`이 `_`가 아니라 실제 도메인인지 먼저 확인
3. 인증서 발급:

```bash
apt -y install certbot python3-certbot-nginx
certbot --nginx -d 배포도메인
```

4. `.env`의 `ALLOWED_HOSTS`·`CORS_ALLOWED_ORIGINS`를 도메인으로 바꾸고
   `SECURE_HTTPS=True` 주석 해제 → `systemctl restart waywell`
   - `ALLOWED_HOSTS`를 안 고치면 **API가 전부 400**을 낸다(화면은 뜨는데 데이터가 없다)
   - 확인: `curl -sI https://배포도메인/api/health/ | grep -i strict-transport`

## 11. 외부 콘솔에 배포 도메인 등록

로컬에서 되던 게 배포에서 깨지는 가장 흔한 원인이다.

- **카카오** — 플랫폼 Web 사이트 도메인에 `https://배포도메인` 추가, 카카오 로그인 Redirect URI에
  `https://배포도메인/auth/kakao/callback` 추가 (안 하면 지도·로컬 API 403, 로그인 실패)
  - 콘솔에서 **Client Secret '사용함'** 을 켰다면 `server/.env`의 `KAKAO_CLIENT_SECRET`이 **필수**다.
    비워두면 로그인 화면까지는 가고 돌아오는 순간 토큰 교환이 실패한다.
    확인: `journalctl -u waywell | grep -i "kakao token exchange failed"`
  - 카카오맵 **서비스 활성화(ON)** 는 사이트 도메인 등록과 별개 스위치다
- **ODsay** — 대시보드 Service URI에 배포 도메인 등록 (안 하면 `ApiKeyAuthFailed`)
- **Tmap** — 별도 도메인 등록은 없으나 무료 쿼터 429 시 ODsay로 자동 폴백

## 12. 배포 확인 체크리스트

```bash
curl -s https://배포도메인/api/health/                       # {"success": true}
curl -s "https://배포도메인/api/environment?lat=37.5&lng=127.0" | head -c 300   # uv·pm10이 null이 아닌지
```

브라우저에서:
- [ ] 지도가 뜨는가 (카카오 JS 키 + 도메인 등록)
- [ ] 경로 검색이 되는가 (Tmap/ODsay)
- [ ] 경로 카드에 LLM 코멘트가 뜨는가 (`/api/routes/explain`)
- [ ] 주소창에 설치 아이콘이 뜨는가 (PWA, HTTPS 필수)
- [ ] 카카오 로그인이 되는가 (Redirect URI)

## 13. 백업 — 8/28 삭제 전 필수

서버는 **8/28(금) 23:59에 일괄 삭제**된다. 이동 기록(리포트 데이터)은 SQLite 파일 하나에 있다.

```bash
tar czf /root/waywell-backup-$(date +%F).tar.gz \
    /opt/waywell/server/db.sqlite3 /opt/waywell/server/.env
```

로컬 PC에서 내려받기:

```bash
scp root@공인IP:/root/waywell-backup-*.tar.gz .
```

계속 쓰려면 **8/27(목)까지** 가비아ID와 클라우드ID를 멋사 운영진에 전달해야 서버가 유지된다
(이후에는 등록된 결제수단으로 과금 — 30만원 크레딧 이벤트로 상쇄 가능).

---

## 자주 나는 문제

| 증상 | 원인 |
| --- | --- |
| 502 Bad Gateway | gunicorn이 죽음 → `journalctl -u waywell -n 50` |
| admin CSS 깨짐 | `STATIC_ROOT` 미설정 또는 `collectstatic` 안 함 |
| 지도 안 뜸 / 로그인 실패 | `.env.production` 누락, 또는 카카오 콘솔에 도메인 미등록 |
| 자외선·미세먼지 null | data.go.kr 서비스별 활용신청 미승인, 또는 429 (잠시 후 회복) |
| LLM 코멘트가 늘 템플릿 톤 | `OPENAI_API_KEY` 미설정 → 응답의 `generated_by` 확인 |
| 경로 조회 타임아웃 | Nginx `proxy_read_timeout`·gunicorn `--timeout`을 90s로 |
